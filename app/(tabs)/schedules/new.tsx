import React from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useForm, useFieldArray } from 'react-hook-form';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useFirebase, useUser } from '../../../src/firebase';
import { uploadToCloudinary } from '../../../src/lib/cloudinary';
import type { ScheduleStep } from '../../../src/lib/types';
import ScheduleBuilder from '../../../components/schedules/ScheduleBuilder';
import type { ScheduleFormValues } from '../../../components/schedules/types';
import { createEmptyStep, makeStepId } from '../../../components/schedules/utils';
import { palette, radii, spacing } from '../../../constants/theme';

function inferMediaType(mimeType?: string | null) {
  if (!mimeType) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return mimeType.startsWith('image/') ? 'image' : 'image';
}

export default function NewScheduleScreen() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user } = useUser();

  const { control, handleSubmit, setValue, watch } = useForm<ScheduleFormValues>({
    defaultValues: {
      title: '',
      description: '',
      frequency: '',
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
  const [successVisible, setSuccessVisible] = React.useState(false);
  const redirectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

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
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save a schedule.');
      return;
    }

    let didSave = false;
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

      const schedulesCol = collection(firestore, 'users', user.uid, 'schedules');
      const scheduleDoc = doc(schedulesCol);

      const now = Date.now();

      const payload: Record<string, any> = {
        id: scheduleDoc.id,
        userId: user.uid,
        title: values.title.trim() || 'Untitled schedule',
        description: values.description?.trim() ?? '',
        frequency: values.frequency?.trim() ?? '',
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

      didSave = true;
      setIsSaving(false);
      setSuccessVisible(true);
      redirectTimeoutRef.current = setTimeout(() => {
        setSuccessVisible(false);
        router.replace('/(tabs)');
      }, 1200);
    } catch (err) {
      console.error('Error saving schedule', err);
      Alert.alert('Error', 'Failed to save schedule.');
    } finally {
      if (!didSave) {
        setIsSaving(false);
      }
    }
  };

  const submitHandler = handleSubmit(onSubmit);

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
        mode="create"
      />

      <Modal
        visible={successVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={56} color={palette.success} />
            <Text style={styles.successTitle}>Schedule saved!</Text>
            <Text style={styles.successMessage}>
              Redirecting you to your dashboard…
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 30, 56, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  successCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.xl,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    shadowColor: palette.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  successMessage: {
    fontSize: 14,
    color: palette.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
