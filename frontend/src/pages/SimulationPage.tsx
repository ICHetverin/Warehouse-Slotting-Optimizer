import { useState } from 'react';
import { App, Button, Col, InputNumber, Row, Space, Spin, Typography } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { StatCard } from '../components/common/StatCard';
import { EmptyState } from '../components/common/EmptyState';
import { RequireWarehouse } from '../components/common/RequireWarehouse';
import { api } from '../api/client';
import type { SimulationResult } from '../types';
import { tokens } from '../theme';

function fmtDuration(iso: string): string {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/.exec(iso);
  if (!m) return iso;
  const [, h, min] = m;
  if (h && Number(h) > 0) return `${h} ч ${min ?? 0} мин`;
  if (min && Number(min) > 0) return `${min} мин`;
  return '< 1 мин';
}

function SimBody({ warehouseId }: { warehouseId: number }) {
  const { message } = App.useApp();
  const [sampleSize, setSampleSize] = useState(150);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const scoring = await api.runScoring({ warehouseId, velocityDays: 1200 });
      const proposed: Record<number, number> = {};
      for (const a of scoring.assignments) {
        if (a.fromSlotId !== a.toSlotId) proposed[a.skuId] = a.toSlotId;
      }
      const res = await api.simulate({ warehouseId, proposedAssignments: proposed, sampleSize });
      setResult(res);
      message.success('Симуляция завершена');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Симуляция не удалась');
    } finally {
      setLoading(false);
    }
  };

  const distData = result
    ? [
        { name: 'Текущий', value: result.totalBeforeDistanceM },
        { name: 'Предложенный', value: result.totalAfterDistanceM },
      ]
    : [];
  const breakdown = result
    ? [
        { name: 'Короче', value: result.improvedOrders, color: tokens.success },
        { name: 'Без изм.', value: result.sameOrders, color: tokens.textTertiary },
        { name: 'Длиннее', value: result.worsenedOrders, color: tokens.error },
      ]
    : [];

  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      <SectionCard title="Параметры" description="Прогон исторических заказов на текущем и предложенном (по скорингу) размещении.">
        <Row gutter={16} align="bottom">
          <Col xs={12} md={6}>
            <Typography.Text style={{ fontSize: 13 }}>Размер выборки заказов</Typography.Text>
            <InputNumber min={10} max={2000} value={sampleSize} onChange={v => setSampleSize(v ?? 100)} style={{ width: '100%', marginTop: 6 }} />
          </Col>
          <Col xs={12} md={6}>
            <Button type="primary" icon={<PlayCircleOutlined />} loading={loading} onClick={run} block>
              Запустить симуляцию
            </Button>
          </Col>
        </Row>
      </SectionCard>

      {loading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: tokens.textTertiary, fontSize: 13 }}>Проигрываем заказы…</div>
        </div>
      )}

      {result && !loading && (
        <>
          <Row gutter={16}>
            <Col xs={12} md={6}><StatCard label="Заказов в выборке" value={result.ordersSampled} tone="primary" /></Col>
            <Col xs={12} md={6}><StatCard label="Экономия пути" value={result.savingsM.toFixed(0)} suffix="м" tone="success" /></Col>
            <Col xs={12} md={6}><StatCard label="Улучшение" value={result.savingsPct.toFixed(1)} suffix="%" tone={result.savingsPct > 0 ? 'success' : 'default'} /></Col>
            <Col xs={12} md={6}><StatCard label="Экономия времени" value={fmtDuration(result.totalBeforeTime)} hint={`было → ${fmtDuration(result.totalAfterTime)}`} /></Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={14}>
              <SectionCard title="Суммарная дистанция: до и после">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={distData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={tokens.borderSoft} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: tokens.textSecondary }} />
                    <YAxis tick={{ fontSize: 11, fill: tokens.textTertiary }} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(0)} м`, 'Дистанция']} contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${tokens.border}` }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                      <Cell fill={tokens.error} />
                      <Cell fill={tokens.success} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </Col>
            <Col xs={24} md={10}>
              <SectionCard title="Как изменились маршруты" description={`Всего отборов: ${result.totalPicks.toLocaleString()}`}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={breakdown} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={tokens.borderSoft} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: tokens.textSecondary }} />
                    <YAxis tick={{ fontSize: 11, fill: tokens.textTertiary }} allowDecimals={false} />
                    <Tooltip formatter={(v: number) => [`${v} заказов`, '']} contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${tokens.border}` }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                      {breakdown.map((b, i) => <Cell key={i} fill={b.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </Col>
          </Row>
        </>
      )}

      {!result && !loading && (
        <SectionCard>
          <EmptyState
            icon={<PlayCircleOutlined />}
            title="Оцените реальную экономию"
            description="Симуляция проигрывает историю заказов на текущем и предложенном размещении и показывает, сколько метров и времени экономит перестановка."
          />
        </SectionCard>
      )}
    </Space>
  );
}

export function SimulationPage() {
  return (
    <PageContainer>
      <PageHeader
        icon={<PlayCircleOutlined />}
        title="Симуляция «что если»"
        description="Прогон исторических заказов на предложенном размещении — честная оценка экономии до внедрения."
      />
      <RequireWarehouse>{warehouseId => <SimBody warehouseId={warehouseId} />}</RequireWarehouse>
    </PageContainer>
  );
}
