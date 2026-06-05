import { useState } from 'react';
import {
  Button, Card, Col, Progress, Row, Space, Tag, Tooltip, Typography,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  RiseOutlined,
  InfoCircleOutlined,
  NodeIndexOutlined,
  ThunderboltOutlined,
  PartitionOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import type { ExplanationReason, RecommendationResponse } from '../../types';

const { Text } = Typography;

const REASON_ICON: Record<string, React.ReactNode> = {
  velocity:     <ThunderboltOutlined style={{ color: '#1677ff' }} />,
  copick:       <PartitionOutlined   style={{ color: '#7C3AED' }} />,
  distance:     <NodeIndexOutlined   style={{ color: '#059669' }} />,
  weight_fit:   <ExperimentOutlined  style={{ color: '#D97706' }} />,
  physical_fit: <ExperimentOutlined  style={{ color: '#D97706' }} />,
  general:      <InfoCircleOutlined  style={{ color: '#8c8c8c' }} />,
};

const REASON_COLOR: Record<string, string> = {
  velocity:     '#EFF6FF',
  copick:       '#F5F3FF',
  distance:     '#ECFDF5',
  weight_fit:   '#FFFBEB',
  physical_fit: '#FFFBEB',
  general:      '#F9FAFB',
};

function ReasonRow({ reason }: { reason: ExplanationReason }) {
  const detail = reason.detail as Record<string, unknown>;
  const num = (key: string): number | null =>
    typeof detail[key] === 'number' ? (detail[key] as number) : null;

  let detailNote: string | null = null;
  if (reason.type === 'copick') {
    const lift = num('lift');
    if (lift != null) detailNote = `lift ×${lift.toFixed(1)}`;
  } else if (reason.type === 'velocity') {
    const percentile = num('velocityPercentile');
    const wilson = num('wilsonVelocity');
    const parts: string[] = [];
    if (percentile != null) parts.push(`перцентиль ${percentile.toFixed(0)}%`);
    if (wilson != null) parts.push(`Wilson ${wilson.toFixed(2)}`);
    if (parts.length > 0) detailNote = parts.join(' · ');
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 12px',
        background: REASON_COLOR[reason.type] ?? '#F9FAFB',
        borderRadius: 8,
        marginBottom: 8,
      }}
    >
      <span style={{ marginTop: 1, flexShrink: 0 }}>
        {REASON_ICON[reason.type] ?? REASON_ICON.general}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13, lineHeight: '1.5' }}>{reason.description}</Text>
        {detailNote && (
          <Text style={{ fontSize: 11, color: '#8c8c8c', marginLeft: 6 }}>{detailNote}</Text>
        )}
        <div style={{ marginTop: 4 }}>
          <Progress
            percent={Math.min(100, Math.round(reason.value * 100))}
            size="small"
            showInfo={false}
            strokeColor={reason.type === 'velocity' ? '#1677ff'
              : reason.type === 'copick'     ? '#7C3AED'
              : reason.type === 'weight_fit' ? '#D97706'
              : '#059669'}
            style={{ maxWidth: 160 }}
          />
        </div>
      </div>
      <Tag style={{ flexShrink: 0, fontSize: 11 }}>{(reason.value * 100).toFixed(0)}%</Tag>
    </div>
  );
}

interface Props {
  rec: RecommendationResponse;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
  accepting?: boolean;
  rejecting?: boolean;
}

