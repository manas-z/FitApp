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
import { Video, ResizeMode, Audio } from 'expo-av';
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
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [repeatConfig, setRepeatConfig] = useState<Record<string, number>>({});
  const [repeatModalVisible, setRepeatModalVisible] = useState(false);
  const [pendingRepeat, setPendingRepeat] = useState(1);
  const [restContext, setRestContext] = useState<
    'betweenRepeats' | 'betweenSteps' | null
  >(null);

  const hasInitializedRef = useRef(false);
  const audioRef = useRef<Audio.Sound | null>(null);

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
    if (!schedule || phase === 'complete') return;

    if (remainingSeconds <= 0) {
      handlePhaseCompletion();
      return;
    }

    const timeout = setTimeout(() => {
      setRemainingSeconds((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [handlePhaseCompletion, phase, remainingSeconds, schedule]);

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

  const renderMedia = () => {
    if (!currentStep?.media) {
      return (
        <View style={styles.mediaPlaceholder}>
          <Feather name="image" size={28} color="#94a3b8" />
          <Text style={styles.mediaPlaceholderText}>No media added</Text>
        </View>
      );
    }

    if (currentStep.media.type === 'image') {
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
        <Video
          source={{ uri: currentStep.media.url }}
          style={styles.mediaVideo}
          resizeMode={ResizeMode.COVER}
          shouldPlay={phase === 'step'}
          isLooping
          useNativeControls
        />
      );
    }

    return (
      <View style={styles.mediaAudio}>
        <Ionicons name="musical-notes" size={28} color="#2563eb" />
        <Text style={styles.mediaAudioText}>
          {currentStep.media.hint ?? 'Audio cue'}
        </Text>
      </View>
    );
  };

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
          <Pressable
            style={styles.repeatButton}
            onPress={openRepeatModal}
            accessibilityLabel="Change repeats for this step"
          >
            <Ionicons name="repeat" size={20} color="#1d4ed8" />
            <Text style={styles.repeatText}>x{plannedRepeats}</Text>
          </Pressable>
          <Text style={styles.scheduleTitle} numberOfLines={1}>
            {schedule.title}
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
              remainingSeconds={remainingSeconds}
              onExtend={() => setRemainingSeconds((prev) => prev + 15)}
              restContext={restContext}
              nextStep={
                restContext === 'betweenRepeats'
                  ? currentStep
                  : steps[currentStepIndex + 1]
              }
              currentRepeatIndex={currentRepeatIndex}
              plannedRepeats={plannedRepeats}
            />
          ) : (
            <ActiveStage
              currentStep={currentStep}
              currentStepIndex={currentStepIndex}
              totalSteps={steps.length}
              remainingSeconds={remainingSeconds}
              currentRepeatIndex={currentRepeatIndex}
              plannedRepeats={plannedRepeats}
              renderMedia={renderMedia}
            />
          )}
        </View>

        <View style={styles.queueCard}>
          <Text style={styles.queueTitle}>Up Next</Text>
          {steps
            .slice(currentStepIndex + 1, currentStepIndex + 3)
            .map((step: ScheduleStep) => (
            <View key={step.id} style={styles.queueItem}>
              <View style={styles.queueIndicator} />
              <View style={styles.queueTextWrapper}>
                <Text style={styles.queueStepName} numberOfLines={1}>
                  {step.name || 'Step'}
                </Text>
                <Text style={styles.queueMeta}>
                  {formatTime(step.duration ?? 0)}
                </Text>
              </View>
            </View>
          ))}
          {currentStepIndex + 1 >= steps.length ? (
            <Text style={styles.queueEmpty}>You're on the last step.</Text>
          ) : null}
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
  currentStep: ScheduleStep | undefined;
  currentStepIndex: number;
  totalSteps: number;
  remainingSeconds: number;
  currentRepeatIndex: number;
  plannedRepeats: number;
  renderMedia: () => React.ReactNode;
};

