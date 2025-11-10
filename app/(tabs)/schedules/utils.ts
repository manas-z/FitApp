import type { StepForm } from './types';

export function makeStepId(): string {
  return Math.random().toString(36).slice(2);
}

export function createEmptyStep(): StepForm {
  return {
    id: makeStepId(),
    name: 'New step',
    duration: '30',
    restDuration: '10',
    instruction: '',
  };
}
