import { IosScheduler } from '@/scheduler/iosScheduler';
import type { Alarm } from '@/domain/types';

import AlarmKit from 'react-native-ios-alarmkit';

jest.mock('react-native-ios-alarmkit', () => ({
  __esModule: true,
  default: {
    isSupported: false,
    getAuthorizationState: jest.fn(),
    requestAuthorization: jest.fn(),
    scheduleAlarm: jest.fn(),
    cancel: jest.fn(),
    getAlarms: jest.fn(),
  },
}));

const mockAlarmKit = AlarmKit as jest.Mocked<typeof AlarmKit>;

describe('IosScheduler', () => {
  let scheduler: IosScheduler;

  beforeEach(() => {
    scheduler = new IosScheduler();
    jest.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('returns false when AlarmKit.isSupported is false', async () => {
      Object.defineProperty(mockAlarmKit, 'isSupported', { value: false, configurable: true });
      const result = await scheduler.isAvailable();
      expect(result).toBe(false);
    });

    it('returns true when AlarmKit.isSupported is true', async () => {
      Object.defineProperty(mockAlarmKit, 'isSupported', { value: true, configurable: true });
      const result = await scheduler.isAvailable();
      expect(result).toBe(true);
    });
  });

  describe('requestAuthorization', () => {
    it('returns authorized when AlarmKit.requestAuthorization resolves true', async () => {
      Object.defineProperty(mockAlarmKit, 'isSupported', { value: true, configurable: true });
      (mockAlarmKit.requestAuthorization as jest.Mock).mockResolvedValue(true);
      const result = await scheduler.requestAuthorization();
      expect(result).toBe('authorized');
    });

    it('returns denied when AlarmKit.requestAuthorization resolves false', async () => {
      Object.defineProperty(mockAlarmKit, 'isSupported', { value: true, configurable: true });
      (mockAlarmKit.requestAuthorization as jest.Mock).mockResolvedValue(false);
      const result = await scheduler.requestAuthorization();
      expect(result).toBe('denied');
    });

    it('returns notDetermined when AlarmKit is not supported', async () => {
      Object.defineProperty(mockAlarmKit, 'isSupported', { value: false, configurable: true });
      const result = await scheduler.requestAuthorization();
      expect(result).toBe('notDetermined');
    });
  });

  describe('schedule – weekday translation', () => {
    const baseAlarm: Alarm = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      label: 'Wake Up',
      hour: 7,
      minute: 30,
      weekdays: ['mon', 'wed', 'fri'],
      enabled: true,
      snoozeEnabled: true,
      soundId: 'default',
      createdAt: 1000,
      updatedAt: 1000,
    };

    beforeEach(() => {
      Object.defineProperty(mockAlarmKit, 'isSupported', { value: true, configurable: true });
      (mockAlarmKit.scheduleAlarm as jest.Mock).mockResolvedValue(undefined);
    });

    it('translates mon/wed/fri to monday/wednesday/friday', async () => {
      await scheduler.schedule(baseAlarm);
      expect(mockAlarmKit.scheduleAlarm).toHaveBeenCalledWith(
        baseAlarm.id,
        expect.objectContaining({
          weekdays: ['monday', 'wednesday', 'friday'],
        }),
      );
    });

    it('passes hour, minute, title, snoozeEnabled', async () => {
      await scheduler.schedule(baseAlarm);
      expect(mockAlarmKit.scheduleAlarm).toHaveBeenCalledWith(
        baseAlarm.id,
        expect.objectContaining({
          hour: 7,
          minute: 30,
          title: 'Wake Up',
          snoozeEnabled: true,
        }),
      );
    });

    it('passes empty weekdays array for one-shot alarm', async () => {
      await scheduler.schedule({ ...baseAlarm, weekdays: [] });
      expect(mockAlarmKit.scheduleAlarm).toHaveBeenCalledWith(
        baseAlarm.id,
        expect.objectContaining({ weekdays: [] }),
      );
    });

    it('does not call scheduleAlarm when not supported', async () => {
      Object.defineProperty(mockAlarmKit, 'isSupported', { value: false, configurable: true });
      await scheduler.schedule(baseAlarm);
      expect(mockAlarmKit.scheduleAlarm).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('calls AlarmKit.cancel with the given id', async () => {
      Object.defineProperty(mockAlarmKit, 'isSupported', { value: true, configurable: true });
      (mockAlarmKit.cancel as jest.Mock).mockResolvedValue(true);
      await scheduler.cancel('550e8400-e29b-41d4-a716-446655440000');
      expect(mockAlarmKit.cancel).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
    });

    it('no-ops when not supported', async () => {
      Object.defineProperty(mockAlarmKit, 'isSupported', { value: false, configurable: true });
      await scheduler.cancel('550e8400-e29b-41d4-a716-446655440000');
      expect(mockAlarmKit.cancel).not.toHaveBeenCalled();
    });
  });

  describe('listScheduled – AlarmKit state mapping', () => {
    it('maps scheduled → scheduled', async () => {
      Object.defineProperty(mockAlarmKit, 'isSupported', { value: true, configurable: true });
      (mockAlarmKit.getAlarms as jest.Mock).mockResolvedValue([
        { id: 'id-1', state: 'scheduled', countdownDuration: null, schedule: null },
      ]);
      const result = await scheduler.listScheduled();
      expect(result).toEqual([{ id: 'id-1', state: 'scheduled' }]);
    });

    it('maps alerting → alerting', async () => {
      Object.defineProperty(mockAlarmKit, 'isSupported', { value: true, configurable: true });
      (mockAlarmKit.getAlarms as jest.Mock).mockResolvedValue([
        { id: 'id-2', state: 'alerting', countdownDuration: null, schedule: null },
      ]);
      const result = await scheduler.listScheduled();
      expect(result).toEqual([{ id: 'id-2', state: 'alerting' }]);
    });

    it('maps countdown → snoozed', async () => {
      Object.defineProperty(mockAlarmKit, 'isSupported', { value: true, configurable: true });
      (mockAlarmKit.getAlarms as jest.Mock).mockResolvedValue([
        { id: 'id-3', state: 'countdown', countdownDuration: null, schedule: null },
      ]);
      const result = await scheduler.listScheduled();
      expect(result).toEqual([{ id: 'id-3', state: 'snoozed' }]);
    });

    it('maps paused → unknown', async () => {
      Object.defineProperty(mockAlarmKit, 'isSupported', { value: true, configurable: true });
      (mockAlarmKit.getAlarms as jest.Mock).mockResolvedValue([
        { id: 'id-4', state: 'paused', countdownDuration: null, schedule: null },
      ]);
      const result = await scheduler.listScheduled();
      expect(result).toEqual([{ id: 'id-4', state: 'unknown' }]);
    });

    it('returns empty array when not supported', async () => {
      Object.defineProperty(mockAlarmKit, 'isSupported', { value: false, configurable: true });
      const result = await scheduler.listScheduled();
      expect(result).toEqual([]);
    });
  });
});
