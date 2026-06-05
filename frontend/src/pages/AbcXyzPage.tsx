import { useEffect, useState } from 'react';
import { App, Col, Row, Space, Spin, Table, Tag, Typography } from 'antd';
import { PartitionOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { StatCard } from '../components/common/StatCard';
import { AnalysisWindowControl } from '../components/common/AnalysisWindowControl';
import { RequireWarehouse } from '../components/common/RequireWarehouse';
import { api } from '../api/client';
import type { AbcXyzMatrixResponse, AbcXyzProfile } from '../types';
import { tokens } from '../theme';

const ABC = ['A', 'B', 'C'];
const XYZ = ['X', 'Y', 'Z'];

function cellColor(count: number, max: number): string {
  if (count <= 0 || max <= 0) return tokens.bgMuted;
  const t = count / max;
  if (t > 0.66) return '#1E40AF';
  if (t > 0.33) return tokens.primary;
  return tokens.primarySoft;
}

function Matrix({ data }: { data: AbcXyzMatrixResponse }) {
  const max = Math.max(1, ...ABC.flatMap(a => XYZ.map(x => data.matrix[a]?.[x] ?? 0)));
  return (
    <div style={{ display: 'inline-block' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(3, 84px)', gap: 6 }}>
        <div />
        {XYZ.map(x => (
          <div key={x} style={{ textAlign: 'center', color: tokens.textSecondary, fontWeight: 600, fontSize: 13 }}>{x}</div>
        ))}
        {ABC.map(a => (
          <span key={a} style={{ display: 'contents' }}>
            <div style={{ display: 'grid', placeItems: 'center', color: tokens.textSecondary, fontWeight: 600, fontSize: 13 }}>{a}</div>
            {XYZ.map(x => {
              const count = data.matrix[a]?.[x] ?? 0;
              const bg = cellColor(count, max);
              const light = count / max > 0.33;
              return (
                <div
                  key={x}
                  style={{
                    height: 64, borderRadius: 10, background: bg,
                    display: 'grid', placeItems: 'center',
                    color: light ? '#fff' : tokens.text,
                    fontWeight: 700, fontSize: 18,
                    border: `1px solid ${tokens.borderSoft}`,
                  }}
                >
                  {count}
                </div>
              );
            })}
          </span>
        ))}
      </div>
    </div>
  );
}

const PROFILE_COLS: ColumnsType<AbcXyzProfile> = [
  { title: 'SKU', dataIndex: 'skuCode', width: 120 },
  {
    title: 'ABC', dataIndex: 'abcClass', width: 70,
    filters: ABC.map(a => ({ text: a, value: a })),
    onFilter: (v, r) => r.abcClass === v,
    render: (v: string) => <Tag color={v === 'A' ? 'blue' : v === 'B' ? 'cyan' : 'default'}>{v}</Tag>,
  },
  {
    title: 'XYZ', dataIndex: 'xyzClass', width: 70,
    filters: XYZ.map(x => ({ text: x, value: x })),
    onFilter: (v, r) => r.xyzClass === v,
    render: (v: string) => <Tag color={v === 'X' ? 'green' : v === 'Y' ? 'gold' : 'red'}>{v}</Tag>,
  },
  { title: 'Velocity', dataIndex: 'velocityScore', width: 110, align: 'right', sorter: (a, b) => a.velocityScore - b.velocityScore, defaultSortOrder: 'descend', render: (v: number) => v.toFixed(3) },
  { title: 'CV (стаб.)', dataIndex: 'stabilityCv', width: 110, align: 'right', sorter: (a, b) => a.stabilityCv - b.stabilityCv, render: (v: number) => v.toFixed(2) },
  { title: 'Отборов', dataIndex: 'pickCount', width: 100, align: 'right', sorter: (a, b) => a.pickCount - b.pickCount },
];

function AbcXyzBody({ warehouseId }: { warehouseId: number }) {
  const { message } = App.useApp();
  const [days, setDays] = useState(1200);
  const [data, setData] = useState<AbcXyzMatrixResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.getAbcXyz(warehouseId, days)
      .then(d => alive && setData(d))
      .catch(e => alive && message.error(e instanceof Error ? e.message : 'Ошибка загрузки ABC/XYZ'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [warehouseId, days, message]);

  const counts = data
    ? { a: ABC.map(a => ({ a, n: Object.values(data.matrix[a] ?? {}).reduce((s, n) => s + n, 0) })) }
    : null;

  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      <SectionCard>
        <AnalysisWindowControl value={days} onChange={setDays} disabled={loading} />
      </SectionCard>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : data ? (
        <>
          {counts && (
            <Row gutter={16}>
              <Col xs={12} md={6}><StatCard label="Всего SKU" value={data.totalSkus} tone="primary" /></Col>
              {counts.a.map((c, i) => (
                <Col xs={12} md={6} key={c.a}>
                  <StatCard label={`Класс ${c.a}`} value={c.n} tone={i === 0 ? 'success' : 'default'} hint={i === 0 ? 'самые востребованные' : undefined} />
                </Col>
              ))}
            </Row>
          )}

          <Row gutter={16}>
            <Col xs={24} md={10}>
              <SectionCard title="Матрица ABC × XYZ" description="Строки — вклад в отбор (A/B/C), столбцы — стабильность спроса (X/Y/Z).">
                <Matrix data={data} />
              </SectionCard>
            </Col>
            <Col xs={24} md={14}>
              <SectionCard title={`Профили SKU (${data.profiles.length})`} bodyPadding={0}>
                <Table<AbcXyzProfile>
                  dataSource={data.profiles}
                  columns={PROFILE_COLS}
                  rowKey="skuId"
                  size="small"
                  pagination={{ pageSize: 8, showSizeChanger: false }}
                  scroll={{ x: 560 }}
                />
              </SectionCard>
            </Col>
          </Row>
        </>
      ) : (
        <SectionCard><Typography.Text type="secondary">Нет данных.</Typography.Text></SectionCard>
      )}
    </Space>
  );
}

export function AbcXyzPage() {
  return (
    <PageContainer>
      <PageHeader
        icon={<PartitionOutlined />}
        title="ABC / XYZ анализ"
        description="Классификация товаров по востребованности (ABC) и стабильности спроса (XYZ). Помогает понять, какие SKU критичны для размещения."
      />
      <RequireWarehouse>{warehouseId => <AbcXyzBody warehouseId={warehouseId} />}</RequireWarehouse>
    </PageContainer>
  );
}
