import type { ReactNode } from 'react';
import { Typography } from 'antd';
import { tokens } from '../../theme';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  extra?: ReactNode;
}

/**
 * Consistent page heading: title + a one/two-line "what is this & what to do"
 * description, with optional right-aligned actions. Gives every screen the same
 * clear, friendly framing.
 */
export function PageHeader({ title, description, icon, extra }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 24,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0 }}>
        {icon && (
          <div
            style={{
              flexShrink: 0,
              width: 42,
              height: 42,
              borderRadius: 12,
              background: tokens.primarySoft,
              color: tokens.primary,
              display: 'grid',
              placeItems: 'center',
              fontSize: 20,
            }}
          >
            {icon}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <Typography.Title level={2} style={{ margin: 0, fontSize: 24, lineHeight: 1.2 }}>
            {title}
          </Typography.Title>
          {description && (
            <Typography.Paragraph
              type="secondary"
              style={{ margin: '6px 0 0', maxWidth: 760, fontSize: 14 }}
            >
              {description}
            </Typography.Paragraph>
          )}
        </div>
      </div>
      {extra && <div style={{ flexShrink: 0 }}>{extra}</div>}
    </div>
  );
}
