import { Platform } from 'react-native';
import type { AlarmScheduler, ScheduledAlarmInfo } from '@/scheduler/AlarmScheduler';
import type { Alarm } from '@/domain/types';

class NoopScheduler implements AlarmScheduler {
  async isAvailable(): Promise<boolean> {
    return false;
  }

  async requestAuthorization(): Promise<'authorized' | 'denied' | 'notDetermined'> {
    return 'notDetermined';
  }

  async schedule(_alarm: Alarm): Promise<void> {}

  async cancel(_id: string): Promise<void> {}

  async listScheduled(): Promise<ScheduledAlarmInfo[]> {
    return [];
  }
}

export function createScheduler(): AlarmScheduler {
  if (Platform.OS === 'ios') {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { IosScheduler } =
      require('@/scheduler/iosScheduler') as typeof import('@/scheduler/iosScheduler');
    /* eslint-enable @typescript-eslint/no-require-imports */
    return new IosScheduler();
  }
  return new NoopScheduler();
}
