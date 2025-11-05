// src/lib/types.ts

export type MediaType = 'image' | 'video' | 'audio';

export interface ScheduleStep {
  id: string;
  name: string;
  duration: number; // seconds
  media?: {
    type: MediaType;
    url: string;
    hint?: string;
  };
  instruction?: string;
}

export interface Schedule {
  id: string;
  userId: string;
  title: string;
  description?: string;
  steps: ScheduleStep[];
  totalDuration: number; // seconds
  createdAt: number; // Date.now() ms
  updatedAt: number; // Date.now() ms
}
