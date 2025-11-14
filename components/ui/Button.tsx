import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { palette, radii, spacing } from '@/constants/theme';
import { StyledText } from '../StyledText';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: ButtonVariant;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  variant = 'primary',
  leftIcon,
  rightIcon,
  fullWidth,
  loading,
  disabled,
  containerStyle,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        containerStyle,
      ]}
      {...rest}
    >
      {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? palette.surface : palette.primary}
        />
      ) : (
        <StyledText
          variant="label"
          weight="semibold"
          tone={variant === 'primary' ? 'inverse' : 'primary'}
        >
          {title}
        </StyledText>
      )}
      {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  primary: {
    backgroundColor: palette.primary,
  },
  secondary: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.6,
  },
  icon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
