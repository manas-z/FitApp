import type { StepForm, FrequencyDay } from './types';
import { FREQUENCY_DAY_ORDER } from './types';

export function makeStepId(): string {
  return Math.random().toString(36).slice(2);
}

export function createEmptyStep(): StepForm {
  return {
    id: makeStepId(),
    name: 'New step',
    duration: 30,
    restDuration: 0,
    sprintCount: 1,
    countdownVoice: 5,
    muteBackground: false,
  };
}

export const FREQUENCY_DAY_LABELS: Record<FrequencyDay, string> = {
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
};

const DAY_SET = new Set<FrequencyDay>(FREQUENCY_DAY_ORDER);

export function normalizeFrequencyDays(
  days?: ReadonlyArray<string | null> | null,
): FrequencyDay[] {
  if (!days?.length) return [];
  const normalized = new Set<FrequencyDay>();
  days.forEach((day) => {
    if (!day) return;
    const lowered = day.toLowerCase() as FrequencyDay;
    if (DAY_SET.has(lowered)) {
      normalized.add(lowered);
    }
  });
  return FREQUENCY_DAY_ORDER.filter((day) => normalized.has(day));
}

export function formatFrequencyDays(days?: FrequencyDay[] | null): string {
  if (!days?.length) return '';
  const normalized = normalizeFrequencyDays(days);
  if (!normalized.length) return '';
  if (normalized.length === FREQUENCY_DAY_ORDER.length) {
    return 'Everyday';
  }
  const labels = normalized.map((day) => FREQUENCY_DAY_LABELS[day]);
  return `Every ${labels.join(', ')}`;
}

export function parseFrequencyString(input?: string | null): FrequencyDay[] {
  if (!input) return [];
  const lowered = input.toLowerCase();
  if (lowered.includes('everyday') || lowered.includes('daily')) {
    return [...FREQUENCY_DAY_ORDER];
  }
  const matches = FREQUENCY_DAY_ORDER.filter((day) => lowered.includes(day));
  return matches;
}
