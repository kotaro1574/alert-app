import { validateAlarmInput } from '@/domain/validation';
import type { AlarmInput } from '@/domain/types';

const validInput: AlarmInput = {
  label: 'Wake up',
  hour: 7,
  minute: 0,
  weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  enabled: true,
  snoozeEnabled: true,
  soundId: 'classic',
};

describe('validateAlarmInput', () => {
  test('returns ok for valid input', () => {
    const result = validateAlarmInput(validInput);
    expect(result.ok).toBe(true);
  });

  test('rejects hour below 0', () => {
    const result = validateAlarmInput({ ...validInput, hour: -1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('hour');
  });

  test('rejects hour above 23', () => {
    const result = validateAlarmInput({ ...validInput, hour: 24 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('hour');
  });

  test('rejects minute below 0', () => {
    const result = validateAlarmInput({ ...validInput, minute: -1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('minute');
  });

  test('rejects minute above 59', () => {
    const result = validateAlarmInput({ ...validInput, minute: 60 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('minute');
  });

  test('rejects non-integer hour or minute', () => {
    const result = validateAlarmInput({ ...validInput, hour: 7.5 });
    expect(result.ok).toBe(false);
  });

  test('accepts empty label', () => {
    const result = validateAlarmInput({ ...validInput, label: '' });
    expect(result.ok).toBe(true);
  });

  test('rejects label longer than 100 characters', () => {
    const longLabel = 'a'.repeat(101);
    const result = validateAlarmInput({ ...validInput, label: longLabel });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('label');
  });

  test('accepts empty weekdays (single occurrence)', () => {
    const result = validateAlarmInput({ ...validInput, weekdays: [] });
    expect(result.ok).toBe(true);
  });

  test('rejects duplicate weekdays', () => {
    const result = validateAlarmInput({
      ...validInput,
      weekdays: ['mon', 'mon', 'tue'] as AlarmInput['weekdays'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('weekdays');
  });

  test('rejects unknown soundId', () => {
    const result = validateAlarmInput({
      ...validInput,
      soundId: 'nonexistent' as AlarmInput['soundId'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('soundId');
  });
});
