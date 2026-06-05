import { InputNumber, Segmented, Space, Tooltip, Typography } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { tokens } from '../../theme';

interface AnalysisWindowControlProps {
  value: number;
  onChange: (days: number) => void;
  disabled?: boolean;
}

const PRESETS = [
  { label: '90 дн', value: 90 },
  { label: '180 дн', value: 180 },
  { label: '1 год', value: 365 },
  { label: 'Всё (1200)', value: 1200 },
];

/**
 * "Analysis window (days)" control. The backend now anchors the window to the
 * latest order date, but the dataset still spans a fixed range, so a wide
 * window surfaces the full demand signal.
 */
export function AnalysisWindowControl({ value, onChange, disabled }: AnalysisWindowControlProps) {
  return (
    <div>
      <Typography.Text style={{ fontSize: 13 }}>
        Окно анализа{' '}
        <Tooltip title="За сколько дней истории считать velocity, co-pick и ABC/XYZ. Шире окно — больше данных в расчёте.">
          <InfoCircleOutlined style={{ color: tokens.textTertiary }} />
        </Tooltip>
      </Typography.Text>
      <div style={{ marginTop: 6 }}>
        <Space wrap>
          <Segmented
            options={PRESETS}
            value={PRESETS.some(p => p.value === value) ? value : undefined}
            disabled={disabled}
            onChange={v => onChange(Number(v))}
          />
          <InputNumber
            min={1}
            max={5000}
            value={value}
            disabled={disabled}
            onChange={v => onChange(v ?? 90)}
            suffix="дн"
            style={{ width: 130 }}
          />
        </Space>
      </div>
    </div>
  );
}
