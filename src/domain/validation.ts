import { ALL_SOUND_IDS, ALL_WEEKDAYS } from '@/domain/types';
import type { AlarmInput } from '@/domain/types';

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

const isInteger = (n: number): boolean => Number.isInteger(n);

export function validateAlarmInput(input: AlarmInput): ValidationResult {
  const errors: string[] = [];

  if (!isInteger(input.hour) || input.hour < 0 || input.hour > 23) {
    errors.push('hour');
  }

  if (!isInteger(input.minute) || input.minute < 0 || input.minute > 59) {
    errors.push('minute');
  }

  if (input.label.length > 100) {
    errors.push('label');
  }

  const weekdaySet = new Set(input.weekdays);
  if (weekdaySet.size !== input.weekdays.length) {
    errors.push('weekdays');
  }

  for (const w of input.weekdays) {
    if (!ALL_WEEKDAYS.includes(w)) {
      if (!errors.includes('weekdays')) errors.push('weekdays');
    }
  }

  if (!ALL_SOUND_IDS.includes(input.soundId)) {
    errors.push('soundId');
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
