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
  SafeAreaView,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { palette, radii, spacing } from '@/constants/theme';
import { deleteDoc, doc } from 'firebase/firestore';
import { StyledText } from '@/components/StyledText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useFirebase, useUser, useCollection } from '@/src/firebase';
import type { Schedule, ScheduleStepMedia } from '@/src/lib/types';

const formatDurationLabel = (totalSeconds?: number) => {
  if (!totalSeconds) {
    return '0s';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  if ((parts.length === 0 || hours === 0) && seconds > 0) {
    parts.push(`${seconds}s`);
  }

  if (parts.length === 0) {
    parts.push('0s');
  }

  return parts.join(' ');
};

const getDayPeriodGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 18) {
    return 'Good afternoon';
  }

  return 'Good evening';
};

export default function DashboardScreen() {
  const router = useRouter();
  const { firestore } = useFirebase();
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
  const nextSchedule = sortedSchedules[0];
  const dayPeriodGreeting = getDayPeriodGreeting();

  const queueMetrics = useMemo(() => {
    if (sortedSchedules.length === 0) {
      return { totalQueuedSeconds: 0, averageSteps: 0 };
    }

    let totalQueuedSeconds = 0;
    let totalSteps = 0;

    for (const schedule of sortedSchedules) {
      totalQueuedSeconds += schedule.totalDuration ?? 0;
      totalSteps += schedule.steps?.length ?? 0;
    }

    return {
      totalQueuedSeconds,
      averageSteps: Math.round(totalSteps / sortedSchedules.length),
    };
  }, [sortedSchedules]);

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
    const durationLabel = formatDurationLabel(totalSeconds);
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

  const renderListHeader = () => {
    const stats = [
      {
        label: 'Workouts ready',
        value: sortedSchedules.length.toString(),
      },
      {
        label: 'Time queued',
        value: formatDurationLabel(queueMetrics.totalQueuedSeconds),
      },
      {
        label: 'Avg steps',
        value: queueMetrics.averageSteps > 0 ? `${queueMetrics.averageSteps}` : '—',
      },
    ];

    return (
      <View style={styles.listHeader}>
        <Card padding="lg" elevated style={styles.heroCard}>
          <View style={styles.heroHeadingRow}>
            <View style={styles.heroHeadingText}>
              <StyledText tone="inverse" variant="caption">
                {dayPeriodGreeting}, {name}
              </StyledText>
              <StyledText tone="inverse" variant="title" weight="bold" style={styles.heroTitle}>
                Keep your cadence steady
              </StyledText>
            </View>
            <Pressable
              accessibilityRole="button"
              style={styles.heroIconButton}
              onPress={() => router.push('/(tabs)/schedules/new')}
            >
              <Feather name="plus" size={18} color={palette.primary} />
            </Pressable>
          </View>
          <StyledText tone="inverse" style={styles.heroDescription}>
            {sortedSchedules.length > 0
              ? 'Pick up where you left off or build something fresh.'
              : 'Craft your first plan to start executing intentional rides.'}
          </StyledText>
          <Button
            title="Create schedule"
            variant="secondary"
            onPress={() => router.push('/(tabs)/schedules/new')}
            containerStyle={styles.heroButton}
          />
          {nextSchedule ? (
            <Pressable
              accessibilityRole="button"
              style={styles.nextScheduleCard}
              onPress={() => handlePlay(nextSchedule.id)}
            >
              <View style={styles.nextScheduleBody}>
                <StyledText variant="subtitle" weight="semibold">
                  {nextSchedule.title}
                </StyledText>
                {nextSchedule.description ? (
                  <StyledText variant="caption" tone="muted" numberOfLines={2}>
                    {nextSchedule.description}
                  </StyledText>
                ) : null}
                <View style={styles.nextScheduleMeta}>
                  <View style={styles.metaItem}>
                    <Feather name="clock" size={14} color={palette.textSecondary} />
                    <StyledText variant="caption" tone="muted">
                      {formatDurationLabel(nextSchedule.totalDuration)}
                    </StyledText>
                  </View>
                  <View style={styles.metaItem}>
                    <Feather name="list" size={14} color={palette.textSecondary} />
                    <StyledText variant="caption" tone="muted">
                      {nextSchedule.steps?.length ?? 0} steps
                    </StyledText>
                  </View>
                </View>
              </View>
              <View style={styles.nextScheduleAction}>
                <Ionicons name="play" size={20} color={palette.surface} />
              </View>
            </Pressable>
          ) : (
            <View style={styles.nextScheduleEmpty}>
              <StyledText tone="inverse" weight="semibold">
                Nothing queued yet
              </StyledText>
              <StyledText tone="inverse" variant="caption">
                Use the button above to create a ride.
              </StyledText>
            </View>
          )}
        </Card>

        <View style={styles.statRow}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <StyledText variant="title" weight="bold">
                {stat.value}
              </StyledText>
              <StyledText variant="caption" tone="muted">
                {stat.label}
              </StyledText>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <StyledText variant="subtitle" weight="semibold">
              Schedules to execute
            </StyledText>
            <StyledText variant="caption" tone="muted">
              {sortedSchedules.length > 0
                ? 'Tap any plan to start, edit, or preview.'
                : 'Once saved, your routines will appear here.'}
            </StyledText>
          </View>
          <Pressable
            accessibilityRole="button"
            style={styles.headingAction}
            onPress={() => router.push('/(tabs)/schedules/new')}
          >
            <Feather name="plus" size={16} color={palette.primary} />
            <StyledText variant="label" weight="semibold" style={styles.headingActionText}>
              New
            </StyledText>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={sortedSchedules}
        keyExtractor={(item) => item.id}
        renderItem={renderScheduleCard}
        contentContainerStyle={[
          styles.listContent,
          sortedSchedules.length === 0 && styles.emptyList,
        ]}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color={palette.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="bicycle" size={42} color={palette.textMuted} />
              <StyledText variant="subtitle" weight="semibold">
                No schedules yet
              </StyledText>
              <StyledText tone="muted" style={styles.emptyMessage}>
                Tap "New" above to build your first ride.
              </StyledText>
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  listHeader: {
    gap: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  heroCard: {
    backgroundColor: palette.primary,
    borderColor: 'transparent',
    gap: spacing.md,
  },
  heroHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  heroHeadingText: {
    flex: 1,
    gap: spacing.xs,
  },
  heroTitle: {
    marginTop: spacing.xs / 2,
  },
  heroDescription: {
    opacity: 0.85,
  },
  heroIconButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  heroButton: {
    alignSelf: 'flex-start',
  },
  nextScheduleCard: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  nextScheduleBody: {
    flex: 1,
    gap: spacing.xs,
  },
  nextScheduleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
  },
  nextScheduleAction: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextScheduleEmpty: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    gap: spacing.xs,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: 120,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.xs / 2,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headingAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  headingActionText: {
    color: palette.primary,
  },
  loadingState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
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
