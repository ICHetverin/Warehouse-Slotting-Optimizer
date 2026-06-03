import { useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, InputNumber, Row,
  Segmented, Spin, Statistic, Typography, Space,
} from 'antd';
import { BulbOutlined, DownloadOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { ExplainCard } from '../components/ExplainCard';
import { api } from '../api/client';
import type { RecommendationResponse, ScoringWeights } from '../types';

const { Title, Paragraph, Text } = Typography;

const DEFAULT_WEIGHTS: ScoringWeights = { w1: 0.5, w2: 0.35, w3: 0.15 };

type StatusFilter = 'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED';

const STATUS_LABELS: Record<StatusFilter, string> = {
  ALL:      'Все',
  PENDING:  'Ожидает',
  ACCEPTED: 'Принято',
  REJECTED: 'Отклонено',
};

export function RecommendationsPage() {
  const [searchParams] = useSearchParams();
  const [warehouseId, setWarehouseId] = useState<number | null>(() => {
    const wid = searchParams.get('wid');
    return wid ? parseInt(wid, 10) : null;
  });
  const [recs, setRecs]                 = useState<RecommendationResponse[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [loading, setLoading]           = useState(false);
  const [generating, setGenerating]     = useState(false);
  const [exporting, setExporting]       = useState(false);
  const [actingId, setActingId]         = useState<number | null>(null);
  const [error, setError]               = useState<string | null>(null);

  const load = async (wid: number, status: StatusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listRecommendations(wid, {
        status: status === 'ALL' ? undefined : status,
        limit:  100,
      });
      setRecs(res.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить рекомендации');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (warehouseId) load(warehouseId, statusFilter);
  }, [warehouseId, statusFilter]);

  const generate = async () => {
    if (!warehouseId) { setError('Введите ID склада'); return; }
    setGenerating(true);
    setError(null);
    try {
      const res = await api.generateRecommendations(warehouseId, DEFAULT_WEIGHTS);
      setRecs(res.data.filter(r => statusFilter === 'ALL' || r.status === statusFilter));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка генерации');
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!warehouseId) return;
    setExporting(true);
    try {
      const blob = await api.exportRecommendations(warehouseId);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `recommendations-warehouse-${warehouseId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  const handleAccept = async (id: number) => {
    setActingId(id);
    try {
      const res = await api.acceptRecommendation(id);
      setRecs(prev => prev.map(r => r.id === id ? res.data : r));
    } catch { /* игнорируем */ }
    setActingId(null);
  };

  const handleReject = async (id: number) => {
    setActingId(id);
    try {
      const res = await api.rejectRecommendation(id);
      setRecs(prev => prev.map(r => r.id === id ? res.data : r));
    } catch { /* игнорируем */ }
    setActingId(null);
  };

  const pending  = recs.filter(r => r.status === 'PENDING').length;
  const accepted = recs.filter(r => r.status === 'ACCEPTED').length;
  const rejected = recs.filter(r => r.status === 'REJECTED').length;
  const topSaving = recs
    .filter(r => r.explanation?.impact.estimatedDailySavingsMin)
    .reduce((sum, r) => sum + (r.explanation?.impact.estimatedDailySavingsMin ?? 0), 0);

  const visible = statusFilter === 'ALL'
    ? recs
    : recs.filter(r => r.status === statusFilter);

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '40px 16px' }}>
      <Title level={3} style={{ marginBottom: 4 }}>Рекомендации</Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Каждая карточка показывает, <em>почему</em> рекомендуется перемещение — с конкретными
        цифрами по скорости продаж, совместным заказам и вместимости.
      </Paragraph>

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={24} align="middle" wrap>
          <Col>
            <Text style={{ fontSize: 13 }}>ID склада</Text>
            <div style={{ marginTop: 4 }}>
              <InputNumber
                min={1}
                placeholder="например 1"
                value={warehouseId ?? undefined}
                onChange={v => setWarehouseId(v ?? null)}
                style={{ width: 140 }}
              />
            </div>
          </Col>
          <Col style={{ marginTop: 20 }}>
            <Space>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={generating}
                onClick={generate}
              >
                Сгенерировать рекомендации
              </Button>
              {warehouseId && (
                <Button
                  icon={<ReloadOutlined />}
                  loading={loading}
                  onClick={() => load(warehouseId, statusFilter)}
                >
                  Обновить
                </Button>
              )}
              {warehouseId && recs.length > 0 && (
                <Button
                  icon={<DownloadOutlined />}
                  loading={exporting}
                  onClick={handleExport}
                >
                  Экспорт CSV
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {error && (
        <Alert
          type="error"
          message={error}
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {recs.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="Ожидает" value={pending} valueStyle={{ color: '#1677ff' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="Принято" value={accepted} valueStyle={{ color: '#16A34A' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="Отклонено" value={rejected} valueStyle={{ color: '#DC2626' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Экономия в день"
                value={topSaving.toFixed(1)}
                suffix="мин"
                valueStyle={{ color: '#16A34A' }}
                prefix={<BulbOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {recs.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Segmented<StatusFilter>
            value={statusFilter}
            onChange={v => setStatusFilter(v)}
            options={[
              { label: `${STATUS_LABELS.ALL} (${recs.length})`,      value: 'ALL' },
              { label: `${STATUS_LABELS.PENDING} (${pending})`,       value: 'PENDING' },
              { label: `${STATUS_LABELS.ACCEPTED} (${accepted})`,     value: 'ACCEPTED' },
              { label: `${STATUS_LABELS.REJECTED} (${rejected})`,     value: 'REJECTED' },
            ]}
          />
        </div>
      )}

      {(loading || generating) && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: '#8c8c8c', fontSize: 13 }}>
            {generating ? 'Запускаем скоринг и формируем объяснения…' : 'Загрузка…'}
          </div>
        </div>
      )}

      {!loading && !generating && visible.length === 0 && warehouseId && (
        <Card>
          <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8c', fontSize: 14 }}>
            {statusFilter !== 'ALL'
              ? `Нет рекомендаций со статусом «${STATUS_LABELS[statusFilter]}».`
              : 'Нет рекомендаций.'}{' '}
            {statusFilter === 'PENDING' && 'Нажмите «Сгенерировать рекомендации» для запуска скоринга.'}
          </div>
        </Card>
      )}

      {!loading && !generating && !warehouseId && (
        <Card>
          <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8c', fontSize: 14 }}>
            Введите ID склада и нажмите «Сгенерировать рекомендации».
          </div>
        </Card>
      )}

      {!loading && !generating && visible.map(rec => (
        <ExplainCard
          key={rec.id}
          rec={rec}
          onAccept={handleAccept}
          onReject={handleReject}
          accepting={actingId === rec.id}
          rejecting={actingId === rec.id}
        />
      ))}
    </div>
  );
}
