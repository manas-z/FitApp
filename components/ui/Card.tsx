import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { palette, radii, spacing } from '@/constants/theme';

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  elevated?: boolean;
};

const paddingMap = {
  none: 0,
  sm: spacing.md,
  md: spacing.lg,
  lg: spacing.xl,
};

export function Card({
  children,
  style,
  padding = 'lg',
  elevated = false,
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        elevated && styles.elevated,
        { padding: paddingMap[padding] },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: palette.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.border,
  },
  elevated: {
    shadowColor: palette.shadowStrong,
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
});
