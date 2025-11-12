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
import { palette } from '../../../../constants/theme';

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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <View style={styles.topBarSpacer} />
          <Text style={styles.screenTitle} numberOfLines={1}>
            {phase === 'rest' ? 'Rest interval' : 'Active step'}
          </Text>
          <Pressable
            style={styles.closeButton}
            onPress={() => router.replace('/(tabs)')}
            accessibilityLabel="Close player"
          >
            <Ionicons name="close" size={22} color={palette.textPrimary} />
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
                <Ionicons name="add" size={22} color={palette.surface} />
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
      </Modal>

    </SafeAreaView>
  );
}

type ActiveStageProps = {
  scheduleTitle: string;
  currentStep: ScheduleStep | undefined;
  currentStepIndex: number;
  totalSteps: number;
  remainingSeconds: number;
  currentRepeatIndex: number;
  plannedRepeats: number;
  upcomingSteps: ScheduleStep[];
  onTogglePause: () => void;
  onSkipStep: () => void;
  onToggleMute: () => void;
  isPaused: boolean;
  isAudioMuted: boolean;
  canMute: boolean;
  onOpenRepeat: () => void;
  renderMedia: () => React.ReactNode;
};

function ActiveStage({
  scheduleTitle,
  currentStep,
  currentStepIndex,
  totalSteps,
  remainingSeconds,
  currentRepeatIndex,
  plannedRepeats,
  upcomingSteps,
  onTogglePause,
  onSkipStep,
  onToggleMute,
  isPaused,
  isAudioMuted,
  canMute,
  onOpenRepeat,
  renderMedia,
}: ActiveStageProps) {
  const nextStep = upcomingSteps[0];
  const laterStep = upcomingSteps[1];

  return (
    <>
      <View style={styles.stageHeaderRow}>
        <View style={styles.stageHeaderBlock}>
          <Text style={styles.stageHeaderLabel}>Name</Text>
          <Text style={styles.stageHeaderValue}>{scheduleTitle}</Text>
        </View>
        <View style={styles.stageHeaderBlock}>
          <Text style={styles.stageHeaderLabel}>Step</Text>
          <Text style={styles.stageHeaderValue}>
            {currentStepIndex + 1} / {totalSteps}
          </Text>
        </View>
        <View style={styles.stageTimerBadge}>
          <Text style={styles.stageTimerValue}>{formatTime(remainingSeconds)}</Text>
          <Text style={styles.stageTimerSubtitle}>remaining</Text>
        </View>
      </View>

      <Text style={styles.currentStepTitle}>
        {currentStep?.name?.trim() || 'Workout Step'}
      </Text>

      <View style={styles.mediaWrapper}>
        {renderMedia()}
        <Pressable
          style={styles.skipFloatingButton}
          onPress={onSkipStep}
          accessibilityLabel="Skip current step"
        >
          <Ionicons name="play-skip-forward" size={26} color={palette.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.roundInfoRow}>
        <Text style={styles.roundInfoText}>
          Round {currentRepeatIndex} of {plannedRepeats}
        </Text>
        <Pressable
          style={styles.roundAdjustButton}
          onPress={onOpenRepeat}
          accessibilityLabel="Adjust repeats for this step"
        >
          <Ionicons name="repeat" size={16} color={palette.primary} />
          <Text style={styles.roundAdjustText}>Change</Text>
        </Pressable>
      </View>

      <View style={styles.controlRow}>
        <Pressable
          style={styles.controlButton}
          onPress={onTogglePause}
          accessibilityLabel={isPaused ? 'Resume timer' : 'Pause timer'}
        >
          <View
            style={[
              styles.controlIconWrap,
              isPaused && styles.controlIconWrapActive,
            ]}
          >
            <Ionicons
              name={isPaused ? 'play' : 'pause'}
              size={20}
              color={isPaused ? palette.surface : palette.textPrimary}
            />
          </View>
          <Text style={styles.controlButtonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
        </Pressable>
        <Pressable
          style={styles.controlButton}
          onPress={onSkipStep}
          accessibilityLabel="Skip to next step"
        >
          <View style={styles.controlIconWrap}>
            <Ionicons name="play-skip-forward" size={20} color={palette.textPrimary} />
          </View>
          <Text style={styles.controlButtonText}>Skip</Text>
        </Pressable>
        <Pressable
          style={[styles.controlButton, !canMute && styles.controlButtonDisabled]}
          onPress={onToggleMute}
          disabled={!canMute}
          accessibilityLabel={
            isAudioMuted ? 'Unmute step audio' : 'Mute step audio'
          }
        >
          <View
            style={[
              styles.controlIconWrap,
              isAudioMuted && styles.controlIconWrapActive,
            ]}
          >
            <Ionicons
              name={isAudioMuted ? 'volume-mute' : 'volume-high'}
              size={20}
              color={
                isAudioMuted ? palette.surface : canMute ? palette.textPrimary : palette.textMuted
              }
            />
          </View>
          <Text
            style={[
              styles.controlButtonText,
              !canMute && styles.controlButtonTextDisabled,
            ]}
          >
            {isAudioMuted ? 'Muted' : 'Mute'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.upcomingSection}>
        <Text style={styles.upNextHeading}>Up next</Text>
        {nextStep ? (
          <View style={styles.upNextCard}>
            <View style={styles.upNextContext}>
              <Text style={styles.upNextTitle}>
                {nextStep.name?.trim() || 'Next step'}
              </Text>
              <Text style={styles.upNextMeta}>
                {formatTime(nextStep.duration ?? 0)} · Step {currentStepIndex + 2}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </View>
        ) : (
          <Text style={styles.upcomingEmpty}>
            You're on the final step of this schedule.
          </Text>
        )}
        {laterStep ? (
          <Text style={styles.upcomingLater}>
            Following: {laterStep.name?.trim() || 'Upcoming step'} ·{' '}
            {formatTime(laterStep.duration ?? 0)}
          </Text>
        ) : null}
      </View>
    </>
  );
}

type RestStageProps = {
  scheduleTitle: string;
  remainingSeconds: number;
  onExtend: () => void;
  restContext: 'betweenRepeats' | 'betweenSteps' | null;
  nextStep: ScheduleStep | undefined;
  currentRepeatIndex: number;
  plannedRepeats: number;
  onTogglePause: () => void;
  isPaused: boolean;
  onSkipRest: () => void;
};

function RestStage({
  scheduleTitle,
  remainingSeconds,
  onExtend,
  restContext,
  nextStep,
  currentRepeatIndex,
  plannedRepeats,
  onTogglePause,
  isPaused,
  onSkipRest,
}: RestStageProps) {
  const isBetweenRepeats = restContext === 'betweenRepeats';
  const nextRepeatIndex = Math.min(plannedRepeats, currentRepeatIndex + 1);

  return (
    <>
      <View style={styles.stageHeaderRow}>
        <View style={styles.stageHeaderBlock}>
          <Text style={styles.stageHeaderLabel}>Name</Text>
          <Text style={styles.stageHeaderValue}>{scheduleTitle}</Text>
        </View>
        <View style={styles.stageHeaderBlock}>
          <Text style={styles.stageHeaderLabel}>Context</Text>
          <Text style={styles.stageHeaderValue}>
            {isBetweenRepeats ? 'Between rounds' : 'Between steps'}
          </Text>
        </View>
        <View style={styles.stageTimerBadge}>
          <Text style={styles.stageTimerValue}>{formatTime(remainingSeconds)}</Text>
          <Text style={styles.stageTimerSubtitle}>remaining</Text>
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
            color={isPaused ? palette.surface : palette.textPrimary}
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
        <Pressable
          style={styles.skipRestButton}
          onPress={onSkipRest}
          accessibilityLabel="Skip rest"
        >
          <Text style={styles.skipRestText}>Skip rest</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  topBarSpacer: { width: 48 },
  screenTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: palette.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  scheduleTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: palette.textPrimary,
    paddingHorizontal: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageCard: {
    backgroundColor: palette.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: palette.shadowStrong,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    gap: 16,
  },
  stageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  stageHeaderBlock: { flex: 1, gap: 4 },
  stageHeaderLabel: {
    fontSize: 11,
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stageHeaderValue: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textPrimary,
    lineHeight: 18,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  stageTimerBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: palette.primaryMuted,
    alignItems: 'center',
    minWidth: 88,
    gap: 2,
  },
  stageTimerValue: { fontSize: 16, fontWeight: '700', color: palette.textPrimary },
  stageTimerSubtitle: {
    fontSize: 11,
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  currentStepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.textPrimary,
    lineHeight: 24,
  },
  mediaWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: palette.border,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  mediaPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  mediaPlaceholderText: { fontSize: 14, color: palette.textMuted },
  mediaImage: { width: '100%', height: '100%' },
  mediaVideo: { width: '100%', height: '100%', backgroundColor: '#000' },
  mediaAudio: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  mediaAudioText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.textPrimary,
    textAlign: 'center',
  },
  mediaAudioMuted: { fontSize: 12, color: palette.textMuted },
  skipFloatingButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: palette.shadowStrong,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  roundInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundInfoText: { fontSize: 13, fontWeight: '600', color: palette.textPrimary },
  roundAdjustButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.primaryMuted,
  },
  roundAdjustText: { fontSize: 12, fontWeight: '600', color: palette.primary },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
  },
  controlButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  controlButtonDisabled: { opacity: 0.5 },
  controlIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlIconWrapActive: { backgroundColor: palette.primary },
  controlButtonText: { fontSize: 12, fontWeight: '600', color: palette.textPrimary },
  controlButtonTextDisabled: { color: palette.textMuted },
  upcomingSection: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  upNextHeading: { fontSize: 14, fontWeight: '600', color: palette.textPrimary },
  upNextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: palette.shadowStrong,
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  upNextContext: { flex: 1, marginRight: 12 },
  upNextTitle: { fontSize: 15, fontWeight: '600', color: palette.textPrimary },
  upNextMeta: { fontSize: 12, color: palette.textMuted, marginTop: 4 },
  upcomingEmpty: { fontSize: 13, color: palette.textMuted },
  upcomingLater: { fontSize: 12, color: palette.textMuted },
  restMainDisplay: {
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: palette.primaryMuted,
    paddingVertical: 20,
    gap: 8,
  },
  restTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  restTimerLarge: { fontSize: 60, fontWeight: '700', color: palette.textPrimary },
  restTimerCaption: { fontSize: 13, color: palette.textSecondary },
  restStageMessage: {
    fontSize: 13,
    color: palette.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  extendButton: {
    marginTop: 8,
    backgroundColor: palette.primary,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  extendButtonText: { color: palette.surface, fontWeight: '700', fontSize: 13 },
  restFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  restControlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: palette.primary,
  },
  restControlText: { fontSize: 12, fontWeight: '600', color: palette.surface },
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
  restNextLabel: {
    fontSize: 11,
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  restNextValue: { fontSize: 15, fontWeight: '700', color: palette.textPrimary },
  restNextMeta: { fontSize: 12, color: palette.textMuted },
  skipRestButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  skipRestText: { fontSize: 12, fontWeight: '600', color: palette.primary },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: palette.textPrimary },
  modalSubtitle: { fontSize: 13, color: palette.textSecondary },
  modalControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  modalControlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalControlSecondary: {
    backgroundColor: palette.surfaceMuted,
  },
  modalControlPrimary: {
    backgroundColor: palette.primary,
  },
  modalCount: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.textPrimary,
    minWidth: 40,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancel: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: palette.border,
  },
  modalCancelText: { color: palette.textPrimary, fontWeight: '600' },
  modalConfirm: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: palette.primary,
  },
  modalConfirmText: { color: palette.surface, fontWeight: '700' },
  primaryButton: {
    marginTop: 20,
    backgroundColor: palette.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryButtonText: { color: palette.surface, fontWeight: '700', fontSize: 15 },
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
  completionTitle: { fontSize: 24, fontWeight: '700', color: palette.textPrimary },
  completionMessage: { fontSize: 14, color: palette.textSecondary, textAlign: 'center' },
  completionButton: { marginTop: 12 },
});
