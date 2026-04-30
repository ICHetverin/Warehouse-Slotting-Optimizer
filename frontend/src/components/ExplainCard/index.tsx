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

const { Text, Paragraph } = Typography;

const REASON_ICON: Record<string, React.ReactNode> = {
  velocity:    <ThunderboltOutlined style={{ color: '#1677ff' }} />,
  copick:      <PartitionOutlined   style={{ color: '#7C3AED' }} />,
  distance:    <NodeIndexOutlined   style={{ color: '#059669' }} />,
  weight_fit:  <ExperimentOutlined  style={{ color: '#D97706' }} />,
  general:     <InfoCircleOutlined  style={{ color: '#8c8c8c' }} />,
};

const REASON_COLOR: Record<string, string> = {
  velocity:   '#EFF6FF',
  copick:     '#F5F3FF',
  distance:   '#ECFDF5',
  weight_fit: '#FFFBEB',
  general:    '#F9FAFB',
};

function ReasonRow({ reason }: { reason: ExplanationReason }) {
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
    ? <Tag color="success">Accepted</Tag>
    : isRejected
    ? <Tag color="error">Rejected</Tag>
    : <Tag color="processing">Pending</Tag>;

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
          </Space>

          {exp && (
            <div style={{ marginTop: 6, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Tooltip title="Score improvement from current to proposed slot">
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <RiseOutlined style={{ color: deltaColor }} />
                  <Text style={{ fontSize: 12, color: deltaColor }}>
                    {rec.scoreDelta > 0 ? '+' : ''}{rec.scoreDelta.toFixed(3)} score
                  </Text>
                </span>
              </Tooltip>
              {exp.impact.avgRouteSavingsM > 0 && (
                <Tooltip title="Estimated route savings per pick">
                  <Text style={{ fontSize: 12, color: '#595959' }}>
                    ~{exp.impact.avgRouteSavingsM.toFixed(1)} m saved/pick
                  </Text>
                </Tooltip>
              )}
              {exp.impact.dailyPicksAffected > 0 && (
                <Text style={{ fontSize: 12, color: '#595959' }}>
                  {exp.impact.dailyPicksAffected} picks/day affected
                </Text>
              )}
              {exp.impact.estimatedDailySavingsMin > 0 && (
                <Text style={{ fontSize: 12, color: '#16A34A' }}>
                  ~{exp.impact.estimatedDailySavingsMin.toFixed(1)} min/day saved
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
                {expanded ? 'Hide' : `Why? (${exp.reasons.length})`}
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
                  Accept
                </Button>
                <Button
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  loading={rejecting}
                  onClick={() => onReject(rec.id)}
                >
                  Reject
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
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>Score before</div>
                <Text style={{ fontSize: 13 }}>{exp.scoreBefore.toFixed(4)}</Text>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>Score after</div>
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
