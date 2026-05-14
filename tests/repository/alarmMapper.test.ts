import { alarmToRow, rowToAlarm } from '@/repository/alarmMapper';
import type { Alarm } from '@/domain/types';

const sampleAlarm: Alarm = {
  id: 'a1',
  label: 'Wake up',
  hour: 7,
  minute: 30,
  weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  enabled: true,
  snoozeEnabled: false,
  soundId: 'classic',
  createdAt: 1715000000000,
  updatedAt: 1715000000000,
};

describe('alarmToRow', () => {
  test('serializes weekdays as comma-separated string', () => {
    const row = alarmToRow(sampleAlarm);
    expect(row.weekdays).toBe('mon,tue,wed,thu,fri');
  });

  test('serializes empty weekdays as empty string', () => {
    const row = alarmToRow({ ...sampleAlarm, weekdays: [] });
    expect(row.weekdays).toBe('');
  });

  test('serializes booleans as 0/1', () => {
    const row = alarmToRow({ ...sampleAlarm, enabled: true, snoozeEnabled: false });
    expect(row.enabled).toBe(1);
    expect(row.snooze_enabled).toBe(0);
  });

  test('preserves all numeric fields', () => {
    const row = alarmToRow(sampleAlarm);
    expect(row.id).toBe('a1');
    expect(row.label).toBe('Wake up');
    expect(row.hour).toBe(7);
    expect(row.minute).toBe(30);
    expect(row.sound_id).toBe('classic');
    expect(row.created_at).toBe(1715000000000);
    expect(row.updated_at).toBe(1715000000000);
  });
});

describe('rowToAlarm', () => {
  test('parses weekdays from comma-separated string', () => {
    const alarm = rowToAlarm({
      id: 'a1',
      label: 'Wake up',
      hour: 7,
      minute: 30,
      weekdays: 'mon,tue,wed',
      enabled: 1,
      snooze_enabled: 0,
      sound_id: 'classic',
      created_at: 1715000000000,
      updated_at: 1715000000000,
    });
    expect(alarm.weekdays).toEqual(['mon', 'tue', 'wed']);
  });

  test('parses empty weekdays string as empty array', () => {
    const alarm = rowToAlarm({
      id: 'a1',
      label: 'Wake up',
      hour: 7,
      minute: 30,
      weekdays: '',
      enabled: 1,
      snooze_enabled: 0,
      sound_id: 'classic',
      created_at: 1715000000000,
      updated_at: 1715000000000,
    });
    expect(alarm.weekdays).toEqual([]);
  });

  test('parses booleans from 0/1', () => {
    const alarm = rowToAlarm({
      id: 'a1',
      label: 'Wake up',
      hour: 7,
      minute: 30,
      weekdays: '',
      enabled: 1,
      snooze_enabled: 0,
      sound_id: 'classic',
      created_at: 1715000000000,
      updated_at: 1715000000000,
    });
    expect(alarm.enabled).toBe(true);
    expect(alarm.snoozeEnabled).toBe(false);
  });
});

describe('round-trip', () => {
  test('alarm -> row -> alarm preserves all fields', () => {
    const row = alarmToRow(sampleAlarm);
    const restored = rowToAlarm(row);
    expect(restored).toEqual(sampleAlarm);
  });
});
