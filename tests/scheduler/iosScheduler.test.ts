import { IosScheduler } from '@/scheduler/iosScheduler';

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

import AlarmKit from 'react-native-ios-alarmkit';

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
});
