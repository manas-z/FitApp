import { StyleSheet, TextStyle } from 'react-native';

import { palette, typography } from '@/constants/theme';

import { Text, TextProps } from './Themed';

type TextVariant = 'display' | 'title' | 'subtitle' | 'body' | 'label' | 'caption';
type TextWeight = keyof typeof typography.weight;
type TextTone = 'default' | 'secondary' | 'muted' | 'inverse' | 'primary';

type StyledTextProps = TextProps & {
  variant?: TextVariant;
  weight?: TextWeight;
  tone?: TextTone;
};

const variantStyles: Record<TextVariant, TextStyle> = {
  display: {
    fontSize: typography.size.display,
    lineHeight: typography.lineHeight.loose,
  },
  title: {
    fontSize: typography.size.xl,
    lineHeight: typography.lineHeight.relaxed,
  },
  subtitle: {
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.normal,
  },
  body: {
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.normal,
  },
  label: {
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.snug,
    letterSpacing: 0.3,
  },
  caption: {
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.tight,
  },
};

const toneColors: Record<Exclude<TextTone, 'default'>, string> = {
  primary: palette.primary,
  secondary: palette.textSecondary,
  muted: palette.textMuted,
  inverse: palette.surface,
};

const weightStyles: Record<TextWeight, TextStyle> = {
  regular: { fontWeight: typography.weight.regular },
  medium: { fontWeight: typography.weight.medium },
  semibold: { fontWeight: typography.weight.semibold },
  bold: { fontWeight: typography.weight.bold },
};

export function StyledText({
  variant = 'body',
  weight = 'regular',
  tone = 'default',
  style,
  ...rest
}: StyledTextProps) {
  const color = tone === 'default' ? undefined : toneColors[tone];

  return (
    <Text
      {...rest}
      lightColor={color}
      darkColor={color}
      style={[styles.base, variantStyles[variant], weightStyles[weight], style]}
    />
  );
}

export function MonoText(props: TextProps) {
  return <Text {...props} style={[styles.base, props.style, { fontFamily: 'SpaceMono' }]} />;
}

const styles = StyleSheet.create({
  base: {},
});
