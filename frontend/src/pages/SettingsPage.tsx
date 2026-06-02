import { useState } from 'react';
import {
  Alert, Button, Card, Col, Form,
  InputNumber, Row, Slider, Space, Typography,
} from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { loadSettings, saveSettings } from '../lib/settings';
import type { AppSettings } from '../lib/settings';

const { Title, Paragraph, Text } = Typography;

const DEFAULTS: AppSettings = {
  w1: 0.5,
  w2: 0.35,
  w3: 0.15,
  velocityDays: 90,
  cartCapacityKg: 50,
};

const WEIGHT_CONFIG = [
  {
    key: 'w1' as const,
    label: 'Velocity × Distance',
    desc: 'Prioritises fast-moving SKUs near the dock',
    color: '#1677ff',
  },
  {
    key: 'w2' as const,
    label: 'Co-pick Affinity',
    desc: 'Groups frequently co-ordered SKUs close together',
    color: '#7C3AED',
  },
  {
    key: 'w3' as const,
    label: 'Weight Fit',
    desc: 'Penalises SKUs placed in slots with insufficient capacity',
    color: '#059669',
  },
];

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [saved, setSaved]       = useState(false);

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    setSettings(prev => ({ ...prev, [k]: v }));

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => setSettings({ ...DEFAULTS });

  const weightSum = settings.w1 + settings.w2 + settings.w3;
  const sumOk     = Math.abs(weightSum - 1.0) < 0.02;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 16px' }}>
      <Title level={3} style={{ marginBottom: 4 }}>Settings</Title>
      <Paragraph type="secondary" style={{ marginBottom: 32 }}>
        Configure default scoring weights and analysis parameters.
        Values are saved in your browser and applied as defaults across all pages.
      </Paragraph>

      <Card title="Scoring Weights" style={{ marginBottom: 24 }}>
        <Paragraph style={{ marginBottom: 20, fontSize: 13, color: '#595959' }}>
          Formula:{' '}
          <Text code style={{ fontSize: 12 }}>
            score = w1·velocity·distance + w2·copick + w3·fit
          </Text>
          <br />
          Weight sum:{' '}
          <Text strong style={{ color: sumOk ? '#16A34A' : '#DC2626' }}>
            {weightSum.toFixed(2)}
          </Text>
          {!sumOk && (
            <Text style={{ color: '#D97706', fontSize: 12, marginLeft: 8 }}>
              (ideally 1.00)
            </Text>
          )}
        </Paragraph>

        {WEIGHT_CONFIG.map(({ key, label, desc, color }) => (
          <div key={key} style={{ marginBottom: 24 }}>
            <Row justify="space-between" align="middle" style={{ marginBottom: 4 }}>
              <Col>
                <Text strong style={{ fontSize: 13 }}>{label}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>{desc}</Text>
              </Col>
              <Col>
                <Text strong style={{ color, fontSize: 20 }}>
                  {settings[key].toFixed(2)}
                </Text>
              </Col>
            </Row>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={settings[key]}
              onChange={v => set(key, v)}
              styles={{
                track:  { background: color },
                handle: { borderColor: color },
              }}
            />
          </div>
        ))}
      </Card>

      <Card title="Analysis Parameters" style={{ marginBottom: 24 }}>
        <Form layout="vertical">
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="Velocity window"
                help="Days of order history used for velocity scoring"
                style={{ marginBottom: 0 }}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  max={365}
                  addonAfter="days"
                  value={settings.velocityDays}
                  onChange={v => set('velocityDays', v ?? 90)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Default cart capacity"
                help="Used in route optimisation — 0 means unlimited"
                style={{ marginBottom: 0 }}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  addonAfter="kg"
                  value={settings.cartCapacityKg}
                  onChange={v => set('cartCapacityKg', v ?? 0)}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {saved && (
        <Alert
          type="success"
          message="Settings saved to browser storage."
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Space>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
          Save Settings
        </Button>
        <Button icon={<ReloadOutlined />} onClick={handleReset}>
          Reset to Defaults
        </Button>
      </Space>
    </div>
  );
}
