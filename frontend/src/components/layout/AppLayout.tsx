import { lazy, Suspense, useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Grid, Drawer, Space, Spin } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  ShopOutlined,
  UploadOutlined,
  SlidersOutlined,
  BulbOutlined,
  ExperimentOutlined,
  AppstoreOutlined,
  PartitionOutlined,
  DeploymentUnitOutlined,
  NodeIndexOutlined,
  PlayCircleOutlined,
  MenuOutlined,
  CompassOutlined,
} from '@ant-design/icons';
import { WarehouseSelector } from './WarehouseSelector';
import { HealthBadge } from './HealthBadge';
import { DemoTour, openDemoTour } from '../DemoTour';
import { tokens } from '../../theme';

const DashboardPage = lazy(() => import('../../pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const WarehousesPage = lazy(() => import('../../pages/WarehousesPage').then(m => ({ default: m.WarehousesPage })));
const ImportPage = lazy(() => import('../../pages/ImportPage').then(m => ({ default: m.ImportPage })));
const ScoringPage = lazy(() => import('../../pages/ScoringPage').then(m => ({ default: m.ScoringPage })));
const RecommendationsPage = lazy(() => import('../../pages/RecommendationsPage').then(m => ({ default: m.RecommendationsPage })));
const TuningPage = lazy(() => import('../../pages/TuningPage').then(m => ({ default: m.TuningPage })));
const WarehouseMapPage = lazy(() => import('../../pages/WarehouseMapPage').then(m => ({ default: m.WarehouseMapPage })));
const AbcXyzPage = lazy(() => import('../../pages/AbcXyzPage').then(m => ({ default: m.AbcXyzPage })));
const CopickPage = lazy(() => import('../../pages/CopickPage').then(m => ({ default: m.CopickPage })));
const RoutesPage = lazy(() => import('../../pages/RoutesPage').then(m => ({ default: m.RoutesPage })));
const SimulationPage = lazy(() => import('../../pages/SimulationPage').then(m => ({ default: m.SimulationPage })));

const { Sider, Header, Content } = Layout;

const NAV: MenuProps['items'] = [
  { key: '/', label: 'Обзор', icon: <DashboardOutlined /> },
  {
    type: 'group',
    label: 'Данные',
    children: [
      { key: '/warehouses', label: 'Склады', icon: <ShopOutlined /> },
      { key: '/import', label: 'Импорт данных', icon: <UploadOutlined /> },
    ],
  },
  {
    type: 'group',
    label: 'Оптимизация',
    children: [
      { key: '/scoring', label: 'Скоринг', icon: <SlidersOutlined /> },
      { key: '/recommendations', label: 'Рекомендации', icon: <BulbOutlined /> },
      { key: '/tuning', label: 'Автотюнинг', icon: <ExperimentOutlined /> },
    ],
  },
  {
    type: 'group',
    label: 'Аналитика',
    children: [
      { key: '/map', label: 'Карта склада', icon: <AppstoreOutlined /> },
      { key: '/abcxyz', label: 'ABC / XYZ', icon: <PartitionOutlined /> },
      { key: '/copick', label: 'Co-pick матрица', icon: <DeploymentUnitOutlined /> },
    ],
  },
  {
    type: 'group',
    label: 'Маршруты',
    children: [
      { key: '/routes', label: 'Маршрут пикера', icon: <NodeIndexOutlined /> },
      { key: '/simulation', label: 'Симуляция', icon: <PlayCircleOutlined /> },
    ],
  },
];

const ALL_KEYS = ['/', '/warehouses', '/import', '/scoring', '/recommendations', '/tuning',
  '/map', '/abcxyz', '/copick', '/routes', '/simulation'];

function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.violet})`,
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          fontSize: 16,
        }}
      >
        <DeploymentUnitOutlined />
      </div>
      <span style={{ fontWeight: 700, fontSize: 15, color: tokens.ink, letterSpacing: '-0.01em' }}>
        Slotting&nbsp;Optimizer
      </span>
    </div>
  );
}

function NavMenu({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const selected =
    ALL_KEYS.filter(k => k !== '/').find(k => pathname.startsWith(k)) ??
    (pathname === '/' ? '/' : '/');
  return (
    <Menu
      mode="inline"
      selectedKeys={[selected]}
      items={NAV}
      style={{ border: 'none', paddingTop: 8 }}
      onClick={({ key }) => {
        navigate(key);
        onNavigate?.();
      }}
    />
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>}>
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/warehouses" element={<WarehousesPage />} />
      <Route path="/import" element={<ImportPage />} />
      <Route path="/scoring" element={<ScoringPage />} />
      <Route path="/recommendations" element={<RecommendationsPage />} />
      <Route path="/tuning" element={<TuningPage />} />
      <Route path="/map" element={<WarehouseMapPage />} />
      <Route path="/abcxyz" element={<AbcXyzPage />} />
      <Route path="/copick" element={<CopickPage />} />
      <Route path="/routes" element={<RoutesPage />} />
      <Route path="/simulation" element={<SimulationPage />} />
      <Route path="*" element={<DashboardPage />} />
    </Routes>
    </Suspense>
  );
}

export function AppLayout() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider
          width={232}
          theme="light"
          style={{
            borderRight: `1px solid ${tokens.border}`,
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflow: 'auto',
          }}
        >
          <div style={{ padding: '18px 18px 12px' }}>
            <Brand />
          </div>
          <NavMenu />
        </Sider>
      )}

      <Drawer
        open={drawerOpen}
        placement="left"
        onClose={() => setDrawerOpen(false)}
        styles={{ body: { padding: 0 }, header: { display: 'none' } }}
      >
        <div style={{ padding: '18px 18px 12px' }}>
          <Brand />
        </div>
        <NavMenu onNavigate={() => setDrawerOpen(false)} />
      </Drawer>

      <Layout>
        <Header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${tokens.border}`,
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobile && (
              <Button type="text" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} />
            )}
            <Button type="text" icon={<CompassOutlined />} onClick={openDemoTour}>
              {isMobile ? '' : 'Демо-тур'}
            </Button>
          </div>
          <Space size={20}>
            <HealthBadge />
            <WarehouseSelector />
          </Space>
        </Header>
        <Content style={{ overflow: 'auto' }}>
          <AppRoutes />
        </Content>
        <DemoTour />
      </Layout>
    </Layout>
  );
}
