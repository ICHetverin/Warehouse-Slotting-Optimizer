import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, Col, Row, Space, Steps, Tag, Typography, message,
} from 'antd';
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  BarChartOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  NodeIndexOutlined,
  PartitionOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { api } from '../api/client';

const { Title, Paragraph, Text } = Typography;

const FEATURES = [
  {
    icon: <ThunderboltOutlined style={{ fontSize: 28, color: '#1677ff' }} />,
    title: 'Scoring Engine',
    desc: 'Velocity × distance + co-pick affinity + weight fit. Three components, one transparent formula. Tune the weights yourself.',
    tags: ['Greedy Assignment', 'Co-pick Matrix', 'Velocity Score'],
    color: '#EFF6FF',
    border: '#BFDBFE',
  },
  {
    icon: <NodeIndexOutlined style={{ fontSize: 28, color: '#F97316' }} />,
    title: 'Route Optimizer',
    desc: 'Builds a JGraphT warehouse graph and solves pick routes via TSP — exact for ≤12 stops, nearest-neighbour + 2-opt for larger lists.',
    tags: ['JGraphT', 'TSP', 'Before / After'],
    color: '#FFF7ED',
    border: '#FED7AA',
  },
  {
    icon: <BulbOutlined style={{ fontSize: 28, color: '#7C3AED' }} />,
    title: 'Explainability',
    desc: 'Every recommendation shows the exact reason: "Co-pick with SKU-A22 (43% shared orders), 12 m closer to dock." No black boxes.',
    tags: ['Reasons + Numbers', 'Accept / Reject', 'Daily Savings'],
    color: '#F5F3FF',
    border: '#DDD6FE',
  },
];

