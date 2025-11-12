import { palette } from './theme';

const tintColorLight = palette.primary;
const tintColorDark = palette.accent;

export default {
  light: {
    text: palette.textPrimary,
    background: palette.background,
    tint: tintColorLight,
    tabIconDefault: palette.tabIconInactive,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#f8fafc',
    background: '#0b1120',
    tint: tintColorDark,
    tabIconDefault: '#475569',
    tabIconSelected: tintColorDark,
  },
};
