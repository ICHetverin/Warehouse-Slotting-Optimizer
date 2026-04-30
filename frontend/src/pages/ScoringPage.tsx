import { useState } from 'react';
import {
  Button, Card, Col, Form, InputNumber, Row, Slider,
  Statistic, Table, Tag, Typography, Space, Alert, Spin,
} from 'antd';
import { PlayCircleOutlined, RiseOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api/client';
import type { Assignment, ScoringRunResponse, ScoringWeights } from '../types';

const { Title, Paragraph, Text } = Typography;

const DEFAULT_WEIGHTS: ScoringWeights = { w1: 0.5, w2: 0.35, w3: 0.15 };

function WeightSliders({
  weights,
  onChange,
}: {
  weights: ScoringWeights;
  onChange: (w: ScoringWeights) => void;
}) {
  const set = (key: keyof ScoringWeights, val: number) =>
    onChange({ ...weights, [key]: val });

  return (
    <Row gutter={24}>
      {(
        [
          { key: 'w1', label: 'Velocity × Distance', color: '#1677ff' },
          { key: 'w2', label: 'Co-pick Affinity',    color: '#7C3AED' },
          { key: 'w3', label: 'Weight Fit',           color: '#059669' },
        ] as { key: keyof ScoringWeights; label: string; color: string }[]
      ).map(({ key, label, color }) => (
        <Col span={8} key={key}>
          <div style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 12, color: '#595959' }}>{label}</Text>
            <Text strong style={{ float: 'right', fontSize: 12 }}>
              {weights[key].toFixed(2)}
            </Text>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={weights[key]}
            onChange={v => set(key, v)}
            styles={{ track: { background: color }, handle: { borderColor: color } }}
          />
        </Col>
      ))}
    </Row>
  );
}

const COLUMNS: ColumnsType<Assignment> = [
  {
    title: 'SKU',
    dataIndex: 'skuCode',
    sorter: (a, b) => a.skuCode.localeCompare(b.skuCode),
    width: 120,
  },
  {
    title: 'From',
    dataIndex: 'fromLabel',
    render: v => v ?? <Text type="secondary">—</Text>,
    width: 100,
  },
  {
    title: 'To',
    dataIndex: 'toLabel',
    width: 100,
  },
  {
    title: 'Score',
    dataIndex: 'score',
    render: v => v.toFixed(3),
    sorter: (a, b) => a.score - b.score,
    width: 90,
    align: 'right',
  },
  {
    title: 'Delta',
    dataIndex: 'scoreDelta',
    render: v => (
      <Tag color={v > 0 ? 'success' : v < 0 ? 'error' : 'default'}>
        {v > 0 ? '+' : ''}{v.toFixed(3)}
      </Tag>
    ),
    sorter: (a, b) => a.scoreDelta - b.scoreDelta,
    defaultSortOrder: 'descend',
    width: 100,
    align: 'right',
  },
];

export function ScoringPage() {
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [weights, setWeights]         = useState<ScoringWeights>(DEFAULT_WEIGHTS);
  const [result, setResult]           = useState<ScoringRunResponse | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const run = async () => {
    if (!warehouseId) { setError('Enter a warehouse ID'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await api.runScoring(warehouseId, weights);
      setResult(res.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Scoring failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 16px' }}>
      <Title level={3} style={{ marginBottom: 4 }}>Scoring Engine</Title>
      <Paragraph type="secondary" style={{ marginBottom: 32 }}>
        Run greedy slot assignment and tune component weights. Formula:{' '}
        <Text code>score = w1·velocity·distance + w2·copick + w3·fit</Text>
      </Paragraph>

      <Card title="Configuration" style={{ marginBottom: 24 }}>
        <Form layout="vertical">
          <Row gutter={24} align="bottom">
            <Col span={8}>
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
          </Row>
          <div style={{ marginTop: 24, marginBottom: 8 }}>
            <Text strong style={{ fontSize: 13 }}>Component Weights</Text>
          </div>
          <WeightSliders weights={weights} onChange={setWeights} />
          <div style={{ marginTop: 24 }}>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={loading}
              onClick={run}
              size="middle"
            >
              Run Scoring
            </Button>
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

      {loading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: '#8c8c8c', fontSize: 13 }}>
            Running greedy assignment…
          </div>
        </div>
      )}

      {result && !loading && (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic title="Total Assignments" value={result.totalAssignments} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Improved"
                  value={result.improved}
                  suffix={`/ ${result.totalAssignments}`}
                  valueStyle={{ color: '#16A34A' }}
                  prefix={<RiseOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Improvement Rate"
                  value={result.totalAssignments > 0
                    ? Math.round((result.improved / result.totalAssignments) * 100)
                    : 0}
                  suffix="%"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Weights (w1/w2/w3)"
                  value={`${result.weightsUsed.w1}/${result.weightsUsed.w2}/${result.weightsUsed.w3}`}
                  valueStyle={{ fontSize: 18 }}
                />
              </Card>
            </Col>
          </Row>

          <Card title={`Assignments (${result.assignments.length})`}>
            <Table<Assignment>
              dataSource={result.assignments}
              columns={COLUMNS}
              rowKey="skuId"
              size="small"
              pagination={{ pageSize: 20, showSizeChanger: false }}
              scroll={{ x: 600 }}
            />
          </Card>

          <Space style={{ marginTop: 16 }}>
            <Button
              type="primary"
              href={`/recommendations?warehouseId=${warehouseId}`}
            >
              View Recommendations
            </Button>
          </Space>
        </>
      )}
    </div>
  );
}
