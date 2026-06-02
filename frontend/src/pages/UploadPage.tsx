import { useState, useEffect } from 'react';
import {
  Steps, Card, Form, Input, Select, Button,
  Alert, Space, Typography, Divider, message,
} from 'antd';
import { CheckCircleFilled, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { DropZone } from '../components/Upload/DropZone';
import { api } from '../api/client';
import type { Warehouse } from '../types';

const { Title, Text, Paragraph } = Typography;

type StepKey = 'warehouse' | 'layout' | 'skus' | 'orders' | 'done';

const STEP_KEYS:   StepKey[] = ['warehouse', 'layout', 'skus', 'orders', 'done'];
const STEP_TITLES             = ['Склад', 'Планировка', 'Артикулы', 'Заказы', 'Готово'];

interface StepResult {
  label: string;
  count: number;
}

function DemoBanner() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleDemo = async () => {
    setLoading(true);
    try {
      const res = await api.seedDemo();
      message.success(`Демо загружено — ID склада: ${res.data.warehouseId}`);
      navigate(`/recommendations?wid=${res.data.warehouseId}`);
    } catch {
      message.error('Не удалось загрузить демо — запущен ли бэкенд?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      style={{ marginBottom: 24, background: '#EFF6FF', border: '1px solid #BFDBFE' }}
      styles={{ body: { padding: '16px 20px' } }}
    >
      <Space align="start">
        <ThunderboltOutlined style={{ color: '#1677ff', fontSize: 18, marginTop: 2 }} />
        <div>
          <Text strong style={{ fontSize: 14 }}>Пропустить загрузку — попробовать демо</Text>
          <div>
            <Text style={{ fontSize: 13, color: '#595959' }}>
              1&thinsp;000 артикулов, 500 ячеек и 10&thinsp;000 заказов — мгновенно.
            </Text>
          </div>
          <Button
            type="link"
            loading={loading}
            onClick={handleDemo}
            style={{ padding: 0, height: 'auto', marginTop: 6, fontSize: 13 }}
          >
            Загрузить демо-данные →
          </Button>
        </div>
      </Space>
    </Card>
  );
}

export function UploadPage() {
  const [step, setStep]             = useState<StepKey>('warehouse');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWh, setSelectedWh] = useState<number | null>(null);
  const [newWhName, setNewWhName]   = useState('');
  const [results, setResults]       = useState<StepResult[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    api.listWarehouses().then(r => setWarehouses(r.data)).catch(() => {});
  }, []);

  const currentIdx = STEP_KEYS.indexOf(step);

  const handleError = (msg: string) => { setError(msg); setLoading(false); };
  const handleOk    = (label: string, count: number) => {
    setResults(prev => [...prev, { label, count }]);
    setError(null);
    setLoading(false);
  };

  const handleWarehouse = async () => {
    if (selectedWh) { setStep('layout'); return; }
    if (!newWhName.trim()) { setError('Введите название склада'); return; }
    setLoading(true);
    try {
      const res = await api.createWarehouse({
        name: newWhName.trim(), rows: 25, columns: 20,
        dockX: 0, dockY: 0, aisleWidthM: 1.5,
      });
      setSelectedWh(res.data.id);
      setWarehouses(prev => [...prev, res.data]);
      setStep('layout');
    } catch { handleError('Не удалось создать склад'); }
  };

  const upload = async (
    file: File,
    fn: (wid: number, f: File) => ReturnType<typeof api.uploadLayout>,
    label: string,
    next: StepKey,
  ) => {
    if (!selectedWh) return;
    setLoading(true);
    try {
      const res = await fn(selectedWh, file);
      handleOk(label, res.data.imported);
      setStep(next);
    } catch (e: unknown) {
      handleError(e instanceof Error ? e.message : 'Ошибка загрузки');
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 16px' }}>
      <Title level={3} style={{ marginBottom: 4 }}>Загрузка данных</Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Загрузите планировку склада, каталог артикулов и историю заказов для начала скоринга.
      </Paragraph>

      <DemoBanner />

      <Divider style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 12, color: '#8c8c8c' }}>или загрузите свои данные</Text>
      </Divider>

      <Steps
        current={currentIdx}
        size="small"
        items={STEP_TITLES.map((title, i) => ({
          title,
          status: (i < currentIdx ? 'finish' : i === currentIdx ? 'process' : 'wait') as
            'finish' | 'process' | 'wait',
        }))}
        style={{ marginBottom: 32 }}
      />

      {results.length > 0 && (
        <Space direction="vertical" size={4} style={{ width: '100%', marginBottom: 24 }}>
          {results.map((r, i) => (
            <Space key={i} size={8}>
              <CheckCircleFilled style={{ color: '#16A34A' }} />
              <Text style={{ fontSize: 13 }}>
                {r.label}: <Text strong>{r.count.toLocaleString('ru-RU')}</Text> записей импортировано
              </Text>
            </Space>
          ))}
        </Space>
      )}

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

      {step === 'warehouse' && (
        <Card title="1. Выбрать или создать склад">
          <Form layout="vertical">
            {warehouses.length > 0 && (
              <Form.Item label="Существующие склады">
                <Select
                  placeholder="— создать новый —"
                  value={selectedWh ?? undefined}
                  onChange={(v: number | undefined) => setSelectedWh(v ?? null)}
                  allowClear
                  options={warehouses.map(w => ({ label: w.name, value: w.id }))}
                />
              </Form.Item>
            )}
            {!selectedWh && (
              <Form.Item label="Название нового склада">
                <Input
                  placeholder="например Главный склад — Киев"
                  value={newWhName}
                  onChange={e => setNewWhName(e.target.value)}
                  onPressEnter={handleWarehouse}
                />
              </Form.Item>
            )}
            <Button type="primary" block loading={loading} onClick={handleWarehouse}>
              {selectedWh ? 'Продолжить' : 'Создать и продолжить'}
            </Button>
          </Form>
        </Card>
      )}

      {step === 'layout' && (
        <Card title="2. Загрузить планировку склада">
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            Формат CSV: <Text code>slot_label, row, col, level, zone, capacity_kg</Text>
          </Paragraph>
          <DropZone
            label="Перетащите layout.csv сюда"
            hint="slot_label, row, col, level, zone, capacity_kg"
            disabled={loading}
            onFile={f => upload(f, api.uploadLayout.bind(api), 'Планировка', 'skus')}
          />
        </Card>
      )}

      {step === 'skus' && (
        <Card title="3. Загрузить каталог артикулов">
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            Формат CSV: <Text code>code, name, weight_kg, volume_m3, category</Text>
          </Paragraph>
          <DropZone
            label="Перетащите skus.csv сюда"
            hint="code, name, weight_kg, volume_m3, category"
            disabled={loading}
            onFile={f => upload(f, api.uploadSkus.bind(api), 'Артикулы', 'orders')}
          />
        </Card>
      )}

      {step === 'orders' && (
        <Card title="4. Загрузить историю заказов">
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            Формат CSV: <Text code>order_id, sku_code, quantity, timestamp</Text>
          </Paragraph>
          <DropZone
            label="Перетащите orders.csv сюда"
            hint="order_id, sku_code, quantity, timestamp"
            disabled={loading}
            onFile={f => upload(f, api.uploadOrders.bind(api), 'Заказы', 'done')}
          />
        </Card>
      )}

      {step === 'done' && (
        <Card title="Всё готово!">
          <Paragraph style={{ marginBottom: 16 }}>
            Данные загружены. Перейдите в <Text strong>Скоринг</Text> для получения рекомендаций по размещению.
          </Paragraph>
          <Button type="primary" block href="/scoring">
            Запустить скоринг
          </Button>
        </Card>
      )}
    </div>
  );
}
