import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  App, Button, Col, Form, Input, InputNumber, Row, Select, Space, Table, Tag, Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ShopOutlined, PlusOutlined, ThunderboltOutlined, CheckCircleFilled, DatabaseOutlined,
} from '@ant-design/icons';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { StatCard } from '../components/common/StatCard';
import { useWarehouse } from '../app/WarehouseContext';
import { api } from '../api/client';
import type { DatasetInfo, StorageStrategy, Warehouse } from '../types';
import { tokens } from '../theme';

const STRATEGIES: { value: StorageStrategy; label: string }[] = [
  { value: 'CLASS_BASED', label: 'Class-based (по классам)' },
  { value: 'DEDICATED', label: 'Dedicated (выделенные)' },
  { value: 'HYBRID', label: 'Hybrid (гибрид)' },
  { value: 'RANDOM', label: 'Random (случайно)' },
];

export function WarehousesPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { warehouses, warehouseId, select, refresh, loading } = useWarehouse();

  const [name, setName] = useState('');
  const [rows, setRows] = useState(25);
  const [cols, setCols] = useState(20);
  const [creating, setCreating] = useState(false);

  const [mendeleyStrategy, setMendeleyStrategy] = useState<StorageStrategy>('CLASS_BASED');
  const [examples, setExamples] = useState<DatasetInfo[]>([]);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const [counts, setCounts] = useState<{ skus: number; slots: number; placed: number } | null>(null);

  useEffect(() => { api.listExamples().then(setExamples).catch(() => setExamples([])); }, []);

  useEffect(() => {
    let alive = true;
    if (warehouseId == null) { setCounts(null); return; }
    Promise.all([api.getWarehouseSkus(warehouseId), api.getWarehouseSlots(warehouseId)])
      .then(([skus, slots]) => {
        if (!alive) return;
        setCounts({
          skus: skus.length,
          slots: slots.length,
          placed: slots.filter(s => s.currentSkuId != null).length,
        });
      })
      .catch(() => alive && setCounts(null));
    return () => { alive = false; };
  }, [warehouseId]);

  const create = async () => {
    if (!name.trim()) { message.warning('Введите название склада'); return; }
    setCreating(true);
    try {
      const wh = await api.createWarehouse({
        name: name.trim(), rows, columns: cols, dockX: 0, dockY: 0, aisleWidthM: 1.5,
      });
      await refresh();
      select(wh.id);
      setName('');
      message.success(`Склад «${wh.name}» создан`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Не удалось создать склад');
    } finally {
      setCreating(false);
    }
  };

  const loadExample = async (info: DatasetInfo) => {
    setLoadingKey(info.key);
    try {
      const res = await api.loadExample(info.key, info.hasStrategies ? mendeleyStrategy : undefined);
      await refresh();
      select(res.warehouseId);
      message.success(
        `«${info.title}»: ${res.skuCount} SKU, ${res.slotCount} слотов, ${res.orderCount.toLocaleString()} заказов`,
      );
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Импорт не удался');
    } finally {
      setLoadingKey(null);
    }
  };

  const columns: ColumnsType<Warehouse> = [
    {
      title: 'Склад',
      dataIndex: 'name',
      render: (v, r) => (
        <Space>
          <ShopOutlined style={{ color: tokens.textTertiary }} />
          <span style={{ fontWeight: 500 }}>{v}</span>
          {r.id === warehouseId && <Tag color="blue">активный</Tag>}
        </Space>
      ),
    },
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: 'Сетка', key: 'grid', width: 110, render: (_, r) => `${r.rows} × ${r.columns}` },
    {
      title: 'Док', key: 'dock', width: 90,
      render: (_, r) => `(${r.dockX}, ${r.dockY})`,
    },
    {
      title: '', key: 'action', width: 130, align: 'right',
      render: (_, r) =>
        r.id === warehouseId ? (
          <CheckCircleFilled style={{ color: tokens.success }} />
        ) : (
          <Button size="small" onClick={() => select(r.id)}>Выбрать</Button>
        ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        icon={<ShopOutlined />}
        title="Склады"
        description="Выберите активный склад, загрузите готовый пример из реальных данных одной кнопкой или создайте новый. Активный склад используется на всех страницах."
      />

      {counts && (
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col xs={12} md={6}><StatCard label="SKU" value={counts.skus.toLocaleString()} tone="primary" /></Col>
          <Col xs={12} md={6}><StatCard label="Слотов" value={counts.slots.toLocaleString()} /></Col>
          <Col xs={12} md={6}>
            <StatCard label="Размещено" value={counts.placed.toLocaleString()} tone="success" />
          </Col>
          <Col xs={12} md={6}>
            <StatCard
              label="Заполненность"
              value={counts.slots ? Math.round((counts.placed / counts.slots) * 100) : 0}
              suffix="%"
            />
          </Col>
        </Row>
      )}

      {examples.length > 0 && (
        <SectionCard
          title="Готовые примеры для демонстрации"
          description="Реальные публичные датасеты — загрузите в один клик и сразу оптимизируйте."
          style={{ marginBottom: 20 }}
        >
          <Row gutter={[16, 16]}>
            {examples.map(ex => (
              <Col xs={24} md={8} key={ex.key}>
                <div style={{
                  border: `1px solid ${tokens.border}`, borderRadius: 12, padding: 16,
                  height: '100%', display: 'flex', flexDirection: 'column',
                  borderTop: `3px solid ${tokens.primary}`,
                }}>
                  <Space style={{ marginBottom: 6 }}>
                    <DatabaseOutlined style={{ color: tokens.primary }} />
                    <Typography.Text strong>{ex.title}</Typography.Text>
                  </Space>
                  <Space size={6} wrap style={{ marginBottom: 8 }}>
                    <Tag>{ex.source}</Tag>
                    {ex.realLayout && <Tag color="green">реальный layout</Tag>}
                  </Space>
                  <Typography.Paragraph type="secondary" style={{ fontSize: 12, flex: 1 }}>
                    {ex.description}
                  </Typography.Paragraph>
                  {ex.hasStrategies && (
                    <Select<StorageStrategy>
                      size="small" value={mendeleyStrategy} onChange={setMendeleyStrategy}
                      options={STRATEGIES} style={{ width: '100%', marginBottom: 8 }}
                    />
                  )}
                  <Button
                    type="primary" icon={<ThunderboltOutlined />} block
                    loading={loadingKey === ex.key}
                    disabled={loadingKey != null && loadingKey !== ex.key}
                    onClick={() => loadExample(ex)}
                  >
                    Загрузить
                  </Button>
                </div>
              </Col>
            ))}
          </Row>
        </SectionCard>
      )}

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <SectionCard title="Список складов" description="Нажмите «Выбрать», чтобы сделать склад активным.">
            <Table<Warehouse>
              rowKey="id"
              loading={loading}
              dataSource={warehouses}
              columns={columns}
              size="small"
              pagination={false}
              onRow={r => ({ onClick: () => select(r.id), style: { cursor: 'pointer' } })}
            />
          </SectionCard>
        </Col>

        <Col xs={24} lg={10}>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <SectionCard title="Создать пустой склад">
              <Form layout="vertical">
                <Form.Item label="Название" style={{ marginBottom: 12 }}>
                  <Input
                    placeholder="напр. Главный склад"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onPressEnter={create}
                  />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item label="Строк" style={{ marginBottom: 12 }}>
                      <InputNumber min={1} value={rows} onChange={v => setRows(v ?? 1)} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Колонок" style={{ marginBottom: 12 }}>
                      <InputNumber min={1} value={cols} onChange={v => setCols(v ?? 1)} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Button icon={<PlusOutlined />} block loading={creating} onClick={create}>
                  Создать склад
                </Button>
                <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '12px 0 0' }}>
                  Затем загрузите layout, SKU и заказы на странице{' '}
                  <a onClick={() => navigate('/import')}>Импорт данных</a>.
                </Typography.Paragraph>
              </Form>
            </SectionCard>
          </Space>
        </Col>
      </Row>
    </PageContainer>
  );
}
