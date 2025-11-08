// app/(tabs)/index.tsx
import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { deleteDoc, doc } from 'firebase/firestore';
import { useFirebase, useUser, useCollection } from '../../src/firebase';
import type { Schedule, ScheduleStepMedia } from '../../src/lib/types';

export default function DashboardScreen() {
  const router = useRouter();
  const { auth, firestore } = useFirebase();
  const { user } = useUser();

  const userId = user?.uid ?? '';
  const path =
    userId.length > 0
      ? `users/${userId}/schedules`
      : 'users/__no_user__/schedules';

  const { data: schedules, isLoading } = useCollection<Schedule>(path);

  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(
    null,
  );

  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }, [schedules]);

  const name = user?.displayName?.trim() || user?.email?.split('@')[0] || 'there';

  const handlePlay = (scheduleId: string) => {
    router.push({
      pathname: '/(tabs)/schedules/[id]/play',
      params: { id: scheduleId },
    });
  };

  const handleOpenMenu = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setMenuVisible(true);
  };

  const closeMenu = () => {
    setMenuVisible(false);
    setSelectedSchedule(null);
  };

  const handleEdit = () => {
    if (!selectedSchedule) return;
    const { id } = selectedSchedule;
    closeMenu();
    router.push({
      pathname: '/(tabs)/schedules/[id]',
      params: { id },
    });
  };

  const handleDelete = () => {
    if (!selectedSchedule || !userId) return;
    const schedule = selectedSchedule;
    closeMenu();

    Alert.alert(
      'Delete schedule',
      `Are you sure you want to delete "${schedule.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const scheduleRef = doc(
              firestore,
              'users',
              userId,
              'schedules',
              schedule.id,
            );

            deleteDoc(scheduleRef).catch((err) => {
              console.error('Failed to delete schedule', err);
            });
          },
        },
      ],
    );
  };

  const renderMediaPreview = (media?: ScheduleStepMedia) => {
    if (!media?.url) {
      return <View style={styles.mediaFallback} />;
    }

    if (media.type === 'image') {
      return <Image source={{ uri: media.url }} style={styles.mediaImage} />;
    }

    if (media.type === 'video') {
      return (
        <Video
          source={{ uri: media.url }}
          style={styles.mediaVideo}
          resizeMode={ResizeMode.COVER}
          shouldPlay={false}
          isMuted
        />
      );
    }

    return (
      <View style={styles.mediaAudio}>
        <Ionicons name="musical-notes" size={20} color="#2563eb" />
      </View>
    );
  };

  const renderScheduleCard = ({ item }: { item: Schedule }) => {
    const firstStepWithMedia = item.steps?.find((step) => step.media);
    const media = firstStepWithMedia?.media;
    const totalSeconds = item.totalDuration ?? 0;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const durationLabel =
      minutes > 0
        ? `${minutes} min${minutes > 1 ? 's' : ''}${
            seconds > 0 ? ` ${seconds} sec` : ''
          }`
        : `${seconds} sec`;
    const stepsCount = item.steps?.length ?? 0;

    return (
      <View style={styles.card}>
        <View style={styles.mediaContainer}>{renderMediaPreview(media)}</View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          {item.description ? (
            <Text style={styles.cardDescription} numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Feather name="clock" size={14} color="#1f2937" />
              <Text style={styles.metaText}>{durationLabel}</Text>
            </View>
            <View style={styles.metaItem}>
              <Feather name="list" size={14} color="#1f2937" />
              <Text style={styles.metaText}>
                {stepsCount} step{stepsCount === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.cardActions}>
          <Pressable
            accessibilityLabel={`Play ${item.title}`}
            style={styles.iconButton}
            onPress={() => handlePlay(item.id)}
          >
            <Ionicons name="play" size={18} color="#111827" />
          </Pressable>
          <Pressable
            accessibilityLabel={`Open menu for ${item.title}`}
            style={styles.iconButton}
            onPress={() => handleOpenMenu(item)}
          >
            <Ionicons name="menu" size={18} color="#111827" />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextGroup}>
            <Text style={styles.greeting}>Hello, {name}</Text>
            <Text style={styles.subtitle}>Your Schedules</Text>
            <Text style={styles.helperText}>
              Select a schedule to start your workout.
            </Text>
          </View>
          <Pressable
            style={styles.newButton}
            onPress={() => router.push('/(tabs)/schedules/new')}
          >
            <Feather name="plus" size={18} color="#0f172a" style={styles.newIcon} />
            <Text style={styles.newButtonText}>New</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color="#0f172a" />
          </View>
        ) : (
          <FlatList
            data={sortedSchedules}
            keyExtractor={(item) => item.id}
            renderItem={renderScheduleCard}
            contentContainerStyle={
              sortedSchedules.length === 0 ? styles.emptyList : styles.listContent
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No schedules yet</Text>
                <Text style={styles.emptyMessage}>
                  Create your first schedule to see it listed here.
                </Text>
              </View>
            }
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

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <View style={styles.menuOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
          <View style={styles.menuCard}>
            <Pressable style={styles.menuItem} onPress={handleEdit}>
              <Feather name="edit-2" size={16} color="#0f172a" />
              <Text style={styles.menuItemText}>Edit schedule</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={handleDelete}>
              <Feather name="trash-2" size={16} color="#dc2626" />
              <Text style={[styles.menuItemText, styles.menuDeleteText]}>Delete schedule</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#d7ecf7',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerTextGroup: {
    flex: 1,
    marginRight: 16,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  helperText: {
    fontSize: 14,
    color: '#334155',
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fcd34d',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  newIcon: {
    marginRight: 6,
  },
  newButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 32,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#334155',
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  mediaContainer: {
    width: 72,
    height: 72,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#cbd5f5',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mediaVideo: {
    width: '100%',
    height: '100%',
  },
  mediaAudio: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  logoutButton: {
    marginTop: 16,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#0f172a',
  },
  logoutText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 24,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemText: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#0f172a',
  },
  menuDeleteText: {
    color: '#dc2626',
  },
});
