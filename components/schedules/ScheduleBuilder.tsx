import React from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Control,
  Controller,
  FieldArrayWithId,
  UseFormSetValue,
  UseFormWatch,
  useWatch,
} from 'react-hook-form';
import DraggableFlatList, {
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ScheduleFormValues, FrequencyDay } from './types';
import { FREQUENCY_DAY_ORDER } from './types';
import { FREQUENCY_DAY_LABELS, formatFrequencyDays } from './utils';
import { palette, getReadableTextColor } from '../../constants/theme';

const PRIMARY_ACTION_TEXT_COLOR = getReadableTextColor(palette.primaryDark);

type ScheduleBuilderProps = {
  control: Control<ScheduleFormValues>;
  watch: UseFormWatch<ScheduleFormValues>;
  fields: FieldArrayWithId<ScheduleFormValues, 'steps', 'id'>[];
  onAddStep: () => void;
  onInsertStep: (index: number) => void;
  onRemoveStep: (index: number) => void;
  onReorderSteps: (from: number, to: number) => void;
  onSubmit: () => void;
  isSaving: boolean;
  uploadingStepIndex: number | null;
  onPickStepMedia: (index: number) => Promise<void>;
  onRemoveStepMedia: (index: number) => void;
  editingStepIndex: number | null;
  setEditingStepIndex: (index: number | null) => void;
  setValue: UseFormSetValue<ScheduleFormValues>;
  uploadingMusic: boolean;
  onPickMusic: () => Promise<void>;
  onRemoveMusic: () => void;
  mode: 'create' | 'edit';
  secondaryAction?: {
    label: string;
    tone?: 'default' | 'danger';
    onPress: () => void;
  };
};

type StepEditorModalProps = {
  control: Control<ScheduleFormValues>;
  visible: boolean;
  stepIndex: number;
  onClose: () => void;
  onPickStepMedia: (index: number) => Promise<void>;
  onRemoveStepMedia: (index: number) => void;
  uploadingStepIndex: number | null;
  setValue: UseFormSetValue<ScheduleFormValues>;
};

function formatSecondsToClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(totalSeconds, 0) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const DURATION_MIN = 5;
const DURATION_MAX = 900;
const REST_MIN = 5;
const REST_MAX = 600;
const REST_DEFAULT = 30;

