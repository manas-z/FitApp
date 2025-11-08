// app/(tabs)/new-schedule.tsx
import { Redirect } from 'expo-router';

export default function NewScheduleTabRedirect() {
  return <Redirect href="/(tabs)/schedules/new" />;
}
