// app/(tabs)/profile.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { palette, radii, spacing } from '../../constants/theme';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Profile details will go here.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    shadowColor: palette.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
    borderWidth: 1,
    borderColor: palette.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing.sm,
    color: palette.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: palette.textSecondary,
  },
});
