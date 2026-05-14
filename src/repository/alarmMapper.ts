import type { Alarm, SoundId, Weekday } from '@/domain/types';

export interface AlarmRow {
  id: string;
  label: string;
  hour: number;
  minute: number;
  weekdays: string;
  enabled: number;
  snooze_enabled: number;
  sound_id: string;
  created_at: number;
  updated_at: number;
}

export function alarmToRow(alarm: Alarm): AlarmRow {
  return {
    id: alarm.id,
    label: alarm.label,
    hour: alarm.hour,
    minute: alarm.minute,
    weekdays: alarm.weekdays.join(','),
    enabled: alarm.enabled ? 1 : 0,
    snooze_enabled: alarm.snoozeEnabled ? 1 : 0,
    sound_id: alarm.soundId,
    created_at: alarm.createdAt,
    updated_at: alarm.updatedAt,
  };
}

export function rowToAlarm(row: AlarmRow): Alarm {
  const weekdays = row.weekdays === '' ? [] : (row.weekdays.split(',') as Weekday[]);
  return {
    id: row.id,
    label: row.label,
    hour: row.hour,
    minute: row.minute,
    weekdays,
    enabled: row.enabled === 1,
    snoozeEnabled: row.snooze_enabled === 1,
    soundId: row.sound_id as SoundId,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
