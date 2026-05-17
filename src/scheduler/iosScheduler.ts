import AlarmKit from 'react-native-ios-alarmkit';
import type { Weekday as AlarmKitWeekday } from 'react-native-ios-alarmkit';
import type { Alarm, Weekday } from '@/domain/types';
import type { AlarmScheduler, ScheduledAlarmInfo } from '@/scheduler/AlarmScheduler';

const WEEKDAY_MAP: Record<Weekday, AlarmKitWeekday> = {
  mon: 'monday',
  tue: 'tuesday',
  wed: 'wednesday',
  thu: 'thursday',
  fri: 'friday',
  sat: 'saturday',
  sun: 'sunday',
};

export class IosScheduler implements AlarmScheduler {
  async isAvailable(): Promise<boolean> {
    return AlarmKit.isSupported;
  }

  async requestAuthorization(): Promise<'authorized' | 'denied' | 'notDetermined'> {
    if (!AlarmKit.isSupported) return 'notDetermined';
    const authorized = await AlarmKit.requestAuthorization();
    return authorized ? 'authorized' : 'denied';
  }

  async schedule(alarm: Alarm): Promise<void> {
    if (!AlarmKit.isSupported) return;
    await AlarmKit.scheduleAlarm(alarm.id, {
      hour: alarm.hour,
      minute: alarm.minute,
      weekdays: alarm.weekdays.map((w) => WEEKDAY_MAP[w]),
      title: alarm.label || 'アラーム',
      snoozeEnabled: alarm.snoozeEnabled,
    });
  }

  async cancel(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async listScheduled(): Promise<ScheduledAlarmInfo[]> {
    throw new Error('Not implemented');
  }
}
