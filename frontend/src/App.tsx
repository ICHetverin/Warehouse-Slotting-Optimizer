import { BrowserRouter } from 'react-router-dom';
import { App as AntdApp, ConfigProvider } from 'antd';
import { appTheme } from './theme';
import { WarehouseProvider } from './app/WarehouseContext';
import { WeightsProvider } from './app/WeightsContext';
import { AppLayout } from './components/layout/AppLayout';

export function App() {
  return (
    <ConfigProvider theme={appTheme}>
      <AntdApp>
        <BrowserRouter>
          <WarehouseProvider>
            <WeightsProvider>
              <AppLayout />
            </WeightsProvider>
          </WarehouseProvider>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
}
