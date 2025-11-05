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
          <ActivityIndicator />
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
  container: { flex: 1, padding: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: 'bold' },
  newButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  newButtonText: { color: '#fff', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#b91c1c' },
  emptyText: { color: '#6b7280', marginTop: 8 },
  card: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardDescription: { color: '#4b5563', marginBottom: 4 },
  cardMeta: { color: '#6b7280', fontSize: 12 },
});
