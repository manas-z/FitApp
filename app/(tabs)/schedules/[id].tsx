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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import {
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { useFirebase, useUser, useDoc } from '../../../src/firebase';
import type { Schedule, ScheduleStep } from '../../../src/lib/types';

type StepForm = { id: string; name: string; duration: string };
type FormValues = { title: string; description?: string; steps: StepForm[] };

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

  const { control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { title: '', description: '', steps: [] },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'steps',
  });

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
      steps:
        schedule.steps?.map((s) => ({
          id: s.id,
          name: s.name,
          duration: String(s.duration ?? 0),
        })) ?? [],
    });
  }, [schedule, reset, router, user]);

  const onSubmit = async (values: FormValues) => {
    if (!user || !id) return;

    try {
      const steps: ScheduleStep[] = values.steps.map((s) => ({
        id: s.id,
        name: s.name.trim() || 'Step',
        duration: Number(s.duration) || 0,
      }));

      const totalDuration = steps.reduce(
        (sum, step) => sum + (step.duration || 0),
        0,
      );

      const scheduleRef = doc(
        firestore,
        'users',
        user.uid,
        'schedules',
        id as string,
      );

      await updateDoc(scheduleRef, {
        title: values.title.trim() || 'Untitled schedule',
        description: values.description?.trim() ?? '',
        steps,
        totalDuration,
        updatedAt: Date.now(),
      });

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

      {fields.map((field, index) => (
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

          {fields.length > 1 && (
            <Pressable
              style={styles.removeButton}
              onPress={() => remove(index)}
            >
              <Text style={styles.removeButtonText}>Remove step</Text>
            </Pressable>
          )}
        </View>
      ))}

      <Pressable
        style={styles.addStepButton}
        onPress={() =>
          append({
            id: Math.random().toString(36).slice(2),
            name: `Step ${fields.length + 1}`,
            duration: '30',
          })
        }
      >
        <Text style={styles.addStepText}>+ Add step</Text>
      </Pressable>

      <Pressable
        style={styles.saveButton}
        onPress={handleSubmit(onSubmit)}
      >
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
  label: { fontSize: 14, fontWeight: '500', marginTop: 12, marginBottom: 4 },
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
  stepTitle: { fontWeight: '600', marginBottom: 4 },
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
