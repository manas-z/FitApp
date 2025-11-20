import React from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { useFirebase, useUser, useDoc } from '../../../../src/firebase';
import { uploadToCloudinary } from '../../../../src/lib/cloudinary';
import type { Schedule, ScheduleStep } from '../../../../src/lib/types';
import ScheduleBuilder from '../../../../components/schedules/ScheduleBuilder';
import type { ScheduleFormValues } from '../../../../components/schedules/types';
import {
  createEmptyStep,
  makeStepId,
  formatFrequencyDays,
  normalizeFrequencyDays,
  parseFrequencyString,
} from '../../../../components/schedules/utils';
import { palette } from '../../../../constants/theme';

function inferMediaType(mimeType?: string | null) {
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

  const { control, handleSubmit, setValue, reset, watch } = useForm<ScheduleFormValues>({
    defaultValues: {
      title: '',
      description: '',
      frequencyDays: [],
      steps: [createEmptyStep()],
      music: null,
    },
  });

  const { fields, append, remove, move, insert } = useFieldArray({ control, name: 'steps' });

  const [uploadingStepIndex, setUploadingStepIndex] = React.useState<number | null>(
    null,
  );
  const [uploadingMusic, setUploadingMusic] = React.useState(false);
  const [editingStepIndex, setEditingStepIndex] = React.useState<number | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!schedule) return;

    if (user && schedule.userId && schedule.userId !== user.uid) {
      Alert.alert('Error', 'You are not allowed to edit this schedule.');
      router.replace('/(tabs)/schedules');
      return;
    }

    const mappedSteps =
      schedule.steps?.map((step) => ({
        id: step.id || makeStepId(),
        name: step.name ?? '',
        duration: Math.max(0, step.duration ?? 0),
        restDuration: Math.max(0, step.restDuration ?? 0),
        sprintCount: Math.max(1, step.sprintCount ?? 1),
        countdownVoice: Math.max(0, step.countdownVoice ?? 5),
        muteBackground: step.muteBackground ?? false,
        media: step.media,
      })) ?? [createEmptyStep()];

    const inferredFrequencyDays =
      schedule.frequencyDays && schedule.frequencyDays.length > 0
        ? normalizeFrequencyDays(schedule.frequencyDays)
        : parseFrequencyString(schedule.frequency);

    reset({
      title: schedule.title ?? '',
      description: schedule.description ?? '',
      frequencyDays: inferredFrequencyDays,
      music: schedule.music ?? null,
      steps: mappedSteps.length > 0 ? mappedSteps : [createEmptyStep()],
    });
  }, [schedule, reset, router, user]);

  const focusStep = (index: number) => {
    setTimeout(() => {
      const steps = watch('steps') ?? [];
      if (index >= 0 && index < steps.length) {
        setEditingStepIndex(index);
      }
    }, 0);
  };

  const handleAddStep = () => {
    const nextIndex = fields.length;
    append(createEmptyStep());
    focusStep(nextIndex);
  };

  const handleInsertStep = (index: number) => {
    insert(index, createEmptyStep());
    focusStep(index);
  };

  const handleRemoveStep = (index: number) => {
    remove(index);
    setEditingStepIndex((current) => {
      if (current === null) return current;
      if (current === index) return null;
      if (current > index) return current - 1;
      return current;
    });
  };

  const handleReorderSteps = (from: number, to: number) => {
    move(from, to);
    setEditingStepIndex((current) => {
      if (current === null) return current;
      if (current === from) return to;
      if (from < current && current <= to) return current - 1;
      if (to <= current && current < from) return current + 1;
      return current;
    });
  };

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

  const handleRemoveStepMedia = (index: number) => {
    setValue(`steps.${index}.media`, undefined);
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

  const handleRemoveMusic = () => {
    setValue('music', null);
  };

  const onSubmit = async (values: ScheduleFormValues) => {
    if (!user || !id) return;

    try {
      setIsSaving(true);
      const steps: ScheduleStep[] = values.steps.map((step) => {
        const mapped: ScheduleStep = {
          id: step.id || makeStepId(),
          name: step.name.trim() || 'Step',
          duration: Math.max(0, Math.round(step.duration ?? 0)),
        };
        const restDuration = Math.max(0, Math.round(step.restDuration ?? 0));
        if (restDuration > 0) {
          mapped.restDuration = restDuration;
        }
        if (step.media?.url) {
          mapped.media = step.media;
        }
        if (step.sprintCount && step.sprintCount > 0) {
          mapped.sprintCount = Math.round(step.sprintCount);
        }
        if (step.countdownVoice && step.countdownVoice > 0) {
          mapped.countdownVoice = Math.round(step.countdownVoice);
        }
        mapped.muteBackground = step.muteBackground ?? false;
        return mapped;
      });

      const totalDuration = steps.reduce(
        (sum, step) =>
          sum + (step.duration || 0) + (step.restDuration ? step.restDuration : 0),
        0,
      );

      const scheduleRef = doc(
        firestore,
        'users',
        user.uid,
        'schedules',
        id as string,
      );

      const normalizedFrequencyDays = normalizeFrequencyDays(values.frequencyDays);
      const frequencyLabel = formatFrequencyDays(normalizedFrequencyDays);

      const payload: Record<string, any> = {
        title: values.title.trim() || 'Untitled schedule',
        description: values.description?.trim() ?? '',
        frequency: frequencyLabel,
        frequencyDays: normalizedFrequencyDays,
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
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!user || !id) return;

    Alert.alert('Delete schedule', 'Are you sure you want to delete this?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
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
        },
      },
    ]);
  };

  const submitHandler = handleSubmit(onSubmit);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!schedule) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Schedule not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScheduleBuilder
        control={control}
        watch={watch}
        fields={fields}
        onAddStep={handleAddStep}
        onInsertStep={handleInsertStep}
        onRemoveStep={handleRemoveStep}
        onReorderSteps={handleReorderSteps}
        onSubmit={submitHandler}
        isSaving={isSaving}
        uploadingStepIndex={uploadingStepIndex}
        onPickStepMedia={handlePickStepMedia}
        onRemoveStepMedia={handleRemoveStepMedia}
        editingStepIndex={editingStepIndex}
        setEditingStepIndex={setEditingStepIndex}
        setValue={setValue}
        uploadingMusic={uploadingMusic}
        onPickMusic={handlePickMusic}
        onRemoveMusic={handleRemoveMusic}
        mode="edit"
        secondaryAction={{
          label: 'Delete schedule',
          tone: 'danger',
          onPress: handleDelete,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  emptyText: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
