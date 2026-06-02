import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ConfigProvider, Layout, Menu, Typography } from 'antd';
import type { MenuProps } from 'antd';
import {
  UploadOutlined,
  AppstoreOutlined,
  BulbOutlined,
  BarChartOutlined,
  NodeIndexOutlined,
  SettingOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { UploadPage }          from './pages/UploadPage';
import { ScoringPage }         from './pages/ScoringPage';
import { WarehouseMapPage }    from './pages/WarehouseMapPage';
import { RoutesPage }          from './pages/RoutesPage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { AnalyticsPage }       from './pages/AnalyticsPage';
import { SettingsPage }        from './pages/SettingsPage';
import { LandingPage }         from './pages/LandingPage';
import { appTheme }            from './theme';

const { Sider, Content } = Layout;

const NAV_ITEMS: MenuProps['items'] = [
  { key: '/upload',          label: 'Import Data',     icon: <UploadOutlined /> },
  { key: '/map',             label: 'Warehouse Map',   icon: <AppstoreOutlined /> },
  { key: '/recommendations', label: 'Recommendations', icon: <BulbOutlined /> },
  { key: '/scoring',         label: 'Scoring',         icon: <BarChartOutlined /> },
  { key: '/routes',          label: 'Routes',          icon: <NodeIndexOutlined /> },
  { key: '/analytics',       label: 'Analytics',       icon: <LineChartOutlined /> },
  { key: '/settings',        label: 'Settings',        icon: <SettingOutlined /> },
];

const NAV_KEYS = NAV_ITEMS!.map(item => (item as { key: string }).key);

function AppShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const selectedKey =
    NAV_KEYS.find(k => pathname === k || pathname.startsWith(k + '/')) ?? '/upload';

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
        }}
      >
        <div
          style={{
            padding: '20px 16px 14px',
            borderBottom: '1px solid #f0f0f0',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/')}
        >
          <Typography.Text
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#8c8c8c',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Warehouse Optimizer
          </Typography.Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={NAV_ITEMS}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none', paddingTop: 8 }}
        />
      </Sider>
      <Content style={{ background: '#f5f5f5', overflow: 'auto' }}>
        <Routes>
          <Route path="/upload"          element={<UploadPage />} />
          <Route path="/map"             element={<WarehouseMapPage />} />
          <Route path="/scoring"         element={<ScoringPage />} />
          <Route path="/routes"          element={<RoutesPage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route path="/analytics"       element={<AnalyticsPage />} />
          <Route path="/settings"        element={<SettingsPage />} />
          <Route path="*"                element={<UploadPage />} />
        </Routes>
      </Content>
    </Layout>
  );
}

export function App() {
  return (
    <ConfigProvider theme={appTheme}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/*" element={<AppShell />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
