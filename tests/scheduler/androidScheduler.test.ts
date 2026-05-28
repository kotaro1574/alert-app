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
});
