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

function RoutePathViz({
  path,
  label,
  color,
}: {
  path:  number[];
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
          <Text style={{ fontSize: 11, color: '#8c8c8c' }}>+{rest} ещё</Text>
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
    if (!warehouseId) { setError('Введите ID склада'); return; }
    const skuIds = parseSkuIds();
    if (skuIds.length === 0) { setError('Введите хотя бы один ID артикула'); return; }

    setLoading(true);
    setError(null);
    try {
      const optimRes = await api.optimizeRoute({ warehouseId, skuIds, cartCapacityKg: cartCap });
      const currentSlots: Record<number, number>  = {};
      const proposedSlots: Record<number, number> = {};

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
      setError(e instanceof Error ? e.message : 'Ошибка оптимизации маршрута');
    } finally {
      setLoading(false);
    }
  };

  const runOptimize = async () => {
    if (!warehouseId) { setError('Введите ID склада'); return; }
    const skuIds = parseSkuIds();
    if (skuIds.length === 0) { setError('Введите хотя бы один ID артикула'); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await api.optimizeRoute({ warehouseId, skuIds, cartCapacityKg: cartCap });
      setResult({
        currentDistanceM:  res.data.totalDistanceM,
        proposedDistanceM: res.data.totalDistanceM,
        savingsM:          0,
        savingsPct:        0,
        currentRoute:      res.data,
        proposedRoute:     res.data,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка оптимизации маршрута');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 16px' }}>
      <Title level={3} style={{ marginBottom: 4 }}>Оптимизатор маршрута</Title>
      <Paragraph type="secondary" style={{ marginBottom: 32 }}>
        Оптимизация маршрутов сборки методом TSP — точный алгоритм для ≤10 остановок,
        ближайший сосед + 2-opt для больших списков.
      </Paragraph>

      <Card title="Параметры" style={{ marginBottom: 24 }}>
        <Form layout="vertical">
          <Row gutter={24}>
            <Col span={6}>
              <Form.Item label="ID склада" style={{ marginBottom: 0 }}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  placeholder="например 1"
                  value={warehouseId ?? undefined}
                  onChange={v => setWarehouseId(v ?? null)}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Грузоподъёмность тележки (кг)" style={{ marginBottom: 0 }}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="0 = без ограничений"
                  value={cartCap}
                  onChange={v => setCartCap(v ?? 0)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="ID артикулов (через запятую или пробел)" style={{ marginBottom: 0 }}>
                <Input
                  placeholder="например 1, 2, 5, 12, 30"
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
                Оптимизировать маршрут
              </Button>
              <Button
                icon={<EnvironmentOutlined />}
                loading={loading}
                onClick={runCompare}
              >
                Сравнить до / после
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
                  title="Текущее расстояние"
                  value={result.currentDistanceM.toFixed(1)}
                  suffix="м"
                  valueStyle={{ color: '#DC2626' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Новое расстояние"
                  value={result.proposedDistanceM.toFixed(1)}
                  suffix="м"
                  valueStyle={{ color: '#16A34A' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Экономия"
                  value={result.savingsM.toFixed(1)}
                  suffix="м"
                  prefix={result.savingsM > 0 ? '↓' : ''}
                  valueStyle={{ color: result.savingsM > 0 ? '#16A34A' : '#595959' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Улучшение"
                  value={result.savingsPct.toFixed(1)}
                  suffix="%"
                  valueStyle={{ color: result.savingsPct > 0 ? '#16A34A' : '#595959' }}
                />
              </Card>
            </Col>
          </Row>

          <Card title="Детали маршрута">
            <Row gutter={32}>
              <Col span={12}>
                <RoutePathViz
                  path={result.currentRoute.fullPath}
                  label={`Текущий маршрут — ${result.currentDistanceM.toFixed(1)} м, ${result.currentRoute.tripCount} рейс(а)`}
                  color="#DC2626"
                />
              </Col>
              <Col span={12}>
                <RoutePathViz
                  path={result.proposedRoute.fullPath}
                  label={`Предложенный маршрут — ${result.proposedDistanceM.toFixed(1)} м, ${result.proposedRoute.tripCount} рейс(а)`}
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
