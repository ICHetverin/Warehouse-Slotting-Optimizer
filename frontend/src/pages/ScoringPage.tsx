import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  App, Button, Col, Row, Space, Table, Tag, Typography,
} from 'antd';
import { PlayCircleOutlined, ReloadOutlined, SlidersOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { StatCard } from '../components/common/StatCard';
import { RequireWarehouse } from '../components/common/RequireWarehouse';
import { WeightSliders } from '../components/common/WeightSliders';
import { AnalysisWindowControl } from '../components/common/AnalysisWindowControl';
import { useAsync } from '../hooks/useAsync';
import { useWeights } from '../app/WeightsContext';
import { api } from '../api/client';
import type { Assignment, ScoringRunResponse } from '../types';
import { tokens } from '../theme';

type AbcXyz = { abcClass: string; xyzClass: string };

const ABC_COLOR: Record<string, string> = { A: 'blue', B: 'cyan', C: 'default' };
const XYZ_COLOR: Record<string, string> = { X: 'green', Y: 'gold', Z: 'red' };

function buildColumns(abcXyzMap: Map<number, AbcXyz>): ColumnsType<Assignment> {
  return [
    { title: 'SKU', dataIndex: 'skuCode', sorter: (a, b) => a.skuCode.localeCompare(b.skuCode), width: 120 },
    {
      title: 'ABC', width: 70, align: 'center',
      render: (_, r) => {
        const cls = abcXyzMap.get(r.skuId)?.abcClass;
        return cls ? <Tag color={ABC_COLOR[cls] ?? 'default'}>{cls}</Tag> : <Typography.Text type="secondary">—</Typography.Text>;
      },
    },
    {
      title: 'XYZ', width: 70, align: 'center',
      render: (_, r) => {
        const cls = abcXyzMap.get(r.skuId)?.xyzClass;
        return cls ? <Tag color={XYZ_COLOR[cls] ?? 'default'}>{cls}</Tag> : <Typography.Text type="secondary">—</Typography.Text>;
      },
    },
    { title: 'Откуда', dataIndex: 'fromLabel', width: 110, render: v => v ?? <Typography.Text type="secondary">—</Typography.Text> },
    { title: 'Куда', dataIndex: 'toLabel', width: 110 },
    { title: 'Скор', dataIndex: 'score', width: 90, align: 'right', sorter: (a, b) => a.score - b.score, render: v => v.toFixed(3) },
    {
      title: 'Δ', dataIndex: 'scoreDelta', width: 100, align: 'right',
      sorter: (a, b) => a.scoreDelta - b.scoreDelta, defaultSortOrder: 'descend',
      render: (v: number) => (
        <Tag color={v > 0 ? 'success' : v < 0 ? 'error' : 'default'}>
          {v > 0 ? '+' : ''}{v.toFixed(3)}
        </Tag>
      ),
    },
  ];
}

function DeltaHistogram({ assignments }: { assignments: Assignment[] }) {
  const bins = useMemo(() => {
    const deltas = assignments.map(a => a.scoreDelta);
    if (!deltas.length) return [];
    const min = Math.min(...deltas);
    const max = Math.max(...deltas);
    const n = 12;
    const span = max - min || 1;
    const step = span / n;
    const buckets = Array.from({ length: n }, (_, i) => ({
      mid: min + step * (i + 0.5),
      label: (min + step * (i + 0.5)).toFixed(2),
      count: 0,
    }));
    for (const d of deltas) {
      const idx = Math.min(n - 1, Math.floor((d - min) / step));
      buckets[idx].count++;
    }
    return buckets;
  }, [assignments]);

  if (!bins.length) return null;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={bins} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={tokens.borderSoft} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: tokens.textTertiary }} interval={1} />
        <YAxis tick={{ fontSize: 11, fill: tokens.textTertiary }} allowDecimals={false} />
        <Tooltip
          formatter={(v: number) => [`${v} SKU`, 'Количество']}
          labelFormatter={l => `Δ ≈ ${l}`}
          contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${tokens.border}` }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {bins.map((b, i) => (
            <Cell key={i} fill={b.mid > 0 ? tokens.success : b.mid < 0 ? tokens.error : tokens.textTertiary} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ScoringPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { weights, setWeights } = useWeights();
  const [days, setDays] = useState(1200);
  const [abcXyzMap, setAbcXyzMap] = useState<Map<number, AbcXyz>>(new Map());
  const scoring = useAsync<ScoringRunResponse, [number]>(async (warehouseId: number) => {
    await api.validateWeights(weights); // server-side weight validation (PATCH /scoring/weights)
    const res = await api.runScoring({ warehouseId, weights, velocityDays: days });
    try {
      const { profiles } = await api.getAbcXyz(warehouseId, days);
      setAbcXyzMap(new Map(profiles.map(p => [p.skuId, { abcClass: p.abcClass, xyzClass: p.xyzClass }])));
    } catch {
      setAbcXyzMap(new Map());
    }
    return res;
  });

  const reload = async (jobId: string) => {
    const res = await api.getScoringResult(jobId).catch(() => null);
    if (res) { scoring.setData(res); message.success('Результат перезагружен по jobId'); }
  };

  const result = scoring.data;
  const columns = useMemo(() => buildColumns(abcXyzMap), [abcXyzMap]);

  return (
    <PageContainer>
      <PageHeader
        icon={<SlidersOutlined />}
        title="Скоринг размещения"
        description={
          <>
            Жадный алгоритм переставляет товары по ячейкам. Подберите веса и окно анализа, затем нажмите
            «Запустить». Формула:{' '}
            <Typography.Text code>score = w1·velocity·distance + w2·copick + w3·fit</Typography.Text>.
          </>
        }
      />
      <RequireWarehouse>
        {warehouseId => (
          <Space orientation="vertical" size={20} style={{ width: '100%' }}>
            <SectionCard title="Параметры" description="Веса определяют, что важнее при размещении.">
              <Row gutter={[24, 16]}>
                <Col xs={24} md={14}>
                  <WeightSliders value={weights} onChange={setWeights} disabled={scoring.loading} />
                </Col>
                <Col xs={24} md={10}>
                  <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                    <AnalysisWindowControl value={days} onChange={setDays} disabled={scoring.loading} />
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      loading={scoring.loading}
                      onClick={() => scoring.run(warehouseId)}
                    >
                      Запустить скоринг
                    </Button>
                  </Space>
                </Col>
              </Row>
            </SectionCard>

            {scoring.error && (
              <SectionCard><Typography.Text type="danger">{scoring.error}</Typography.Text></SectionCard>
            )}

            {result && (
              <>
                <Row gutter={16}>
                  <Col xs={12} md={6}><StatCard label="Назначений" value={result.totalAssignments} /></Col>
                  <Col xs={12} md={6}>
                    <StatCard label="Улучшено" value={result.improved} suffix={`/ ${result.totalAssignments}`} tone="success" />
                  </Col>
                  {result.validation && (
                    <Col xs={12} md={6}>
                      <StatCard
                        label="WAPE прогноза"
                        value={result.validation.forecastWape.toFixed(1)}
                        suffix="%"
                        tone={result.validation.forecastWape < 30 ? 'success' : result.validation.forecastWape < 50 ? 'warning' : 'error'}
                        hint="ошибка прогноза (меньше — лучше)"
                      />
                    </Col>
                  )}
                  {result.validation && (
                    <Col xs={12} md={6}>
                      <StatCard
                        label="Стабильность"
                        value={result.validation.placementStabilityPct.toFixed(1)}
                        suffix="%"
                        tone={result.validation.placementStabilityPct >= 80 ? 'success' : 'default'}
                      />
                    </Col>
                  )}
                  {result.validation && (
                    <Col xs={12} md={6}>
                      <StatCard
                        label="Эффективность маршрута"
                        value={result.validation.routeEfficiencyGainPct.toFixed(1)}
                        suffix="%"
                        hint={`CI [${result.validation.routeEfficiencyCiLowPct.toFixed(1)}; ${result.validation.routeEfficiencyCiHighPct.toFixed(1)}]%`}
                        tone={result.validation.routeEfficiencyCiLowPct > 0 ? 'success' : 'default'}
                      />
                    </Col>
                  )}
                </Row>

                <SectionCard
                  title="Распределение прироста скора (Δ)"
                  description="Сколько SKU выигрывают (зелёные) и проигрывают (красные) от пересортировки."
                >
                  <DeltaHistogram assignments={result.assignments} />
                </SectionCard>

                <SectionCard
                  title={`Назначения (${result.assignments.length})`}
                  extra={
                    <Space>
                      <Button size="small" icon={<ReloadOutlined />} onClick={() => reload(result.jobId)}>
                        Перезагрузить по jobId
                      </Button>
                      <Button size="small" type="primary" onClick={() => navigate('/recommendations')}>
                        К рекомендациям
                      </Button>
                    </Space>
                  }
                >
                  <Table<Assignment>
                    dataSource={result.assignments}
                    columns={columns}
                    rowKey="skuId"
                    size="small"
                    pagination={{ pageSize: 20, showSizeChanger: false }}
                    scroll={{ x: 700 }}
                  />
                </SectionCard>
              </>
            )}
          </Space>
        )}
      </RequireWarehouse>
    </PageContainer>
  );
}