function ActiveStage({
  currentStep,
  currentStepIndex,
  totalSteps,
  remainingSeconds,
  currentRepeatIndex,
  plannedRepeats,
  renderMedia,
}: ActiveStageProps) {
  return (
    <>
      <View style={styles.stepMetaRow}>
        <Text style={styles.stepName} numberOfLines={1}>
          {currentStep?.name?.trim() || 'Workout Step'}
        </Text>
        <Text style={styles.stepProgress}>
          Step {currentStepIndex + 1} of {totalSteps}
        </Text>
      </View>
      <View style={styles.mediaWrapper}>{renderMedia()}</View>
      <View style={styles.timerBlock}>
        <Text style={styles.timerLabel}>Active Time</Text>
        <Text style={styles.timerValue}>{formatTime(remainingSeconds)}</Text>
        <Text style={styles.repeatCounter}>
          Round {currentRepeatIndex} of {plannedRepeats}
        </Text>
      </View>
    </>
  );
}

type RestStageProps = {
  remainingSeconds: number;
  onExtend: () => void;
  restContext: 'betweenRepeats' | 'betweenSteps' | null;
  nextStep: ScheduleStep | undefined;
  currentRepeatIndex: number;
  plannedRepeats: number;
};

function RestStage({
  remainingSeconds,
  onExtend,
  restContext,
  nextStep,
  currentRepeatIndex,
  plannedRepeats,
}: RestStageProps) {
  const isBetweenRepeats = restContext === 'betweenRepeats';
  const nextRepeatIndex = Math.min(plannedRepeats, currentRepeatIndex + 1);

  return (
    <>
      <View style={styles.stepMetaRow}>
        <Text style={styles.stepName} numberOfLines={1}>
          Rest
        </Text>
        <Text style={styles.stepProgress}>
          {isBetweenRepeats ? 'Between repeats' : 'Between steps'}
        </Text>
      </View>
      <View style={styles.restStageBody}>
        <Ionicons name="pause" size={40} color="#2563eb" />
        <Text style={styles.restStageTitle}>Catch your breath</Text>
        <Text style={styles.restStageMessage}>
          {isBetweenRepeats
            ? `Next round starts soon (Round ${nextRepeatIndex} of ${plannedRepeats}).`
            : nextStep
              ? `Up next: ${nextStep.name?.trim() || 'Next step'}.`
              : 'Great work! This is your final rest.'}
        </Text>
      </View>
      <View style={styles.timerBlock}>
        <Text style={styles.timerLabel}>Rest Time</Text>
        <Text style={styles.timerValue}>{formatTime(remainingSeconds)}</Text>
        <Pressable
          style={styles.extendButton}
          onPress={onExtend}
          accessibilityLabel="Add fifteen seconds"
        >
          <Text style={styles.extendButtonText}>+ 15 sec</Text>
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
  topBarSpacer: { width: 80 },
  repeatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e0f2ff',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 80,
    justifyContent: 'center',
  },
  repeatText: { fontSize: 16, fontWeight: '600', color: '#1d4ed8' },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    paddingHorizontal: 12,
  },
  stageCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  stepMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  stepName: { fontSize: 18, fontWeight: '700', color: '#0f172a', flex: 1 },
  stepProgress: { fontSize: 14, color: '#475569', marginLeft: 12 },
  mediaWrapper: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    height: 240,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restStageBody: {
    height: 240,
    borderRadius: 18,
    backgroundColor: '#e0f2ff',
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  restStageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  restStageMessage: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
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
  },
  mediaAudioText: { fontSize: 15, fontWeight: '600', color: '#2563eb' },
  timerBlock: { alignItems: 'center' },
  timerLabel: { fontSize: 14, color: '#475569', marginBottom: 4 },
  timerValue: { fontSize: 48, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  repeatCounter: { fontSize: 14, fontWeight: '500', color: '#1d4ed8' },
  extendButton: {
    marginTop: 8,
    backgroundColor: '#22c55e',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  extendButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  queueCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  queueTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  queueIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1d4ed8',
  },
  queueTextWrapper: { flex: 1 },
  queueStepName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  queueMeta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  queueEmpty: { fontSize: 13, color: '#64748b' },
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
    borderRadius: 20,
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
