// src/lib/types.ts

export type MediaType = 'image' | 'video' | 'audio';

export interface ScheduleStepMedia {
  type: MediaType;
  url: string;
  hint?: string;
}

export interface ScheduleStep {
  id: string;
  name: string;
  duration: number; // seconds
  restDuration?: number; // seconds between this and the next step
  media?: ScheduleStepMedia;
  sprintCount?: number;
  countdownVoice?: number;
  muteBackground?: boolean;
}

export interface ScheduleMusic {
  url: string;
  title?: string;
}

export interface Schedule {
  id: string;
  userId: string;
  title: string;
  description?: string;
  frequency?: string | null;
  steps: ScheduleStep[];
  totalDuration: number; // seconds
  music?: ScheduleMusic | null;
  createdAt: number; // Date.now() ms
  updatedAt: number; // Date.now() ms
}
