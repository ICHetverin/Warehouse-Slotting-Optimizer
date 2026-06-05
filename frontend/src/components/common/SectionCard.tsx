import type { ReactNode } from 'react';
import { Card, Typography } from 'antd';
import { tokens } from '../../theme';

interface SectionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  bodyPadding?: number;
  style?: React.CSSProperties;
}

/** Card with a consistent titled header used to group page content. */
export function SectionCard({
  title,
  description,
  extra,
  children,
  bodyPadding,
  style,
}: SectionCardProps) {
  return (
    <Card
      style={style}
      styles={{ body: bodyPadding != null ? { padding: bodyPadding } : undefined }}
      title={
        title ? (
          <div style={{ padding: '4px 0' }}>
            <Typography.Text strong style={{ fontSize: 15 }}>
              {title}
            </Typography.Text>
            {description && (
              <div style={{ fontWeight: 400, fontSize: 13, color: tokens.textSecondary, marginTop: 2 }}>
                {description}
              </div>
            )}
          </div>
        ) : undefined
      }
      extra={extra}
    >
      {children}
    </Card>
  );
}
