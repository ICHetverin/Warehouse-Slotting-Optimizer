import type { CSSProperties, ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  maxWidth?: number;
  style?: CSSProperties;
}

/**
 * Single source of truth for page width & padding — replaces the
 * `maxWidth/margin/padding` inline blocks that were copy-pasted across pages.
 */
export function PageContainer({ children, maxWidth = 1120, style }: PageContainerProps) {
  return (
    <div className="wso-page" style={{ maxWidth, margin: '0 auto', padding: '28px 28px 64px', ...style }}>
      {children}
    </div>
  );
}
