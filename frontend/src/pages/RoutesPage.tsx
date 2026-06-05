import { useEffect, useState } from 'react';
import { App, Button, Col, InputNumber, Row, Select, Space, Tag, Typography } from 'antd';
import { ArrowRightOutlined, EnvironmentOutlined, NodeIndexOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { StatCard } from '../components/common/StatCard';
import { EmptyState } from '../components/common/EmptyState';
import { RequireWarehouse } from '../components/common/RequireWarehouse';
import { api } from '../api/client';
import type { Route, RouteComparison, Sku } from '../types';
import { tokens } from '../theme';

function PathViz({ path, label, color }: { path: number[]; label: string; color: string }) {
  const preview = path.slice(0, 16);
  const rest = path.length - preview.length;
  return (
    <div>
      <Typography.Text style={{ fontSize: 12, color: tokens.textSecondary, display: 'block', marginBottom: 6 }}>
        {label}
      </Typography.Text>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        {preview.map((id, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tag color={id === 0 ? 'blue' : undefined} style={{ margin: 0, fontSize: 11, borderColor: color, color: id === 0 ? undefined : color }}>
              {id === 0 ? 'ДОК' : `#${id}`}
            </Tag>
            {i < preview.length - 1 && <ArrowRightOutlined style={{ fontSize: 10, color: tokens.border }} />}
          </span>
        ))}
        {rest > 0 && <Typography.Text style={{ fontSize: 11, color: tokens.textTertiary }}>+{rest}</Typography.Text>}
      </div>
    </div>
  );
}

function RouteTool({ warehouseId }: { warehouseId: number }) {
  const { message } = App.useApp();
  const [skus, setSkus] = useState<Sku[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [cartCap, setCartCap] = useState(50);
  const [route, setRoute] = useState<Route | null>(null);
  const [compare, setCompare] = useState<RouteComparison | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getWarehouseSkus(warehouseId)
      .then(list => { if (alive) { setSkus(list); setPicked(list.slice(0, 6).map(s => s.id)); } })
      .catch(() => {});
    setRoute(null);
    setCompare(null);
    return () => { alive = false; };
  }, [warehouseId]);

  const optimize = async () => {
    if (!picked.length) { message.warning('Выберите хотя бы один SKU'); return; }
    setLoading(true);
    setCompare(null);
    try {
      setRoute(await api.optimizeRoute({ warehouseId, skuIds: picked, cartCapacityKg: cartCap }));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Не удалось построить маршрут');
    } finally {
      setLoading(false);
    }
  };

  const beforeAfter = async () => {
    if (!picked.length) { message.warning('Выберите хотя бы один SKU'); return; }
    setLoading(true);
    setRoute(null);
    try {
      const scoring = await api.runScoring({ warehouseId, velocityDays: 1200 });
      const byId = new Map(scoring.assignments.map(a => [a.skuId, a]));
      const currentSlots: Record<number, number> = {};
      const proposedSlots: Record<number, number> = {};
      const usable: number[] = [];
      for (const id of picked) {
        const a = byId.get(id);
        if (a && a.fromSlotId != null) {
          currentSlots[id] = a.fromSlotId;
          proposedSlots[id] = a.toSlotId;
          usable.push(id);
        }
      }
      if (usable.length < 2) {
        message.warning('Недостаточно размещённых SKU для сравнения. Запустите скоринг.');
        return;
      }
      setCompare(await api.compareRoutes({
        warehouseId, skuIds: usable, currentSlots, proposedSlots, cartCapacityKg: cartCap,
      }));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Сравнение не удалось');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      <SectionCard title="Список отбора" description="Выберите товары для подбора. Маршрут начинается и заканчивается у дока.">
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} md={16}>
            <Typography.Text style={{ fontSize: 13 }}>Товары (SKU)</Typography.Text>
            <Select
              mode="multiple"
              style={{ width: '100%', marginTop: 6 }}
              placeholder="Выберите SKU из каталога"
              value={picked}
              onChange={setPicked}
              maxTagCount="responsive"
              optionFilterProp="label"
              options={skus.map(s => ({ value: s.id, label: `${s.code} · ${s.name}` }))}
            />
          </Col>
          <Col xs={12} md={4}>
            <Typography.Text style={{ fontSize: 13 }}>Тележка, кг</Typography.Text>
            <InputNumber min={0} value={cartCap} onChange={v => setCartCap(v ?? 0)} style={{ width: '100%', marginTop: 6 }} />
          </Col>
          <Col xs={12} md={4}>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Button type="primary" icon={<ThunderboltOutlined />} loading={loading} onClick={optimize} block>
                Маршрут
              </Button>
              <Button icon={<EnvironmentOutlined />} loading={loading} onClick={beforeAfter} block>
                До / после
              </Button>
            </Space>
          </Col>
        </Row>
      </SectionCard>

      {route && (
        <>
          <Row gutter={16}>
            <Col xs={12} md={8}><StatCard label="Дистанция" value={route.totalDistanceM.toFixed(1)} suffix="м" tone="primary" /></Col>
            <Col xs={12} md={8}><StatCard label="Рейсов" value={route.tripCount} /></Col>
            <Col xs={12} md={8}><StatCard label="Остановок" value={route.orderedSlotIds.length} /></Col>
          </Row>
          <SectionCard title="Оптимальный маршрут">
            <PathViz path={route.fullPath} label={`${route.totalDistanceM.toFixed(1)} м · ${route.tripCount} рейс(ов)`} color={tokens.success} />
          </SectionCard>
        </>
      )}

      {compare && (
        <>
          <Row gutter={16}>
            <Col xs={12} md={6}><StatCard label="Текущий" value={compare.currentDistanceM.toFixed(1)} suffix="м" tone="error" /></Col>
            <Col xs={12} md={6}><StatCard label="Предложенный" value={compare.proposedDistanceM.toFixed(1)} suffix="м" tone="success" /></Col>
            <Col xs={12} md={6}><StatCard label="Экономия" value={compare.savingsM.toFixed(1)} suffix="м" tone="success" /></Col>
            <Col xs={12} md={6}><StatCard label="Улучшение" value={compare.savingsPct.toFixed(1)} suffix="%" tone={compare.savingsPct > 0 ? 'success' : 'default'} /></Col>
          </Row>
          <SectionCard title="Маршрут до и после перестановки">
            <Row gutter={[24, 16]}>
              <Col xs={24} md={12}>
                <PathViz path={compare.currentRoute.fullPath} label={`Текущий — ${compare.currentDistanceM.toFixed(1)} м`} color={tokens.error} />
              </Col>
              <Col xs={24} md={12}>
                <PathViz path={compare.proposedRoute.fullPath} label={`Предложенный — ${compare.proposedDistanceM.toFixed(1)} м`} color={tokens.success} />
              </Col>
            </Row>
          </SectionCard>
        </>
      )}

      {!route && !compare && !loading && (
        <SectionCard>
          <EmptyState
            icon={<NodeIndexOutlined />}
            title="Постройте маршрут"
            description="Выберите SKU и нажмите «Маршрут» для оптимального обхода, либо «До / после» — чтобы увидеть экономию от рекомендованной перестановки."
          />
        </SectionCard>
      )}
    </Space>
  );
}

export function RoutesPage() {
  return (
    <PageContainer>
      <PageHeader
        icon={<NodeIndexOutlined />}
        title="Маршрут пикера"
        description="Оптимизация обхода по списку отбора (TSP: точный для ≤10 остановок, nearest-neighbour + 2-opt для больших). Сравнение текущего и предложенного размещения."
      />
      <RequireWarehouse>{warehouseId => <RouteTool warehouseId={warehouseId} />}</RequireWarehouse>
    </PageContainer>
  );
}
