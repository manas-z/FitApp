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
import { Video, ResizeMode } from 'expo-av';
import { Picker } from '@react-native-picker/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ScheduleFormValues } from './types';
import type { ScheduleStepMedia } from '../../src/lib/types';
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
};

function formatSecondsToClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(totalSeconds, 0) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function describeDuration(seconds: number): string {
  const total = Math.max(Math.floor(seconds), 0);
  const minutes = Math.floor(total / 60);
  const remainSeconds = total % 60;
  if (minutes === 0) {
    return `${remainSeconds}s`;
  }
  if (remainSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainSeconds}s`;
}

function mediaIconForType(media?: ScheduleStepMedia) {
  if (!media) return 'image-outline';
  if (media.type === 'video') return 'videocam-outline';
  if (media.type === 'audio') return 'musical-notes-outline';
  return 'image-outline';
}

const DURATION_MIN = 5;
const DURATION_MAX = 900;
const REST_MIN = 5;
const REST_MAX = 600;
const REST_DEFAULT = 30;

type CounterControlProps = {
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
  description?: string;
};

type DurationPickerProps = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
};

const CounterControl: React.FC<CounterControlProps> = ({
  label,
  value,
  min = 0,
  onChange,
  description,
}) => {
  const clampedValue = Number.isFinite(value) ? value : min;
  const handleDecrease = () => {
    const next = Math.max(min, Math.round(clampedValue) - 1);
    onChange(next);
  };
  const handleIncrease = () => {
    onChange(Math.round(clampedValue) + 1);
  };
  const disableDecrease = clampedValue <= min;

  return (
    <View style={styles.counterGroup}>
      <View style={styles.counterCopy}>
        <Text style={styles.counterLabel}>{label}</Text>
        {description ? <Text style={styles.counterHint}>{description}</Text> : null}
      </View>
      <View style={styles.counterControls}>
        <Pressable
          style={[styles.counterButton, disableDecrease && styles.counterButtonDisabled]}
          onPress={handleDecrease}
          disabled={disableDecrease}
        >
          <Ionicons
            name="remove"
            size={16}
            color={disableDecrease ? palette.textMuted : palette.textPrimary}
          />
        </Pressable>
        <Text style={styles.counterValue}>{clampedValue}</Text>
        <Pressable style={styles.counterButton} onPress={handleIncrease}>
          <Ionicons name="add" size={16} color={palette.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
};

const DurationPicker: React.FC<DurationPickerProps> = ({
  value,
  onChange,
  min,
  max,
  step = 5,
}) => {
  const allowedValues = React.useMemo(() => {
    const safeStep = Math.max(1, Math.round(step));
    const roundedMin = Math.max(0, min);
    const roundedMax = Math.max(roundedMin, max);
    const values: number[] = [];
    const first = Math.max(roundedMin, Math.ceil(roundedMin / safeStep) * safeStep);
    for (let current = first; current <= roundedMax; current += safeStep) {
      values.push(current);
    }
    if (values.length === 0) {
      values.push(roundedMin);
    }
    return values;
  }, [min, max, step]);

  const valueSet = React.useMemo(() => new Set(allowedValues), [allowedValues]);

  const safeValue = React.useMemo(() => {
    if (!Number.isFinite(value)) {
      return allowedValues[0];
    }
    const clamped = Math.min(Math.max(Math.round(value), allowedValues[0]), allowedValues[allowedValues.length - 1]);
    return allowedValues.reduce((closest, current) => {
      const diff = Math.abs(current - clamped);
      const closestDiff = Math.abs(closest - clamped);
      if (diff < closestDiff) {
        return current;
      }
      return closest;
    }, allowedValues[0]);
  }, [allowedValues, value]);

  const buckets = React.useMemo(() => {
    const map = new Map<number, number[]>();
    allowedValues.forEach((allowed) => {
      const minute = Math.floor(allowed / 60);
      const second = allowed % 60;
      const seconds = map.get(minute) ?? [];
      if (!seconds.includes(second)) {
        seconds.push(second);
      }
      map.set(minute, seconds);
    });
    map.forEach((seconds) => seconds.sort((a, b) => a - b));
    return map;
  }, [allowedValues]);

  const minuteOptions = React.useMemo(
    () => Array.from(buckets.keys()).sort((a, b) => a - b),
    [buckets],
  );

  const [selectedMinute, setSelectedMinute] = React.useState(Math.floor(safeValue / 60));
  const [selectedSecond, setSelectedSecond] = React.useState(safeValue % 60);

  React.useEffect(() => {
    setSelectedMinute(Math.floor(safeValue / 60));
    setSelectedSecond(safeValue % 60);
  }, [safeValue]);

  const secondsForMinute = React.useMemo(
    () => buckets.get(selectedMinute) ?? [],
    [buckets, selectedMinute],
  );

  React.useEffect(() => {
    if (!secondsForMinute.includes(selectedSecond) && secondsForMinute.length > 0) {
      const fallback = secondsForMinute[0];
      setSelectedSecond(fallback);
      const total = selectedMinute * 60 + fallback;
      if (valueSet.has(total)) {
        onChange(total);
      }
    }
  }, [secondsForMinute, selectedSecond, selectedMinute, valueSet, onChange]);

  const handleMinuteChange = (nextMinute: number | string) => {
    const coercedMinute =
      typeof nextMinute === 'string' ? Math.max(0, Number.parseInt(nextMinute, 10) || 0) : nextMinute;
    setSelectedMinute(coercedMinute);
    const seconds = buckets.get(coercedMinute) ?? [];
    const coercedSelectedSecond =
      typeof selectedSecond === 'string'
        ? Math.max(0, Number.parseInt(selectedSecond, 10) || 0)
        : selectedSecond;
    const nextSecond = seconds.includes(coercedSelectedSecond)
      ? coercedSelectedSecond
      : seconds[0] ?? 0;
    const total = coercedMinute * 60 + nextSecond;
    if (valueSet.has(total)) {
      onChange(total);
    } else if (seconds.length) {
      onChange(coercedMinute * 60 + seconds[0]);
    } else {
      onChange(allowedValues[0]);
    }
  };

  const handleSecondChange = (nextSecond: number | string) => {
    const coercedSecond =
      typeof nextSecond === 'string' ? Math.max(0, Number.parseInt(nextSecond, 10) || 0) : nextSecond;
    setSelectedSecond(coercedSecond);
    const coercedMinute =
      typeof selectedMinute === 'string'
        ? Math.max(0, Number.parseInt(selectedMinute, 10) || 0)
        : selectedMinute;
    const total = coercedMinute * 60 + coercedSecond;
    if (valueSet.has(total)) {
      onChange(total);
    } else {
      const seconds = buckets.get(coercedMinute) ?? [];
      if (seconds.length) {
        onChange(coercedMinute * 60 + seconds[0]);
      }
    }
  };

  return (
    <View style={styles.durationPicker}>
      <View style={styles.durationHighlight} pointerEvents="none" />
      <View style={styles.durationColumn}>
        <Text style={styles.durationColumnLabel}>Minutes</Text>
        <Picker
          selectedValue={selectedMinute}
          onValueChange={handleMinuteChange}
          style={styles.durationWheel}
          itemStyle={styles.durationItem}
        >
          {minuteOptions.map((minute) => (
            <Picker.Item
              key={minute}
              label={String(minute).padStart(2, '0')}
              value={minute}
              color={palette.textPrimary}
            />
          ))}
        </Picker>
      </View>
      <View style={styles.durationColumn}>
        <Text style={styles.durationColumnLabel}>Seconds</Text>
        <Picker
          selectedValue={selectedSecond}
          onValueChange={handleSecondChange}
          style={styles.durationWheel}
          itemStyle={styles.durationItem}
        >
          {secondsForMinute.map((second) => (
            <Picker.Item
              key={second}
              label={String(second).padStart(2, '0')}
              value={second}
              color={palette.textPrimary}
            />
          ))}
        </Picker>
      </View>
    </View>
  );
};

const StepEditorModal: React.FC<StepEditorModalProps> = ({
  control,
  visible,
  stepIndex,
  onClose,
  onPickStepMedia,
  onRemoveStepMedia,
  uploadingStepIndex,
}) => {
  const step = useWatch({ control, name: `steps.${stepIndex}` });
  const insets = useSafeAreaInsets();
  const footerPadding = Math.max(insets.bottom, 16);
  const contentPadding = React.useMemo(
    () => [styles.modalContent, { paddingBottom: footerPadding + 72 }],
    [footerPadding],
  );
  const footerStyle = React.useMemo(
    () => [styles.modalFooter, { paddingBottom: footerPadding }],
    [footerPadding],
  );
  const durationLabel = formatSecondsToClock(step?.duration ?? 0);
  const media = step?.media;

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
              <Text style={styles.modalTitle}>Step {stepIndex + 1} details</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Step name</Text>
                <Controller
                  control={control}
                  name={`steps.${stepIndex}.name`}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      style={styles.input}
                      placeholder="Enter a step name"
                      placeholderTextColor={palette.textMuted}
                      value={value}
                      onChangeText={onChange}
                    />
                  )}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Duration</Text>
                <View style={styles.durationCard}>
                  <View style={styles.durationHeaderRow}>
                    <Text style={styles.durationHeading}>Set time</Text>
                    <Text style={styles.durationCurrent}>{durationLabel}</Text>
                  </View>
                  <Controller
                    control={control}
                    name={`steps.${stepIndex}.duration`}
                    render={({ field: { onChange, value } }) => {
                      const safeValue = Number.isFinite(value)
                        ? Math.max(DURATION_MIN, Math.round(value))
                        : DURATION_MIN;
                      return (
                        <DurationPicker
                          value={safeValue}
                          min={DURATION_MIN}
                          max={DURATION_MAX}
                          onChange={onChange}
                          step={5}
                        />
                      );
                    }}
                  />
                  <Text style={styles.durationHint}>Scroll to fine tune minutes and seconds.</Text>
                </View>
              </View>

              <Controller
                control={control}
                name={`steps.${stepIndex}.sprintCount`}
                render={({ field: { value, onChange } }) => (
                  <CounterControl
                    label="Sprint"
                    value={Math.max(1, Math.round(value ?? 1))}
                    min={1}
                    description="Number of rounds for this movement."
                    onChange={onChange}
                  />
                )}
              />

              <Controller
                control={control}
                name={`steps.${stepIndex}.countdownVoice`}
                render={({ field: { value, onChange } }) => (
                  <CounterControl
                    label="Countdown with voice"
                    value={Math.max(0, Math.round(value ?? 0))}
                    min={0}
                    description="Seconds for the vocal countdown."
                    onChange={onChange}
                  />
                )}
              />

              <View style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                  <Text style={styles.toggleLabel}>Mute background</Text>
                  <Text style={styles.toggleHint}>
                    Silence background music while this step plays.
                  </Text>
                </View>
                <Controller
                  control={control}
                  name={`steps.${stepIndex}.muteBackground`}
                  render={({ field: { value, onChange } }) => (
                    <Switch
                      value={Boolean(value)}
                      onValueChange={onChange}
                      trackColor={{ false: palette.primaryMuted, true: palette.primary }}
                      thumbColor={Boolean(value) ? palette.primary : palette.surface}
                    />
                  )}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Upload image / video / audio</Text>
                <Pressable
                  style={styles.uploadArea}
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
                        />
                      ) : (
                        <View style={styles.modalAudio}>
                          <Ionicons
                            name="musical-notes"
                            size={28}
                            color={palette.primary}
                          />
                          <Text style={styles.modalAudioText} numberOfLines={1}>
                            {media.hint ?? 'Audio clip'}
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.uploadPrompt}>
                      <Ionicons
                        name="cloud-upload-outline"
                        size={32}
                        color={palette.primary}
                        style={styles.uploadPromptIcon}
                      />
                      <Text style={styles.uploadPromptText}>
                        Tap to upload a file for this step
                      </Text>
                    </View>
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
              <Pressable style={styles.modalActionSecondary} onPress={onClose}>
                <Text style={styles.modalActionSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalActionPrimary} onPress={onClose}>
                <Text style={styles.modalActionPrimaryText}>Save</Text>
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
    const durationDescription = describeDuration(totalDuration);

    return (
      <View style={styles.headerCard}>
        <Text style={styles.pageTitle}>
          {mode === 'create' ? 'Create schedule' : 'Edit schedule'}
        </Text>
        <Text style={styles.helperCopy}>
          Arrange steps, add timing, and upload media exactly as in the design.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Schedule name</Text>
          <Controller
            control={control}
            name="title"
            rules={{ required: true }}
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={styles.input}
                placeholder="e.g., Test Duration"
                placeholderTextColor={palette.textMuted}
                value={value}
                onChangeText={onChange}
              />
            )}
          />
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Schedule Duration</Text>
            <Text style={styles.infoValue}>{totalLabel}</Text>
            <Text style={styles.infoHint}>{durationDescription}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Steps</Text>
            <Text style={styles.infoValue}>{steps.length}</Text>
            <Text style={styles.infoHint}>Drag to reorder</Text>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Schedule frequency</Text>
          <Controller
            control={control}
            name="frequency"
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={styles.input}
                placeholder="e.g., Every Tuesday"
                placeholderTextColor={palette.textMuted}
                value={value}
                onChangeText={onChange}
              />
            )}
          />
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
            <Text style={styles.stepsSubtitle}>
              You can drag the handle to reorder steps instantly.
            </Text>
          </View>
          <Pressable style={styles.addStepButton} onPress={onAddStep}>
            <Ionicons name="add-circle-outline" size={18} color={palette.primary} />
            <Text style={styles.addStepText}>Add Step</Text>
          </Pressable>
        </View>
      </View>
    );
  }, [control, mode, music?.title, music?.url, onAddStep, onPickMusic, onRemoveMusic, steps.length, totalDuration, uploadingMusic]);

  const renderItem = ({ item, getIndex, drag, isActive }: RenderItemParams<any>) => {
    const index = getIndex?.() ?? fields.findIndex((field) => field.id === item.id);
    if (index < 0) return null;
    const step = steps[index];
    if (!step) return null;

    const duration = Number(step.duration) || 0;
    const rest = Number(step.restDuration) || 0;
    const parts: string[] = [];
    if (duration > 0) {
      parts.push(`Duration ${formatSecondsToClock(duration)}`);
    }
    if (rest > 0) {
      parts.push(`Rest ${formatSecondsToClock(rest)}`);
    }
    const summary = parts.join('  |  ');
    const showRestBlock = rest > 0 || restEditorIndex === index;
    const sprintCount = Math.max(1, Math.round(step.sprintCount ?? 1));
    const countdownVoice = Math.max(0, Math.round(step.countdownVoice ?? 0));

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
              <Ionicons name="reorder-three" size={28} color={palette.textSecondary} />
            </Pressable>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle} numberOfLines={1}>
                {step.name?.trim() || `Step ${index + 1}`}
              </Text>
              <Text style={styles.stepSubtitle} numberOfLines={1}>
                {summary || 'No duration set'}
              </Text>
              <View style={styles.stepMetaRow}>
                <View style={styles.stepMetaPill}>
                  <Ionicons name="repeat-outline" size={14} color={palette.primary} />
                  <Text style={styles.stepMetaText}>
                    {sprintCount} Sprint{sprintCount === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={styles.stepMetaPill}>
                  <Ionicons name="mic-outline" size={14} color={palette.primary} />
                  <Text style={styles.stepMetaText}>{countdownVoice}s Voice</Text>
                </View>
                {step.muteBackground ? (
                  <View style={[styles.stepMetaPill, styles.stepMetaPillDanger]}>
                    <Ionicons name="volume-mute-outline" size={14} color={palette.danger} />
                    <Text style={[styles.stepMetaText, styles.stepMetaDangerText]}>Muted</Text>
                  </View>
                ) : null}
              </View>
              {step.media?.url ? (
                <View style={styles.stepMediaRow}>
                  <Ionicons
                    name={mediaIconForType(step.media)}
                    size={16}
                    color={palette.primary}
                  />
                  <Text style={styles.stepMediaText} numberOfLines={1}>
                    {step.media.hint ?? 'Attached file'}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.stepActions}>
              <Pressable
                accessibilityLabel="Edit step"
                onPress={() => {
                  setInsertMenuIndex(null);
                  setEditingStepIndex(index);
                }}
                style={styles.iconButton}
              >
                <Ionicons name="create-outline" size={18} color={palette.textPrimary} />
              </Pressable>
              <Pressable
                accessibilityLabel="Delete step"
                onPress={() => onRemoveStep(index)}
                style={styles.iconButton}
              >
                <Ionicons name="trash-outline" size={18} color={palette.danger} />
              </Pressable>
            </View>
          </View>
        </Pressable>

        {showRestBlock ? (
          <View style={styles.restCard}>
            <View style={styles.restHeader}>
              <Text style={styles.restTitle}>Rest interval</Text>
              <Text style={styles.restValue}>
                {formatSecondsToClock(rest > 0 ? rest : REST_DEFAULT)}
              </Text>
            </View>
            <Controller
              control={control}
              name={`steps.${index}.restDuration`}
              render={({ field: { value, onChange } }) => {
                const pickerValue = value && value > 0 ? Math.round(value) : REST_DEFAULT;
                return (
                  <>
                    <DurationPicker
                      value={pickerValue}
                      min={REST_MIN}
                      max={REST_MAX}
                      onChange={(next) => {
                        onChange(next);
                        if (restEditorIndex !== index) {
                          setRestEditorIndex(index);
                        }
                      }}
                      step={5}
                    />
                    <Text style={styles.durationHint}>
                      Scroll to fine tune the recovery window.
                    </Text>
                  </>
                );
              }}
            />
            <Pressable
              style={styles.removeRestButton}
              onPress={() => {
                setValue(`steps.${index}.restDuration`, 0);
                setRestEditorIndex(null);
              }}
            >
              <Ionicons name="trash-outline" size={16} color={palette.danger} />
              <Text style={styles.removeRestText}>Remove rest</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.insertRow}>
          <View style={styles.insertDivider} />
          <Pressable
            style={styles.insertButton}
            onPress={() =>
              setInsertMenuIndex((current) => (current === index ? null : index))
            }
          >
            <Ionicons name="add" size={20} color={palette.primary} />
          </Pressable>
          <View style={styles.insertDivider} />
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
              <Text style={styles.insertMenuText}>Add step</Text>
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
              <Text style={styles.insertMenuText}>Add rest</Text>
            </Pressable>
          </View>
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
  helperCopy: {
    fontSize: 14,
    color: palette.textSecondary,
    marginBottom: 16,
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
  durationCard: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    shadowColor: palette.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  durationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  durationHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  durationCurrent: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.primary,
  },
  durationHint: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  durationPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: palette.surfaceMuted,
    position: 'relative',
    overflow: 'hidden',
    paddingHorizontal: 12,
  },
  durationHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 52,
    backgroundColor: palette.primaryMuted,
    top: '50%',
    marginTop: -26,
    borderRadius: 12,
    opacity: 0.7,
  },
  durationColumn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  durationColumnLabel: {
    fontSize: 12,
    color: palette.textPrimary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  durationWheel: {
    width: '100%',
    height: 150,
    backgroundColor: 'transparent',
  },
  durationItem: {
    fontSize: 22,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  counterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: palette.surfaceMuted,
    marginBottom: 12,
  },
  counterCopy: {
    flex: 1,
    paddingRight: 12,
  },
  counterLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.textPrimary,
    marginBottom: 4,
  },
  counterHint: {
    fontSize: 12,
    color: palette.textSecondary,
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  counterButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: palette.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterButtonDisabled: {
    backgroundColor: palette.surfaceMuted,
  },
  counterValue: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: palette.surfaceMuted,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  toggleCopy: {
    flex: 1,
    paddingRight: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.textPrimary,
    marginBottom: 4,
  },
  toggleHint: {
    fontSize: 12,
    color: palette.textSecondary,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: palette.primaryMuted,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.primaryMuted,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: palette.primary,
    marginBottom: 6,
    letterSpacing: 0.6,
  },
  infoValue: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  infoHint: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 4,
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
  stepHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  stepsSubtitle: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 4,
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
    marginBottom: 16,
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
    alignItems: 'flex-start',
  },
  dragHandle: {
    marginRight: 12,
    paddingTop: 4,
  },
  stepContent: {
    flex: 1,
    gap: 4,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  stepSubtitle: {
    fontSize: 12,
    color: palette.textSecondary,
  },
  stepMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  stepMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.background,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepMetaPillDanger: {
    backgroundColor: palette.dangerMuted,
  },
  stepMetaText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.primaryDark,
  },
  stepMetaDangerText: {
    color: palette.danger,
  },
  stepMediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepMediaText: {
    fontSize: 12,
    color: palette.primary,
    flex: 1,
  },
  stepActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: palette.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restCard: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 12,
    shadowColor: palette.shadow,
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  restHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  restTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  restValue: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.primary,
  },
  removeRestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  removeRestText: {
    color: palette.danger,
    fontWeight: '600',
  },
  insertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  insertDivider: {
    flex: 1,
    height: 1,
    backgroundColor: palette.primaryMuted,
  },
  insertButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.primary,
  },
  insertMenu: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: palette.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  insertMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  insertMenuText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.primary,
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
  uploadArea: {
    borderWidth: 1,
    borderColor: palette.primary,
    borderStyle: 'dashed',
    borderRadius: 18,
    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
  },
  uploadPrompt: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  uploadPromptIcon: {
    marginBottom: 12,
  },
  uploadPromptText: {
    fontSize: 14,
    color: palette.textSecondary,
    textAlign: 'center',
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
  modalActionSecondary: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 12,
    marginRight: 12,
    alignItems: 'center',
  },
  modalActionSecondaryText: {
    color: palette.textSecondary,
    fontWeight: '600',
  },
  modalActionPrimary: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: palette.primaryDark,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalActionPrimaryText: {
    color: PRIMARY_ACTION_TEXT_COLOR,
    fontWeight: '700',
  },
});
