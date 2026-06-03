import {
  BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate,
} from 'react-router-dom';
import { ConfigProvider, Layout, Menu, Typography, Button, Tag, Spin } from 'antd';
import type { MenuProps } from 'antd';
import {
  UploadOutlined,
  AppstoreOutlined,
  BulbOutlined,
  BarChartOutlined,
  NodeIndexOutlined,
  SettingOutlined,
  LineChartOutlined,
  DatabaseOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { UploadPage }          from './pages/UploadPage';
import { ScoringPage }         from './pages/ScoringPage';
import { WarehouseMapPage }    from './pages/WarehouseMapPage';
import { RoutesPage }          from './pages/RoutesPage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { AnalyticsPage }       from './pages/AnalyticsPage';
import { SettingsPage }        from './pages/SettingsPage';
import { LandingPage }         from './pages/LandingPage';
import { DatasetImportPage }   from './pages/DatasetImportPage';
import { LoginPage }           from './pages/LoginPage';
import { RegisterPage }        from './pages/RegisterPage';
import { WarehousesPage }      from './pages/WarehousesPage';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { appTheme }            from './theme';
import type { ReactNode }      from 'react';

const { Sider, Content } = Layout;

const NAV_ITEMS: MenuProps['items'] = [
  { key: '/warehouses',      label: 'Мои склады',       icon: <DatabaseOutlined /> },
  { key: '/upload',          label: 'Загрузка данных',  icon: <UploadOutlined /> },
  { key: '/dataset-import',  label: 'Импорт датасета',  icon: <LineChartOutlined /> },
  { key: '/map',             label: 'Карта склада',     icon: <AppstoreOutlined /> },
  { key: '/recommendations', label: 'Рекомендации',    icon: <BulbOutlined /> },
  { key: '/scoring',         label: 'Скоринг',          icon: <BarChartOutlined /> },
  { key: '/routes',          label: 'Маршруты',         icon: <NodeIndexOutlined /> },
  { key: '/analytics',       label: 'Аналитика',        icon: <LineChartOutlined /> },
  { key: '/settings',        label: 'Настройки',        icon: <SettingOutlined /> },
];

const NAV_KEYS = NAV_ITEMS!.map(item => (item as { key: string }).key);

/** Gate: requires a valid session, otherwise bounces to /login preserving the target. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

function AppShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isGuest, logout } = useAuth();

  const selectedKey =
    NAV_KEYS.find(k => pathname === k || pathname.startsWith(k + '/')) ?? '/warehouses';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={208}
        theme="light"
        style={{
          borderRight: '1px solid #f0f0f0',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'auto',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{ padding: '20px 16px 14px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
          onClick={() => navigate('/warehouses')}
        >
          <Typography.Text
            style={{
              fontSize: 11, fontWeight: 700, color: '#8c8c8c',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}
          >
            Оптимизатор склада
          </Typography.Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={NAV_ITEMS}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none', paddingTop: 8, flex: 1 }}
        />
        <div style={{ borderTop: '1px solid #f0f0f0', padding: '12px 16px' }}>
          {isGuest && <Tag color="blue" style={{ marginBottom: 8 }}>Демо-режим</Tag>}
          <div style={{ marginBottom: 8 }}>
            <Typography.Text style={{ fontSize: 12, color: '#8c8c8c' }} ellipsis>
              {user?.email}
            </Typography.Text>
          </div>
          <Button size="small" icon={<LogoutOutlined />} onClick={handleLogout} block>
            {isGuest ? 'Выйти из демо' : 'Выйти'}
          </Button>
        </div>
      </Sider>
      <Content style={{ background: '#f5f5f5', overflow: 'auto' }}>
        <Routes>
          <Route path="/warehouses"      element={<WarehousesPage />} />
          <Route path="/upload"          element={<UploadPage />} />
          <Route path="/dataset-import"  element={<DatasetImportPage />} />
          <Route path="/map"             element={<WarehouseMapPage />} />
          <Route path="/scoring"         element={<ScoringPage />} />
          <Route path="/routes"          element={<RoutesPage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route path="/analytics"       element={<AnalyticsPage />} />
          <Route path="/settings"        element={<SettingsPage />} />
          <Route path="*"                element={<Navigate to="/warehouses" replace />} />
        </Routes>
      </Content>
    </Layout>
  );
}

export function App() {
  return (
    <ConfigProvider theme={appTheme}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/"         element={<LandingPage />} />
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/*"        element={<RequireAuth><AppShell /></RequireAuth>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}
