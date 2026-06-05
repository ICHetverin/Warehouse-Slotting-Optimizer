import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Col, Row, Select, Space, Spin, Typography } from 'antd';
import { ExperimentOutlined, ThunderboltOutlined } from '@ant-design/icons';
import {
  CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { StatCard } from '../components/common/StatCard';
import { EmptyState } from '../components/common/EmptyState';
import { AnalysisWindowControl } from '../components/common/AnalysisWindowControl';
import { RequireWarehouse } from '../components/common/RequireWarehouse';
import { useWeights } from '../app/WeightsContext';
import { useAsync } from '../hooks/useAsync';
import { heatColor } from '../components/common/HeatmapLegend';
import { api } from '../api/client';
import type { TuningResult } from '../types';
import { tokens } from '../theme';

const METRICS = [
  { value: 'routeEfficiency', label: 'Эффективность маршрута' },
  { value: 'stability', label: 'Стабильность размещения' },
  { value: 'composite', label: 'Композитная метрика' },
];

function TuningBody({ warehouseId }: { warehouseId: number }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { setWeights } = useWeights();
  const [metric, setMetric] = useState('routeEfficiency');
  const [days, setDays] = useState(1200);
  const [gridStep, setGridStep] = useState(0.25);
  const [applying, setApplying] = useState(false);

  const tuning = useAsync<TuningResult, []>(() =>
    api.tune({ warehouseId, metricToOpt: metric, sampleDays: days, gridStep }),
  );
  const result = tuning.data;

  const points = useMemo(() => {
    if (!result) return [];
    const metrics = result.scoreGrid.map(p => p.metric);
    const min = Math.min(...metrics);
    const max = Math.max(...metrics);
    const span = max - min || 1;
    return result.scoreGrid.map(p => ({ ...p, norm: (p.metric - min) / span }));
  }, [result]);

  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      <SectionCard title="Параметры подбора" description="Перебор комбинаций весов по сетке. При мелком шаге расчёт может занять время.">
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} md={8}>
            <Typography.Text style={{ fontSize: 13 }}>Оптимизируемая метрика</Typography.Text>
            <Select value={metric} onChange={setMetric} options={METRICS} style={{ width: '100%', marginTop: 6 }} disabled={tuning.loading} />
          </Col>
          <Col xs={12} md={5}>
            <Typography.Text style={{ fontSize: 13 }}>Шаг сетки</Typography.Text>
            <Select
              value={gridStep}
              onChange={setGridStep}
              disabled={tuning.loading}
              style={{ width: '100%', marginTop: 6 }}
              options={[
                { value: 0.5, label: '0.5 · быстро' },
                { value: 0.25, label: '0.25 · баланс' },
                { value: 0.2, label: '0.2' },
                { value: 0.1, label: '0.1 · точно, дольше' },
              ]}
            />
          </Col>
          <Col xs={24} md={7}>
            <AnalysisWindowControl value={days} onChange={setDays} disabled={tuning.loading} />
          </Col>
          <Col xs={24} md={4}>
            <Button type="primary" icon={<ThunderboltOutlined />} loading={tuning.loading} onClick={() => tuning.run()} block>
              Подобрать
            </Button>
          </Col>
        </Row>
      </SectionCard>

      {tuning.loading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: tokens.textTertiary, fontSize: 13 }}>Перебираем комбинации весов…</div>
        </div>
      )}

      {tuning.error && <SectionCard><Typography.Text type="danger">{tuning.error}</Typography.Text></SectionCard>}

      {result && !tuning.loading && (
        <>
          <Row gutter={16}>
            <Col xs={12} md={6}><StatCard label="Лучший w1/w2/w3" value={<span style={{ fontSize: 16 }}>{result.bestWeights.w1.toFixed(2)}/{result.bestWeights.w2.toFixed(2)}/{result.bestWeights.w3.toFixed(2)}</span>} tone="primary" /></Col>
            <Col xs={12} md={6}><StatCard label="Лучшая метрика" value={result.bestMetricValue.toFixed(3)} tone="success" /></Col>
            <Col xs={12} md={6}><StatCard label="Базовая" value={result.baselineValue.toFixed(3)} /></Col>
            <Col xs={12} md={6}><StatCard label="Улучшение" value={result.improvementPct.toFixed(1)} suffix="%" tone={result.improvementPct > 0 ? 'success' : 'default'} /></Col>
          </Row>

          <SectionCard
            title={`Карта перебора (${result.evaluations} комбинаций)`}
            description="Каждая точка — комбинация весов (w1 × w2). Ярче = выше метрика. Зелёная — лучшая."
          >
            <ResponsiveContainer width="100%" height={320}>
              <ScatterChart margin={{ top: 10, right: 16, bottom: 16, left: -8 }}>
                <CartesianGrid stroke={tokens.borderSoft} />
                <XAxis type="number" dataKey="w1" name="w1" domain={[0, 1]} tick={{ fontSize: 11, fill: tokens.textTertiary }} label={{ value: 'w1', position: 'insideBottom', offset: -6, fontSize: 12 }} />
                <YAxis type="number" dataKey="w2" name="w2" domain={[0, 1]} tick={{ fontSize: 11, fill: tokens.textTertiary }} label={{ value: 'w2', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                <ZAxis type="number" dataKey="metric" range={[40, 320]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  formatter={(v: number, n: string) => [typeof v === 'number' ? v.toFixed(3) : v, n]}
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${tokens.border}` }}
                />
                <Scatter data={points} isAnimationActive={false}>
                  {points.map((p, i) => {
                    const isBest = Math.abs(p.metric - result.bestMetricValue) < 1e-9;
                    return <Cell key={i} fill={isBest ? tokens.success : heatColor(p.norm)} />;
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <Space style={{ marginTop: 12 }}>
              <Button
                type="primary"
                loading={applying}
                onClick={async () => {
                  setApplying(true);
                  try {
                    setWeights(result.bestWeights);
                    await api.generateRecommendations({ warehouseId, weights: result.bestWeights });
                    message.success('Веса применены, рекомендации сгенерированы');
                    navigate('/recommendations');
                  } catch (e) {
                    message.error(e instanceof Error ? e.message : 'Не удалось сгенерировать рекомендации');
                  } finally {
                    setApplying(false);
                  }
                }}
              >
                Применить и сгенерировать рекомендации
              </Button>
            </Space>
          </SectionCard>
        </>
      )}

      {!result && !tuning.loading && !tuning.error && (
        <SectionCard>
          <EmptyState
            icon={<ExperimentOutlined />}
            title="Подберите оптимальные веса"
            description="Алгоритм перебирает комбинации w1/w2/w3 по сетке и находит лучшую под выбранную метрику. Нажмите «Подобрать»."
          />
        </SectionCard>
      )}
    </Space>
  );
}

export function TuningPage() {
  return (
    <PageContainer>
      <PageHeader
        icon={<ExperimentOutlined />}
        title="Автотюнинг весов"
        description="Автоматический подбор весов скоринга по сетке для выбранной целевой метрики. Долгая операция — начните с крупного шага."
      />
      <RequireWarehouse>{warehouseId => <TuningBody warehouseId={warehouseId} />}</RequireWarehouse>
    </PageContainer>
  );
}
