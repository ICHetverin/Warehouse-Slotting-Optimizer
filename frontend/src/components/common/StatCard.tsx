import type { ReactNode } from 'react';
import { Card, Typography } from 'antd';
import { tokens } from '../../theme';

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'error';

const TONE: Record<Tone, string> = {
  default: tokens.ink,
  primary: tokens.primary,
  success: tokens.success,
  warning: tokens.warning,
  error: tokens.error,
};

const ACCENT: Record<Tone, string> = {
  default: tokens.border,
  primary: tokens.primary,
  success: tokens.success,
  warning: tokens.warning,
  error: tokens.error,
};

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  suffix?: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
}

/** Compact KPI card with consistent typography across all dashboards. */
export function StatCard({ label, value, suffix, hint, icon, tone = 'default' }: StatCardProps) {
  return (
    <Card
      size="small"
      styles={{ body: { padding: 18 } }}
      style={{ borderLeft: `3px solid ${ACCENT[tone]}` }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Text style={{ color: tokens.textSecondary, fontSize: 13 }}>
          {label}
        </Typography.Text>
        {icon && <span style={{ color: tokens.textTertiary, fontSize: 16 }}>{icon}</span>}
      </div>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: TONE[tone], lineHeight: 1.1 }}>
          {value}
        </span>
        {suffix && (
          <span style={{ fontSize: 14, color: tokens.textTertiary, fontWeight: 500 }}>{suffix}</span>
        )}
      </div>
      {hint && (
        <Typography.Text style={{ color: tokens.textTertiary, fontSize: 12 }}>
          {hint}
        </Typography.Text>
      )}
    </Card>
  );
}
