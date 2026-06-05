import { useEffect, useMemo, useState } from 'react';
import { App, Alert, Col, Row, Space, Spin, Tooltip, Typography } from 'antd';
import { DeploymentUnitOutlined } from '@ant-design/icons';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { StatCard } from '../components/common/StatCard';
import { HeatmapLegend, heatColor } from '../components/common/HeatmapLegend';
import { AnalysisWindowControl } from '../components/common/AnalysisWindowControl';
import { RequireWarehouse } from '../components/common/RequireWarehouse';
import { api } from '../api/client';
import type { CopickMatrixResponse, Sku } from '../types';
import { tokens } from '../theme';

const TOP_N = 22;

function CopickBody({ warehouseId }: { warehouseId: number }) {
  const { message } = App.useApp();
  const [days, setDays] = useState(1200);
  const [data, setData] = useState<CopickMatrixResponse | null>(null);
  const [skuCode, setSkuCode] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      api.getCopickMatrix(warehouseId, days),
      api.getWarehouseSkus(warehouseId).catch(() => [] as Sku[]),
    ])
      .then(([matrix, skus]) => {
        if (!alive) return;
        setData(matrix);
        setSkuCode(Object.fromEntries(skus.map(s => [s.id, s.code])));
      })
      .catch(e => alive && message.error(e instanceof Error ? e.message : 'Ошибка загрузки матрицы'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [warehouseId, days, message]);

  const top = useMemo(() => {
    if (!data) return [];
    const strength: Record<number, number> = {};
    for (const [i, partners] of Object.entries(data.matrix)) {
      strength[Number(i)] = Object.values(partners).reduce((s, v) => s + v, 0);
    }
    return Object.keys(data.matrix)
      .map(Number)
      .sort((a, b) => (strength[b] ?? 0) - (strength[a] ?? 0))
      .slice(0, TOP_N);
  }, [data]);

  const label = (id: number) => skuCode[id] ?? `#${id}`;

  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      <SectionCard>
        <AnalysisWindowControl value={days} onChange={setDays} disabled={loading} />
      </SectionCard>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : data ? (
        <>
          <Row gutter={16}>
            <Col xs={12} md={8}><StatCard label="SKU с парами" value={data.skuCount} tone="primary" /></Col>
            <Col xs={12} md={8}><StatCard label="Пар совместного отбора" value={data.pairCount.toLocaleString()} /></Col>
            <Col xs={12} md={8}><StatCard label="Окно" value={data.velocityDays} suffix="дн" /></Col>
          </Row>

          {data.skuCount === 0 ? (
            <Alert
              type="info"
              showIcon
              title="Нет пар совместного отбора в этом окне"
              description="Увеличьте окно анализа — на демо-датасете заказы датированы прошлым, и узкое окно не захватывает историю."
            />
          ) : (
            <SectionCard
              title={`Матрица co-pick — топ-${Math.min(TOP_N, top.length)} SKU`}
              description="Чем ярче клетка, тем чаще пара товаров заказывается вместе. Такие SKU выгодно ставить рядом."
              extra={<HeatmapLegend lowLabel="Реже" highLabel="Чаще" />}
            >
              {data.skuCount > TOP_N && (
                <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
                  Показаны {TOP_N} наиболее связанных SKU из {data.skuCount} — иначе матрица нечитаема.
                </Typography.Paragraph>
              )}
              <div style={{ overflow: 'auto' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `64px repeat(${top.length}, 22px)`,
                    gap: 2,
                  }}
                >
                  <div />
                  {top.map(id => (
                    <div key={id} style={{ writingMode: 'vertical-rl', fontSize: 9, color: tokens.textTertiary, whiteSpace: 'nowrap' }}>
                      {label(id)}
                    </div>
                  ))}
                  {top.map(rowId => (
                    <span key={rowId} style={{ display: 'contents' }}>
                      <div style={{ fontSize: 10, color: tokens.textSecondary, textAlign: 'right', paddingRight: 4, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        {label(rowId)}
                      </div>
                      {top.map(colId => {
                        const v = rowId === colId ? 0 : data.matrix[String(rowId)]?.[String(colId)] ?? 0;
                        return (
                          <Tooltip key={colId} title={rowId === colId ? '' : `${label(rowId)} × ${label(colId)}: ${(v * 100).toFixed(0)}%`}>
                            <div
                              style={{
                                width: 22, height: 22, borderRadius: 3,
                                background: rowId === colId ? '#F1F5F9' : v > 0 ? heatColor(v) : '#F8FAFC',
                              }}
                            />
                          </Tooltip>
                        );
                      })}
                    </span>
                  ))}
                </div>
              </div>
            </SectionCard>
          )}
        </>
      ) : null}
    </Space>
  );
}

export function CopickPage() {
  return (
    <PageContainer>
      <PageHeader
        icon={<DeploymentUnitOutlined />}
        title="Co-pick матрица"
        description="Какие товары часто заказывают вместе. Размещение таких SKU рядом сокращает путь пикера."
      />
      <RequireWarehouse>{warehouseId => <CopickBody warehouseId={warehouseId} />}</RequireWarehouse>
    </PageContainer>
  );
}
