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
import { palette, radii, spacing } from '../../constants/theme';
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
        <Ionicons name="musical-notes" size={20} color={palette.primary} />
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
              <Feather name="clock" size={14} color={palette.textSecondary} />
              <Text style={styles.metaText}>{durationLabel}</Text>
            </View>
            <View style={styles.metaItem}>
              <Feather name="list" size={14} color={palette.textSecondary} />
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
            <Ionicons name="play" size={18} color={palette.primaryDark} />
          </Pressable>
          <Pressable
            accessibilityLabel={`Open menu for ${item.title}`}
            style={styles.iconButton}
            onPress={() => handleOpenMenu(item)}
          >
            <Ionicons name="menu" size={18} color={palette.primaryDark} />
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
            <Feather
              name="plus"
              size={18}
              color={palette.surface}
              style={styles.newIcon}
            />
            <Text style={styles.newButtonText}>New</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={palette.primary} />
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
              <Feather name="edit-2" size={16} color={palette.primaryDark} />
              <Text style={styles.menuItemText}>Edit schedule</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={handleDelete}>
              <Feather name="trash-2" size={16} color={palette.danger} />
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
    backgroundColor: palette.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: palette.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  headerTextGroup: {
    flex: 1,
    marginRight: spacing.lg,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.textPrimary,
    marginBottom: spacing.xs,
  },
  helperText: {
    fontSize: 14,
    color: palette.textSecondary,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    elevation: 2,
    shadowColor: palette.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  newIcon: {
    marginRight: spacing.xs,
  },
  newButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.surface,
    letterSpacing: 0.2,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: spacing.xxl,
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
    color: palette.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyMessage: {
    fontSize: 14,
    color: palette.textSecondary,
    textAlign: 'center',
    maxWidth: 220,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: palette.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  mediaContainer: {
    width: 72,
    height: 72,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: palette.surfaceMuted,
    marginRight: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  mediaFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: palette.primaryMuted,
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
    color: palette.textPrimary,
    marginBottom: spacing.xs,
  },
  cardDescription: {
    fontSize: 13,
    color: palette.textSecondary,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    marginLeft: spacing.xs,
    fontSize: 13,
    color: palette.textMuted,
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: palette.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  logoutButton: {
    marginTop: spacing.lg,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: palette.primaryDark,
    shadowColor: palette.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  logoutText: {
    color: palette.surface,
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: palette.overlay,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingTop: 72,
    paddingBottom: spacing.xl,
  },
  menuCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.xs,
    shadowColor: palette.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    borderWidth: 1,
    borderColor: palette.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  menuItemText: {
    marginLeft: spacing.sm,
    fontSize: 15,
    fontWeight: '500',
    color: palette.textPrimary,
  },
  menuDeleteText: {
    color: palette.danger,
  },
});
