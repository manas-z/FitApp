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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useFirebase, useUser } from '../../../src/firebase';
import type { ScheduleStep } from '../../../src/lib/types';

type StepForm = {
  id: string;
  name: string;
  duration: string;
};

type FormValues = {
  title: string;
  description?: string;
  steps: StepForm[];
};

function makeStepId() {
  return Math.random().toString(36).slice(2);
}

export default function NewScheduleScreen() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user } = useUser();

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      title: '',
      description: '',
      steps: [
        {
          id: makeStepId(),
          name: 'New step',
          duration: '30',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'steps',
  });

  const onSubmit = async (values: FormValues) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save a schedule.');
      return;
    }

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

      // MATCHES WEB APP:
      // users/{uid}/schedules/{scheduleId}
      const schedulesCol = collection(
        firestore,
        'users',
        user.uid,
        'schedules',
      );
      const scheduleDoc = doc(schedulesCol); // auto id

      const now = Date.now();

      await setDoc(scheduleDoc, {
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
      });

      Alert.alert(
        'Schedule Saved',
        'Your schedule has been saved successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)'),
          },
        ],
      );
    } catch (err) {
      console.error('Error saving schedule', err);
      Alert.alert('Error', 'Failed to save schedule.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>New Schedule</Text>

      <Text style={styles.label}>Title</Text>
      <Controller
        control={control}
        name="title"
        rules={{ required: true }}
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="e.g. Morning yoga"
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
            id: makeStepId(),
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
        <Text style={styles.saveButtonText}>Save schedule</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
});