const HOW_IT_WORKS = [
  {
    title: 'Upload your data',
    description: 'Drop CSV files for warehouse layout, SKU catalog, and order history. Takes under a minute.',
    icon: <UploadOutlined />,
  },
  {
    title: 'Run scoring',
    description: 'The engine computes velocity, co-pick affinity, and distance scores — then assigns SKUs to optimal slots.',
    icon: <BarChartOutlined />,
  },
  {
    title: 'Review & accept',
    description: 'Each recommendation shows why it was made — in plain language and exact numbers. Accept or reject in one click.',
    icon: <CheckCircleOutlined />,
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [seeding, setSeeding] = useState(false);

  const tryDemo = async () => {
    setSeeding(true);
    try {
      const res = await api.seedDemo();
      message.success(`Demo warehouse loaded (ID: ${res.data.warehouseId}) — use it on any page`);
      navigate(`/recommendations?wid=${res.data.warehouseId}`);
    } catch {
      message.error('Failed to load demo data — is the backend running?');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header
        style={{
          borderBottom: '1px solid #f0f0f0',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: '#fff',
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: '0 24px',
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Space>
            <AppstoreOutlined style={{ color: '#1677ff', fontSize: 18 }} />
            <Text strong style={{ fontSize: 15 }}>Warehouse Optimizer</Text>
          </Space>
          <Space>
            <Button onClick={() => navigate('/upload')}>Get Started</Button>
            <Button
              type="primary"
              loading={seeding}
              onClick={tryDemo}
            >
              Try Demo
            </Button>
          </Space>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
        style={{
          background: 'linear-gradient(160deg, #f0f5ff 0%, #fafafa 60%, #fff 100%)',
          padding: '80px 24px 96px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <Tag color="blue" style={{ marginBottom: 20, fontSize: 12 }}>
            Transparent · Formula-driven · No black box
          </Tag>

          <Title
            level={1}
            style={{
              fontSize: 'clamp(32px, 5vw, 52px)',
              lineHeight: 1.2,
              marginBottom: 20,
              fontWeight: 700,
            }}
          >
            Warehouse slotting that{' '}
            <span style={{ color: '#1677ff' }}>shows its work</span>
          </Title>

          <Paragraph
            style={{
              fontSize: 18,
              color: '#595959',
              maxWidth: 560,
              margin: '0 auto 36px',
              lineHeight: 1.7,
            }}
          >
            Every recommendation comes with the formula, the graph, and the numbers behind it.
            Built for ops teams that need to justify decisions — not just accept them.
          </Paragraph>

          <Space size={12} wrap style={{ justifyContent: 'center' }}>
            <Button
              type="primary"
              size="large"
              icon={<ArrowRightOutlined />}
              onClick={() => navigate('/upload')}
              style={{ height: 44, paddingInline: 28, fontSize: 15 }}
            >
              Get Started
            </Button>
            <Button
              size="large"
              loading={seeding}
              onClick={tryDemo}
              style={{ height: 44, paddingInline: 28, fontSize: 15 }}
            >
              Try Demo — no upload needed
            </Button>
          </Space>

          <div style={{ marginTop: 32, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['JGraphT', 'Co-pick Matrix', 'Greedy TSP', 'Explainability', 'React + Spring Boot'].map(t => (
              <Tag key={t} style={{ fontSize: 12 }}>{t}</Tag>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Title level={2} style={{ marginBottom: 8 }}>Three layers, one goal</Title>
            <Paragraph style={{ fontSize: 16, color: '#595959', marginBottom: 0 }}>
              Scoring → Routing → Explainability. Each layer is open — inspect it, tune it, verify it.
            </Paragraph>
          </div>
          <Row gutter={[24, 24]}>
            {FEATURES.map(f => (
              <Col key={f.title} xs={24} md={8}>
                <Card
                  style={{
                    height: '100%',
                    border: `1px solid ${f.border}`,
                    background: f.color,
                  }}
                  styles={{ body: { padding: '28px 24px' } }}
                >
                  <div style={{ marginBottom: 16 }}>{f.icon}</div>
                  <Title level={4} style={{ marginTop: 0, marginBottom: 10 }}>{f.title}</Title>
                  <Paragraph style={{ color: '#595959', fontSize: 14, marginBottom: 16 }}>
                    {f.desc}
                  </Paragraph>
                  <Space wrap size={6}>
                    {f.tags.map(t => (
                      <Tag key={t} style={{ fontSize: 11 }}>{t}</Tag>
                    ))}
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </section>

      {/* ── Value prop quote ──────────────────────────────────────────────── */}
      <section
        style={{
          background: '#1677ff',
          padding: '56px 24px',
          textAlign: 'center',
        }}
      >
        <Title
          level={3}
          style={{ color: '#fff', marginBottom: 8, fontWeight: 600 }}
        >
          "Here is the graph, the route, and the formula — verify it yourself."
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, marginBottom: 0 }}>
          Built for warehouse managers who've been burned by AI black boxes.
        </Paragraph>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 24px' }}>
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Title level={2} style={{ marginBottom: 8 }}>How it works</Title>
            <Paragraph style={{ fontSize: 16, color: '#595959', marginBottom: 0 }}>
              From raw CSVs to actionable recommendations in under 30 seconds.
            </Paragraph>
          </div>
          <Steps
            direction="vertical"
            current={3}
            items={HOW_IT_WORKS.map((s, i) => ({
              title: <Text strong style={{ fontSize: 16 }}>{s.title}</Text>,
              description: (
                <Paragraph style={{ color: '#595959', marginBottom: 0, marginTop: 4 }}>
                  {s.description}
                </Paragraph>
              ),
              icon: (
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#1677ff',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                  }}
                >
                  {i + 1}
                </span>
              ),
            }))}
          />
        </div>
      </section>

      {/* ── Competitor table ──────────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 72px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <Title level={3} style={{ textAlign: 'center', marginBottom: 32 }}>
            Why not just use Excel?
          </Title>
          <Row gutter={[16, 16]}>
            {[
              { label: 'Pretty dashboard, no math', name: 'SlotWise', bad: true },
              { label: '6-month rollout, $$$$ consultants', name: 'Manhattan', bad: true },
              { label: 'Open formulas, graph, explainability', name: 'This tool', bad: false },
            ].map(c => (
              <Col key={c.name} xs={24} md={8}>
                <Card
                  style={{
                    border: c.bad ? '1px solid #f0f0f0' : '2px solid #1677ff',
                    background: c.bad ? '#fafafa' : '#EFF6FF',
                  }}
                  styles={{ body: { padding: '20px 20px' } }}
                >
                  <Text
                    strong
                    style={{
                      fontSize: 14,
                      color: c.bad ? '#595959' : '#1677ff',
                      display: 'block',
                      marginBottom: 8,
                    }}
                  >
                    {c.name}
                  </Text>
                  <Text style={{ fontSize: 13, color: c.bad ? '#8c8c8c' : '#262626' }}>
                    {c.label}
                  </Text>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section
        style={{
          background: '#fafafa',
          borderTop: '1px solid #f0f0f0',
          padding: '72px 24px',
          textAlign: 'center',
        }}
      >
        <Title level={2} style={{ marginBottom: 12 }}>Ready to optimise?</Title>
        <Paragraph style={{ fontSize: 16, color: '#595959', marginBottom: 32 }}>
          Upload your data or jump straight into the demo.
        </Paragraph>
        <Space size={12} wrap style={{ justifyContent: 'center' }}>
          <Button
            type="primary"
            size="large"
            icon={<PartitionOutlined />}
            onClick={() => navigate('/upload')}
            style={{ height: 44, paddingInline: 28 }}
          >
            Upload & Start
          </Button>
          <Button
            size="large"
            loading={seeding}
            onClick={tryDemo}
            style={{ height: 44, paddingInline: 28 }}
          >
            Load Demo Data
          </Button>
        </Space>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid #f0f0f0',
          padding: '20px 24px',
          textAlign: 'center',
        }}
      >
        <Text style={{ color: '#bfbfbf', fontSize: 12 }}>
          Warehouse Slotting Optimizer · Transparent algorithms, real results
        </Text>
      </footer>
    </div>
  );
}
