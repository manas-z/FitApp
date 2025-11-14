import { ReactNode } from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing } from '@/constants/theme';

type ScreenProps = {
  children: ReactNode;
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  inset?: 'top' | 'bottom' | 'vertical' | 'all' | 'none';
};

const insetMap: Record<Exclude<ScreenProps['inset'], undefined>, Partial<ViewStyle>> = {
  none: {},
  top: { paddingTop: spacing.xl },
  bottom: { paddingBottom: spacing.xl },
  vertical: { paddingVertical: spacing.xl },
  all: { padding: spacing.xl },
};

export function Screen({
  children,
  scrollable = true,
  style,
  contentStyle,
  inset = 'vertical',
}: ScreenProps) {
  const Wrapper = scrollable ? ScrollView : View;
  const wrapperProps = scrollable
    ? {
        contentContainerStyle: [styles.contentContainer, insetMap[inset], contentStyle],
        showsVerticalScrollIndicator: false,
      }
    : {
        style: [styles.contentContainer, insetMap[inset], contentStyle],
      };

  return (
    <SafeAreaView style={[styles.safeArea, style]}>
      <Wrapper {...wrapperProps}>{children}</Wrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  contentContainer: {
    flex: 1,
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
});
