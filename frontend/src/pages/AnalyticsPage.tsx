import { useState } from 'react';
import {
  Alert, Button, Card, Col, InputNumber,
  Row, Spin, Statistic, Table, Tag, Typography,
} from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import type { CopickMatrixResponse } from '../types';

const { Title, Paragraph, Text } = Typography;

const MAX_SKU = 25;
const CELL    = 18;
const LABEL_W = 64;
const LABEL_H = 64;

function affinityColor(v: number): string {
  if (v <= 0) return '#f5f3ff';
  const stops = [
    { at: 0,   r: 245, g: 243, b: 255 },
    { at: 0.3, r: 196, g: 181, b: 253 },
    { at: 0.7, r: 124, g: 58,  b: 237 },
    { at: 1.0, r: 76,  g: 29,  b: 149 },
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (v >= stops[i].at && v <= stops[i + 1].at) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const t = hi.at === lo.at ? 0 : (v - lo.at) / (hi.at - lo.at);
  return `rgb(${Math.round(lo.r + t * (hi.r - lo.r))},${Math.round(lo.g + t * (hi.g - lo.g))},${Math.round(lo.b + t * (hi.b - lo.b))})`;
}

interface TopPair {
  sku1: string;
  sku2: string;
  affinity: number;
}

function deriveHeatmapData(matrix: CopickMatrixResponse) {
  const m = matrix.matrix;
  const codes = Object.keys(m);

  const totals = codes.map(c => ({
    c,
    total: Object.values(m[c] ?? {}).reduce((s, v) => s + v, 0),
  }));
  totals.sort((a, b) => b.total - a.total);
  const topSkus = totals.slice(0, MAX_SKU).map(x => x.c);

  const pairs: TopPair[] = [];
  for (const c1 of codes) {
    for (const [c2, v] of Object.entries(m[c1] ?? {})) {
      if (c1 < c2) pairs.push({ sku1: c1, sku2: c2, affinity: v as number });
    }
  }
  pairs.sort((a, b) => b.affinity - a.affinity);

  return { topSkus, topPairs: pairs.slice(0, 20) };
}

export function AnalyticsPage() {
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [matrix, setMatrix]           = useState<CopickMatrixResponse | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const load = async () => {
    if (!warehouseId) { setError('Enter a warehouse ID'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCopickMatrix(warehouseId);
      setMatrix(res.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const { topSkus, topPairs } = matrix
    ? deriveHeatmapData(matrix)
    : { topSkus: [] as string[], topPairs: [] as TopPair[] };

  const svgW = LABEL_W + topSkus.length * CELL + 4;
  const svgH = LABEL_H + topSkus.length * CELL + 4;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 16px' }}>
      <Title level={3} style={{ marginBottom: 4 }}>Analytics</Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Co-pick affinity heatmap — shows which SKUs are frequently ordered together.
        Darker cells = stronger co-pick signal.
      </Paragraph>

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="bottom" wrap={false}>
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
            <Button
              type="primary"
              icon={<BarChartOutlined />}
              loading={loading}
              onClick={load}
            >
              Load Analytics
            </Button>
          </Col>
        </Row>
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
            Computing co-pick matrix…
          </div>
        </div>
      )}

      {matrix && !loading && (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic title="SKUs in matrix" value={matrix.skuCount} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="Co-pick pairs" value={matrix.pairCount} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="Analysis window" value={matrix.days} suffix="days" />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Shown in heatmap"
                  value={topSkus.length}
                  suffix={`/ ${matrix.skuCount}`}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={24} wrap={false} style={{ alignItems: 'flex-start' }}>
            <Col flex="auto" style={{ minWidth: 0 }}>
              <Card
                title="Co-pick Heatmap"
                styles={{ body: { overflowX: 'auto', padding: 16 } }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: '#8c8c8c' }}>
                    Top {topSkus.length} SKUs by co-pick activity
                  </Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280' }}>
                      <span style={{ width: 14, height: 14, background: '#f5f3ff', border: '1px solid #e9d5ff', display: 'inline-block', borderRadius: 2 }} />
                      Low
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280' }}>
                      <span style={{ width: 14, height: 14, background: '#c4b5fd', display: 'inline-block', borderRadius: 2 }} />
                      Mid
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280' }}>
                      <span style={{ width: 14, height: 14, background: '#4c1d95', display: 'inline-block', borderRadius: 2 }} />
                      High
                    </span>
                  </div>
                </div>

                {topSkus.length === 0 ? (
                  <Text type="secondary">No co-pick data found for this warehouse.</Text>
                ) : (
                  <svg width={svgW} height={svgH} style={{ display: 'block', minWidth: svgW }}>
                    {topSkus.map((code, ci) => (
                      <text
                        key={`ch-${ci}`}
                        x={LABEL_W + ci * CELL + CELL / 2}
                        y={LABEL_H - 4}
                        textAnchor="end"
                        fontSize={8}
                        fill="#374151"
                        transform={`rotate(-45,${LABEL_W + ci * CELL + CELL / 2},${LABEL_H - 4})`}
                        style={{ userSelect: 'none' }}
                      >
                        {code.length > 8 ? code.slice(-8) : code}
                      </text>
                    ))}

                    {topSkus.map((rowCode, ri) => (
                      <g key={`row-${ri}`}>
                        <text
                          x={LABEL_W - 4}
                          y={LABEL_H + ri * CELL + CELL / 2 + 3}
                          textAnchor="end"
                          fontSize={8}
                          fill="#374151"
                          style={{ userSelect: 'none' }}
                        >
                          {rowCode.length > 8 ? rowCode.slice(-8) : rowCode}
                        </text>
                        {topSkus.map((colCode, ci) => {
                          const val =
                            (matrix.matrix[rowCode]?.[colCode] as number | undefined) ??
                            (matrix.matrix[colCode]?.[rowCode] as number | undefined) ??
                            0;
                          const isDiag = ri === ci;
                          return (
                            <rect
                              key={`c-${ri}-${ci}`}
                              x={LABEL_W + ci * CELL}
                              y={LABEL_H + ri * CELL}
                              width={CELL - 1}
                              height={CELL - 1}
                              fill={isDiag ? '#f0f0f0' : affinityColor(val)}
                              stroke="#fff"
                              strokeWidth={0.5}
                              style={{ cursor: isDiag ? 'default' : 'crosshair' }}
                            >
                              <title>
                                {rowCode} × {colCode}:{' '}
                                {isDiag ? 'same SKU' : `${(val * 100).toFixed(1)}% co-pick`}
                              </title>
                            </rect>
                          );
                        })}
                      </g>
                    ))}
                  </svg>
                )}
              </Card>
            </Col>

            <Col style={{ width: 300, flexShrink: 0 }}>
              <Card title="Top Co-pick Pairs" size="small">
                <Table<TopPair>
                  dataSource={topPairs}
                  rowKey={r => `${r.sku1}-${r.sku2}`}
                  size="small"
                  pagination={false}
                  columns={[
                    {
                      title: 'Pair',
                      render: (_, r) => (
                        <Text style={{ fontSize: 11 }}>{r.sku1} + {r.sku2}</Text>
                      ),
                    },
                    {
                      title: '%',
                      dataIndex: 'affinity',
                      width: 64,
                      align: 'right',
                      render: (v: number) => (
                        <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>
                          {(v * 100).toFixed(1)}
                        </Tag>
                      ),
                    },
                  ]}
                  scroll={{ y: 360 }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}

      {!matrix && !loading && !error && (
        <Card>
          <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8c', fontSize: 14 }}>
            Enter a warehouse ID and click "Load Analytics" to view the co-pick heatmap.
          </div>
        </Card>
      )}
    </div>
  );
}
