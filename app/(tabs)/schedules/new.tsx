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
import ScheduleBuilder from './components/ScheduleBuilder';
import type { ScheduleFormValues } from './types';
import { createEmptyStep, makeStepId } from './utils';

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

  const {
    control,
    handleSubmit,
    setValue,
    watch,
  } = useForm<ScheduleFormValues>({
    defaultValues: {
      title: '',
      description: '',
      frequency: '',
      steps: [createEmptyStep()],
      music: null,
    },
  });

  const { fields, append, remove, move } = useFieldArray({ control, name: 'steps' });

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

  const handleAddStep = () => {
    append(createEmptyStep());
    setTimeout(() => {
      const steps = watch('steps') ?? [];
      if (steps.length > 0) {
        setEditingStepIndex(steps.length - 1);
      }
    }, 0);
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
        const duration = Number(step.duration) || 0;
        const restDuration = Number(step.restDuration) || 0;
        const mapped: ScheduleStep = {
          id: step.id || makeStepId(),
          name: step.name.trim() || 'Step',
          duration,
          restDuration,
        };
        if (step.media?.url) {
          mapped.media = step.media;
        }
        if (step.instruction?.trim()) {
          mapped.instruction = step.instruction.trim();
        }
        return mapped;
      });

      const totalDuration = steps.reduce(
        (sum, step) => sum + (step.duration || 0) + (step.restDuration || 0),
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
        onRemoveStep={handleRemoveStep}
        onReorderSteps={handleReorderSteps}
        onSubmit={submitHandler}
        isSaving={isSaving}
        uploadingStepIndex={uploadingStepIndex}
        onPickStepMedia={handlePickStepMedia}
        onRemoveStepMedia={handleRemoveStepMedia}
        editingStepIndex={editingStepIndex}
        setEditingStepIndex={setEditingStepIndex}
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
            <Ionicons name="checkmark-circle" size={56} color="#22c55e" />
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
