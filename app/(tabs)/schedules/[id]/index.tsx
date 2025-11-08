// app/(tabs)/schedules/[id]/index.tsx
import React, { useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import {
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useFirebase, useUser, useDoc } from '../../../../src/firebase';
import type {
  Schedule,
  ScheduleStep,
  ScheduleStepMedia,
  ScheduleMusic,
} from '../../../../src/lib/types';
import { uploadToCloudinary } from '../../../../src/lib/cloudinary';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

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

function inferMediaType(mimeType?: string | null): ScheduleStepMedia['type'] {
  if (!mimeType) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return mimeType.startsWith('image/') ? 'image' : 'image';
}

export default function EditScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user } = useUser();

  const userId = user?.uid ?? '';
  const path =
    userId && id
      ? `users/${userId}/schedules/${id}`
      : 'users/__no_user__/schedules/__no_doc__';

  const { data: schedule, isLoading } = useDoc<Schedule>(path);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
  } = useForm<FormValues>({
    defaultValues: { title: '', description: '', steps: [], music: undefined },
  });

  const { fields, append, remove } = useFieldArray<FormValues, 'steps'>({
    control,
    name: 'steps',
  });

  const [uploadingStepIndex, setUploadingStepIndex] = React.useState<number | null>(
    null,
  );
  const [uploadingMusic, setUploadingMusic] = React.useState(false);

  const music = watch('music');

  useEffect(() => {
    if (!schedule) return;

    if (user && schedule.userId && schedule.userId !== user.uid) {
      Alert.alert('Error', 'You are not allowed to edit this schedule.');
      router.replace('/(tabs)/schedules');
      return;
    }

    reset({
      title: schedule.title ?? '',
      description: schedule.description ?? '',
      music: schedule.music ?? undefined,
      steps:
        schedule.steps?.map((s: ScheduleStep) => ({
          id: s.id,
          name: s.name,
          duration: String(s.duration ?? 0),
          restDuration: String(s.restDuration ?? 0),
          media: s.media,
        })) ?? [],
    });
  }, [schedule, reset, router, user]);

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

      setValue(
        `steps.${index}.media`,
        {
          type: mediaType,
          url: uploadResult.secureUrl,
          hint: asset.name ?? uploadResult.originalFilename ?? undefined,
        } as StepForm['media'],
      );
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

      setValue(
        'music',
        {
          url: uploadResult.secureUrl,
          title: asset.name ?? uploadResult.originalFilename ?? undefined,
        } as FormValues['music'],
      );
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

  const onSubmit = async (values: FormValues) => {
    if (!user || !id) return;

    try {
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

      const scheduleRef = doc(
        firestore,
        'users',
        user.uid,
        'schedules',
        id as string,
      );

      const payload: any = {
        title: values.title.trim() || 'Untitled schedule',
        description: values.description?.trim() ?? '',
        steps,
        totalDuration,
        updatedAt: Date.now(),
        updatedAtServer: serverTimestamp(),
      };

      if (values.music?.url) {
        payload.music = values.music;
      } else {
        payload.music = null;
      }

      await updateDoc(scheduleRef, payload);

      router.replace('/(tabs)/schedules');
    } catch (err) {
      console.error('Error updating schedule', err);
      Alert.alert('Error', 'Failed to update schedule.');
    }
  };

  const onDelete = async () => {
    if (!user || !id) return;

    try {
      const scheduleRef = doc(
        firestore,
        'users',
        user.uid,
        'schedules',
        id as string,
      );
      await deleteDoc(scheduleRef);
      router.replace('/(tabs)/schedules');
    } catch (err) {
      console.error('Error deleting schedule', err);
      Alert.alert('Error', 'Failed to delete schedule.');
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

  if (isLoading || !schedule) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.pageTitle}>Edit Schedule</Text>

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
                  onPress={() =>
                    setValue(`steps.${index}.media`, undefined as StepForm['media'])
                  }
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
              id: Math.random().toString(36).slice(2),
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
              <Pressable
                onPress={() => setValue('music', undefined as FormValues['music'])}
              >
                <Text style={styles.clearButtonText}>Remove audio</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      <Pressable style={styles.saveButton} onPress={handleSubmit(onSubmit)}>
        <Text style={styles.saveButtonText}>Save changes</Text>
      </Pressable>

      <Pressable style={styles.deleteButton} onPress={onDelete}>
        <Text style={styles.deleteButtonText}>Delete schedule</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, backgroundColor: '#e0f2ff' },
  container: { padding: 20, paddingBottom: 60 },
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
  saveButtonText: {
    color: '#f8fafc',
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  deleteButton: {
    marginTop: 16,
    backgroundColor: '#b91c1c',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff1f2',
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
