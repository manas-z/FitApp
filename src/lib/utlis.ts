// src/lib/utils.ts

export type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined;

/**
 * Simple className join helper. Keeps TS happy and avoids
 * pulling in clsx / tailwind-merge.
 */
export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(' ');
}
