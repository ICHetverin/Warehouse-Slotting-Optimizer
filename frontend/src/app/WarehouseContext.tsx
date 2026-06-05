import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import type { Warehouse } from '../types';

const STORAGE_KEY = 'wso.selectedWarehouseId';

interface WarehouseContextValue {
  warehouses: Warehouse[];
  warehouseId: number | null;
  warehouse: Warehouse | null;
  loading: boolean;
  error: string | null;
  select: (id: number | null) => void;
  refresh: () => Promise<Warehouse[]>;
}

const WarehouseContext = createContext<WarehouseContextValue | null>(null);

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<number | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const select = useCallback((id: number | null) => {
    setWarehouseId(id);
    if (id == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(id));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listWarehouses();
      setWarehouses(list);
      // keep selection valid; default to first warehouse when none chosen
      setWarehouseId(prev => {
        if (prev != null && list.some(w => w.id === prev)) return prev;
        const next = list.length ? list[list.length - 1].id : null;
        if (next != null) localStorage.setItem(STORAGE_KEY, String(next));
        return next;
      });
      return list;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить склады');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const warehouse = useMemo(
    () => warehouses.find(w => w.id === warehouseId) ?? null,
    [warehouses, warehouseId],
  );

  const value = useMemo<WarehouseContextValue>(
    () => ({ warehouses, warehouseId, warehouse, loading, error, select, refresh }),
    [warehouses, warehouseId, warehouse, loading, error, select, refresh],
  );

  return <WarehouseContext.Provider value={value}>{children}</WarehouseContext.Provider>;
}

export function useWarehouse(): WarehouseContextValue {
  const ctx = useContext(WarehouseContext);
  if (!ctx) throw new Error('useWarehouse must be used within WarehouseProvider');
  return ctx;
}
