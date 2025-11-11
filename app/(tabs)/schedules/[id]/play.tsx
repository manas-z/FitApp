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
          <Feather name="image" size={32} color="#94a3b8" />
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
          color="#2563eb"
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
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  if (!schedule) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Ionicons name="warning" size={48} color="#f97316" />
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
              <Ionicons name="close" size={22} color="#0f172a" />
            </Pressable>
          </View>
          <View style={[styles.centered, styles.completionCard]}>
            <Ionicons name="checkmark-circle" size={72} color="#22c55e" />
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
            <Ionicons name="close" size={22} color="#0f172a" />
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
                <Ionicons name="remove" size={22} color="#0f172a" />
              </Pressable>
              <Text style={styles.modalCount}>{pendingRepeat}</Text>
              <Pressable
                style={[styles.modalControlButton, styles.modalControlPrimary]}
                onPress={() => setPendingRepeat((prev) => prev + 1)}
                accessibilityLabel="Increase repeats"
              >
                <Ionicons name="add" size={22} color="#ffffff" />
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
          <Text style={styles.stageHeaderValue} numberOfLines={1}>
            {scheduleTitle}
          </Text>
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

      <Text style={styles.currentStepTitle} numberOfLines={1}>
        {currentStep?.name?.trim() || 'Workout Step'}
      </Text>

      <View style={styles.mediaWrapper}>
        {renderMedia()}
        <Pressable
          style={styles.skipFloatingButton}
          onPress={onSkipStep}
          accessibilityLabel="Skip current step"
        >
          <Ionicons name="play-skip-forward" size={28} color="#0f172a" />
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
          <Ionicons name="repeat" size={16} color="#1d4ed8" />
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
              size={22}
              color={isPaused ? '#ffffff' : '#0f172a'}
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
            <Ionicons name="play-skip-forward" size={22} color="#0f172a" />
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
              size={22}
              color={
                isAudioMuted ? '#ffffff' : canMute ? '#0f172a' : '#94a3b8'
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
        <Text style={styles.upcomingTitle}>Upcoming</Text>
        {nextStep ? (
          <View style={styles.upcomingCard}>
            <View style={styles.upcomingMarker} />
            <View style={styles.upcomingContent}>
              <Text style={styles.upcomingLabel}>Next</Text>
              <Text style={styles.upcomingName} numberOfLines={1}>
                {nextStep.name?.trim() || 'Next step'}
              </Text>
              <Text style={styles.upcomingMeta}>
                {formatTime(nextStep.duration ?? 0)}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.upcomingEmpty}>You're on the last step.</Text>
        )}
        {laterStep ? (
          <View style={[styles.upcomingCard, styles.upcomingCardSecondary]}>
            <View style={styles.upcomingMarkerSecondary} />
            <View style={styles.upcomingContent}>
              <Text style={styles.upcomingLabel}>Later</Text>
              <Text style={styles.upcomingName} numberOfLines={1}>
                {laterStep.name?.trim() || 'Upcoming step'}
              </Text>
              <Text style={styles.upcomingMeta}>
                {formatTime(laterStep.duration ?? 0)}
              </Text>
            </View>
          </View>
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
          <Text style={styles.stageHeaderValue} numberOfLines={1}>
            {scheduleTitle}
          </Text>
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
        <Text style={styles.restTimerCaption}>seconds</Text>
        <Text style={styles.restStageMessage}>
          {isBetweenRepeats
            ? `Next round: ${nextRepeatIndex} of ${plannedRepeats}`
            : nextStep
              ? `Up next: ${nextStep.name?.trim() || 'Next step'}`
              : 'Great work! This is your final rest.'}
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
            style={styles.controlButton}
            onPress={onTogglePause}
            accessibilityLabel={
              isPaused ? 'Resume rest timer' : 'Pause rest timer'
            }
          >
            <View
              style={[
                styles.controlIconWrap,
                isPaused && styles.controlIconWrapActive,
              ]}
            >
              <Ionicons
                name={isPaused ? 'play' : 'pause'}
                size={22}
                color={isPaused ? '#ffffff' : '#0f172a'}
              />
            </View>
            <Text style={styles.controlButtonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
          </Pressable>
          <View style={styles.restNextBlock}>
            <Text style={styles.restNextLabel}>Next</Text>
            <Text style={styles.restNextValue} numberOfLines={1}>
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
  safeArea: { flex: 1, backgroundColor: '#d7ecf7' },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
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
    marginBottom: 20,
  },
  topBarSpacer: { width: 48 },
  screenTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scheduleTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    paddingHorizontal: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  stageCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    gap: 18,
  },
  stageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  stageHeaderBlock: { flex: 1, gap: 4 },
  stageHeaderLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stageHeaderValue: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  stageTimerBadge: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#e0f2ff',
    alignItems: 'center',
    minWidth: 96,
    gap: 2,
  },
  stageTimerValue: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  stageTimerSubtitle: {
    fontSize: 12,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  currentStepTitle: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  mediaWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    height: 320,
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
  mediaPlaceholderText: { fontSize: 14, color: '#64748b' },
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
    fontSize: 16,
    fontWeight: '600',
    color: '#1d4ed8',
    textAlign: 'center',
  },
  mediaAudioMuted: { fontSize: 12, color: '#64748b' },
  skipFloatingButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  roundInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundInfoText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  roundAdjustButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e0f2ff',
  },
  roundAdjustText: { fontSize: 13, fontWeight: '600', color: '#1d4ed8' },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 8,
  },
  controlButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  controlButtonDisabled: { opacity: 0.5 },
  controlIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlIconWrapActive: { backgroundColor: '#1d4ed8' },
  controlButtonText: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  controlButtonTextDisabled: { color: '#94a3b8' },
  upcomingSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  upcomingTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  upcomingCardSecondary: {
    backgroundColor: '#eef2ff',
    shadowOpacity: 0,
    elevation: 0,
  },
  upcomingMarker: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1d4ed8' },
  upcomingMarkerSecondary: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#94a3b8',
  },
  upcomingContent: { flex: 1 },
  upcomingLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  upcomingName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  upcomingMeta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  upcomingEmpty: { fontSize: 13, color: '#64748b' },
  restMainDisplay: {
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    paddingVertical: 24,
    gap: 8,
  },
  restTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  restTimerLarge: { fontSize: 72, fontWeight: '700', color: '#0f172a' },
  restTimerCaption: { fontSize: 14, color: '#475569' },
  restStageMessage: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  extendButton: {
    marginTop: 8,
    backgroundColor: '#1d4ed8',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  extendButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  restFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  restNextBlock: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    gap: 4,
  },
  restNextLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  restNextValue: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  restNextMeta: { fontSize: 13, color: '#64748b' },
  skipRestButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#ffffff',
  },
  skipRestText: { fontSize: 14, fontWeight: '600', color: '#1d4ed8' },
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
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  modalSubtitle: { fontSize: 14, color: '#475569' },
  modalControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  modalControlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalControlSecondary: {
    backgroundColor: '#e2e8f0',
  },
  modalControlPrimary: {
    backgroundColor: '#2563eb',
  },
  modalCount: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
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
    backgroundColor: '#e2e8f0',
  },
  modalCancelText: { color: '#0f172a', fontWeight: '600' },
  modalConfirm: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#2563eb',
  },
  modalConfirmText: { color: '#ffffff', fontWeight: '700' },
  primaryButton: {
    marginTop: 20,
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  errorTitle: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginTop: 16 },
  errorMessage: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    marginTop: 8,
  },
  completionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 48,
    paddingHorizontal: 24,
    marginTop: 32,
    gap: 12,
  },
  completionTitle: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  completionMessage: { fontSize: 14, color: '#475569', textAlign: 'center' },
  completionButton: { marginTop: 12 },
});
