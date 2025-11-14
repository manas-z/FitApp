export const palette = {
  background: '#f5f7fb',
  surface: '#ffffff',
  surfaceMuted: '#f1f3f9',
  surfaceElevated: '#fbfcff',
  primary: '#1f3c88',
  primaryDark: '#15275b',
  primaryMuted: '#dfe7fb',
  accent: '#0ea5e9',
  accentMuted: '#cfefff',
  success: '#16a34a',
  successMuted: '#dcfce7',
  warning: '#f59e0b',
  warningMuted: '#fef3c7',
  danger: '#dc2626',
  dangerMuted: '#fee4e2',
  textPrimary: '#12172f',
  textSecondary: '#4c5877',
  textMuted: '#8791ab',
  tabIconInactive: '#9aa5c3',
  border: '#d9dfec',
  borderStrong: '#c1c9dd',
  overlay: 'rgba(8, 14, 31, 0.35)',
  shadow: 'rgba(15, 23, 42, 0.08)',
  shadowStrong: 'rgba(15, 23, 42, 0.14)',
};

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const typography = {
  headingFontWeight: '700' as const,
  labelFontWeight: '600' as const,
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    display: 28,
  },
  lineHeight: {
    tight: 18,
    snug: 22,
    normal: 26,
    relaxed: 30,
    loose: 34,
  },
};
