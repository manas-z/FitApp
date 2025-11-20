// app/(tabs)/schedules/[id]/play.tsx
import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Audio, Video as ExpoVideo, ResizeMode } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/Screen';
import {
  DEFAULT_REST_DURATION_SECONDS,
  REST_DURATION_STORAGE_KEY,
} from '../../../../constants/settings';
import {
  getReadableTextColor,
  palette,
  spacing,
} from '../../../../constants/theme';
import { useDoc, useUser } from '../../../../src/firebase';
import type { Schedule, ScheduleStep } from '../../../../src/lib/types';

const PRIMARY_BUTTON_TEXT_COLOR = getReadableTextColor(palette.primary);

// Extend ScheduleStep locally to allow an optional description field
type ExtendedScheduleStep = ScheduleStep & {
  description?: string | null;
};

type UpcomingItem =
  | { type: 'rest'; duration: number }
  | { type: 'step'; step: ExtendedScheduleStep; index: number };

function formatTime(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export default function PlayScheduleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useUser();
  const userId = user?.uid ?? '';
  const path =
    userId && id
      ? `users/${userId}/schedules/${id}`
      : 'users/__no_user__/schedules/__no_doc__';

  const { data: schedule, isLoading } = useDoc<Schedule>(path);

  const [restDurationSetting, setRestDurationSetting] = useState(
    DEFAULT_REST_DURATION_SECONDS,
  );
  const [phase, setPhase] = useState<'step' | 'rest' | 'complete'>('step');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentRepeatIndex, setCurrentRepeatIndex] = useState(1);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [repeatConfig, setRepeatConfig] = useState<Record<string, number>>({});
  const [restContext, setRestContext] = useState<
    'betweenRepeats' | 'betweenSteps' | null
  >(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState<
    { type: 'image' | 'video'; url: string } | null
  >(null);

  const hasInitializedRef = useRef(false);
  const audioRef = useRef<Audio.Sound | null>(null);
  const videoRef = useRef<React.ElementRef<typeof ExpoVideo> | null>(null);

  const steps = useMemo<ExtendedScheduleStep[]>(
    () => ((schedule?.steps as ExtendedScheduleStep[]) ?? []),
    [schedule],
  );

  const currentStep: ExtendedScheduleStep | undefined =
    steps[currentStepIndex];
  const plannedRepeats = currentStep ? repeatConfig[currentStep.id] ?? 1 : 1;

  useEffect(() => {
    setFullscreenMedia(null);
  }, [currentStep?.id]);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(REST_DURATION_STORAGE_KEY)
      .then((stored) => {
        if (!stored || !isMounted) return;
        const parsed = Number.parseInt(stored, 10);
        if (!Number.isNaN(parsed)) {
          setRestDurationSetting(parsed);
        }
      })
      .catch((err) => {
        console.warn('Failed to load rest duration setting', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      AsyncStorage.getItem(REST_DURATION_STORAGE_KEY)
        .then((stored) => {
          if (!stored || !isActive) return;
          const parsed = Number.parseInt(stored, 10);
          if (!Number.isNaN(parsed)) {
            setRestDurationSetting(parsed);
          }
        })
        .catch((err) => {
          console.warn('Failed to refresh rest duration setting', err);
        });

      return () => {
        isActive = false;
      };
    }, []),
  );

  useEffect(() => {
    if (!schedule) return;

    if (user && schedule.userId && schedule.userId !== user.uid) {
      router.replace('/(tabs)');
      return;
    }
  }, [router, schedule, user]);

  useEffect(() => {
    if (!schedule || hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;

    if (!steps.length) {
      setPhase('complete');
      setRemainingSeconds(0);
      return;
    }

    setRepeatConfig(() => {
      const defaults: Record<string, number> = {};
      steps.forEach((step: ExtendedScheduleStep) => {
        defaults[step.id] = 1;
      });
      return defaults;
    });
    setCurrentStepIndex(0);
    setCurrentRepeatIndex(1);
    setPhase('step');
    setRestContext(null);
    setRemainingSeconds(Math.max(steps[0]?.duration ?? 0, 0));
  }, [schedule, steps]);

  useEffect(() => {
    setIsPaused(false);
    setIsAudioMuted(false);
  }, [currentStepIndex, phase]);

  const advanceToNextStep = useCallback(() => {
    setCurrentStepIndex((prevIndex) => {
      const nextIndex = prevIndex + 1;
      if (nextIndex >= steps.length) {
        setPhase('complete');
        setRemainingSeconds(0);
        setRestContext(null);
        return prevIndex;
      }

      const nextStep = steps[nextIndex];
      setPhase('step');
      setCurrentRepeatIndex(1);
      setRestContext(null);
      setRemainingSeconds(Math.max(nextStep?.duration ?? 0, 0));
      return nextIndex;
    });
  }, [steps]);

  const handlePhaseCompletion = useCallback(() => {
    if (!steps.length || !currentStep) {
      setPhase('complete');
      setRemainingSeconds(0);
      return;
    }

    if (phase === 'step') {
      const desiredRepeats = repeatConfig[currentStep.id] ?? 1;
      const hasMoreRepeats = currentRepeatIndex < desiredRepeats;

      if (hasMoreRepeats) {
        if (restDurationSetting > 0) {
          setPhase('rest');
          setRestContext('betweenRepeats');
          setRemainingSeconds(restDurationSetting);
        } else {
          setCurrentRepeatIndex((prev) => prev + 1);
          setRemainingSeconds(Math.max(currentStep.duration ?? 0, 0));
        }
        return;
      }

      if (restDurationSetting > 0) {
        setPhase('rest');
        setRestContext('betweenSteps');
        setRemainingSeconds(restDurationSetting);
      } else {
        advanceToNextStep();
      }
      return;
    }

    if (phase === 'rest') {
      if (restContext === 'betweenRepeats') {
        setRestContext(null);
        setPhase('step');
        setCurrentRepeatIndex((prev) => prev + 1);
        setRemainingSeconds(Math.max(currentStep.duration ?? 0, 0));
        return;
      }

      setRestContext(null);
      advanceToNextStep();
    }
  }, [
    advanceToNextStep,
    currentRepeatIndex,
    currentStep,
    restContext,
    phase,
    repeatConfig,
    restDurationSetting,
    steps.length,
  ]);

  useEffect(() => {
    if (
      !schedule ||
      phase === 'complete' ||
      remainingSeconds === null ||
      isPaused
    )
      return;

    if (remainingSeconds <= 0) {
      handlePhaseCompletion();
      return;
    }

    const timeout = setTimeout(() => {
      setRemainingSeconds((prev) => {
        if (prev === null) return null;
        return Math.max(prev - 1, 0);
      });
    }, 1000);

    return () => clearTimeout(timeout);
  }, [handlePhaseCompletion, isPaused, phase, remainingSeconds, schedule]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.unloadAsync().catch(() => {});
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const unloadCurrent = () => {
      if (audioRef.current) {
        audioRef.current.stopAsync().catch(() => {});
        audioRef.current.unloadAsync().catch(() => {});
        audioRef.current = null;
      }
    };

    unloadCurrent();

    if (!currentStep || !currentStep.media || phase !== 'step') {
      return;
    }

    const media = currentStep.media;

    if (media.type !== 'audio') {
      return;
    }

    let isCancelled = false;

    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync({
          uri: media.url,
        });
        if (isCancelled) {
          await sound.unloadAsync();
          return;
        }
        audioRef.current = sound;
        await sound.playAsync();
      } catch (err) {
        console.warn('Failed to play step audio', err);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [currentStep, phase]);

  useEffect(() => {
    const sound = audioRef.current;
    if (!sound) return;

    sound.setIsMutedAsync(isAudioMuted).catch(() => {});
  }, [isAudioMuted]);

  useEffect(() => {
    const sound = audioRef.current;
    if (!sound) return;

    if (phase === 'step' && !isPaused) {
      sound.playAsync().catch(() => {});
      return;
    }

    sound.pauseAsync().catch(() => {});
  }, [isPaused, phase]);

  useEffect(() => {
    const player = videoRef.current;
    if (!player || currentStep?.media?.type !== 'video') return;

    if (
      phase === 'step' &&
      !isPaused &&
      !(fullscreenMedia && fullscreenMedia.type === 'video')
    ) {
      player.playAsync().catch(() => {});
      return;
    }

    player.pauseAsync().catch(() => {});
  }, [currentStep, fullscreenMedia, isPaused, phase]);

  useEffect(() => {
    const player = videoRef.current;
    if (!player || currentStep?.media?.type !== 'video') return;

    player.setIsMutedAsync(isAudioMuted).catch(() => {});
  }, [currentStep, isAudioMuted]);

  const handleMediaPress = useCallback(() => {
    if (!currentStep?.media) return;
    if (currentStep.media.type === 'audio') return;
    setFullscreenMedia({
      type: currentStep.media.type,
      url: currentStep.media.url,
    });
  }, [currentStep?.media]);

  const closeFullscreenMedia = useCallback(() => {
    setFullscreenMedia(null);
  }, []);

  const renderMedia = useCallback(() => {
    if (!currentStep?.media) {
      videoRef.current = null;
      return (
        <View style={styles.mediaPlaceholder}>
          <Feather name="image" size={32} color={palette.textMuted} />
          <Text style={styles.mediaPlaceholderText}>No media added</Text>
        </View>
      );
    }

    if (currentStep.media.type === 'image') {
      videoRef.current = null;
      return (
        <Pressable
          onPress={handleMediaPress}
          style={({ pressed }) => [
            styles.mediaPressable,
            pressed && styles.mediaPressablePressed,
          ]}
        >
          <Image
            source={{ uri: currentStep.media.url }}
            style={styles.mediaImage}
            resizeMode="cover"
          />
          <View style={styles.mediaHint}>
            <Ionicons name="expand" size={16} color={palette.surface} />
            <Text style={styles.mediaHintText}>Tap to enlarge</Text>
          </View>
        </Pressable>
      );
    }

    if (currentStep.media.type === 'video') {
      return (
        <Pressable
          onPress={handleMediaPress}
          style={({ pressed }) => [
            styles.mediaPressable,
            pressed && styles.mediaPressablePressed,
          ]}
        >
          <ExpoVideo
            ref={(ref) => {
              videoRef.current = ref;
            }}
            source={{ uri: currentStep.media.url }}
            style={styles.mediaVideo}
            resizeMode={ResizeMode.COVER}
            shouldPlay={!isPaused && phase === 'step' && !fullscreenMedia}
            isLooping
            useNativeControls={false}
          />
          <View style={styles.mediaHint}>
            <Ionicons name="expand" size={16} color={palette.surface} />
            <Text style={styles.mediaHintText}>Tap to enlarge</Text>
          </View>
        </Pressable>
      );
    }

    videoRef.current = null;
    return (
      <View style={styles.mediaAudio}>
        <Ionicons
          name={isAudioMuted ? 'volume-mute' : 'musical-notes'}
          size={32}
          color={palette.primary}
        />
        <Text style={styles.mediaAudioText}>
          {currentStep.media.hint ?? 'Audio cue'}
        </Text>
        {isAudioMuted ? (
          <Text style={styles.mediaAudioMuted}>Muted</Text>
        ) : null}
      </View>
    );
  }, [currentStep, fullscreenMedia, handleMediaPress, isAudioMuted, isPaused, phase]);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const toggleMute = useCallback(() => {
    setIsAudioMuted((prev) => !prev);
  }, []);

  const skipCurrentStep = useCallback(() => {
    if (phase !== 'step') return;
    setIsPaused(false);
    handlePhaseCompletion();
  }, [handlePhaseCompletion, phase]);

  const skipRestPeriod = useCallback(() => {
    if (phase !== 'rest') return;
    setIsPaused(false);
    handlePhaseCompletion();
  }, [handlePhaseCompletion, phase]);

  const adjustRest = useCallback(
    (delta: number) => {
      setRemainingSeconds((prev) => {
        const base = prev ?? restDurationSetting;
        return Math.max(base + delta, 0);
      });
    },
    [restDurationSetting],
  );

  const upcomingItems = useMemo<UpcomingItem[]>(() => {
    const items: UpcomingItem[] = [];
    const hasMoreSteps = currentStepIndex < steps.length - 1;

    if (phase === 'step' && restDurationSetting > 0 && hasMoreSteps) {
      items.push({ type: 'rest', duration: restDurationSetting });
    }

    for (
      let index = currentStepIndex + 1;
      index < steps.length && items.length < 2;
      index += 1
    ) {
      items.push({ type: 'step', step: steps[index], index });
    }

    return items;
  }, [currentStepIndex, phase, restDurationSetting, steps]);

  const canMuteMedia = useMemo(() => {
    const mediaType = currentStep?.media?.type;
    return mediaType === 'audio' || mediaType === 'video';
  }, [currentStep]);

  const incrementRepeat = useCallback(() => {
    if (!currentStep) return;
    setRepeatConfig((prev) => {
      const currentValue = prev[currentStep.id] ?? 1;
      return {
        ...prev,
        [currentStep.id]: currentValue + 1,
      };
    });
  }, [currentStep]);

  const resetRepeat = useCallback(() => {
    if (!currentStep) return;
    setRepeatConfig((prev) => {
      if ((prev[currentStep.id] ?? 1) === 1) {
        return prev;
      }
      return {
        ...prev,
        [currentStep.id]: 1,
      };
    });
  }, [currentStep]);

  const isRestPhase = phase === 'rest';
  const timerValue = Math.max(
    0,
    remainingSeconds ??
      (isRestPhase ? restDurationSetting : currentStep?.duration ?? 0),
  );
  const timerLabel = formatTime(timerValue);
  const repeatBadgeValue = Math.max(0, plannedRepeats - 1);
  const repeatBadgeLabel =
    repeatBadgeValue === 1
      ? '1 more time'
      : `${repeatBadgeValue} more times`;
  const skipHandler = isRestPhase ? skipRestPeriod : skipCurrentStep;
  const jumpToStep = useCallback(
    (targetIndex: number) => {
      const targetStep = steps[targetIndex];
      if (!targetStep) return;
      setIsPaused(false);
      setPhase('step');
      setRestContext(null);
      setCurrentStepIndex(targetIndex);
      setCurrentRepeatIndex(1);
      setRemainingSeconds(Math.max(targetStep.duration ?? 0, 0));
    },
    [steps],
  );
  const stepLabel = isRestPhase
    ? restContext === 'betweenRepeats'
      ? `Rest before repeat ${currentRepeatIndex + 1}`
      : 'Rest'
    : `Step ${currentStepIndex + 1}: ${
        currentStep?.name?.trim() || 'Workout Step'
      }`;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!schedule) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Ionicons name="warning" size={48} color={palette.warning} />
          <Text style={styles.errorTitle}>Schedule not found</Text>
          <Text style={styles.errorMessage}>
            We couldn't load this schedule. It may have been deleted.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!steps.length || phase === 'complete') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.topBar}>
            <View style={styles.topBarSpacer} />
            <Text style={styles.scheduleTitle}>{schedule.title}</Text>
            <Pressable
              style={styles.closeButton}
              onPress={() => router.replace('/(tabs)')}
            >
              <Ionicons name="close" size={22} color={palette.textPrimary} />
            </Pressable>
          </View>
          <View style={[styles.centered, styles.completionCard]}>
            <Ionicons
              name="checkmark-circle"
              size={72}
              color={palette.success}
            />
            <Text style={styles.completionTitle}>All done!</Text>
            <Text style={styles.completionMessage}>
              Great job completing your schedule.
            </Text>
            <Pressable
              style={[styles.primaryButton, styles.completionButton]}
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={styles.primaryButtonText}>Back to Dashboard</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Screen
      scrollable={false}
      inset="none"
      style={styles.screen}
      contentStyle={styles.content}
    >
      <View style={styles.playSurface}>
        {isRestPhase ? (
          <View style={styles.restScreen}>
            <Text style={styles.restTitle}>REST</Text>
            <Text style={styles.restTimer}>{timerLabel}</Text>
            <View style={styles.restAdjustRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.restAdjustButton,
                  pressed && styles.restAdjustButtonActive,
                ]}
                onPress={() => adjustRest(-10)}
                accessibilityLabel="Subtract ten seconds from rest"
              >
                {({ pressed }) => (
                  <Text
                    style={[
                      styles.restAdjustText,
                      pressed && styles.restAdjustTextActive,
                    ]}
                  >
                    -10s
                  </Text>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.restAdjustButton,
                  pressed && styles.restAdjustButtonActive,
                ]}
                onPress={() => adjustRest(10)}
                accessibilityLabel="Add ten seconds to rest"
              >
                {({ pressed }) => (
                  <Text
                    style={[
                      styles.restAdjustText,
                      pressed && styles.restAdjustTextActive,
                    ]}
                  >
                    +10s
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.headerBlock}>
              <Text style={styles.scheduleLabel}>Name: {schedule.title}</Text>
              <View style={styles.stepRow}>
                <Text style={styles.stepText}>{stepLabel}</Text>
                <View style={styles.timerBadge}>
                  <Text style={styles.timerValue}>{timerLabel}</Text>
                </View>
              </View>
            </View>

            <View style={styles.mediaFrame}>{renderMedia()}</View>

            <View style={styles.controlsRow}>
              <View style={styles.controlsGroup}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    repeatBadgeValue > 0
                      ? `Current step will repeat ${repeatBadgeLabel}. Tap to add another repeat, long press to clear repeats.`
                      : 'Tap to repeat this step. Long press to clear repeats.'
                  }
                  onPress={incrementRepeat}
                  onLongPress={resetRepeat}
                  delayLongPress={400}
                  style={({ pressed }) => [
                    styles.iconButton,
                    repeatBadgeValue > 0 && styles.iconButtonActive,
                    pressed && styles.iconButtonPressed,
                  ]}
                >
                  <Ionicons
                    name="repeat"
                    size={20}
                    color={
                      repeatBadgeValue > 0
                        ? PRIMARY_BUTTON_TEXT_COLOR
                        : palette.textPrimary
                    }
                  />
                  {repeatBadgeValue > 0 ? (
                    <View style={styles.repeatBadge}>
                      <Text style={styles.repeatBadgeText}>
                        {repeatBadgeValue}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isPaused ? 'Resume timer' : 'Pause timer'}
                  onPress={togglePause}
                  style={({ pressed }) => [
                    styles.iconButton,
                    isPaused && styles.iconButtonActive,
                    pressed && styles.iconButtonPressed,
                  ]}
                >
                  <Ionicons
                    name={isPaused ? 'play' : 'pause'}
                    size={20}
                    color={
                      isPaused ? PRIMARY_BUTTON_TEXT_COLOR : palette.textPrimary
                    }
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    isRestPhase ? 'Skip rest timer' : 'Skip current step'
                  }
                  onPress={skipHandler}
                  style={({ pressed }) => [
                    styles.iconButton,
                    pressed && styles.iconButtonPressed,
                  ]}
                >
                  <Ionicons
                    name="play-skip-forward"
                    size={20}
                    color={palette.textPrimary}
                  />
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isAudioMuted ? 'Unmute media' : 'Mute media'}
                disabled={!canMuteMedia}
                onPress={toggleMute}
                style={({ pressed }) => [
                  styles.mutePill,
                  isAudioMuted && styles.mutePillActive,
                  !canMuteMedia && styles.mutePillDisabled,
                  pressed && styles.mutePillPressed,
                ]}
              >
                <Text
                  style={[
                    styles.mutePillText,
                    isAudioMuted && styles.mutePillTextActive,
                    !canMuteMedia && styles.mutePillTextDisabled,
                  ]}
                >
                  {isAudioMuted ? 'Unmute' : 'Mute'}
                </Text>
              </Pressable>
            </View>
          </>
        )}

        <View style={styles.upcomingSection}>
          <Text style={styles.upcomingTitle}>Upcoming steps</Text>
          {upcomingItems.length === 0 ? (
            <Text style={styles.upcomingEmpty}>You're on the final step.</Text>
          ) : (
            upcomingItems.map((item, index) => {
              const label =
                item.type === 'rest'
                  ? 'Rest'
                  : item.step.name?.trim() ||
                    `Step ${item.index + 1}`;
              const meta =
                item.type === 'rest'
                  ? `${item.duration}s`
                  : formatTime(item.step.duration ?? 0);

              return (
                <View key={`${item.type}-${index}`} style={styles.upcomingItem}>
                  <View style={styles.upcomingInfo}>
                    <Text style={styles.upcomingIndex}>{index + 1}.</Text>
                    <View style={styles.upcomingTextBlock}>
                      <Text style={styles.upcomingLabel}>{label}</Text>
                      <Text style={styles.upcomingMeta}>{meta}</Text>
                    </View>
                  </View>
                  {item.type === 'step' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Jump to ${label}`}
                      onPress={() => jumpToStep(item.index)}
                      style={({ pressed }) => [
                        styles.jumpButton,
                        pressed && styles.jumpButtonPressed,
                      ]}
                    >
                      <Ionicons
                        name="play-skip-forward"
                        size={16}
                        color={palette.textPrimary}
                      />
                    </Pressable>
                  ) : (
                    <View style={styles.jumpButtonPlaceholder}>
                      <Ionicons
                        name="time-outline"
                        size={16}
                        color={palette.textMuted}
                      />
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>

      {fullscreenMedia ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={closeFullscreenMedia}
        >
          <Pressable
            style={styles.fullscreenOverlay}
            onPress={closeFullscreenMedia}
          >
            <Pressable
              onPress={(event: GestureResponderEvent) => {
                event.stopPropagation();
              }}
              style={styles.fullscreenMediaContainer}
            >
              {fullscreenMedia.type === 'image' ? (
                <Image
                  source={{ uri: fullscreenMedia.url }}
                  style={styles.fullscreenMedia}
                  resizeMode="contain"
                />
              ) : (
                <ExpoVideo
                  source={{ uri: fullscreenMedia.url }}
                  style={styles.fullscreenMedia}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={!isPaused && phase === 'step'}
                  isLooping
                  useNativeControls
                />
              )}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  topBarSpacer: {
    width: spacing.md,
  },
  scheduleTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  playSurface: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: palette.surface,
    borderRadius: 32,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: palette.shadowStrong,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    gap: spacing.lg,
    minHeight: 780,
  },
  headerBlock: {
    gap: spacing.xs,
  },
  scheduleLabel: {
    fontSize: 16,
    color: palette.textPrimary,
    fontWeight: '600',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  stepText: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  timerBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: palette.textPrimary,
    borderRadius: 14,
    minWidth: 80,
    alignItems: 'center',
  },
  timerValue: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  mediaFrame: {
    height: 360,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: palette.textPrimary,
    backgroundColor: palette.surfaceMuted,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPressable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPressablePressed: {
    opacity: 0.9,
  },
  restScreen: {
    height: 360,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: palette.textPrimary,
    backgroundColor: palette.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  restTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  restTimer: {
    fontSize: 54,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  restAdjustRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  restAdjustButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    minWidth: 120,
    alignItems: 'center',
  },
  restAdjustButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  restAdjustText: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  restAdjustTextActive: {
    color: PRIMARY_BUTTON_TEXT_COLOR,
  },
  mediaPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  mediaPlaceholderText: {
    fontSize: 14,
    color: palette.textMuted,
    textAlign: 'center',
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
  mediaHint: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  mediaHintText: {
    color: palette.surface,
    fontSize: 11,
    fontWeight: '600',
  },
  mediaAudio: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  mediaAudioText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.textPrimary,
    textAlign: 'center',
  },
  mediaAudioMuted: {
    fontSize: 12,
    color: palette.textMuted,
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 10, 20, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  fullscreenMediaContainer: {
    width: '90%',
    maxWidth: 920,
    aspectRatio: 16 / 9,
    borderRadius: 28,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenMedia: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.textPrimary,
    backgroundColor: palette.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  iconButtonPressed: {
    opacity: 0.8,
  },
  repeatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.primary,
    borderWidth: 1,
    borderColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  repeatBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: PRIMARY_BUTTON_TEXT_COLOR,
  },
  mutePill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.textPrimary,
    backgroundColor: palette.surface,
  },
  mutePillActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  mutePillDisabled: {
    opacity: 0.4,
  },
  mutePillPressed: {
    opacity: 0.8,
  },
  mutePillText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  mutePillTextActive: {
    color: PRIMARY_BUTTON_TEXT_COLOR,
  },
  mutePillTextDisabled: {
    color: palette.textSecondary,
  },
  upcomingSection: {
    gap: spacing.sm,
  },
  upcomingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  upcomingEmpty: {
    fontSize: 13,
    color: palette.textSecondary,
  },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  upcomingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  upcomingIndex: {
    fontSize: 14,
    color: palette.textSecondary,
  },
  upcomingTextBlock: {
    flex: 1,
    gap: 2,
  },
  upcomingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  upcomingMeta: {
    fontSize: 12,
    color: palette.textSecondary,
  },
  jumpButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.textPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jumpButtonPressed: {
    opacity: 0.7,
  },
  jumpButtonPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: palette.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryButtonText: {
    color: PRIMARY_BUTTON_TEXT_COLOR,
    fontWeight: '700',
    fontSize: 15,
  },
  completionCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    paddingVertical: 48,
    paddingHorizontal: 24,
    marginTop: 32,
    gap: 12,
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  completionMessage: {
    fontSize: 14,
    color: palette.textSecondary,
    textAlign: 'center',
  },
  completionButton: {
    marginTop: 12,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.textPrimary,
    marginTop: 16,
  },
  errorMessage: {
    fontSize: 14,
    color: palette.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
