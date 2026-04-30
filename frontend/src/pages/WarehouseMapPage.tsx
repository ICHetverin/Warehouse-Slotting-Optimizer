import { useEffect, useState } from 'react';
import {
  Alert, Card, Col, InputNumber, Row, Spin,
  Typography, Space, Tag,
} from 'antd';
import { api } from '../api/client';
import type { ScoringRunResponse, WarehouseGraphResponse } from '../types';

const { Title, Paragraph, Text } = Typography;

const CELL = 28;
const PAD  = 40;

function velocityColor(v: number): string {
  // green → yellow → red  (low → mid → high velocity)
  if (v <= 0)   return '#e5e7eb';
  if (v < 0.33) return '#86efac'; // low  → green-300
  if (v < 0.66) return '#fde68a'; // mid  → amber-200
  return '#fca5a5';               // high → red-300
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
  const [warehouseId, setWarehouseId]         = useState<number | null>(null);
  const [graphData, setGraphData]             = useState<WarehouseGraphResponse | null>(null);
  const [scoringData, setScoringData]         = useState<ScoringRunResponse | null>(null);
  const [hovered, setHovered]                 = useState<SlotMeta | null>(null);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  const load = async (wid: number) => {
    setLoading(true);
    setError(null);
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
    if (warehouseId) load(warehouseId);
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

  const maxRow = Math.max(0, ...slots.map(s => s.row));
  const maxCol = Math.max(0, ...slots.map(s => s.col));
  const svgW   = (maxCol + 1) * CELL + PAD * 2;
  const svgH   = (maxRow + 1) * CELL + PAD * 2;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 16px' }}>
      <Title level={3} style={{ marginBottom: 4 }}>Warehouse Map</Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Slot colors reflect composite score — red slots are high-priority (fast-moving SKUs).
      </Paragraph>

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={24} align="middle">
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
            <Space>
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
        </Row>
      </Card>

      {error && (
        <Alert type="error" message={error} showIcon closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: '#8c8c8c', fontSize: 13 }}>Building warehouse graph…</div>
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
                  const x = PAD + slot.col * CELL;
                  const y = PAD + slot.row * CELL;
                  const fill = slot.isDock ? '#1677ff' : velocityColor(slot.velocity);
                  const isHovered = hovered?.id === slot.id;
                  return (
                    <g key={slot.id}>
                      <rect
                        x={x + 1}
                        y={y + 1}
                        width={CELL - 2}
                        height={CELL - 2}
                        rx={3}
                        fill={fill}
                        stroke={isHovered ? '#111827' : '#d1d5db'}
                        strokeWidth={isHovered ? 2 : 0.5}
                        style={{ cursor: 'pointer', transition: 'stroke 0.1s' }}
                        onMouseEnter={() => setHovered(slot)}
                        onMouseLeave={() => setHovered(null)}
                      />
                      {CELL >= 28 && !slot.isDock && (
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
                  <Text type="secondary" style={{ fontSize: 12 }}>Loading dock — all routes start and end here.</Text>
                ) : (
                  <>
                    <div style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 12, color: '#8c8c8c' }}>Position</Text>
                      <div>
                        <Text style={{ fontSize: 13 }}>Row {hovered.row}, Col {hovered.col}</Text>
                      </div>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 12, color: '#8c8c8c' }}>Score</Text>
                      <div>
                        <Tag color={hovered.velocity > 0.66 ? 'red' : hovered.velocity > 0.33 ? 'gold' : hovered.velocity > 0 ? 'green' : 'default'}>
                          {hovered.velocity.toFixed(3)}
                        </Tag>
                      </div>
                    </div>
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
