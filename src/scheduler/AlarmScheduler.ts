import type { Alarm } from '@/domain/types';

export interface ScheduledAlarmInfo {
  id: string;
  state: 'scheduled' | 'alerting' | 'snoozed' | 'unknown';
}

export interface AlarmScheduler {
  isAvailable(): Promise<boolean>;

  requestAuthorization(): Promise<'authorized' | 'denied' | 'notDetermined'>;

  schedule(alarm: Alarm): Promise<void>;

  cancel(id: string): Promise<void>;

  listScheduled(): Promise<ScheduledAlarmInfo[]>;
}
