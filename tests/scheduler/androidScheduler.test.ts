import { requireNativeModule } from 'expo';
import { AndroidScheduler } from '@/scheduler/androidScheduler';

jest.mock('expo', () => ({
  __esModule: true,
  requireNativeModule: jest.fn(),
  NativeModule: class {},
}));

const mockNative = {
  schedule: jest.fn(),
  cancel: jest.fn(),
  list: jest.fn(),
  requestPermissions: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  removeAllListeners: jest.fn(),
};

(requireNativeModule as jest.Mock).mockReturnValue(mockNative);

describe('AndroidScheduler', () => {
  let scheduler: AndroidScheduler;

  beforeEach(() => {
    scheduler = new AndroidScheduler();
    jest.clearAllMocks();
    (requireNativeModule as jest.Mock).mockReturnValue(mockNative);
  });

  describe('isAvailable', () => {
    it('returns true on Android (module is always available when loaded)', async () => {
      expect(await scheduler.isAvailable()).toBe(true);
    });
  });

  describe('requestAuthorization', () => {
    it('returns authorized when all 3 perms granted', async () => {
      mockNative.requestPermissions.mockResolvedValue({
        exactAlarm: true,
        notifications: true,
        fullScreenIntent: true,
      });
      expect(await scheduler.requestAuthorization()).toBe('authorized');
    });

    it('returns denied when exactAlarm is denied', async () => {
      mockNative.requestPermissions.mockResolvedValue({
        exactAlarm: false,
        notifications: true,
        fullScreenIntent: true,
      });
      expect(await scheduler.requestAuthorization()).toBe('denied');
    });

    it('returns denied when notifications is denied', async () => {
      mockNative.requestPermissions.mockResolvedValue({
        exactAlarm: true,
        notifications: false,
        fullScreenIntent: true,
      });
      expect(await scheduler.requestAuthorization()).toBe('denied');
    });
  });

  describe('schedule – weekday translation', () => {
    const baseAlarm = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      label: 'Wake Up',
      hour: 7,
      minute: 30,
      weekdays: ['mon', 'wed', 'fri'] as const,
      enabled: true,
      snoozeEnabled: true,
      soundId: 'default' as const,
      createdAt: 1000,
      updatedAt: 1000,
    };

    beforeEach(() => {
      mockNative.schedule.mockResolvedValue(undefined);
    });

    it('translates mon/wed/fri to 1/3/5', async () => {
      await scheduler.schedule(baseAlarm);
      expect(mockNative.schedule).toHaveBeenCalledWith(
        baseAlarm.id,
        7,
        30,
        [1, 3, 5],
        'Wake Up',
        true,
      );
    });

    it('passes empty array for one-shot alarm', async () => {
      await scheduler.schedule({ ...baseAlarm, weekdays: [] });
      expect(mockNative.schedule).toHaveBeenCalledWith(baseAlarm.id, 7, 30, [], 'Wake Up', true);
    });

    it('uses default label when label is empty', async () => {
      await scheduler.schedule({ ...baseAlarm, label: '' });
      expect(mockNative.schedule).toHaveBeenCalledWith(
        baseAlarm.id,
        7,
        30,
        [1, 3, 5],
        'アラーム',
        true,
      );
    });

    it('passes snoozeEnabled false through', async () => {
      await scheduler.schedule({ ...baseAlarm, snoozeEnabled: false });
      expect(mockNative.schedule).toHaveBeenCalledWith(
        baseAlarm.id,
        7,
        30,
        [1, 3, 5],
        'Wake Up',
        false,
      );
    });
  });
});
