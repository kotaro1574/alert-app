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

type AlarmKitState = 'scheduled' | 'countdown' | 'paused' | 'alerting';

function mapAlarmKitState(state: AlarmKitState): ScheduledAlarmInfo['state'] {
  switch (state) {
    case 'scheduled':
      return 'scheduled';
    case 'alerting':
      return 'alerting';
    case 'countdown':
      return 'snoozed';
    default:
      return 'unknown';
  }
}

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

  async cancel(id: string): Promise<void> {
    if (!AlarmKit.isSupported) return;
    await AlarmKit.cancel(id);
  }

  async listScheduled(): Promise<ScheduledAlarmInfo[]> {
    if (!AlarmKit.isSupported) return [];
    const alarms = await AlarmKit.getAlarms();
    return alarms.map((a) => ({
      id: a.id,
      state: mapAlarmKitState(a.state as AlarmKitState),
    }));
  }
}
