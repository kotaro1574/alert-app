import { nextOccurrence } from '@/domain/nextOccurrence';
import type { Alarm } from '@/domain/types';

const baseAlarm: Omit<Alarm, 'hour' | 'minute' | 'weekdays' | 'id'> = {
  label: 'Test',
  enabled: true,
  snoozeEnabled: false,
  soundId: 'default',
  createdAt: 0,
  updatedAt: 0,
};

const makeAlarm = (overrides: Partial<Alarm>): Alarm => ({
  id: 'a1',
  hour: 7,
  minute: 0,
  weekdays: [],
  ...baseAlarm,
  ...overrides,
});

describe('nextOccurrence', () => {
  describe('single occurrence (no weekdays)', () => {
    test('returns null when target time has already passed today', () => {
      const now = new Date('2026-05-07T10:00:00');
      const alarm = makeAlarm({ hour: 7, minute: 0, weekdays: [] });
      expect(nextOccurrence(alarm, now)).toBeNull();
    });

    test('returns today at target time when target is in the future', () => {
      const now = new Date('2026-05-07T06:00:00');
      const alarm = makeAlarm({ hour: 7, minute: 30, weekdays: [] });
      const expected = new Date('2026-05-07T07:30:00');
      expect(nextOccurrence(alarm, now)?.getTime()).toBe(expected.getTime());
    });

    test('returns target time when now equals target', () => {
      const now = new Date('2026-05-07T07:00:00.000');
      const alarm = makeAlarm({ hour: 7, minute: 0, weekdays: [] });
      const result = nextOccurrence(alarm, now);
      expect(result?.getTime()).toBe(now.getTime());
    });
  });

  describe('daily repeat (all weekdays)', () => {
    test('returns today at target time when target is in the future', () => {
      const now = new Date('2026-05-07T06:00:00');
      const alarm = makeAlarm({
        hour: 7,
        minute: 0,
        weekdays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      });
      const expected = new Date('2026-05-07T07:00:00');
      expect(nextOccurrence(alarm, now)?.getTime()).toBe(expected.getTime());
    });

    test('returns tomorrow when target time has passed today', () => {
      const now = new Date('2026-05-07T08:00:00');
      const alarm = makeAlarm({
        hour: 7,
        minute: 0,
        weekdays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      });
      const expected = new Date('2026-05-08T07:00:00');
      expect(nextOccurrence(alarm, now)?.getTime()).toBe(expected.getTime());
    });
  });

  describe('weekday filter', () => {
    test('weekdays mon-fri, called Sunday returns Monday', () => {
      const now = new Date('2026-05-10T10:00:00');
      const alarm = makeAlarm({
        hour: 7,
        minute: 0,
        weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      });
      const result = nextOccurrence(alarm, now);
      expect(result?.getDay()).toBe(1);
      expect(result?.getDate()).toBe(11);
    });

    test('weekdays sat-sun, called Monday returns Saturday', () => {
      const now = new Date('2026-05-04T10:00:00');
      const alarm = makeAlarm({ hour: 7, minute: 0, weekdays: ['sat', 'sun'] });
      const result = nextOccurrence(alarm, now);
      expect(result?.getDay()).toBe(6);
      expect(result?.getDate()).toBe(9);
    });

    test('weekday today but time has passed returns next valid weekday', () => {
      const now = new Date('2026-05-08T08:00:00');
      const alarm = makeAlarm({ hour: 7, minute: 0, weekdays: ['mon', 'fri'] });
      const result = nextOccurrence(alarm, now);
      expect(result?.getDay()).toBe(1);
      expect(result?.getDate()).toBe(11);
    });
  });

  describe('disabled alarm', () => {
    test('returns null when alarm.enabled is false', () => {
      const now = new Date('2026-05-07T06:00:00');
      const alarm = makeAlarm({ hour: 7, minute: 0, weekdays: [], enabled: false });
      expect(nextOccurrence(alarm, now)).toBeNull();
    });
  });
});
