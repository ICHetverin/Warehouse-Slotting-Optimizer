import { useEffect, useMemo, useState } from 'react';
import { App, Button, Col, InputNumber, Row, Select, Space, Spin, Tag, Typography } from 'antd';
import { AppstoreOutlined, EnvironmentOutlined, ThunderboltOutlined, ClearOutlined } from '@ant-design/icons';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { StatCard } from '../components/common/StatCard';
import { RequireWarehouse } from '../components/common/RequireWarehouse';
import { HeatmapLegend, heatColor } from '../components/common/HeatmapLegend';
import { api } from '../api/client';
import type { Route, RouteComparison, ScoringRunResponse, Sku, WarehouseGraphResponse } from '../types';
import { tokens } from '../theme';

const CELL = 26;
const PAD = 34;

interface SlotMeta {
  id: number;
  label: string;
  row: number;
  col: number;
  norm: number;
  isDock: boolean;
}

function points(ids: number[], coord: Map<number, { x: number; y: number }>): string {
  return ids.map(id => coord.get(id)).filter(Boolean).map(p => `${p!.x},${p!.y}`).join(' ');
}

function MapView({ warehouseId }: { warehouseId: number }) {
  const { message } = App.useApp();
  const [graph, setGraph] = useState<WarehouseGraphResponse | null>(null);
  const [scoring, setScoring] = useState<ScoringRunResponse | null>(null);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState<SlotMeta | null>(null);

  // route overlay
  const [picked, setPicked] = useState<number[]>([]);
  const [cartCap, setCartCap] = useState(50);
  const [route, setRoute] = useState<Route | null>(null);
  const [cmp, setCmp] = useState<RouteComparison | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setRoute(null); setCmp(null);
    Promise.all([
      api.getWarehouseGraph(warehouseId),
      api.runScoring({ warehouseId, velocityDays: 1200 }),
      api.getWarehouseSkus(warehouseId).catch(() => [] as Sku[]),
    ])
      .then(([g, s, sk]) => {
        if (!alive) return;
        setGraph(g); setScoring(s); setSkus(sk);
        setPicked(sk.slice(0, 6).map(x => x.id));
      })
      .catch(e => alive && message.error(e instanceof Error ? e.message : 'Не удалось загрузить карту'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [warehouseId, message]);

  const slots = useMemo<SlotMeta[]>(() => {
    if (!graph) return [];
    const score: Record<number, number> = {};
    let max = 0;
    for (const a of scoring?.assignments ?? []) {
      score[a.toSlotId] = a.score;
      if (a.score > max) max = a.score;
    }
    return graph.nodes.map(n => ({
      id: n.id, label: n.label, row: n.row, col: n.col, isDock: n.isDock,
      norm: max > 0 ? (score[n.id] ?? 0) / max : 0,
    }));
  }, [graph, scoring]);

  const coord = useMemo(() => {
    const m = new Map<number, { x: number; y: number }>();
    for (const n of graph?.nodes ?? []) {
      m.set(n.id, { x: PAD + n.col * CELL + CELL / 2, y: PAD + n.row * CELL + CELL / 2 });
    }
    return m;
  }, [graph]);

  const maxRow = Math.max(0, ...slots.map(s => s.row));
  const maxCol = Math.max(0, ...slots.map(s => s.col));
  const svgW = (maxCol + 1) * CELL + PAD * 2;
  const svgH = (maxRow + 1) * CELL + PAD * 2;

  const optimize = async () => {
    if (!picked.length) { message.warning('Выберите хотя бы один SKU'); return; }
    setRouteLoading(true);
    try {
      const r = await api.optimizeRoute({ warehouseId, skuIds: picked, cartCapacityKg: cartCap });
      setRoute(r); setCmp(null); setAnimKey(k => k + 1);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Не удалось построить маршрут');
    } finally { setRouteLoading(false); }
  };

  const beforeAfter = async () => {
    if (!picked.length || !scoring) { message.warning('Выберите SKU'); return; }
    setRouteLoading(true);
    try {
      const byId = new Map(scoring.assignments.map(a => [a.skuId, a]));
      const current: Record<number, number> = {};
      const proposed: Record<number, number> = {};
      const usable: number[] = [];
      for (const id of picked) {
        const a = byId.get(id);
        if (a && a.fromSlotId != null) { current[id] = a.fromSlotId; proposed[id] = a.toSlotId; usable.push(id); }
      }
      if (usable.length < 2) { message.warning('Недостаточно размещённых SKU. Запустите скоринг.'); return; }
      const c = await api.compareRoutes({ warehouseId, skuIds: usable, currentSlots: current, proposedSlots: proposed, cartCapacityKg: cartCap });
      setCmp(c); setRoute(null); setAnimKey(k => k + 1);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Сравнение не удалось');
    } finally { setRouteLoading(false); }
  };

  const clear = () => { setRoute(null); setCmp(null); };

  if (loading) {
    return (
      <SectionCard>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: tokens.textTertiary, fontSize: 13 }}>Строим граф склада…</div>
        </div>
      </SectionCard>
    );
  }

  const orderedIds = cmp ? cmp.proposedRoute.orderedSlotIds : route?.orderedSlotIds ?? [];

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <SectionCard title="Маршрут пикера" description="Выберите товары — построим оптимальный обход поверх карты или сравним текущее и предложенное размещение.">
        <Row gutter={[16, 12]} align="bottom">
          <Col xs={24} md={14}>
            <Typography.Text style={{ fontSize: 13 }}>Товары (SKU)</Typography.Text>
            <Select
              mode="multiple" style={{ width: '100%', marginTop: 6 }} placeholder="Выберите SKU"
              value={picked} onChange={setPicked} maxTagCount="responsive" optionFilterProp="label"
              options={skus.map(s => ({ value: s.id, label: `${s.code} · ${s.name}` }))}
            />
          </Col>
          <Col xs={12} md={4}>
            <Typography.Text style={{ fontSize: 13 }}>Тележка, кг</Typography.Text>
            <InputNumber min={0} value={cartCap} onChange={v => setCartCap(v ?? 0)} style={{ width: '100%', marginTop: 6 }} />
          </Col>
          <Col xs={12} md={6}>
            <Space wrap>
              <Button type="primary" icon={<ThunderboltOutlined />} loading={routeLoading} onClick={optimize}>Маршрут</Button>
              <Button icon={<EnvironmentOutlined />} loading={routeLoading} onClick={beforeAfter}>До / после</Button>
              {(route || cmp) && <Button icon={<ClearOutlined />} onClick={clear} />}
            </Space>
          </Col>
        </Row>
      </SectionCard>

      {cmp && (
        <Row gutter={16}>
          <Col xs={12} md={6}><StatCard label="Текущий" value={cmp.currentDistanceM.toFixed(1)} suffix="м" tone="error" /></Col>
          <Col xs={12} md={6}><StatCard label="Предложенный" value={cmp.proposedDistanceM.toFixed(1)} suffix="м" tone="success" /></Col>
          <Col xs={12} md={6}><StatCard label="Экономия" value={cmp.savingsM.toFixed(1)} suffix="м" tone="success" /></Col>
          <Col xs={12} md={6}><StatCard label="Улучшение" value={cmp.savingsPct.toFixed(1)} suffix="%" tone={cmp.savingsPct > 0 ? 'success' : 'default'} /></Col>
        </Row>
      )}

      <Row gutter={16}>
        <Col flex="auto">
          <SectionCard
            title="Карта склада"
            description="Тепло — приоритет ячейки. Линия — маршрут пикера (зелёный = предложенный, красный = текущий)."
            extra={<HeatmapLegend extra={[{ color: tokens.primary, label: 'Док' }, { color: '#E2E8F0', label: 'Пусто' }]} />}
            bodyPadding={0}
          >
            <div style={{ overflowX: 'auto' }}>
              <svg width={svgW} height={svgH} style={{ display: 'block', minWidth: svgW }}>
                {slots.map(slot => {
                  const x = PAD + slot.col * CELL;
                  const y = PAD + slot.row * CELL;
                  const onRoute = orderedIds.includes(slot.id);
                  const fill = slot.isDock ? tokens.primary : slot.norm > 0 ? heatColor(slot.norm) : '#EEF2F7';
                  const isHovered = hovered?.id === slot.id;
                  return (
                    <g key={slot.id}>
                      <rect
                        x={x + 1} y={y + 1} width={CELL - 2} height={CELL - 2} rx={3} fill={fill}
                        stroke={isHovered ? tokens.ink : onRoute ? tokens.violet : '#E2E8F0'}
                        strokeWidth={isHovered ? 2 : onRoute ? 2 : 0.5}
                        style={{ cursor: 'pointer', transition: 'stroke 0.1s' }}
                        onMouseEnter={() => setHovered(slot)}
                      />
                      {slot.isDock && (
                        <text x={x + CELL / 2} y={y + CELL / 2 + 3} textAnchor="middle" fontSize={7} fill="#fff" fontWeight={700} style={{ pointerEvents: 'none' }}>ДОК</text>
                      )}
                    </g>
                  );
                })}

                {/* route overlay */}
                {cmp && (
                  <polyline key={`cur-${animKey}`} className="wso-route" pathLength={1}
                    points={points(cmp.currentRoute.fullPath, coord)}
                    fill="none" stroke={tokens.error} strokeWidth={2} strokeOpacity={0.5}
                    strokeLinejoin="round" strokeDasharray="4 3" />
                )}
                {(route || cmp) && (
                  <polyline key={`prop-${animKey}`} className="wso-route" pathLength={1}
                    points={points((cmp ? cmp.proposedRoute : route!).fullPath, coord)}
                    fill="none" stroke={cmp ? tokens.success : tokens.violet} strokeWidth={2.5}
                    strokeLinejoin="round" strokeLinecap="round" />
                )}
                {orderedIds.map((id, i) => {
                  const p = coord.get(id);
                  if (!p) return null;
                  return <circle key={`m-${id}-${i}`} cx={p.x} cy={p.y} r={3.5} fill={cmp ? tokens.success : tokens.violet} stroke="#fff" strokeWidth={1} />;
                })}
              </svg>
            </div>
          </SectionCard>
        </Col>

        <Col flex="240px">
          <SectionCard title={hovered ? (hovered.isDock ? 'Док' : hovered.label) : route || cmp ? 'Маршрут' : 'Наведите на ячейку'}>
            {hovered ? (
              hovered.isDock ? (
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>Погрузочный док — здесь начинаются и заканчиваются маршруты.</Typography.Text>
              ) : (
                <Space orientation="vertical" size={10}>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>Позиция</Typography.Text>
                    <div><Typography.Text>Строка {hovered.row}, колонка {hovered.col}</Typography.Text></div>
                  </div>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>Скор (норм.)</Typography.Text>
                    <div><Tag color={hovered.norm > 0.66 ? 'red' : hovered.norm > 0.33 ? 'gold' : hovered.norm > 0 ? 'green' : 'default'}>{hovered.norm.toFixed(2)}</Tag></div>
                  </div>
                </Space>
              )
            ) : route ? (
              <Typography.Text style={{ fontSize: 13 }}>
                Оптимальный обход: <b>{route.totalDistanceM.toFixed(1)} м</b>, {route.tripCount} рейс(ов), {route.orderedSlotIds.length} остановок.
              </Typography.Text>
            ) : cmp ? (
              <Typography.Text style={{ fontSize: 13 }}>
                Экономия <b style={{ color: tokens.success }}>{cmp.savingsM.toFixed(1)} м</b> ({cmp.savingsPct.toFixed(1)}%) при перестановке выбранных SKU.
              </Typography.Text>
            ) : (
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>Наведите курсор на ячейку или постройте маршрут.</Typography.Text>
            )}
          </SectionCard>
        </Col>
      </Row>
    </Space>
  );
}

export function WarehouseMapPage() {
  return (
    <PageContainer>
      <PageHeader
        icon={<AppstoreOutlined />}
        title="Карта склада"
        description="Тепловая карта приоритета ячеек и визуализация маршрута пикера прямо на схеме склада."
      />
      <RequireWarehouse>{warehouseId => <MapView warehouseId={warehouseId} />}</RequireWarehouse>
    </PageContainer>
  );
}
