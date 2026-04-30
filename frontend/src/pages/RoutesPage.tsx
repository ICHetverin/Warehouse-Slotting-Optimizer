import { useState } from 'react';
import {
  Alert, Button, Card, Col, Form, InputNumber,
  Row, Space, Statistic, Tag, Typography, Input,
} from 'antd';
import {
  ArrowRightOutlined, EnvironmentOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { api } from '../api/client';
import type { RouteComparison } from '../types';

const { Title, Paragraph, Text } = Typography;

function DistanceBadge({ value, color }: { value: number; color?: string }) {
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', color: color ?? 'inherit' }}>
      {value.toFixed(1)} m
    </span>
  );
}

function RoutePathViz({
  path,
  label,
  color,
}: {
  path: number[];
  label: string;
  color: string;
}) {
  const preview = path.slice(0, 12);
  const rest    = path.length - 12;

  return (
    <div>
      <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 6 }}>
        {label}
      </Text>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        {preview.map((id, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tag
              color={id === 0 ? 'blue' : undefined}
              style={{
                margin: 0,
                fontSize: 11,
                borderColor: color,
                color: id === 0 ? undefined : color,
              }}
            >
              {id === 0 ? 'DOCK' : `#${id}`}
            </Tag>
            {i < preview.length - 1 && (
              <ArrowRightOutlined style={{ fontSize: 10, color: '#d1d5db' }} />
            )}
          </span>
        ))}
        {rest > 0 && (
          <Text style={{ fontSize: 11, color: '#8c8c8c' }}>+{rest} more</Text>
        )}
      </div>
    </div>
  );
}

export function RoutesPage() {
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [skuInput, setSkuInput]       = useState('');
  const [cartCap, setCartCap]         = useState<number>(50);
  const [result, setResult]           = useState<RouteComparison | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const parseSkuIds = (): number[] =>
    skuInput
      .split(/[\s,]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0);

  const runCompare = async () => {
    if (!warehouseId) { setError('Enter a warehouse ID'); return; }
    const skuIds = parseSkuIds();
    if (skuIds.length === 0) { setError('Enter at least one SKU ID'); return; }

    setLoading(true);
    setError(null);
    try {
      // Use current and proposed as the same list (demo: compare optimised vs sequential)
      const optimRes = await api.optimizeRoute({ warehouseId, skuIds, cartCapacityKg: cartCap });
      const currentSlots: Record<number, number> = {};
      const proposedSlots: Record<number, number> = {};

      // For demo: current = skuIds in order given, proposed = optimised order
      skuIds.forEach((id, i) => { currentSlots[id] = i + 1; });
      optimRes.data.orderedSlotIds.forEach((slotId, i) => {
        const skuId = skuIds[i] ?? skuIds[0];
        proposedSlots[skuId] = slotId;
      });

      const compareRes = await api.compareRoutes({
        warehouseId,
        skuIds,
        currentSlots,
        proposedSlots,
        cartCapacityKg: cartCap,
      });
      setResult(compareRes.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Route optimisation failed');
    } finally {
      setLoading(false);
    }
  };

  const runOptimize = async () => {
    if (!warehouseId) { setError('Enter a warehouse ID'); return; }
    const skuIds = parseSkuIds();
    if (skuIds.length === 0) { setError('Enter at least one SKU ID'); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await api.optimizeRoute({ warehouseId, skuIds, cartCapacityKg: cartCap });
      // Show as a "comparison" with itself for layout consistency
      setResult({
        currentDistanceM:  res.data.totalDistanceM,
        proposedDistanceM: res.data.totalDistanceM,
        savingsM:          0,
        savingsPct:        0,
        currentRoute:      res.data,
        proposedRoute:     res.data,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Route optimisation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 16px' }}>
      <Title level={3} style={{ marginBottom: 4 }}>Route Optimizer</Title>
      <Paragraph type="secondary" style={{ marginBottom: 32 }}>
        Optimise pick routes using TSP (exact for ≤ 10 stops, nearest-neighbour + 2-opt for larger lists).
      </Paragraph>

      <Card title="Parameters" style={{ marginBottom: 24 }}>
        <Form layout="vertical">
          <Row gutter={24}>
            <Col span={6}>
              <Form.Item label="Warehouse ID" style={{ marginBottom: 0 }}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  placeholder="e.g. 1"
                  value={warehouseId ?? undefined}
                  onChange={v => setWarehouseId(v ?? null)}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Cart Capacity (kg)" style={{ marginBottom: 0 }}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="0 = unlimited"
                  value={cartCap}
                  onChange={v => setCartCap(v ?? 0)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="SKU IDs (comma or space separated)" style={{ marginBottom: 0 }}>
                <Input
                  placeholder="e.g. 1, 2, 5, 12, 30"
                  value={skuInput}
                  onChange={e => setSkuInput(e.target.value)}
                />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ marginTop: 16 }}>
            <Space>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                loading={loading}
                onClick={runOptimize}
              >
                Optimize Route
              </Button>
              <Button
                icon={<EnvironmentOutlined />}
                loading={loading}
                onClick={runCompare}
              >
                Compare Before / After
              </Button>
            </Space>
          </div>
        </Form>
      </Card>

      {error && (
        <Alert
          type="error"
          message={error}
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {result && !loading && (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Current Distance"
                  value={result.currentDistanceM.toFixed(1)}
                  suffix="m"
                  valueStyle={{ color: '#DC2626' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Proposed Distance"
                  value={result.proposedDistanceM.toFixed(1)}
                  suffix="m"
                  valueStyle={{ color: '#16A34A' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Savings"
                  value={result.savingsM.toFixed(1)}
                  suffix="m"
                  prefix={result.savingsM > 0 ? '↓' : ''}
                  valueStyle={{ color: result.savingsM > 0 ? '#16A34A' : '#595959' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Improvement"
                  value={result.savingsPct.toFixed(1)}
                  suffix="%"
                  valueStyle={{ color: result.savingsPct > 0 ? '#16A34A' : '#595959' }}
                />
              </Card>
            </Col>
          </Row>

          <Card title="Route Detail">
            <Row gutter={32}>
              <Col span={12}>
                <RoutePathViz
                  path={result.currentRoute.fullPath}
                  label={`Current Route — ${result.currentDistanceM.toFixed(1)} m, ${result.currentRoute.tripCount} trip(s)`}
                  color="#DC2626"
                />
              </Col>
              <Col span={12}>
                <RoutePathViz
                  path={result.proposedRoute.fullPath}
                  label={`Proposed Route — ${result.proposedDistanceM.toFixed(1)} m, ${result.proposedRoute.tripCount} trip(s)`}
                  color="#16A34A"
                />
              </Col>
            </Row>
          </Card>
        </>
      )}
    </div>
  );
}
