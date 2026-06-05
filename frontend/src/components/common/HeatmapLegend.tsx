import { Typography } from 'antd';
import { tokens } from '../../theme';

interface HeatmapLegendProps {
  lowLabel?: string;
  highLabel?: string;
  /** Optional extra swatches (e.g. Empty / Dock) shown before the ramp. */
  extra?: { color: string; label: string }[];
}

/** Reusable gradient legend for velocity / heatmap visualisations. */
export function HeatmapLegend({
  lowLabel = 'Низкая',
  highLabel = 'Высокая',
  extra,
}: HeatmapLegendProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      {extra?.map(e => (
        <span key={e.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: e.color,
              border: `1px solid ${tokens.border}`,
            }}
          />
          <Typography.Text style={{ fontSize: 12, color: tokens.textSecondary }}>
            {e.label}
          </Typography.Text>
        </span>
      ))}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Typography.Text style={{ fontSize: 12, color: tokens.textSecondary }}>
          {lowLabel}
        </Typography.Text>
        <span
          style={{
            width: 120,
            height: 10,
            borderRadius: 5,
            background: `linear-gradient(90deg, ${tokens.heat.join(',')})`,
          }}
        />
        <Typography.Text style={{ fontSize: 12, color: tokens.textSecondary }}>
          {highLabel}
        </Typography.Text>
      </span>
    </div>
  );
}

/** Map a normalized value [0..1] onto the shared heat ramp. */
export function heatColor(v: number): string {
  const ramp = tokens.heat;
  if (!Number.isFinite(v)) return ramp[0];
  const clamped = Math.max(0, Math.min(1, v));
  const idx = Math.min(ramp.length - 1, Math.floor(clamped * (ramp.length - 1) + 0.5));
  return ramp[idx];
}
