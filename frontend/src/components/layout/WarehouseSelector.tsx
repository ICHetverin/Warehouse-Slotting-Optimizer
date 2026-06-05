import { Select, Typography } from 'antd';
import { ShopOutlined } from '@ant-design/icons';
import { useWarehouse } from '../../app/WarehouseContext';
import { tokens } from '../../theme';

/** Global warehouse picker shown in the header — every page reads from it. */
export function WarehouseSelector() {
  const { warehouses, warehouseId, select, loading } = useWarehouse();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, justifyContent: 'flex-end' }}>
      <Typography.Text style={{ color: tokens.textTertiary, fontSize: 13, flexShrink: 0 }} className="wso-hide-mobile">
        Склад
      </Typography.Text>
      <Select
        style={{ flex: 1, minWidth: 130, maxWidth: 240 }}
        loading={loading}
        value={warehouseId ?? undefined}
        placeholder="Выберите склад"
        onChange={v => select(v ?? null)}
        suffixIcon={<ShopOutlined />}
        showSearch
        optionFilterProp="label"
        notFoundContent={loading ? 'Загрузка…' : 'Складов пока нет'}
        options={warehouses.map(w => ({
          value: w.id,
          label: `${w.name}  ·  #${w.id}`,
        }))}
      />
    </div>
  );
}
