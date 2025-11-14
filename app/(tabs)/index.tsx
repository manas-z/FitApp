// app/(tabs)/index.tsx
import { useMemo, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { deleteDoc, doc } from 'firebase/firestore';
import { Screen } from '@/components/Screen';
import { StyledText } from '@/components/StyledText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { palette, radii, spacing } from '@/constants/theme';
import { useFirebase, useUser, useCollection } from '@/src/firebase';
import type { Schedule, ScheduleStepMedia } from '@/src/lib/types';

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
      <Card padding="md" style={styles.card}>
        <View style={styles.mediaContainer}>{renderMediaPreview(media)}</View>
        <View style={styles.cardContent}>
          <StyledText variant="subtitle" weight="semibold" numberOfLines={1}>
            {item.title}
          </StyledText>
          {item.description ? (
            <StyledText tone="muted" numberOfLines={1}>
              {item.description}
            </StyledText>
          ) : null}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Feather name="clock" size={14} color={palette.textSecondary} />
              <StyledText variant="caption" tone="muted">
                {durationLabel}
              </StyledText>
            </View>
            <View style={styles.metaItem}>
              <Feather name="list" size={14} color={palette.textSecondary} />
              <StyledText variant="caption" tone="muted">
                {stepsCount} step{stepsCount === 1 ? '' : 's'}
              </StyledText>
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
            <Ionicons name="ellipsis-horizontal" size={18} color={palette.primaryDark} />
          </Pressable>
        </View>
      </Card>
    );
  };

  return (
    <Screen scrollable={false} inset="none" contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextGroup}>
          <StyledText variant="label" tone="muted">
            Hey {name},
          </StyledText>
          <StyledText variant="title" weight="bold">
            Your schedules
          </StyledText>
          <StyledText tone="muted">
            Select a plan to get rolling.
          </StyledText>
        </View>
        <Button
          title="New schedule"
          leftIcon={<Feather name="plus" size={16} color={palette.surface} />}
          onPress={() => router.push('/(tabs)/schedules/new')}
        />
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
          contentContainerStyle={[
            styles.listContent,
            sortedSchedules.length === 0 && styles.emptyList,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="bicycle" size={42} color={palette.textMuted} />
              <StyledText variant="subtitle" weight="semibold">
                No schedules yet
              </StyledText>
              <StyledText tone="muted" style={styles.emptyMessage}>
                Tap "New schedule" to build your first ride.
              </StyledText>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <Button title="Log out" variant="ghost" onPress={() => signOut(auth)} />

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
              <StyledText weight="medium">Edit schedule</StyledText>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={handleDelete}>
              <Feather name="trash-2" size={16} color={palette.danger} />
              <StyledText weight="medium" style={styles.menuDeleteText}>
                Delete schedule
              </StyledText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  headerTextGroup: {
    flex: 1,
    gap: spacing.xs,
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
    gap: spacing.sm,
  },
  emptyMessage: {
    textAlign: 'center',
    maxWidth: 240,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  mediaContainer: {
    width: 82,
    height: 82,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: palette.surfaceMuted,
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
    gap: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: palette.overlay,
    justifyContent: 'flex-end',
    padding: spacing.xl,
  },
  menuCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  menuDeleteText: {
    color: palette.danger,
  },
});
