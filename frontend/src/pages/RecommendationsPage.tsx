import { useCallback, useEffect, useState } from 'react';
import { App, Button, Col, Modal, Popconfirm, Row, Segmented, Space, Spin, Typography } from 'antd';
import { BulbOutlined, CheckOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { StatCard } from '../components/common/StatCard';
import { EmptyState } from '../components/common/EmptyState';
import { RequireWarehouse } from '../components/common/RequireWarehouse';
import { ExplainCard } from '../components/ExplainCard';
import { useWeights } from '../app/WeightsContext';
import { api } from '../api/client';
import type { RecommendationResponse } from '../types';

type StatusFilter = 'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED';

function RecList({ warehouseId }: { warehouseId: number }) {
  const { message } = App.useApp();
  const { weights } = useWeights();
  const [recs, setRecs] = useState<RecommendationResponse[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('PENDING');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [acceptingAll, setAcceptingAll] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RecommendationResponse | null>(null);

  const load = useCallback(async (status: StatusFilter) => {
    setLoading(true);
    try {
      const data = await api.listRecommendations(warehouseId, {
        status: status === 'ALL' ? undefined : status,
        limit: 1000,
      });
      setRecs(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Не удалось загрузить рекомендации');
    } finally {
      setLoading(false);
    }
  }, [warehouseId, message]);

  useEffect(() => { void load(filter); }, [load, filter]);

  const generate = async () => {
    setGenerating(true);
    try {
      await api.generateRecommendations({ warehouseId, weights });
      setFilter('PENDING');
      await load('PENDING');
      message.success('Рекомендации сгенерированы');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Генерация не удалась');
    } finally {
      setGenerating(false);
    }
  };

  const acceptAll = async () => {
    setAcceptingAll(true);
    try {
      const r = await api.acceptAllRecommendations(warehouseId, 'PENDING');
      message.success(`Применено ${r.applied}, пропущено ${r.skipped}`);
      await load(filter);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Не удалось применить рекомендации');
    } finally {
      setAcceptingAll(false);
    }
  };

  const act = async (id: number, kind: 'accept' | 'reject') => {
    setActingId(id);
    try {
      const updated = kind === 'accept'
        ? await api.acceptRecommendation(id)
        : await api.rejectRecommendation(id);
      setRecs(prev => prev.map(r => (r.id === id ? updated : r)));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Действие не удалось');
    } finally {
      setActingId(null);
    }
  };

  const openDetail = async (id: number) => {
    try { setDetail(await api.getRecommendationDetail(id)); } catch { /* ignore */ }
  };

  const pending = recs.filter(r => r.status === 'PENDING').length;
  const accepted = recs.filter(r => r.status === 'ACCEPTED').length;
  const rejected = recs.filter(r => r.status === 'REJECTED').length;
  const savingMin = recs.reduce((s, r) => s + (r.explanation?.impact.estimatedDailySavingsMin ?? 0), 0);
  const visible = filter === 'ALL' ? recs : recs.filter(r => r.status === filter);

  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      <SectionCard>
        <Space wrap>
          <Button type="primary" icon={<PlayCircleOutlined />} loading={generating} onClick={generate}>
            Сгенерировать рекомендации
          </Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => load(filter)}>
            Обновить
          </Button>
          {pending > 0 && (
            <Popconfirm
              title="Применить все ожидающие рекомендации к раскладке?"
              okText="Применить"
              cancelText="Отмена"
              onConfirm={acceptAll}
            >
              <Button icon={<CheckOutlined />} loading={acceptingAll}>
                Принять все
              </Button>
            </Popconfirm>
          )}
        </Space>
      </SectionCard>

      {recs.length > 0 && (
        <>
          <Typography.Text type="secondary">
            {recs.length} статистически значимых рекомендаций
          </Typography.Text>

          <Row gutter={16}>
            <Col xs={12} md={6}><StatCard label="Ожидают" value={pending} tone="primary" /></Col>
            <Col xs={12} md={6}><StatCard label="Приняты" value={accepted} tone="success" /></Col>
            <Col xs={12} md={6}><StatCard label="Отклонены" value={rejected} tone="error" /></Col>
            <Col xs={12} md={6}>
              <StatCard label="Экономия/день" value={savingMin.toFixed(1)} suffix="мин" tone="success" />
            </Col>
          </Row>

          <Segmented<StatusFilter>
            value={filter}
            onChange={setFilter}
            options={[
              { label: `Все (${recs.length})`, value: 'ALL' },
              { label: `Ожидают (${pending})`, value: 'PENDING' },
              { label: `Приняты (${accepted})`, value: 'ACCEPTED' },
              { label: `Отклонены (${rejected})`, value: 'REJECTED' },
            ]}
          />
        </>
      )}

      {loading || generating ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: '#94a3b8', fontSize: 13 }}>
            {generating ? 'Скоринг и формирование объяснений…' : 'Загрузка…'}
          </div>
        </div>
      ) : visible.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={<BulbOutlined />}
            title="Рекомендаций пока нет"
            description="Нажмите «Сгенерировать рекомендации», чтобы прогнать скоринг и получить объяснимые предложения по перестановке."
          />
        </SectionCard>
      ) : (
        <div>
          {visible.map(rec => (
            <div key={rec.id} onClick={() => { if (rec.explanation == null) openDetail(rec.id); }}>
              <ExplainCard
                rec={rec}
                onAccept={id => act(id, 'accept')}
                onReject={id => act(id, 'reject')}
                accepting={actingId === rec.id}
                rejecting={actingId === rec.id}
              />
            </div>
          ))}
        </div>
      )}

      <Modal
        open={detail != null}
        onCancel={() => setDetail(null)}
        footer={null}
        title={detail ? `Рекомендация · ${detail.skuCode}` : ''}
        width={640}
      >
        {detail && (
          <Typography.Paragraph>
            <b>{detail.fromSlot ?? '—'}</b> → <b>{detail.toSlot}</b>, Δ {detail.scoreDelta.toFixed(3)}.
            {detail.explanation && (
              <ul style={{ marginTop: 12 }}>
                {detail.explanation.reasons.map((r, i) => (
                  <li key={i}>{r.description}</li>
                ))}
              </ul>
            )}
          </Typography.Paragraph>
        )}
      </Modal>
    </Space>
  );
}

export function RecommendationsPage() {
  return (
    <PageContainer maxWidth={920}>
      <PageHeader
        icon={<BulbOutlined />}
        title="Рекомендации"
        description="Каждая карточка показывает, почему предлагается переставить товар — с числами по velocity, co-pick и вместимости. Принимайте или отклоняйте предложения."
      />
      <RequireWarehouse>{warehouseId => <RecList warehouseId={warehouseId} />}</RequireWarehouse>
    </PageContainer>
  );
}
