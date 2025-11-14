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
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Control,
  Controller,
  FieldArrayWithId,
  UseFormWatch,
  useWatch,
} from 'react-hook-form';
import DraggableFlatList, {
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import type { ScheduleFormValues } from '../types';
import type { ScheduleStepMedia } from '../../../../src/lib/types';
import { palette, getReadableTextColor } from '../../../../constants/theme';

const PRIMARY_ACTION_TEXT_COLOR = getReadableTextColor(palette.primaryDark);

type ScheduleBuilderProps = {
  control: Control<ScheduleFormValues>;
  watch: UseFormWatch<ScheduleFormValues>;
  fields: FieldArrayWithId<ScheduleFormValues, 'steps', 'id'>[];
  onAddStep: () => void;
  onRemoveStep: (index: number) => void;
  onReorderSteps: (from: number, to: number) => void;
  onSubmit: () => void;
  isSaving: boolean;
  uploadingStepIndex: number | null;
  onPickStepMedia: (index: number) => Promise<void>;
  onRemoveStepMedia: (index: number) => void;
  editingStepIndex: number | null;
  setEditingStepIndex: (index: number | null) => void;
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
  onAddNextStep: () => void;
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

const StepEditorModal: React.FC<StepEditorModalProps> = ({
  control,
  visible,
  stepIndex,
  onClose,
  onPickStepMedia,
  onRemoveStepMedia,
  onAddNextStep,
  uploadingStepIndex,
}) => {
  const step = useWatch({ control, name: `steps.${stepIndex}` });

  if (!visible || !step) {
    return null;
  }

  const media = step.media;

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
              contentContainerStyle={styles.modalContent}
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

              <View style={styles.inlineFields}>
                <View style={styles.inlineField}>
                  <Text style={styles.label}>Duration (seconds)</Text>
                  <Controller
                    control={control}
                    name={`steps.${stepIndex}.duration`}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        style={styles.input}
                        placeholder="45"
                        placeholderTextColor={palette.textMuted}
                        keyboardType="numeric"
                        value={value}
                        onChangeText={onChange}
                      />
                    )}
                  />
                </View>
                <View style={styles.inlineField}>
                  <Text style={styles.label}>Rest after (seconds)</Text>
                  <Controller
                    control={control}
                    name={`steps.${stepIndex}.restDuration`}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        style={styles.input}
                        placeholder="15"
                        placeholderTextColor={palette.textMuted}
                        keyboardType="numeric"
                        value={value}
                        onChangeText={onChange}
                      />
                    )}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Instruction / Voice script</Text>
                <Controller
                  control={control}
                  name={`steps.${stepIndex}.instruction`}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      style={[styles.input, styles.multiline]}
                      placeholder="Add spoken or on-screen instructions"
                      placeholderTextColor={palette.textMuted}
                      value={value}
                      onChangeText={onChange}
                      multiline
                      numberOfLines={3}
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
                    <ActivityIndicator color={palette.textPrimary} />
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

              <Pressable style={styles.addNextStepButton} onPress={onAddNextStep}>
                <Ionicons name="add-circle-outline" size={18} color={palette.primary} />
                <Text style={styles.addNextStepText}>Add another step</Text>
              </Pressable>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.modalActionSecondary} onPress={onClose}>
                <Text style={styles.modalActionSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalActionPrimary} onPress={onClose}>
                <Text style={styles.modalActionPrimaryText}>Done</Text>
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
  onRemoveStep,
  onReorderSteps,
  onSubmit,
  isSaving,
  uploadingStepIndex,
  onPickStepMedia,
  onRemoveStepMedia,
  editingStepIndex,
  setEditingStepIndex,
  uploadingMusic,
  onPickMusic,
  onRemoveMusic,
  mode,
  secondaryAction,
}) => {
  const steps = watch('steps') ?? [];
  const music = watch('music');
  const totalDuration = steps.reduce((sum, step) => {
    const duration = Number(step?.duration) || 0;
    const rest = Number(step?.restDuration) || 0;
    return sum + duration + rest;
  }, 0);

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
                <ActivityIndicator color={palette.textPrimary} />
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

    return (
      <Pressable
        onPress={() => setEditingStepIndex(index)}
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
            {step.instruction?.trim() ? (
              <Text style={styles.stepInstruction} numberOfLines={1}>
                {step.instruction.trim()}
              </Text>
            ) : null}
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
              onPress={() => setEditingStepIndex(index)}
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
        onAddNextStep={() => {
          onAddStep();
          setTimeout(() => {
            const latestSteps = watch('steps') ?? [];
            if (latestSteps.length > 0) {
              setEditingStepIndex(latestSteps.length - 1);
            }
          }, 0);
        }}
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
  inlineFields: {
    flexDirection: 'row',
    gap: 12,
  },
  inlineField: {
    flex: 1,
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
  stepInstruction: {
    fontSize: 12,
    color: palette.textSecondary,
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
    maxHeight: '90%',
    width: '100%',
  },
  modalCard: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 16,
  },
  modalContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
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
  addNextStepButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  addNextStepText: {
    color: palette.primary,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
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
