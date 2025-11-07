// app/(tabs)/schedules/[id].tsx
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
import { useFirebase, useUser, useDoc } from '../../../src/firebase';
import type {
  Schedule,
  ScheduleStep,
  ScheduleStepMedia,
  ScheduleMusic,
} from '../../../src/lib/types';
import { uploadToCloudinary } from '../../../src/lib/cloudinary';

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

  const { fields, append, remove } = useFieldArray({
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
        schedule.steps?.map((s) => ({
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

  if (isLoading || !schedule) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Edit Schedule</Text>

      <Text style={styles.label}>Title</Text>
      <Controller
        control={control}
        name="title"
        rules={{ required: true }}
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Title"
            placeholderTextColor="#9ca3af"
            onChangeText={onChange}
            value={value}
          />
        )}
      />

      <Text style={styles.label}>Description</Text>
      <Controller
        control={control}
        name="description"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Short description"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            onChangeText={onChange}
            value={value}
          />
        )}
      />

      <Text style={styles.label}>Steps</Text>

      {fields.map((field, index) => {
        const stepMedia = watch(`steps.${index}.media`);
        return (
          <View key={field.id} style={styles.stepCard}>
            <Text style={styles.stepTitle}>Step {index + 1}</Text>

            <Controller
              control={control}
              name={`steps.${index}.name`}
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="Step name"
                  placeholderTextColor="#9ca3af"
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />

            <Controller
              control={control}
              name={`steps.${index}.duration`}
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="Duration (seconds)"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />

            <Controller
              control={control}
              name={`steps.${index}.restDuration`}
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="Rest between steps (seconds)"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />

            <View style={styles.mediaSection}>
              <Pressable
                style={styles.mediaButton}
                onPress={() => handlePickStepMedia(index)}
              >
                <Text style={styles.mediaButtonText}>
                  {stepMedia ? 'Change media' : 'Attach media'}
                </Text>
              </Pressable>
              {uploadingStepIndex === index && (
                <Text style={styles.uploadHint}>Uploading…</Text>
              )}
              {stepMedia?.url && (
                <View style={styles.mediaInfo}>
                  <Text style={styles.mediaInfoText}>
                    Attached {stepMedia.type} · {stepMedia.hint ?? 'Uploaded file'}
                  </Text>
                  <Pressable
                    onPress={() => setValue(`steps.${index}.media`, undefined)}
                  >
                    <Text style={styles.removeButtonText}>Remove media</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {fields.length > 1 && (
              <Pressable
                style={styles.removeButton}
                onPress={() => remove(index)}
              >
                <Text style={styles.removeButtonText}>Remove step</Text>
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
            name: `Step ${fields.length + 1}`,
            duration: '30',
            restDuration: '15',
          })
        }
      >
        <Text style={styles.addStepText}>+ Add step</Text>
      </Pressable>

      <Text style={styles.label}>Background music</Text>
      <View style={styles.mediaSection}>
        <Pressable style={styles.mediaButton} onPress={handlePickMusic}>
          <Text style={styles.mediaButtonText}>
            {music?.url ? 'Change audio' : 'Attach audio'}
          </Text>
        </Pressable>
        {uploadingMusic && <Text style={styles.uploadHint}>Uploading…</Text>}
        {music?.url && (
          <View style={styles.mediaInfo}>
            <Text style={styles.mediaInfoText}>
              {music.title ?? 'Uploaded audio file'}
            </Text>
            <Pressable onPress={() => setValue('music', undefined)}>
              <Text style={styles.removeButtonText}>Remove audio</Text>
            </Pressable>
          </View>
        )}
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
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginTop: 16, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  stepCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  stepTitle: { fontWeight: '600', marginBottom: 8 },
  mediaSection: { marginTop: 12, gap: 6 },
  mediaButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#111827',
    alignItems: 'center',
  },
  mediaButtonText: { fontWeight: '600', color: '#111827' },
  mediaInfo: { gap: 4 },
  mediaInfoText: { color: '#374151' },
  uploadHint: { color: '#6b7280', fontStyle: 'italic' },
  removeButton: { marginTop: 8 },
  removeButtonText: { color: '#b91c1c', fontWeight: '500' },
  addStepButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#9ca3af',
    alignItems: 'center',
  },
  addStepText: { fontWeight: '600', color: '#111827' },
  saveButton: {
    marginTop: 24,
    padding: 14,
    borderRadius: 999,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '600' },
  deleteButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 999,
    backgroundColor: '#b91c1c',
    alignItems: 'center',
  },
  deleteButtonText: { color: '#fff', fontWeight: '600' },
});
