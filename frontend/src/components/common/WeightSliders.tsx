import { Slider, Tooltip, Typography } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import type { ScoringWeights } from '../../types';
import { tokens } from '../../theme';

interface WeightSlidersProps {
  value: ScoringWeights;
  onChange: (w: ScoringWeights) => void;
  disabled?: boolean;
}

const DEFS = [
  {
    key: 'w1' as const,
    label: 'Скорость × расстояние (w1)',
    color: tokens.primary,
    help: 'Быстро оборачиваемые товары ближе к доку. Главный фактор экономии маршрута.',
  },
  {
    key: 'w2' as const,
    label: 'Совместный отбор (w2)',
    color: tokens.violet,
    help: 'Товары, которые часто заказывают вместе, размещаются рядом (co-pick).',
  },
  {
    key: 'w3' as const,
    label: 'Физическая пригодность (w3)',
    color: tokens.success,
    help: 'Соответствие веса/объёма товара вместимости ячейки.',
  },
];

/** Three weighting sliders shared by Scoring / Tuning / Settings. */
export function WeightSliders({ value, onChange, disabled }: WeightSlidersProps) {
  const sum = value.w1 + value.w2 + value.w3;
  const off = Math.abs(sum - 1) > 0.001;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {DEFS.map(d => (
        <div key={d.key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <Typography.Text style={{ fontSize: 13 }}>
              {d.label}{' '}
              <Tooltip title={d.help}>
                <InfoCircleOutlined style={{ color: tokens.textTertiary }} />
              </Tooltip>
            </Typography.Text>
            <Typography.Text strong style={{ fontSize: 13, color: d.color }}>
              {value[d.key].toFixed(2)}
            </Typography.Text>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={value[d.key]}
            disabled={disabled}
            onChange={v => onChange({ ...value, [d.key]: v })}
            styles={{ track: { background: d.color } }}
            tooltip={{ formatter: v => v?.toFixed(2) }}
          />
        </div>
      ))}
      <Typography.Text
        style={{ fontSize: 12, color: off ? tokens.warning : tokens.textTertiary }}
      >
        Сумма весов: {sum.toFixed(2)}
        {off ? ' — рекомендуется около 1.00 для сбалансированного скоринга.' : ' ✓'}
      </Typography.Text>
    </div>
  );
}