export function ExplainCard({ rec, onAccept, onReject, accepting, rejecting }: Props) {
  const [expanded, setExpanded] = useState(false);

  const exp = rec.explanation;
  const isPending  = rec.status === 'PENDING';
  const isAccepted = rec.status === 'ACCEPTED';
  const isRejected = rec.status === 'REJECTED';

  const statusTag = isAccepted
    ? <Tag color="success">Принято</Tag>
    : isRejected
    ? <Tag color="error">Отклонено</Tag>
    : <Tag color="processing">Ожидает</Tag>;

  const deltaColor = rec.scoreDelta > 0 ? '#16A34A' : rec.scoreDelta < 0 ? '#DC2626' : '#595959';

  return (
    <Card
      size="small"
      style={{
        marginBottom: 12,
        borderColor: isAccepted ? '#bbf7d0' : isRejected ? '#fecaca' : '#e5e7eb',
        opacity: isRejected ? 0.65 : 1,
        transition: 'opacity 0.2s',
      }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      <Row align="middle" gutter={12} wrap={false}>
        {/* SKU + slot move */}
        <Col flex="auto" style={{ minWidth: 0 }}>
          <Space size={8} wrap>
            <Text strong style={{ fontSize: 14 }}>{rec.skuCode}</Text>
            <Text style={{ fontSize: 12, color: '#8c8c8c' }}>
              {rec.fromSlot ?? '—'} <span style={{ margin: '0 4px' }}>→</span> {rec.toSlot}
            </Text>
            {statusTag}
            {rec.decidedAt && (rec.status === 'ACCEPTED' || rec.status === 'REJECTED') && (
              <Tooltip title={`${rec.status === 'ACCEPTED' ? 'Принято' : 'Отклонено'} ${new Date(rec.decidedAt).toLocaleString('ru-RU')}`}>
                <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                  {new Date(rec.decidedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </Tooltip>
            )}
            {exp?.significant && (
              <Tooltip title={`Статистически значимая рекомендация (q=${(exp.qValue ?? 0).toFixed(3)})`}>
                <Tag color="success" style={{ fontSize: 11 }}>Значимо</Tag>
              </Tooltip>
            )}
            {exp?.liftMax != null && exp.liftMax > 1 && (
              <Tag color="purple" style={{ fontSize: 11 }}>co-pick ×{exp.liftMax.toFixed(1)}</Tag>
            )}
          </Space>

          {exp && (
            <div style={{ marginTop: 6, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Tooltip title="Прирост скора при переходе в предложенную ячейку">
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <RiseOutlined style={{ color: deltaColor }} />
                  <Text style={{ fontSize: 12, color: deltaColor }}>
                    {rec.scoreDelta > 0 ? '+' : ''}{rec.scoreDelta.toFixed(3)} к скору
                  </Text>
                </span>
              </Tooltip>
              {exp.impact.avgRouteSavingsM > 0 && (
                <Tooltip title="Оценка экономии маршрута на один отбор">
                  <Text style={{ fontSize: 12, color: '#595959' }}>
                    ~{exp.impact.avgRouteSavingsM.toFixed(1)} м/отбор
                    {exp.impact.savingsCiLowM != null && (
                      <span style={{ color: '#8c8c8c' }}>
                        {' '}(ДИ {exp.impact.savingsCiLowM.toFixed(1)}–{(exp.impact.savingsCiHighM ?? 0).toFixed(1)} м)
                      </span>
                    )}
                  </Text>
                </Tooltip>
              )}
              {exp.impact.dailyPicksAffected > 0 && (
                <Text style={{ fontSize: 12, color: '#595959' }}>
                  {exp.impact.dailyPicksAffected} отборов/день
                </Text>
              )}
              {exp.impact.estimatedDailySavingsMin > 0 && (
                <Text style={{ fontSize: 12, color: '#16A34A' }}>
                  ~{exp.impact.estimatedDailySavingsMin.toFixed(1)} мин/день
                </Text>
              )}
            </div>
          )}
        </Col>

        {/* Actions */}
        <Col style={{ flexShrink: 0 }}>
          <Space size={6}>
            {exp && exp.reasons.length > 0 && (
              <Button
                size="small"
                type="text"
                style={{ fontSize: 12, color: '#1677ff', padding: '0 6px' }}
                onClick={() => setExpanded(v => !v)}
              >
                {expanded ? 'Скрыть' : `Почему? (${exp.reasons.length})`}
              </Button>
            )}
            {isPending && (
              <>
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={accepting}
                  onClick={() => onAccept(rec.id)}
                  style={{ background: '#16A34A', borderColor: '#16A34A' }}
                >
                  Принять
                </Button>
                <Button
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  loading={rejecting}
                  onClick={() => onReject(rec.id)}
                >
                  Отклонить
                </Button>
              </>
            )}
          </Space>
        </Col>
      </Row>

      {expanded && exp && (
        <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
          <div style={{ marginBottom: 10 }}>
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>Скор до</div>
                <Text style={{ fontSize: 13 }}>{exp.scoreBefore.toFixed(4)}</Text>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>Скор после</div>
                <Text style={{ fontSize: 13, color: '#16A34A' }}>{exp.scoreAfter.toFixed(4)}</Text>
              </Col>
            </Row>
          </div>
          {exp.reasons.map((r, i) => (
            <ReasonRow key={i} reason={r} />
          ))}
        </div>
      )}
    </Card>
  );
}
