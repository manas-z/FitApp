// app/(tabs)/schedules/new.tsx
import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  Modal,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useFirebase, useUser } from '../../../src/firebase';
import type {
  ScheduleStep,
  ScheduleStepMedia,
  ScheduleMusic,
} from '../../../src/lib/types';
import { uploadToCloudinary } from '../../../src/lib/cloudinary';

function makeStepId() {
  return Math.random().toString(36).slice(2);
}

function inferMediaType(mimeType?: string | null): ScheduleStepMedia['type'] {
  if (!mimeType) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return mimeType.startsWith('image/') ? 'image' : 'image';
}

type StepForm = {
  id: string;
  name: string;
  duration: string;
  restDuration: string;
  media?: ScheduleStepMedia;
};

type FormValues = {
  title: string;
  description?: string;
  steps: StepForm[];
  music?: ScheduleMusic;
};

export default function NewScheduleScreen() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user } = useUser();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
  } = useForm<FormValues>({
    defaultValues: {
      title: '',
      description: '',
      steps: [
        {
          id: makeStepId(),
          name: 'New step',
          duration: '30',
          restDuration: '15',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'steps',
  });

  const [uploadingStepIndex, setUploadingStepIndex] = React.useState<number | null>(
    null,
  );
  const [uploadingMusic, setUploadingMusic] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [successVisible, setSuccessVisible] = React.useState(false);
  const redirectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const music = watch('music');

  const handlePickStepMedia = async (index: number) => {
    try {
      setUploadingStepIndex(index);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'video/*', 'audio/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const mediaType = inferMediaType(asset.mimeType);
      const uploadResult = await uploadToCloudinary(
        {
          uri: asset.uri,
          mimeType: asset.mimeType,
          name: asset.name,
        },
        mediaType === 'image' ? 'image' : 'auto',
      );

      setValue(`steps.${index}.media`, {
        type: mediaType,
        url: uploadResult.secureUrl,
        hint: asset.name ?? uploadResult.originalFilename ?? undefined,
      });
    } catch (err) {
      console.error('Error uploading step media', err);
      Alert.alert(
        'Upload failed',
        'We could not upload that file to Cloudinary. Please try again.',
      );
    } finally {
      setUploadingStepIndex(null);
    }
  };

  const handlePickMusic = async () => {
    try {
      setUploadingMusic(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const uploadResult = await uploadToCloudinary(
        {
          uri: asset.uri,
          mimeType: asset.mimeType,
          name: asset.name,
        },
        'auto',
      );

      setValue('music', {
        url: uploadResult.secureUrl,
        title: asset.name ?? uploadResult.originalFilename ?? undefined,
      });
    } catch (err) {
      console.error('Error uploading music', err);
      Alert.alert(
        'Upload failed',
        'Unable to upload music to Cloudinary. Please try again.',
      );
    } finally {
      setUploadingMusic(false);
    }
  };

  React.useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const onSubmit = async (values: FormValues) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save a schedule.');
      return;
    }

    try {
      setIsSaving(true);
      const steps: ScheduleStep[] = values.steps.map((s) => {
        const duration = Number(s.duration) || 0;
        const restDuration = Number(s.restDuration) || 0;
        const step: ScheduleStep = {
          id: s.id,
          name: s.name.trim() || 'Step',
          duration,
          restDuration,
        };
        if (s.media?.url) {
          step.media = s.media;
        }
        return step;
      });

      const totalDuration = steps.reduce(
        (sum, step) => sum + (step.duration || 0) + (step.restDuration || 0),
        0,
      );

      const schedulesCol = collection(
        firestore,
        'users',
        user.uid,
        'schedules',
      );
      const scheduleDoc = doc(schedulesCol);

      const now = Date.now();

      const payload: any = {
        id: scheduleDoc.id,
        userId: user.uid,
        title: values.title.trim() || 'Untitled schedule',
        description: values.description?.trim() ?? '',
        steps,
        totalDuration,
        createdAt: now,
        updatedAt: now,
        createdAtServer: serverTimestamp(),
        updatedAtServer: serverTimestamp(),
      };

      if (values.music?.url) {
        payload.music = values.music;
      }

      await setDoc(scheduleDoc, payload);

      setSuccessVisible(true);
      redirectTimeoutRef.current = setTimeout(() => {
        setSuccessVisible(false);
        router.replace('/(tabs)');
      }, 1600);
    } catch (err) {
      console.error('Error saving schedule', err);
      Alert.alert('Error', 'Failed to save schedule.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderMediaPreview = (media?: ScheduleStepMedia) => {
    if (!media) {
      return (
        <Text style={styles.mediaPlaceholder}>
          Upload an image/video or select an audio clip.
        </Text>
      );
    }

    if (media.type === 'image') {
      return <Image source={{ uri: media.url }} style={styles.imagePreview} />;
    }

    if (media.type === 'video') {
      return (
        <Video
          source={{ uri: media.url }}
          style={styles.videoPreview}
          useNativeControls
          resizeMode={ResizeMode.COVER}
          shouldPlay={false}
        />
      );
    }

    return (
      <View style={styles.audioPreview}>
        <Ionicons name="musical-notes" size={28} color="#2563eb" />
        <Text style={styles.audioPreviewText}>{media.hint ?? 'Audio file'}</Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.pageTitle}>Create New Schedule</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Schedule Details</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Title</Text>
          <Controller
            control={control}
            name="title"
            rules={{ required: true }}
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={styles.input}
                placeholder="e.g., Morning Cardio"
                placeholderTextColor="#9ca3af"
                onChangeText={onChange}
                value={value}
              />
            )}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Description (Optional)</Text>
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={[styles.input, styles.multiline]}
                placeholder="Describe your schedule..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Schedule Steps</Text>

        {fields.map((field, index) => {
          const stepMedia = watch(`steps.${index}.media`);
          return (
            <View key={field.id} style={styles.stepWrapper}>
              <View style={styles.stepHeader}>
                <Text style={styles.stepHeading}>Media</Text>
                <Pressable
                  style={styles.uploadButton}
                  onPress={() => handlePickStepMedia(index)}
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={16}
                    color="#1d4ed8"
                    style={styles.uploadIcon}
                  />
                  <Text style={styles.uploadButtonText}>
                    {stepMedia ? 'Change File' : 'Upload File'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.mediaPreviewContainer}>
                {uploadingStepIndex === index ? (
                  <Text style={styles.uploadHint}>Uploading…</Text>
                ) : (
                  renderMediaPreview(stepMedia)
                )}
              </View>

              {stepMedia && (
                <Pressable
                  style={styles.clearButton}
                  onPress={() => setValue(`steps.${index}.media`, undefined)}
                >
                  <Ionicons name="trash-outline" size={14} color="#b91c1c" />
                  <Text style={styles.clearButtonText}>Remove media</Text>
                </Pressable>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Step Name (Optional)</Text>
                <Controller
                  control={control}
                  name={`steps.${index}.name`}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., Warm-up"
                      placeholderTextColor="#9ca3af"
                      onChangeText={onChange}
                      value={value}
                    />
                  )}
                />
              </View>

              <View style={styles.inlineFields}>
                <View style={styles.inlineField}>
                  <Text style={styles.label}>Duration (seconds)</Text>
                  <Controller
                    control={control}
                    name={`steps.${index}.duration`}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        style={styles.input}
                        placeholder="60"
                        placeholderTextColor="#9ca3af"
                        keyboardType="numeric"
                        onChangeText={onChange}
                        value={value}
                      />
                    )}
                  />
                </View>

                <View style={styles.inlineField}>
                  <Text style={styles.label}>Rest (seconds)</Text>
                  <Controller
                    control={control}
                    name={`steps.${index}.restDuration`}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        style={styles.input}
                        placeholder="15"
                        placeholderTextColor="#9ca3af"
                        keyboardType="numeric"
                        onChangeText={onChange}
                        value={value}
                      />
                    )}
                  />
                </View>
              </View>

              {fields.length > 1 && (
                <Pressable
                  style={styles.removeStepButton}
                  onPress={() => remove(index)}
                >
                  <Ionicons name="remove-circle-outline" size={16} color="#b91c1c" />
                  <Text style={styles.removeStepText}>Remove step</Text>
                </Pressable>
              )}
            </View>
          );
        })}

        <Pressable
          style={styles.addStepButton}
          onPress={() =>
            append({
              id: makeStepId(),
              name: '',
              duration: '',
              restDuration: '',
            })
          }
        >
          <Ionicons name="add-circle-outline" size={18} color="#1d4ed8" />
          <Text style={styles.addStepText}>Add Step</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Background Music</Text>
        <View style={styles.fieldGroup}>
          <Pressable style={styles.uploadButton} onPress={handlePickMusic}>
            <Ionicons
              name="musical-notes-outline"
              size={16}
              color="#1d4ed8"
              style={styles.uploadIcon}
            />
            <Text style={styles.uploadButtonText}>
              {music?.url ? 'Change Audio' : 'Upload Audio'}
            </Text>
          </Pressable>
          {uploadingMusic && <Text style={styles.uploadHint}>Uploading…</Text>}
          {music?.url && (
            <View style={styles.audioPreview}>
              <Ionicons name="musical-note" size={24} color="#2563eb" />
              <Text style={styles.audioPreviewText}>
                {music.title ?? 'Uploaded audio file'}
              </Text>
              <Pressable onPress={() => setValue('music', undefined)}>
                <Text style={styles.clearButtonText}>Remove audio</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      <Pressable
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={isSaving ? undefined : handleSubmit(onSubmit)}
      >
        <Text style={styles.saveButtonText}>
          {isSaving ? 'Saving…' : 'Save Schedule'}
        </Text>
      </Pressable>

      <Modal
        visible={successVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={56} color="#22c55e" />
            <Text style={styles.successTitle}>Schedule saved!</Text>
            <Text style={styles.successMessage}>
              Redirecting you to your dashboard…
            </Text>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#e0f2ff' },
  container: { padding: 20, paddingBottom: 40 },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  fieldGroup: { marginBottom: 16 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    backgroundColor: '#f8fbff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0f172a',
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  stepWrapper: {
    borderWidth: 1,
    borderColor: '#d0e4ff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    backgroundColor: '#f5faff',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stepHeading: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#e0f2ff',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  uploadIcon: { marginRight: 6 },
  uploadButtonText: { color: '#1d4ed8', fontWeight: '600', fontSize: 13 },
  mediaPreviewContainer: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    minHeight: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  mediaPlaceholder: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
  },
  imagePreview: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  videoPreview: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    backgroundColor: '#000',
  },
  audioPreview: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  audioPreviewText: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  uploadHint: { color: '#6b7280', fontStyle: 'italic' },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: 12,
  },
  clearButtonText: { color: '#b91c1c', fontWeight: '600' },
  inlineFields: {
    flexDirection: 'row',
    gap: 12,
  },
  inlineField: { flex: 1 },
  removeStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  removeStepText: { color: '#b91c1c', fontWeight: '600' },
  addStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 999,
    paddingVertical: 12,
    backgroundColor: '#e0f2ff',
  },
  addStepText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
  },
  saveButton: {
    marginTop: 12,
    backgroundColor: '#0f172a',
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#f8fafc',
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 16,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },
});
