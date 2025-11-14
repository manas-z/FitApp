import { ReactNode } from 'react';
import {
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { palette, radii, spacing } from '@/constants/theme';
import { StyledText } from '../StyledText';

type ListItemProps = Omit<PressableProps, 'style'> & {
  title: string;
  description?: string;
  meta?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  destructive?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

export function ListItem({
  title,
  description,
  meta,
  leading,
  trailing,
  destructive,
  containerStyle,
  disabled,
  ...rest
}: ListItemProps) {
  const isPressable = typeof rest.onPress === 'function';

  return (
    <Pressable
      accessibilityRole={isPressable ? 'button' : undefined}
      disabled={disabled || !isPressable}
      style={({ pressed }) => [
        styles.base,
        pressed && styles.pressed,
        disabled && styles.disabled,
        containerStyle,
      ]}
      {...rest}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.body}>
        <StyledText
          variant="body"
          weight="semibold"
          style={destructive ? { color: palette.danger } : undefined}
        >
          {title}
        </StyledText>
        {description ? (
          <StyledText variant="caption" tone="muted">
            {description}
          </StyledText>
        ) : null}
      </View>
      <View style={styles.trailing}>
        {meta ? (
          <StyledText variant="caption" tone="muted">
            {meta}
          </StyledText>
        ) : null}
        {trailing ?? null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    gap: spacing.md,
  },
  pressed: {
    backgroundColor: palette.surfaceMuted,
  },
  disabled: {
    opacity: 0.5,
  },
  leading: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  trailing: {
    marginLeft: spacing.md,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
});
