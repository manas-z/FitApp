export const palette = {
  background: '#f4f6fb',
  surface: '#ffffff',
  surfaceMuted: '#f2f4f8',
  surfaceElevated: '#f7f9fd',
  primary: '#1f3c88',
  primaryDark: '#162b63',
  primaryMuted: '#e3e9ff',
  accent: '#0ea5e9',
  accentDark: '#0b82c2',
  accentMuted: '#cbeffd',
  success: '#16a34a',
  successMuted: '#dcfce7',
  warning: '#f59e0b',
  warningMuted: '#fef3c7',
  danger: '#dc2626',
  dangerMuted: '#fee4e2',
  textPrimary: '#1b1f3b',
  textSecondary: '#4e5d78',
  textMuted: '#6b7a99',
  tabIconInactive: '#9aa5c3',
  border: '#d7dce8',
  borderStrong: '#b9c2d8',
  overlay: 'rgba(17, 25, 40, 0.32)',
  shadow: 'rgba(17, 25, 40, 0.12)',
  shadowStrong: 'rgba(17, 25, 40, 0.18)',
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
};

type RGB = { r: number; g: number; b: number };

function hexToRgb(hex: string): RGB | null {
  const normalized = hex.trim().replace('#', '');

  if (![3, 6].includes(normalized.length)) {
    return null;
  }

  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  const r = Number.parseInt(expanded.slice(0, 2), 16);
  const g = Number.parseInt(expanded.slice(2, 4), 16);
  const b = Number.parseInt(expanded.slice(4, 6), 16);

  if ([r, g, b].some((component) => Number.isNaN(component))) {
    return null;
  }

  return { r, g, b };
}

function getRelativeLuminance({ r, g, b }: RGB) {
  const srgb = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

export function getReadableTextColor(
  backgroundColor: string,
  options?: { light?: string; dark?: string },
) {
  const { light = '#ffffff', dark = palette.textPrimary } = options ?? {};
  const rgb = hexToRgb(backgroundColor);

  if (!rgb) {
    return light;
  }

  const luminance = getRelativeLuminance(rgb);

  return luminance > 0.55 ? dark : light;
}