const StepEditorModal: React.FC<StepEditorModalProps> = ({
  control,
  visible,
  stepIndex,
  onClose,
  onPickStepMedia,
  onRemoveStepMedia,
  uploadingStepIndex,
  setValue,
}) => {
  const step = useWatch({ control, name: `steps.${stepIndex}` });
  const insets = useSafeAreaInsets();
  const footerPadding = Math.max(insets.bottom, 16);
  const contentPadding = React.useMemo(
    () => [styles.modalContent, { paddingBottom: footerPadding + 96 }],
    [footerPadding],
  );
  const footerStyle = React.useMemo(
    () => [styles.modalFooter, { paddingBottom: footerPadding }],
    [footerPadding],
  );

  const safeStep = step ?? {
    duration: 0,
    minDuration: DURATION_MIN,
    media: undefined,
  };
  const media = safeStep.media;
  const reportedDuration = Math.round(safeStep.duration ?? 0);
  const storedMinDuration = Math.round(safeStep.minDuration ?? DURATION_MIN);
  const minDurationSetting = Math.min(
    DURATION_MAX,
    Math.max(DURATION_MIN, storedMinDuration),
  );
  const currentDuration = Math.max(minDurationSetting, reportedDuration);
  const handleVideoLoad = React.useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded || status.durationMillis == null || !step) {
        return;
      }
      const videoSeconds = Math.ceil(status.durationMillis / 1000);
      const clampedVideoSeconds = Math.min(
        DURATION_MAX,
        Math.max(DURATION_MIN, videoSeconds),
      );
      const currentMin = Math.round(step.minDuration ?? DURATION_MIN);
      if (currentMin !== clampedVideoSeconds) {
        setValue(`steps.${stepIndex}.minDuration`, clampedVideoSeconds);
      }
      if (currentDuration < clampedVideoSeconds) {
        const rounded = Math.min(
          DURATION_MAX,
          Math.max(
            clampedVideoSeconds,
            Math.ceil(clampedVideoSeconds / 5) * 5,
          ),
        );
        setValue(`steps.${stepIndex}.duration`, rounded);
      }
    },
    [currentDuration, setValue, step, stepIndex],
  );

  React.useEffect(() => {
    if (!step) {
      return;
    }
    if (step.media?.type === 'video') {
      return;
    }
    const currentMin = Math.round(step.minDuration ?? DURATION_MIN);
    if (currentMin === DURATION_MIN) {
      return;
    }
    setValue(`steps.${stepIndex}.minDuration`, DURATION_MIN);
  }, [step, setValue, stepIndex]);

  if (!visible || !step) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalContainer}
        >
          <View style={styles.modalCard}>
            <ScrollView
              contentContainerStyle={contentPadding}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>Edit Step</Text>

              <View style={styles.editorRow}>
                <Text style={styles.editorLabel}>Step Name:</Text>
                <Controller
                  control={control}
                  name={`steps.${stepIndex}.name`}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      style={styles.editorInput}
                      placeholder="Step title"
                      placeholderTextColor={palette.textMuted}
                      value={value}
                      onChangeText={onChange}
                    />
                  )}
                />
              </View>

              <Controller
                control={control}
                name={`steps.${stepIndex}.duration`}
                render={({ field: { value, onChange } }) => {
                  const baseValue = Number.isFinite(value)
                    ? Math.round(value)
                    : minDurationSetting;
                  const boundedValue = Math.max(
                    minDurationSetting,
                    Math.min(DURATION_MAX, baseValue),
                  );
                  const adjust = (delta: number) => {
                    const next = Math.max(
                      minDurationSetting,
                      Math.min(DURATION_MAX, boundedValue + delta),
                    );
                    onChange(next);
                  };
                  const canDecrease = boundedValue > minDurationSetting;
                  return (
                    <View style={styles.editorRow}>
                      <Text style={styles.editorLabel}>Duration:</Text>
                      <View style={styles.numberInput}>
                        <Pressable
                          style={styles.numberButton}
                          accessibilityLabel="Decrease duration"
                          onPress={() => adjust(-5)}
                          disabled={!canDecrease}
                        >
                          <Ionicons
                            name="remove"
                            size={16}
                            color={
                              canDecrease ? palette.surface : palette.textMuted
                            }
                          />
                        </Pressable>
                        <Text style={styles.numberValue}>
                          {formatSecondsToClock(boundedValue)}
                        </Text>
                        <Pressable
                          style={styles.numberButton}
                          accessibilityLabel="Increase duration"
                          onPress={() => adjust(5)}
                        >
                          <Ionicons name="add" size={16} color={palette.surface} />
                        </Pressable>
                      </View>
                    </View>
                  );
                }}
              />

              <Controller
                control={control}
                name={`steps.${stepIndex}.sprintCount`}
                render={({ field: { value, onChange } }) => {
                  const safeValue = Math.max(1, Math.round(value ?? 1));
                  const adjust = (delta: number) => {
                    const next = Math.max(1, safeValue + delta);
                    onChange(next);
                  };
                  return (
                    <View style={styles.editorRow}>
                      <Text style={styles.editorLabel}>Default Sprints:</Text>
                      <View style={styles.numberInput}>
                        <Pressable
                          style={styles.numberButton}
                          accessibilityLabel="Decrease sprint count"
                          onPress={() => adjust(-1)}
                        >
                          <Ionicons name="remove" size={16} color={palette.surface} />
                        </Pressable>
                        <Text style={styles.numberValue}>{safeValue}</Text>
                        <Pressable
                          style={styles.numberButton}
                          accessibilityLabel="Increase sprint count"
                          onPress={() => adjust(1)}
                        >
                          <Ionicons name="add" size={16} color={palette.surface} />
                        </Pressable>
                      </View>
                    </View>
                  );
                }}
              />

              <Controller
                control={control}
                name={`steps.${stepIndex}.countdownVoice`}
                render={({ field: { value, onChange } }) => {
                  const safeValue = Math.max(0, Math.round(value ?? 0));
                  const adjust = (delta: number) => {
                    const next = Math.max(0, safeValue + delta);
                    onChange(next);
                  };
                  return (
                    <View style={styles.editorRow}>
                      <Text style={styles.editorLabel}>Countdown with voice:</Text>
                      <View style={styles.numberInput}>
                        <Pressable
                          style={styles.numberButton}
                          accessibilityLabel="Decrease countdown seconds"
                          onPress={() => adjust(-1)}
                          disabled={safeValue === 0}
                        >
                          <Ionicons
                            name="remove"
                            size={16}
                            color={safeValue === 0 ? palette.textMuted : palette.surface}
                          />
                        </Pressable>
                        <Text style={styles.numberValue}>{safeValue}s</Text>
                        <Pressable
                          style={styles.numberButton}
                          accessibilityLabel="Increase countdown seconds"
                          onPress={() => adjust(1)}
                        >
                          <Ionicons name="add" size={16} color={palette.surface} />
                        </Pressable>
                      </View>
                    </View>
                  );
                }}
              />

              <View style={styles.editorRow}>
                <Text style={styles.editorLabel}>Mute Background:</Text>
                <Controller
                  control={control}
                  name={`steps.${stepIndex}.muteBackground`}
                  render={({ field: { value, onChange } }) => (
                    <Switch
                      value={Boolean(value)}
                      onValueChange={onChange}
                      trackColor={{ false: palette.primaryMuted, true: palette.primary }}
                      thumbColor={Boolean(value) ? palette.primaryDark : palette.surface}
                    />
                  )}
                />
              </View>

              <View style={styles.mediaSection}>
                <Text style={styles.editorLabel}>Upload Media</Text>
                <Pressable
                  style={styles.mediaCard}
                  onPress={() => onPickStepMedia(stepIndex)}
                >
                  {uploadingStepIndex === stepIndex ? (
                    <ActivityIndicator color={palette.primary} />
                  ) : media?.url ? (
                    <View style={styles.modalPreview}>
                      {media.type === 'image' ? (
                        <Image source={{ uri: media.url }} style={styles.modalImage} />
                      ) : media.type === 'video' ? (
                        <Video
                          source={{ uri: media.url }}
                          style={styles.modalVideo}
                          resizeMode={ResizeMode.COVER}
                          shouldPlay={false}
                          useNativeControls
                          onLoad={handleVideoLoad}
                        />
                      ) : (
                        <View style={styles.modalAudio}>
                          <Ionicons name="musical-notes" size={28} color={palette.primary} />
                          <Text style={styles.modalAudioText} numberOfLines={1}>
                            {media.hint ?? 'Audio clip'}
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.mediaPlaceholder}>
                      The user will be able to upload media like image/audio/video as needed.
                    </Text>
                  )}
                </Pressable>
                {media?.url ? (
                  <Pressable
                    style={styles.removeMediaButton}
                    onPress={() => onRemoveStepMedia(stepIndex)}
                  >
                    <Ionicons name="trash-outline" size={16} color={palette.danger} />
                    <Text style={styles.removeMediaText}>Remove file</Text>
                  </Pressable>
                ) : null}
              </View>
            </ScrollView>

            <View style={footerStyle}>
              <Pressable style={styles.modalFooterButtonSecondary} onPress={onClose}>
                <Text style={styles.modalFooterButtonSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalFooterButtonPrimary} onPress={onClose}>
                <Text style={styles.modalFooterButtonPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const ScheduleBuilder: React.FC<ScheduleBuilderProps> = ({
  control,
  watch,
  fields,
  onAddStep,
  onInsertStep,
  onRemoveStep,
  onReorderSteps,
  onSubmit,
  isSaving,
  uploadingStepIndex,
  onPickStepMedia,
  onRemoveStepMedia,
  editingStepIndex,
  setEditingStepIndex,
  setValue,
  uploadingMusic,
  onPickMusic,
  onRemoveMusic,
  mode,
  secondaryAction,
}) => {
  const steps = watch('steps') ?? [];
  const music = watch('music');
  const [insertMenuIndex, setInsertMenuIndex] = React.useState<number | null>(null);
  const [restEditorIndex, setRestEditorIndex] = React.useState<number | null>(null);
  const [frequencyMenuOpen, setFrequencyMenuOpen] = React.useState(false);
  const totalDuration = steps.reduce((sum, step) => {
    const duration = Number(step?.duration) || 0;
    const rest = Number(step?.restDuration) || 0;
    return sum + duration + rest;
  }, 0);

  React.useEffect(() => {
    if (insertMenuIndex !== null && insertMenuIndex >= steps.length) {
      setInsertMenuIndex(null);
    }
  }, [insertMenuIndex, steps.length]);

  React.useEffect(() => {
    if (restEditorIndex !== null) {
      const value = steps[restEditorIndex]?.restDuration ?? 0;
      if (!value || value <= 0) {
        setRestEditorIndex(null);
      }
    }
  }, [restEditorIndex, steps]);

  const listHeader = React.useMemo(() => {
    const totalLabel = formatSecondsToClock(totalDuration);

    return (
      <View style={styles.headerCard}>
        <Text style={styles.pageTitle}>
          {mode === 'create' ? 'Create Schedule' : 'Edit Schedule'}
        </Text>

        <View style={styles.summaryBlock}>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Schedule Name:</Text>
            <Controller
              control={control}
              name="title"
              rules={{ required: true }}
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={styles.summaryInput}
                  placeholder="Test"
                  placeholderTextColor={palette.textMuted}
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
          </View>

          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Schedule Duration:</Text>
            <Text style={styles.summaryValue}>{totalLabel}</Text>
          </View>

          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Schedule Frequency:</Text>
            <Controller
              control={control}
              name="frequencyDays"
              render={({ field: { onChange, value } }) => {
                const selectedDays: FrequencyDay[] = value || [];
                const label = formatFrequencyDays(selectedDays);
                const isEveryday = selectedDays.length === FREQUENCY_DAY_ORDER.length;
                const orderedSelection = (days: FrequencyDay[]) =>
                  FREQUENCY_DAY_ORDER.filter((day) => days.includes(day));
                const toggleDay = (day: FrequencyDay) => {
                  const next = selectedDays.includes(day)
                    ? selectedDays.filter((d) => d !== day)
                    : [...selectedDays, day];
                  onChange(orderedSelection(next));
                };
                const toggleAll = () => {
                  onChange(isEveryday ? [] : [...FREQUENCY_DAY_ORDER]);
                };
                return (
                  <View style={styles.frequencySelector}>
                    <Pressable
                      style={[
                        styles.dropdownTrigger,
                        frequencyMenuOpen && styles.dropdownTriggerActive,
                      ]}
                      onPress={() => setFrequencyMenuOpen((prev) => !prev)}
                    >
                      <Text
                        style={[
                          styles.dropdownTriggerText,
                          !label && styles.dropdownPlaceholderText,
                        ]}
                        numberOfLines={2}
                      >
                        {label || 'Select days'}
                      </Text>
                      <Ionicons
                        name={frequencyMenuOpen ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={palette.textSecondary}
                      />
                    </Pressable>
                    {frequencyMenuOpen && (
                      <View style={styles.dropdownMenu}>
                        <Pressable
                          style={[
                            styles.dropdownOption,
                            isEveryday && styles.dropdownOptionSelected,
                          ]}
                          onPress={toggleAll}
                        >
                          <Text style={styles.dropdownOptionText}>Everyday</Text>
                          {isEveryday && (
                            <Ionicons
                              name="checkmark"
                              size={16}
                              color={palette.primary}
                            />
                          )}
                        </Pressable>
                        <View style={styles.dropdownDivider} />
                        {FREQUENCY_DAY_ORDER.map((day: FrequencyDay) => {
                          const selected = selectedDays.includes(day);
                          return (
                            <Pressable
                              key={day}
                              style={[
                                styles.dropdownOption,
                                selected && styles.dropdownOptionSelected,
                              ]}
                              onPress={() => toggleDay(day)}
                            >
                              <Text style={styles.dropdownOptionText}>
                                {`Every ${FREQUENCY_DAY_LABELS[day]}`}
                              </Text>
                              {selected && (
                                <Ionicons
                                  name="checkmark"
                                  size={16}
                                  color={palette.primary}
                                />
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              }}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Schedule music</Text>
          {music?.url ? (
            <View style={styles.musicSelected}>
              <Ionicons name="musical-notes" size={18} color={palette.primary} />
              <View style={styles.musicTextGroup}>
                <Text style={styles.musicTitle} numberOfLines={1}>
                  {music.title ?? 'Selected audio'}
                </Text>
                <Text style={styles.musicSubtitle}>Tap remove to clear</Text>
              </View>
              <Pressable onPress={onRemoveMusic} style={styles.musicRemoveButton}>
                <Ionicons name="close" size={16} color={palette.danger} />
                <Text style={styles.musicRemoveText}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.musicUpload}
              onPress={onPickMusic}
              disabled={uploadingMusic}
            >
              {uploadingMusic ? (
                <ActivityIndicator color={palette.primary} />
              ) : (
                <>
                  <Ionicons
                    name="cloud-upload-outline"
                    size={18}
                    color={palette.primary}
                    style={styles.uploadIcon}
                  />
                  <Text style={styles.musicUploadText}>Upload audio</Text>
                </>
              )}
            </Pressable>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Description</Text>
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={[styles.input, styles.multiline]}
                placeholder="Add a short description"
                placeholderTextColor={palette.textMuted}
                multiline
                numberOfLines={3}
                value={value}
                onChangeText={onChange}
              />
            )}
          />
        </View>

        <View style={styles.stepHeaderRow}>
          <View>
            <Text style={styles.stepsTitle}>Steps</Text>
          </View>
          <Pressable style={styles.addStepButton} onPress={onAddStep}>
            <Ionicons name="add-circle-outline" size={18} color={palette.primary} />
            <Text style={styles.addStepText}>Add Step</Text>
          </Pressable>
        </View>
      </View>
    );
  }, [control, frequencyMenuOpen, mode, music?.title, music?.url, onAddStep, onPickMusic, onRemoveMusic, steps.length, totalDuration, uploadingMusic]);

  const renderItem = ({ item, getIndex, drag, isActive }: RenderItemParams<any>) => {
    const index = getIndex?.() ?? fields.findIndex((field) => field.id === item.id);
    if (index < 0) return null;
    const step = steps[index];
    if (!step) return null;

    const duration = Number(step.duration) || 0;
    const rest = Number(step.restDuration) || 0;
    const showRestBlock = rest > 0 || restEditorIndex === index;
    const sprintCount = Math.max(1, Math.round(step.sprintCount ?? 1));

    const durationLabel =
      duration > 0 ? formatSecondsToClock(duration) : formatSecondsToClock(0);

    return (
      <View style={styles.stepItem}>
        <Pressable
          onPress={() => {
            setInsertMenuIndex(null);
            setEditingStepIndex(index);
          }}
          style={[styles.stepCard, isActive && styles.stepCardActive]}
        >
          <View style={styles.stepRow}>
            <Pressable
              onLongPress={drag}
              onPressIn={drag}
              hitSlop={8}
              style={styles.dragHandle}
            >
              <Ionicons name="reorder-three" size={32} color={palette.textSecondary} />
            </Pressable>
            <View style={styles.stepInfo}>
              <Text style={styles.stepLabel}>Step Name</Text>
              <Text style={styles.stepName} numberOfLines={1}>
                {step.name?.trim() || `Step ${index + 1}`}
              </Text>
              <Text style={styles.stepMetaLine}>Duration: {durationLabel}</Text>
              <Text style={styles.stepMetaLine}>Sprints: {sprintCount}</Text>
            </View>
            <View style={styles.stepActions}>
              <Pressable
                accessibilityLabel="Edit step"
                onPress={() => {
                  setInsertMenuIndex(null);
                  setEditingStepIndex(index);
                }}
                style={styles.stepActionButton}
              >
                <Ionicons name="create-outline" size={18} color={palette.textPrimary} />
              </Pressable>
              <Pressable
                accessibilityLabel="Delete step"
                onPress={() => onRemoveStep(index)}
                style={styles.stepActionButton}
              >
                <Ionicons name="trash-outline" size={18} color={palette.danger} />
              </Pressable>
            </View>
          </View>
        </Pressable>

        <View style={styles.insertRow}>
          <Pressable
            style={styles.insertButton}
            onPress={() =>
              setInsertMenuIndex((current) => (current === index ? null : index))
            }
          >
            <Ionicons name="add" size={28} color={palette.textPrimary} />
          </Pressable>
        </View>

        {insertMenuIndex === index ? (
          <View style={styles.insertMenu}>
            <Pressable
              style={styles.insertMenuItem}
              onPress={() => {
                setInsertMenuIndex(null);
                onInsertStep(index + 1);
              }}
            >
              <Ionicons name="list-circle-outline" size={18} color={palette.primary} />
              <Text style={styles.insertMenuText}>Add Step</Text>
            </Pressable>
            <Pressable
              style={styles.insertMenuItem}
              onPress={() => {
                setInsertMenuIndex(null);
                const currentRest = steps[index]?.restDuration ?? 0;
                if (!currentRest || currentRest <= 0) {
                  setValue(`steps.${index}.restDuration`, REST_DEFAULT);
                }
                setRestEditorIndex(index);
              }}
            >
              <Ionicons name="timer-outline" size={18} color={palette.primary} />
              <Text style={styles.insertMenuText}>Add Rest</Text>
            </Pressable>
          </View>
        ) : null}

        {showRestBlock ? (
          <>
            <View style={styles.restCard}>
              <Text style={styles.restLabel}>Rest</Text>
            <Controller
              control={control}
              name={`steps.${index}.restDuration`}
              render={({ field: { value, onChange } }) => {
                const safeValue = value && value > 0 ? Math.round(value) : REST_DEFAULT;
                const handleAdjust = (delta: number) => {
                  const next = safeValue + delta;
                  if (next < REST_MIN) {
                    onChange(0);
                    setRestEditorIndex(null);
                    return;
                  }
                  const clamped = Math.min(REST_MAX, Math.max(REST_MIN, next));
                  onChange(clamped);
                  if (restEditorIndex !== index) {
                    setRestEditorIndex(index);
                  }
                };
                return (
                  <View style={styles.restControls}>
                    <Pressable
                      accessibilityLabel="Decrease rest duration"
                      style={styles.restControlButton}
                      onPress={() => handleAdjust(-5)}
                    >
                      <Ionicons name="remove-outline" size={18} color={palette.textPrimary} />
                    </Pressable>
                    <Text style={styles.restTime}>
                      {formatSecondsToClock(safeValue)}
                    </Text>
            <Pressable
              accessibilityLabel="Increase rest duration"
              style={styles.restControlButton}
              onPress={() => handleAdjust(5)}
            >
              <Ionicons name="add-outline" size={18} color={palette.textPrimary} />
            </Pressable>
          </View>
        );
      }}
    />
          </View>
            <View style={styles.insertRow}>
              <Pressable
                style={styles.insertButton}
                onPress={() => {
                  setInsertMenuIndex(null);
                  onInsertStep(index + 1);
                }}
              >
                <Ionicons name="add" size={28} color={palette.textPrimary} />
              </Pressable>
            </View>
          </>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.wrapper}>
      <DraggableFlatList
        data={fields}
        keyExtractor={(item) => item.id}
        onDragEnd={({ from, to }) => {
          if (from !== to) {
            onReorderSteps(from, to);
          }
        }}
        ListHeaderComponent={listHeader}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Add your first step to get started.</Text>
          </View>
        }
      />

      <View style={styles.footer}>
        {secondaryAction ? (
          <Pressable
            style={[
              styles.secondaryButton,
              secondaryAction.tone === 'danger' && styles.secondaryButtonDanger,
            ]}
            onPress={secondaryAction.onPress}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                secondaryAction.tone === 'danger' &&
                  styles.secondaryButtonTextDanger,
              ]}
            >
              {secondaryAction.label}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={isSaving ? undefined : onSubmit}
        >
          {isSaving ? (
            <ActivityIndicator color={palette.surface} />
          ) : (
            <Text style={styles.saveButtonText}>
              {mode === 'create' ? 'Save Schedule' : 'Update Schedule'}
            </Text>
          )}
        </Pressable>
      </View>

      <StepEditorModal
        control={control}
        visible={editingStepIndex !== null}
        stepIndex={editingStepIndex ?? 0}
        onClose={() => setEditingStepIndex(null)}
        onPickStepMedia={onPickStepMedia}
        onRemoveStepMedia={onRemoveStepMedia}
        uploadingStepIndex={uploadingStepIndex}
        setValue={setValue}
      />
    </View>
  );
};

export default ScheduleBuilder;

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: palette.background,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 160,
  },
  headerCard: {
    backgroundColor: palette.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: palette.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.textPrimary,
    marginBottom: 4,
  },
  summaryBlock: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: palette.border,
  },
  summaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  summaryInput: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: palette.border,
    paddingVertical: 4,
    color: palette.textPrimary,
    fontSize: 15,
    textAlign: 'right',
  },
  frequencySelector: {
    flex: 1,
    alignItems: 'flex-end',
  },
  dropdownTrigger: {
    width: '100%',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownTriggerActive: {
    borderColor: palette.primary,
  },
  dropdownTriggerText: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    color: palette.textPrimary,
    marginRight: 8,
  },
  dropdownPlaceholderText: {
    color: palette.textMuted,
  },
  dropdownMenu: {
    width: '100%',
    marginTop: 8,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: palette.surface,
    overflow: 'hidden',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: palette.border,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownOptionSelected: {
    backgroundColor: palette.primaryMuted,
  },
  dropdownOptionText: {
    flex: 1,
    fontSize: 14,
    color: palette.textPrimary,
    marginRight: 12,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.textPrimary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: palette.textPrimary,
    fontSize: 14,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  musicUpload: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.primary,
    backgroundColor: palette.background,
  },
  musicUploadText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.primary,
  },
  uploadIcon: {
    marginRight: 8,
  },
  musicSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: palette.primaryMuted,
    gap: 12,
  },
  musicTextGroup: {
    flex: 1,
  },
  musicTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  musicSubtitle: {
    fontSize: 12,
    color: palette.textSecondary,
  },
  musicRemoveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  musicRemoveText: {
    color: palette.danger,
    fontWeight: '600',
  },
  editorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: palette.border,
  },
  editorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textPrimary,
    flexShrink: 1,
  },
  editorInput: {
    borderBottomWidth: 1,
    borderColor: palette.border,
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: '55%',
    fontSize: 14,
    color: palette.textPrimary,
    textAlign: 'right',
  },
  numberInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  numberButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: palette.textPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberValue: {
    minWidth: 64,
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: palette.primary,
    color: PRIMARY_ACTION_TEXT_COLOR,
    fontWeight: '700',
    fontSize: 14,
  },
  mediaSection: {
    marginTop: 24,
  },
  mediaCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    minHeight: 160,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
  },
  mediaPlaceholder: {
    fontSize: 14,
    color: palette.textSecondary,
    textAlign: 'center',
  },
  stepHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  addStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: palette.primaryMuted,
  },
  addStepText: {
    color: palette.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    fontSize: 12,
  },
  stepItem: {
    marginBottom: 24,
  },
  stepCard: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: palette.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  stepCardActive: {
    borderColor: palette.primary,
    shadowOpacity: 0.12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dragHandle: {
    marginRight: 16,
    paddingTop: 2,
  },
  stepInfo: {
    flex: 1,
    gap: 4,
  },
  stepLabel: {
    fontSize: 13,
    color: palette.textSecondary,
  },
  stepName: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  stepMetaLine: {
    fontSize: 14,
    color: palette.textPrimary,
  },
  stepActions: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 12,
  },
  stepActionButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insertRow: {
    alignItems: 'center',
    marginVertical: 12,
  },
  insertButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: palette.textPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.surface,
  },
  insertMenu: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 12,
    gap: 4,
  },
  insertMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  insertMenuText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  restCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: 16,
    marginBottom: 16,
  },
  restLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.textPrimary,
    marginBottom: 12,
  },
  restControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  restControlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.textPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restTime: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    backgroundColor: 'rgba(224, 242, 255, 0.95)',
    borderTopWidth: 1,
    borderColor: palette.primaryMuted,
    gap: 12,
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonDanger: {
    borderColor: palette.dangerMuted,
    backgroundColor: palette.dangerMuted,
  },
  secondaryButtonText: {
    color: palette.textPrimary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondaryButtonTextDanger: {
    color: palette.danger,
  },
  saveButton: {
    backgroundColor: palette.primaryDark,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: PRIMARY_ACTION_TEXT_COLOR,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: palette.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    width: '100%',
    overflow: 'hidden',
  },
  modalContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.textPrimary,
    marginBottom: 16,
  },
  modalPreview: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  modalVideo: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
  },
  modalAudio: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 12,
  },
  modalAudioText: {
    fontSize: 14,
    color: palette.textPrimary,
  },
  removeMediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  removeMediaText: {
    color: palette.danger,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderColor: palette.border,
  },
  modalFooterButtonSecondary: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 14,
    marginRight: 12,
    alignItems: 'center',
    backgroundColor: palette.surface,
  },
  modalFooterButtonSecondaryText: {
    color: palette.textPrimary,
    fontWeight: '600',
  },
  modalFooterButtonPrimary: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: palette.primaryDark,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalFooterButtonPrimaryText: {
    color: PRIMARY_ACTION_TEXT_COLOR,
    fontWeight: '700',
  },
});
