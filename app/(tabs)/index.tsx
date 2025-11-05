// app/(tabs)/index.tsx
import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { useFirebase, useUser, useCollection } from '../../src/firebase';
import type { Schedule } from '../../src/lib/types';

export default function DashboardScreen() {
  const router = useRouter();
  const { auth } = useFirebase();
  const { user } = useUser();

  const userId = user?.uid ?? '';
  const path =
    userId.length > 0
      ? `users/${userId}/schedules`
      : 'users/__no_user__/schedules';

  const { data: schedules } = useCollection<Schedule>(path);
  const topSchedules = schedules.slice(0, 3);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>
        Welcome {user?.email ?? 'there'}.
      </Text>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Schedules</Text>
        <Pressable onPress={() => router.push('/(tabs)/schedules')}>
          <Text style={styles.sectionLink}>View all</Text>
        </Pressable>
      </View>

      {topSchedules.length === 0 ? (
        <Text style={styles.emptyText}>
          You have no schedules yet. Create one from the Schedules tab.
        </Text>
      ) : (
        <FlatList
          data={topSchedules}
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
              <Text style={styles.cardMeta}>
                {item.steps?.length ?? 0} steps ·{' '}
                {Math.round((item.totalDuration ?? 0) / 60)} min
              </Text>
            </Pressable>
          )}
        />
      )}

      <Pressable
        style={styles.logoutButton}
        onPress={() => {
          signOut(auth);
        }}
      >
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingBottom: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 16, marginBottom: 16 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  sectionLink: { color: '#2563eb', fontWeight: '500' },
  emptyText: { color: '#6b7280', marginBottom: 16 },
  card: {
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  logoutButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  logoutText: { color: '#fff', fontWeight: '600' },
});
