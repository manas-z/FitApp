import type { ScheduleMusic, ScheduleStepMedia } from '../../src/lib/types';

export const FREQUENCY_DAY_ORDER = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type FrequencyDay = (typeof FREQUENCY_DAY_ORDER)[number];

export type StepForm = {
  id: string;
  name: string;
  duration: number;
  restDuration: number;
  sprintCount: number;
  countdownVoice: number;
  muteBackground: boolean;
  minDuration?: number;
  media?: ScheduleStepMedia;
};

export type ScheduleFormValues = {
  title: string;
  description?: string;
  frequencyDays: FrequencyDay[];
  steps: StepForm[];
  music?: ScheduleMusic | null;
};
