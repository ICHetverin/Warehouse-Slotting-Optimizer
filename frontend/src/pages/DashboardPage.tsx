import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Col, Row, Space, Spin, Typography } from 'antd';
import {
  DashboardOutlined, ShopOutlined, BulbOutlined, ArrowRightOutlined,
} from '@ant-design/icons';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { StatCard } from '../components/common/StatCard';
import { EmptyState } from '../components/common/EmptyState';
import { useWarehouse } from '../app/WarehouseContext';
import { openDemoTour } from '../components/DemoTour';
import { api } from '../api/client';
import type { AbcXyzMatrixResponse, RecommendationResponse } from '../types';
import { tokens } from '../theme';

interface Overview {
  skus: number;
  slots: number;
  placed: number;
  grid: string;
  abc: AbcXyzMatrixResponse | null;
  recs: RecommendationResponse[];
}

function DashboardBody({ warehouseId, name }: { warehouseId: number; name: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      api.getWarehouse(warehouseId).catch(() => null),
      api.getWarehouseSkus(warehouseId),
      api.getWarehouseSlots(warehouseId),
      api.getAbcXyz(warehouseId, 1200).catch(() => null),
      api.listRecommendations(warehouseId, { limit: 200 }).catch(() => []),
    ])
      .then(([wh, skus, slots, abc, recs]) => {
        if (!alive) return;
        setData({
          skus: skus.length,
          slots: slots.length,
          placed: slots.filter(s => s.currentSkuId != null).length,
          grid: wh ? `${wh.rows} × ${wh.columns}, док (${wh.dockX},${wh.dockY})` : '',
          abc,
          recs,
        });
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [warehouseId]);

  if (loading || !data) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  const abcDist = ['A', 'B', 'C'].map(c => ({
    cls: c,
    count: data.abc
      ? Object.values(data.abc.matrix[c] ?? {}).reduce((s, n) => s + n, 0)
      : 0,
  }));
  const pending = data.recs.filter(r => r.status === 'PENDING').length;
  const fill = data.slots ? Math.round((data.placed / data.slots) * 100) : 0;

  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      <Row gutter={16}>
        <Col xs={12} md={6}><StatCard label="Активный склад" value={<span style={{ fontSize: 18 }}>{name}</span>} hint={data.grid} icon={<ShopOutlined />} /></Col>
        <Col xs={12} md={6}><StatCard label="SKU" value={data.skus.toLocaleString()} tone="primary" /></Col>
        <Col xs={12} md={6}><StatCard label="Слотов" value={data.slots.toLocaleString()} /></Col>
        <Col xs={12} md={6}><StatCard label="Заполненность" value={fill} suffix="%" tone="success" /></Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={14}>
          <SectionCard title="Распределение ABC" description="Доля товаров по вкладу в общий отбор (класс A — самые востребованные).">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={abcDist} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.borderSoft} vertical={false} />
                <XAxis dataKey="cls" tick={{ fontSize: 12, fill: tokens.textSecondary }} />
                <YAxis tick={{ fontSize: 11, fill: tokens.textTertiary }} allowDecimals={false} />
                <Tooltip
                  formatter={(v: number) => [`${v} SKU`, 'Количество']}
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${tokens.border}` }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                  {abcDist.map((_, i) => <Cell key={i} fill={tokens.chart[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </Col>
        <Col xs={24} md={10}>
          <SectionCard title="Дальнейшие шаги" description="Что можно сделать с этим складом.">
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <BulbOutlined style={{ color: tokens.warning }} />
                  <Typography.Text>Рекомендации</Typography.Text>
                  {pending > 0 && <Badge count={pending} color={tokens.primary} />}
                </Space>
                <Button size="small" onClick={() => navigate('/recommendations')}>
                  Открыть <ArrowRightOutlined />
                </Button>
              </div>
              <Button block onClick={() => navigate('/scoring')}>Запустить скоринг</Button>
              <Button block onClick={() => navigate('/map')}>Посмотреть карту склада</Button>
              <Button block onClick={() => navigate('/simulation')}>Симуляция экономии</Button>
            </Space>
          </SectionCard>
        </Col>
      </Row>
    </Space>
  );
}

export function DashboardPage() {
  const { warehouse, warehouseId, loading } = useWarehouse();
  const navigate = useNavigate();

  return (
    <PageContainer>
      <PageHeader
        icon={<DashboardOutlined />}
        title="Обзор"
        description="Сводка по активному складу и быстрые переходы к ключевым действиям."
      />
      {warehouseId == null ? (
        <SectionCard>
          <EmptyState
            icon={<ShopOutlined />}
            title={loading ? 'Загрузка…' : 'Начните с данных'}
            description="Выберите склад в шапке или загрузите демо-датасет Mendeley в один клик — и здесь появится сводка."
            action={!loading && (
              <Space>
                <Button type="primary" onClick={() => navigate('/warehouses')}>К складам</Button>
                <Button onClick={openDemoTour}>Демо-тур</Button>
              </Space>
            )}
          />
        </SectionCard>
      ) : (
        <DashboardBody warehouseId={warehouseId} name={warehouse?.name ?? `#${warehouseId}`} />
      )}
    </PageContainer>
  );
}
