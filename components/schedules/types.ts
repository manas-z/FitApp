import type { ScheduleMusic, ScheduleStepMedia } from '../../src/lib/types';

export type StepForm = {
  id: string;
  name: string;
  duration: number;
  restDuration: number;
  sprintCount: number;
  countdownVoice: number;
  muteBackground: boolean;
  media?: ScheduleStepMedia;
};

export type ScheduleFormValues = {
  title: string;
  description?: string;
  frequency?: string;
  steps: StepForm[];
  music?: ScheduleMusic | null;
};
