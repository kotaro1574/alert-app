export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const ALL_WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export type SoundId = 'classic' | 'chime' | 'gentle' | 'urgent' | 'default';

export const ALL_SOUND_IDS: readonly SoundId[] = [
  'classic',
  'chime',
  'gentle',
  'urgent',
  'default',
];

export interface Alarm {
  id: string;
  label: string;
  hour: number;
  minute: number;
  weekdays: readonly Weekday[];
  enabled: boolean;
  snoozeEnabled: boolean;
  soundId: SoundId;
  createdAt: number;
  updatedAt: number;
}

export interface AlarmInput {
  label: string;
  hour: number;
  minute: number;
  weekdays: readonly Weekday[];
  enabled: boolean;
  snoozeEnabled: boolean;
  soundId: SoundId;
}
