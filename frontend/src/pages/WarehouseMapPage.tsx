import { useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, Input, InputNumber,
  Row, Space, Spin, Switch, Tag, Typography,
} from 'antd';
import { NodeIndexOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { loadSettings } from '../lib/settings';
import type { ScoringRunResponse, WarehouseGraphResponse } from '../types';

const { Title, Paragraph, Text } = Typography;

const CELL = 28;
const PAD  = 40;

function velocityColor(v: number): string {
  if (v <= 0)   return '#e5e7eb';
  if (v < 0.33) return '#86efac';
  if (v < 0.66) return '#fde68a';
  return '#fca5a5';
}

interface SlotMeta {
  id: number;
  label: string;
  row: number;
  col: number;
  velocity: number;
  isDock: boolean;
}

export function WarehouseMapPage() {
  const [warehouseId, setWarehouseId]     = useState<number | null>(null);
  const [graphData, setGraphData]         = useState<WarehouseGraphResponse | null>(null);
  const [scoringData, setScoringData]     = useState<ScoringRunResponse | null>(null);
  const [hovered, setHovered]             = useState<SlotMeta | null>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  // Route overlay state
  const [showRoute, setShowRoute]         = useState(false);
  const [skuInput, setSkuInput]           = useState('');
  const [cartCap, setCartCap]             = useState(loadSettings().cartCapacityKg);
  const [routePath, setRoutePath]         = useState<number[]>([]);
  const [routeSlots, setRouteSlots]       = useState<number[]>([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeTrips, setRouteTrips]       = useState<number | null>(null);
  const [routeLoading, setRouteLoading]   = useState(false);
  const [routeError, setRouteError]       = useState<string | null>(null);

  const loadWarehouse = async (wid: number) => {
    setLoading(true);
    setError(null);
    setRoutePath([]);
    setRouteSlots([]);
    setRouteDistance(null);
    try {
      const [graphRes, scoringRes] = await Promise.all([
        api.getWarehouseGraph(wid),
        api.runScoring(wid),
      ]);
      setGraphData(graphRes.data);
      setScoringData(scoringRes.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load warehouse data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (warehouseId) loadWarehouse(warehouseId);
  }, [warehouseId]);

  const velocityBySlot: Record<number, number> = {};
  if (scoringData) {
    for (const a of scoringData.assignments) {
      if (a.toSlotId) velocityBySlot[a.toSlotId] = a.score;
    }
  }

  const slots: SlotMeta[] = (graphData?.nodes ?? []).map(n => ({
    id:       n.id,
    label:    n.label,
    row:      n.row,
    col:      n.col,
    velocity: velocityBySlot[n.id] ?? 0,
    isDock:   n.isDock,
  }));

  const nodePositionById = new Map<number, { row: number; col: number }>();
  for (const s of slots) nodePositionById.set(s.id, { row: s.row, col: s.col });

  const routePathSet = new Set(routePath);

  const maxRow = Math.max(0, ...slots.map(s => s.row));
  const maxCol = Math.max(0, ...slots.map(s => s.col));
  const svgW   = (maxCol + 1) * CELL + PAD * 2;
  const svgH   = (maxRow + 1) * CELL + PAD * 2;

  const routePolyline = routePath
    .map(id => nodePositionById.get(id))
    .filter(Boolean)
    .map(pos => `${PAD + pos!.col * CELL + CELL / 2},${PAD + pos!.row * CELL + CELL / 2}`)
    .join(' ');

  const parseSkuIds = (): number[] =>
    skuInput
      .split(/[\s,]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0);

  const runRoute = async () => {
    if (!warehouseId) return;
    const skuIds = parseSkuIds();
    if (skuIds.length === 0) { setRouteError('Enter at least one SKU ID'); return; }
    setRouteLoading(true);
    setRouteError(null);
    try {
      const res = await api.optimizeRoute({ warehouseId, skuIds, cartCapacityKg: cartCap });
      setRoutePath(res.data.fullPath);
      setRouteSlots(res.data.orderedSlotIds);
      setRouteDistance(res.data.totalDistanceM);
      setRouteTrips(res.data.tripCount);
    } catch (e: unknown) {
      setRouteError(e instanceof Error ? e.message : 'Route optimisation failed');
    } finally {
      setRouteLoading(false);
    }
  };

  const clearRoute = () => {
    setRoutePath([]);
    setRouteSlots([]);
    setRouteDistance(null);
    setRouteTrips(null);
    setSkuInput('');
    setRouteError(null);
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 16px' }}>
      <Title level={3} style={{ marginBottom: 4 }}>Warehouse Map</Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Slot colours reflect composite score — red = high-priority (fast-moving SKUs).
        Enable route overlay to visualise an optimised pick path.
      </Paragraph>

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={24} align="middle" wrap>
          <Col>
            <Text style={{ fontSize: 13 }}>Warehouse ID</Text>
            <div style={{ marginTop: 4 }}>
              <InputNumber
                min={1}
                placeholder="e.g. 1"
                value={warehouseId ?? undefined}
                onChange={v => setWarehouseId(v ?? null)}
                style={{ width: 140 }}
              />
            </div>
          </Col>

          <Col style={{ marginTop: 20 }}>
            <Space wrap>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#595959' }}>
                <span style={{ width: 14, height: 14, background: '#e5e7eb', borderRadius: 2, display: 'inline-block' }} />
                Empty
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#595959' }}>
                <span style={{ width: 14, height: 14, background: '#86efac', borderRadius: 2, display: 'inline-block' }} />
                Low score
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#595959' }}>
                <span style={{ width: 14, height: 14, background: '#fde68a', borderRadius: 2, display: 'inline-block' }} />
                Mid
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#595959' }}>
                <span style={{ width: 14, height: 14, background: '#fca5a5', borderRadius: 2, display: 'inline-block' }} />
                High score
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#595959' }}>
                <span style={{ width: 14, height: 14, background: '#1677ff', borderRadius: 2, display: 'inline-block' }} />
                Dock
              </span>
            </Space>
          </Col>

          {graphData && (
            <Col style={{ marginTop: 20, marginLeft: 'auto' }}>
              <Space>
                <Text style={{ fontSize: 13 }}>Route overlay</Text>
                <Switch checked={showRoute} onChange={v => { setShowRoute(v); if (!v) clearRoute(); }} />
              </Space>
            </Col>
          )}
        </Row>

        {showRoute && graphData && (
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: '1px solid #f0f0f0',
            }}
          >
            <Row gutter={16} align="bottom" wrap>
              <Col flex="auto">
                <Text style={{ fontSize: 12, color: '#595959', display: 'block', marginBottom: 4 }}>
                  SKU IDs (comma or space separated)
                </Text>
                <Input
                  placeholder="e.g. 1, 2, 5, 12"
                  value={skuInput}
                  onChange={e => setSkuInput(e.target.value)}
                  onPressEnter={runRoute}
                />
              </Col>
              <Col>
                <Text style={{ fontSize: 12, color: '#595959', display: 'block', marginBottom: 4 }}>
                  Cart capacity (kg)
                </Text>
                <InputNumber
                  min={0}
                  placeholder="0 = unlimited"
                  value={cartCap}
                  onChange={v => setCartCap(v ?? 0)}
                  style={{ width: 130 }}
                />
              </Col>
              <Col>
                <Button
                  type="primary"
                  icon={<NodeIndexOutlined />}
                  loading={routeLoading}
                  onClick={runRoute}
                  style={{ background: '#F97316', borderColor: '#F97316' }}
                >
                  Show Route
                </Button>
              </Col>
              {routeDistance !== null && (
                <Col>
                  <Space>
                    <Tag color="orange">
                      {routeDistance.toFixed(1)} m
                    </Tag>
                    <Tag>
                      {routeTrips} trip{routeTrips !== 1 ? 's' : ''}
                    </Tag>
                    <Button size="small" type="text" onClick={clearRoute} style={{ color: '#8c8c8c', fontSize: 12 }}>
                      Clear
                    </Button>
                  </Space>
                </Col>
              )}
            </Row>
            {routeError && (
              <Alert type="error" message={routeError} showIcon closable onClose={() => setRouteError(null)} style={{ marginTop: 8 }} />
            )}
          </div>
        )}
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

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: '#8c8c8c', fontSize: 13 }}>
            Building warehouse graph…
          </div>
        </div>
      )}

      {!loading && graphData && (
        <Row gutter={16}>
          <Col flex="auto">
            <Card styles={{ body: { overflowX: 'auto', padding: 0 } }}>
              <svg
                width={svgW}
                height={svgH}
                style={{ display: 'block', minWidth: svgW }}
              >
                {slots.map(slot => {
                  const x        = PAD + slot.col * CELL;
                  const y        = PAD + slot.row * CELL;
                  const inRoute  = routePathSet.has(slot.id);
                  const pickIdx  = routeSlots.indexOf(slot.id);
                  const isHovered = hovered?.id === slot.id;

                  let fill = slot.isDock ? '#1677ff' : velocityColor(slot.velocity);
                  if (inRoute && !slot.isDock) fill = '#fed7aa';

                  return (
                    <g key={slot.id}>
                      <rect
                        x={x + 1}
                        y={y + 1}
                        width={CELL - 2}
                        height={CELL - 2}
                        rx={3}
                        fill={fill}
                        stroke={isHovered ? '#111827' : inRoute ? '#F97316' : '#d1d5db'}
                        strokeWidth={isHovered ? 2 : inRoute ? 1.5 : 0.5}
                        style={{ cursor: 'pointer', transition: 'stroke 0.1s' }}
                        onMouseEnter={() => setHovered(slot)}
                        onMouseLeave={() => setHovered(null)}
                      />
                      {pickIdx >= 0 ? (
                        <>
                          <circle
                            cx={x + CELL - 5}
                            cy={y + 5}
                            r={5}
                            fill="#F97316"
                            style={{ pointerEvents: 'none' }}
                          />
                          <text
                            x={x + CELL - 5}
                            y={y + 8}
                            textAnchor="middle"
                            fontSize={6}
                            fill="#fff"
                            fontWeight="700"
                            style={{ pointerEvents: 'none', userSelect: 'none' }}
                          >
                            {pickIdx + 1}
                          </text>
                        </>
                      ) : (
                        CELL >= 28 && !slot.isDock && (
                          <text
                            x={x + CELL / 2}
                            y={y + CELL / 2 + 4}
                            textAnchor="middle"
                            fontSize={8}
                            fill="#374151"
                            style={{ pointerEvents: 'none', userSelect: 'none' }}
                          >
                            {slot.label.slice(-4)}
                          </text>
                        )
                      )}
                      {slot.isDock && (
                        <text
                          x={x + CELL / 2}
                          y={y + CELL / 2 + 4}
                          textAnchor="middle"
                          fontSize={8}
                          fill="#fff"
                          fontWeight="600"
                          style={{ pointerEvents: 'none', userSelect: 'none' }}
                        >
                          DOC
                        </text>
                      )}
                    </g>
                  );
                })}

                {routePolyline && (
                  <polyline
                    points={routePolyline}
                    fill="none"
                    stroke="#F97316"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.85}
                    style={{ pointerEvents: 'none' }}
                  />
                )}
              </svg>
            </Card>
          </Col>

          {hovered && (
            <Col style={{ width: 220 }}>
              <Card
                title={hovered.isDock ? 'Dock' : hovered.label}
                size="small"
                style={{ position: 'sticky', top: 40 }}
              >
                {hovered.isDock ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Loading dock — all routes start and end here.
                  </Text>
                ) : (
                  <>
                    <div style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 12, color: '#8c8c8c' }}>Position</Text>
                      <div>
                        <Text style={{ fontSize: 13 }}>
                          Row {hovered.row}, Col {hovered.col}
                        </Text>
                      </div>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 12, color: '#8c8c8c' }}>Score</Text>
                      <div>
                        <Tag
                          color={
                            hovered.velocity > 0.66
                              ? 'red'
                              : hovered.velocity > 0.33
                              ? 'gold'
                              : hovered.velocity > 0
                              ? 'green'
                              : 'default'
                          }
                        >
                          {hovered.velocity.toFixed(3)}
                        </Tag>
                      </div>
                    </div>
                    {routeSlots.includes(hovered.id) && (
                      <div>
                        <Text style={{ fontSize: 12, color: '#8c8c8c' }}>Pick order</Text>
                        <div>
                          <Tag color="orange">
                            Stop #{routeSlots.indexOf(hovered.id) + 1}
                          </Tag>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Card>
            </Col>
          )}
        </Row>
      )}

      {!loading && !graphData && !error && (
        <Card>
          <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8c', fontSize: 14 }}>
            Enter a warehouse ID above to load the map.
          </div>
        </Card>
      )}
    </div>
  );
}
