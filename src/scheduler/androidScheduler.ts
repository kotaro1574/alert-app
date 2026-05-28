import { requireNativeModule } from 'expo';
import type { NativeModule } from 'expo';
import type { AlarmScheduler, ScheduledAlarmInfo } from '@/scheduler/AlarmScheduler';
import type { Alarm, Weekday } from '@/domain/types';

type AlarmAndroidEvents = {
  onAlarmStateChanged(event: { id: string; state: 'fired' | 'stopped' | 'snoozed' }): void;
};

interface AlarmAndroidNativeModule extends NativeModule<AlarmAndroidEvents> {
  schedule(
    id: string,
    hour: number,
    minute: number,
    weekdays: number[],
    label: string,
    snoozeEnabled: boolean,
  ): Promise<void>;
  cancel(id: string): Promise<void>;
  list(): Promise<{ id: string; nextTriggerAt: number }[]>;
  requestPermissions(): Promise<{
    exactAlarm: boolean;
    notifications: boolean;
    fullScreenIntent: boolean;
  }>;
}

const WEEKDAY_TO_ISO: Record<Weekday, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7,
};

function getNative(): AlarmAndroidNativeModule {
  return requireNativeModule<AlarmAndroidNativeModule>('AlarmAndroid');
}

export class AndroidScheduler implements AlarmScheduler {
  async isAvailable(): Promise<boolean> {
    return true;
  }

  async requestAuthorization(): Promise<'authorized' | 'denied' | 'notDetermined'> {
    const result = await getNative().requestPermissions();
    if (result.exactAlarm && result.notifications && result.fullScreenIntent) {
      return 'authorized';
    }
    return 'denied';
  }

  async schedule(alarm: Alarm): Promise<void> {
    await getNative().schedule(
      alarm.id,
      alarm.hour,
      alarm.minute,
      alarm.weekdays.map((w) => WEEKDAY_TO_ISO[w]),
      alarm.label || 'アラーム',
      alarm.snoozeEnabled,
    );
  }

  async cancel(id: string): Promise<void> {
    await getNative().cancel(id);
  }

  async listScheduled(): Promise<ScheduledAlarmInfo[]> {
    const entries = await getNative().list();
    return entries.map((e) => ({ id: e.id, state: 'scheduled' as const }));
  }
}
