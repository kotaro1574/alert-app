import AlarmKit from 'react-native-ios-alarmkit';
import type { Alarm } from '@/domain/types';
import type { AlarmScheduler, ScheduledAlarmInfo } from '@/scheduler/AlarmScheduler';

export class IosScheduler implements AlarmScheduler {
  async isAvailable(): Promise<boolean> {
    return AlarmKit.isSupported;
  }

  async requestAuthorization(): Promise<'authorized' | 'denied' | 'notDetermined'> {
    if (!AlarmKit.isSupported) return 'notDetermined';
    const authorized = await AlarmKit.requestAuthorization();
    return authorized ? 'authorized' : 'denied';
  }

  async schedule(_alarm: Alarm): Promise<void> {
    throw new Error('Not implemented');
  }

  async cancel(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async listScheduled(): Promise<ScheduledAlarmInfo[]> {
    throw new Error('Not implemented');
  }
}
