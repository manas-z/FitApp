// app/(tabs)/schedules/index.tsx
import React from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useUser, useCollection } from '../../../src/firebase';
import type { Schedule } from '../../../src/lib/types';
import { palette, radii, spacing } from '../../../constants/theme';

export default function SchedulesListScreen() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const userId = user?.uid ?? '';
  const path =
    userId.length > 0
      ? `users/${userId}/schedules`
      : 'users/__no_user__/schedules';

  const {
    data: schedules,
    isLoading,
    error,
  } = useCollection<Schedule>(path);

  const loading = isUserLoading || isLoading;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Schedules</Text>
        <Pressable
          style={styles.newButton}
          onPress={() => router.push('/(tabs)/schedules/new')}
        >
          <Text style={styles.newButtonText}>+ New</Text>
        </Pressable>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={palette.primary} />
        </View>
      )}

      {!loading && error && (
        <Text style={styles.errorText}>Failed to load schedules.</Text>
      )}

      {!loading && !error && schedules.length === 0 && (
        <Text style={styles.emptyText}>
          No schedules yet. Create your first one.
        </Text>
      )}

      {!loading && !error && schedules.length > 0 && (
        <FlatList
          data={schedules}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/schedules/[id]',
                  params: { id: item.id },
                })
              }
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              {!!item.description && (
                <Text style={styles.cardDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              <Text style={styles.cardMeta}>
                {item.steps?.length ?? 0} steps ·{' '}
                {Math.round((item.totalDuration ?? 0) / 60)} min
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    backgroundColor: palette.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  newButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: palette.primary,
    shadowColor: palette.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  newButtonText: {
    color: palette.surface,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: palette.danger,
    marginTop: spacing.md,
  },
  emptyText: {
    color: palette.textMuted,
    marginTop: spacing.md,
    fontSize: 15,
  },
  card: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    shadowColor: palette.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.xs,
    color: palette.textPrimary,
  },
  cardDescription: {
    color: palette.textSecondary,
    marginBottom: spacing.xs,
    fontSize: 14,
    lineHeight: 20,
  },
  cardMeta: {
    color: palette.textMuted,
    fontSize: 13,
  },
});
