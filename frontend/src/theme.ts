import type { ThemeConfig } from 'antd';

/**
 * Clean, light "enterprise" design language.
 * Calm corporate blue, neutral slate greys, generous whitespace,
 * soft borders and shadows. Shared design tokens live here so the
 * whole app stays visually consistent.
 */

export const tokens = {
  // semantic palette (use across custom components / charts)
  primary: '#2563EB',
  primarySoft: '#EFF4FF',
  success: '#16A34A',
  successSoft: '#ECFDF3',
  warning: '#D97706',
  warningSoft: '#FFFAEB',
  error: '#DC2626',
  errorSoft: '#FEF2F2',
  violet: '#7C3AED',
  // neutral slate scale
  ink: '#0F172A',
  text: '#1E293B',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  border: '#E5E9F0',
  borderSoft: '#EEF1F6',
  bgLayout: '#F6F8FB',
  bgContainer: '#FFFFFF',
  bgMuted: '#F8FAFC',
  // chart palette (sequential + categorical)
  chart: ['#2563EB', '#7C3AED', '#16A34A', '#D97706', '#DC2626', '#0891B2'],
  // heat ramp (low → high)
  heat: ['#E2E8F0', '#BBF7D0', '#86EFAC', '#FCD34D', '#FB923C', '#EF4444'],
  shadowSm: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
  shadowMd: '0 4px 12px rgba(15,23,42,0.06), 0 2px 4px rgba(15,23,42,0.04)',
  radius: 10,
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
} as const;

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: tokens.primary,
    colorInfo: tokens.primary,
    colorSuccess: tokens.success,
    colorWarning: tokens.warning,
    colorError: tokens.error,
    colorTextBase: tokens.text,
    colorTextHeading: tokens.ink,
    colorTextSecondary: tokens.textSecondary,
    colorBorder: tokens.border,
    colorBorderSecondary: tokens.borderSoft,
    colorBgLayout: tokens.bgLayout,
    colorBgContainer: tokens.bgContainer,
    fontFamily:
      "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSizeHeading1: 30,
    fontSizeHeading2: 24,
    fontSizeHeading3: 19,
    borderRadius: tokens.radius,
    borderRadiusLG: tokens.radius + 2,
    fontSize: 14,
    controlHeight: 36,
    wireframe: false,
  },
  components: {
    Layout: {
      siderBg: tokens.bgContainer,
      headerBg: tokens.bgContainer,
      headerHeight: 60,
      bodyBg: tokens.bgLayout,
      headerPadding: '0 24px',
    },
    Menu: {
      itemBorderRadius: 8,
      itemMarginInline: 10,
      itemHeight: 40,
      itemSelectedBg: tokens.primarySoft,
      itemSelectedColor: tokens.primary,
      itemColor: tokens.textSecondary,
      groupTitleColor: tokens.textTertiary,
      groupTitleFontSize: 11,
      iconSize: 16,
    },
    Card: {
      borderRadiusLG: 14,
      paddingLG: 22,
      colorBorderSecondary: tokens.border,
    },
    Table: {
      headerBg: tokens.bgMuted,
      headerColor: tokens.textSecondary,
      borderColor: tokens.borderSoft,
      cellPaddingBlock: 10,
    },
    Statistic: {
      contentFontSize: 26,
    },
    Button: {
      fontWeight: 500,
      primaryShadow: 'none',
      defaultShadow: 'none',
    },
    Segmented: {
      trackBg: tokens.bgMuted,
    },
  },
};
