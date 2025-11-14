// app/(tabs)/schedules/[id]/play.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Video as ExpoVideo, ResizeMode, Audio } from 'expo-av';
import { Ionicons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useDoc, useUser } from '../../../../src/firebase';
import type { Schedule, ScheduleStep } from '../../../../src/lib/types';
import {
  DEFAULT_REST_DURATION_SECONDS,
  REST_DURATION_STORAGE_KEY,
} from '../../../../constants/settings';
import { palette, getReadableTextColor } from '../../../../constants/theme';

const PRIMARY_BUTTON_TEXT_COLOR = getReadableTextColor(palette.primary);

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
  const staticTextColor = {
    lightColor: palette.textPrimary,
    darkColor: palette.textPrimary,
  };

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
  const [repeatModalVisible, setRepeatModalVisible] = useState(false);
  const [pendingRepeat, setPendingRepeat] = useState(1);
  const [restContext, setRestContext] = useState<
    'betweenRepeats' | 'betweenSteps' | null
  >(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  const hasInitializedRef = useRef(false);
  const audioRef = useRef<Audio.Sound | null>(null);
  const videoRef = useRef<React.ElementRef<typeof ExpoVideo> | null>(null);

  const steps = useMemo(() => schedule?.steps ?? [], [schedule]);
  const currentStep: ScheduleStep | undefined = steps[currentStepIndex];
  const plannedRepeats = currentStep ? repeatConfig[currentStep.id] ?? 1 : 1;

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
      steps.forEach((step: ScheduleStep) => {
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

    sound
      .setIsMutedAsync(isAudioMuted)
      .catch(() => {});
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

    if (phase === 'step' && !isPaused) {
      player.playAsync().catch(() => {});
      return;
    }

    player.pauseAsync().catch(() => {});
  }, [currentStep, isPaused, phase]);

  useEffect(() => {
    const player = videoRef.current;
    if (!player || currentStep?.media?.type !== 'video') return;

    player.setIsMutedAsync(isAudioMuted).catch(() => {});
  }, [currentStep, isAudioMuted]);

  const openRepeatModal = () => {
    if (!currentStep) return;
    const currentValue = repeatConfig[currentStep.id] ?? 1;
    setPendingRepeat(currentValue);
    setRepeatModalVisible(true);
  };

  const closeRepeatModal = () => {
    setRepeatModalVisible(false);
  };

  const confirmRepeat = () => {
    if (!currentStep) return;
    setRepeatConfig((prev) => ({
      ...prev,
      [currentStep.id]: pendingRepeat,
    }));
    setRepeatModalVisible(false);
    setCurrentRepeatIndex(1);
    if (phase === 'step') {
      setRemainingSeconds(Math.max(currentStep.duration ?? 0, 0));
    }
  };

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
        <Image
          source={{ uri: currentStep.media.url }}
          style={styles.mediaImage}
          resizeMode="cover"
        />
      );
    }

    if (currentStep.media.type === 'video') {
      return (
        <ExpoVideo
          ref={(ref) => {
            videoRef.current = ref;
          }}
          source={{ uri: currentStep.media.url }}
          style={styles.mediaVideo}
          resizeMode={ResizeMode.COVER}
          shouldPlay={!isPaused && phase === 'step'}
          isLooping
          useNativeControls
        />
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
  }, [currentStep, isAudioMuted, isPaused, phase]);

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

  const extendRest = useCallback(() => {
    setRemainingSeconds((prev) => (prev === null ? 15 : prev + 15));
  }, []);

  const upcomingSteps = useMemo(
    () => steps.slice(currentStepIndex + 1, currentStepIndex + 3),
    [currentStepIndex, steps],
  );

  const canMuteMedia = useMemo(() => {
    const mediaType = currentStep?.media?.type;
    return mediaType === 'audio' || mediaType === 'video';
  }, [currentStep]);

  const isRestPhase = phase === 'rest';
  const timerValue = Math.max(
    0,
    remainingSeconds ?? (isRestPhase ? restDurationSetting : currentStep?.duration ?? 0),
  );
  const timerLabel = formatTime(timerValue);
  const upcomingStep = upcomingSteps[0];
  const skipHandler = isRestPhase ? skipRestPeriod : skipCurrentStep;
  const handleJumpToStep = useCallback(() => {
    if (phase === 'rest') {
      skipRestPeriod();
      return;
    }

    advanceToNextStep();
  }, [advanceToNextStep, phase, skipRestPeriod]);

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
            <Ionicons name="checkmark-circle" size={72} color={palette.success} />
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
      <View style={styles.playCard}>
        <View style={styles.cardHeader}>
          <StyledText variant="caption" {...staticTextColor}>
            Name: {schedule.title}
          </StyledText>
          <StyledText variant="label" weight="bold" {...staticTextColor}>
            Sprint Number: {currentStepIndex + 1} of {steps.length}
          </StyledText>
        </View>

        <View style={styles.previewFrame}>
          {renderMedia()}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isRestPhase ? 'Skip rest timer' : 'Skip current step'
            }
            onPress={skipHandler}
            style={({ pressed }) => [
              styles.skipButton,
              pressed && styles.skipButtonActive,
            ]}
          >
            <Ionicons name="play-skip-forward" size={24} color={palette.surface} />
          </Pressable>
        </View>

        <View style={styles.stageCard}>
          {phase === 'rest' ? (
            <RestStage
              scheduleTitle={schedule.title}
              remainingSeconds={remainingSeconds ?? 0}
              onExtend={extendRest}
              restContext={restContext}
              nextStep={
                restContext === 'betweenRepeats'
                  ? currentStep
                  : steps[currentStepIndex + 1]
              }
              currentRepeatIndex={currentRepeatIndex}
              plannedRepeats={plannedRepeats}
              onTogglePause={togglePause}
              isPaused={isPaused}
              onSkipRest={skipRestPeriod}
            />
          ) : (
            <ActiveStage
              scheduleTitle={schedule.title}
              currentStep={currentStep}
              currentStepIndex={currentStepIndex}
              totalSteps={steps.length}
              remainingSeconds={remainingSeconds ?? 0}
              currentRepeatIndex={currentRepeatIndex}
              plannedRepeats={plannedRepeats}
              upcomingSteps={upcomingSteps}
              onTogglePause={togglePause}
              onSkipStep={skipCurrentStep}
              onToggleMute={toggleMute}
              isPaused={isPaused}
              isAudioMuted={isAudioMuted}
              canMute={canMuteMedia}
              onOpenRepeat={openRepeatModal}
              renderMedia={renderMedia}
            />
          )}
        </View>
      </View>

      <Modal
        visible={repeatModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeRepeatModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Repeat this step</Text>
            <Text style={styles.modalSubtitle}>
              Choose how many times to loop "
              {currentStep?.name?.trim() || 'Workout Step'}".
            </Text>
            <View style={styles.modalControls}>
              <Pressable
                style={[styles.modalControlButton, styles.modalControlSecondary]}
                onPress={() =>
                  setPendingRepeat((prev) => Math.max(1, prev - 1))
                }
                accessibilityLabel="Decrease repeats"
              >
                <Ionicons name="remove" size={22} color={palette.textPrimary} />
              </Pressable>
              <Text style={styles.modalCount}>{pendingRepeat}</Text>
              <Pressable
                style={[styles.modalControlButton, styles.modalControlPrimary]}
                onPress={() => setPendingRepeat((prev) => prev + 1)}
                accessibilityLabel="Increase repeats"
              >
                <Ionicons
                  name="add"
                  size={22}
                  color={PRIMARY_BUTTON_TEXT_COLOR}
                />
              </Pressable>
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={closeRepeatModal}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={confirmRepeat}>
                <Text style={styles.modalConfirmText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.controlRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPaused ? 'Resume timer' : 'Pause timer'}
            onPress={togglePause}
            style={({ pressed }) => [
              styles.circleButton,
              isPaused && styles.circleButtonPaused,
              pressed && styles.circleButtonPressed,
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
            accessibilityLabel="Mute background audio"
            disabled={!canMuteMedia}
            onPress={toggleMute}
            style={({ pressed }) => [
              styles.muteButton,
              !canMuteMedia && styles.muteButtonDisabled,
              pressed && styles.muteButtonPressed,
              isAudioMuted && styles.muteButtonActive,
            ]}
          >
            <Ionicons
              name={isAudioMuted ? 'volume-mute' : 'volume-high'}
              size={20}
              color={
                isAudioMuted
                  ? PRIMARY_BUTTON_TEXT_COLOR
                  : canMute
                    ? palette.textPrimary
                    : palette.textMuted
              }
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.restMainDisplay}>
        <Text style={styles.restTitle}>Rest</Text>
        <Text style={styles.restTimerLarge}>{Math.max(remainingSeconds, 0)}</Text>
        <Text style={styles.restTimerCaption}>seconds remaining</Text>
        <Text style={styles.restStageMessage}>
          {isBetweenRepeats
            ? `Next round ${nextRepeatIndex} of ${plannedRepeats}`
            : nextStep
              ? `Up next: ${nextStep.name?.trim() || 'Next step'}`
              : 'Great work! This is your final rest interval.'}
        </Text>
        <Pressable
          style={styles.extendButton}
          onPress={onExtend}
          accessibilityLabel="Add fifteen seconds"
        >
          <Text style={styles.extendButtonText}>+ 15 sec</Text>
        </Pressable>
      </View>

      <View style={styles.restFooterRow}>
        <Pressable
          style={styles.restControlButton}
          onPress={onTogglePause}
          accessibilityLabel={
            isPaused ? 'Resume rest timer' : 'Pause rest timer'
          }
        >
          <Ionicons
            name={isPaused ? 'play' : 'pause'}
            size={18}
            color={
              isPaused ? PRIMARY_BUTTON_TEXT_COLOR : palette.textPrimary
            }
          />
          <Text style={styles.restControlText}>{isPaused ? 'Resume' : 'Pause'}</Text>
        </Pressable>
        <View style={styles.restNextBlock}>
          <Text style={styles.restNextLabel}>Next</Text>
          <Text style={styles.restNextValue}>
            {isBetweenRepeats
              ? `Round ${nextRepeatIndex}`
              : nextStep?.name?.trim() || 'Final step'}
          </Text>
          <Text style={styles.restNextMeta}>
            {isBetweenRepeats
              ? `of ${plannedRepeats}`
              : nextStep
                ? formatTime(nextStep.duration ?? 0)
                : 'Schedule complete'}
          </Text>
        </View>
      </View>
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
    backgroundColor: palette.surface,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.xl,
  },
  playCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: palette.surfaceElevated,
    borderRadius: 32,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: palette.shadowStrong,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    alignItems: 'stretch',
    position: 'relative',
  },
  cardHeader: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  previewFrame: {
    height: 380,
    borderRadius: 28,
    backgroundColor: palette.surfaceMuted,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    position: 'relative',
  },
  mediaContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: palette.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
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
  mediaPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  mediaPlaceholderText: {
    fontSize: 14,
    color: palette.textMuted,
  },
  timerBadge: {
    position: 'absolute',
    top: -26,
    right: 18,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: palette.border,
    shadowColor: palette.shadowStrong,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  skipButton: {
    position: 'absolute',
    right: spacing.lg,
    top: '50%',
    transform: [{ translateY: -28 }],
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  skipButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  circleButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: palette.surface,
    backgroundColor: palette.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleButtonPaused: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  circleButtonPressed: {
    opacity: 0.8,
  },
  muteButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#c92a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  muteButtonPressed: {
    opacity: 0.8,
  },
  muteButtonActive: {
    backgroundColor: '#a52a2a',
  },
  muteButtonDisabled: {
    opacity: 0.4,
  },
  extendButtonText: {
    color: PRIMARY_BUTTON_TEXT_COLOR,
    fontWeight: '700',
    fontSize: 13,
  },
  restFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  restControlText: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY_BUTTON_TEXT_COLOR,
  },
  restNextBlock: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 14,
    shadowColor: palette.shadowStrong,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    gap: 4,
  },
  footerActions: {
    gap: spacing.xs,
    alignItems: 'flex-end',
  },
  footerButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  footerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.surface,
  },
  footerButtonPressed: {
    opacity: 0.7,
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
  modalConfirmText: { color: PRIMARY_BUTTON_TEXT_COLOR, fontWeight: '700' },
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
  errorTitle: { fontSize: 22, fontWeight: '700', color: palette.textPrimary, marginTop: 16 },
  errorMessage: {
    fontSize: 14,
    color: palette.textSecondary,
    textAlign: 'center',
    marginTop: 8,
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
});
