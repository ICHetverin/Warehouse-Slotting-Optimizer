import type { ReactNode } from 'react';
import { Button } from 'antd';
import { ShopOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useWarehouse } from '../../app/WarehouseContext';
import { SectionCard } from './SectionCard';
import { EmptyState } from './EmptyState';

/**
 * Gate page content behind a selected warehouse. When none is selected it
 * shows a friendly prompt that points the user to the Warehouses page
 * (where they can pick one or load demo data) — no more manual ID entry.
 */
export function RequireWarehouse({ children }: { children: (warehouseId: number) => ReactNode }) {
  const { warehouseId, warehouses, loading } = useWarehouse();
  const navigate = useNavigate();

  if (warehouseId != null) return <>{children(warehouseId)}</>;

  return (
    <SectionCard>
      <EmptyState
        icon={<ShopOutlined />}
        title={loading ? 'Загрузка складов…' : 'Сначала выберите склад'}
        description={
          warehouses.length
            ? 'Выберите склад в селекторе сверху, чтобы увидеть данные на этой странице.'
            : 'Складов пока нет. Создайте склад или загрузите демо-данные Mendeley в один клик.'
        }
        action={
          !loading && (
            <Button type="primary" onClick={() => navigate('/warehouses')}>
              {warehouses.length ? 'К списку складов' : 'Создать / загрузить данные'}
            </Button>
          )
        }
      />
    </SectionCard>
  );
}
