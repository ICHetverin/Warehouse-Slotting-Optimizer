import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Space, Tag, Typography } from 'antd';
import { UploadOutlined, CheckCircleFilled } from '@ant-design/icons';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { RequireWarehouse } from '../components/common/RequireWarehouse';
import { DropZone } from '../components/Upload/DropZone';
import { api } from '../api/client';
import { tokens } from '../theme';

type Kind = 'layout' | 'skus' | 'orders';

const STEPS: {
  kind: Kind;
  title: string;
  columns: string;
  hint: string;
  upload: (wid: number, f: File) => Promise<{ imported: number }>;
}[] = [
  {
    kind: 'layout',
    title: '1. Layout — ячейки склада',
    columns: 'slot_label, row, col, level, zone, capacity_kg',
    hint: 'Сначала загрузите расположение ячеек.',
    upload: (wid, f) => api.uploadLayout(wid, f),
  },
  {
    kind: 'skus',
    title: '2. SKU — каталог товаров',
    columns: 'sku_code, name, weight_kg, volume_m3, category',
    hint: 'Товары, которые будут размещаться по ячейкам.',
    upload: (wid, f) => api.uploadSkus(wid, f),
  },
  {
    kind: 'orders',
    title: '3. Orders — история заказов',
    columns: 'order_id, sku_code, quantity, timestamp',
    hint: 'История нужна для расчёта velocity и co-pick.',
    upload: (wid, f) => api.uploadOrders(wid, f),
  },
];

export function ImportPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [done, setDone] = useState<Record<Kind, number | undefined>>({
    layout: undefined, skus: undefined, orders: undefined,
  });
  const [busy, setBusy] = useState<Kind | null>(null);

  return (
    <PageContainer maxWidth={840}>
      <PageHeader
        icon={<UploadOutlined />}
        title="Импорт данных"
        description="Загрузите три CSV-файла в активный склад: расположение ячеек, каталог SKU и историю заказов. После загрузки переходите к скорингу."
      />
      <RequireWarehouse>
        {warehouseId => {
          const handle = async (s: (typeof STEPS)[number], file: File) => {
            setBusy(s.kind);
            try {
              const res = await s.upload(warehouseId, file);
              setDone(d => ({ ...d, [s.kind]: res.imported }));
              message.success(`${s.title.split('—')[0].trim()}: импортировано ${res.imported.toLocaleString()}`);
            } catch (e) {
              message.error(e instanceof Error ? e.message : 'Импорт не удался');
            } finally {
              setBusy(null);
            }
          };

          const allDone = STEPS.every(s => done[s.kind] != null);

          return (
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              {STEPS.map(s => (
                <SectionCard
                  key={s.kind}
                  title={
                    <Space>
                      {s.title}
                      {done[s.kind] != null && (
                        <Tag color="success">
                          <CheckCircleFilled /> {done[s.kind]!.toLocaleString()}
                        </Tag>
                      )}
                    </Space>
                  }
                  description={s.hint}
                >
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 13 }}>
                    Колонки CSV: <Typography.Text code>{s.columns}</Typography.Text>
                  </Typography.Paragraph>
                  <DropZone
                    label={`Перетащите ${s.kind}.csv сюда`}
                    hint={s.columns}
                    disabled={busy === s.kind}
                    onFile={f => handle(s, f)}
                  />
                </SectionCard>
              ))}

              {allDone && (
                <SectionCard>
                  <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }} wrap>
                    <span style={{ color: tokens.success, fontWeight: 500 }}>
                      <CheckCircleFilled /> Все данные загружены.
                    </span>
                    <Button type="primary" onClick={() => navigate('/scoring')}>
                      Перейти к скорингу
                    </Button>
                  </Space>
                </SectionCard>
              )}
            </Space>
          );
        }}
      </RequireWarehouse>
    </PageContainer>
  );
}
