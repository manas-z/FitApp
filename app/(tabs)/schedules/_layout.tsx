// app/(tabs)/schedules/_layout.tsx
import { Stack } from 'expo-router';

export default function SchedulesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Schedules' }} />
      <Stack.Screen name="new" options={{ title: 'New Schedule' }} />
      <Stack.Screen name="[id]" options={{ title: 'Edit Schedule' }} />
      <Stack.Screen
        name="[id]/play"
        options={{ title: 'Play Schedule', headerShown: false }}
      />
    </Stack>
  );
}
