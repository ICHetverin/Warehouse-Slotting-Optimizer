import type { ReactNode } from 'react';
import { Typography } from 'antd';
import { tokens } from '../../theme';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

/**
 * Friendly empty / guidance state — tells the user what to do next
 * instead of showing a blank panel.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '56px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {icon && (
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: tokens.bgMuted,
            color: tokens.textTertiary,
            display: 'grid',
            placeItems: 'center',
            fontSize: 26,
            marginBottom: 4,
          }}
        >
          {icon}
        </div>
      )}
      <Typography.Title level={4} style={{ margin: 0 }}>
        {title}
      </Typography.Title>
      {description && (
        <Typography.Paragraph type="secondary" style={{ margin: 0, maxWidth: 460 }}>
          {description}
        </Typography.Paragraph>
      )}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
