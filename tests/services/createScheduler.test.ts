import { IosScheduler } from '@/scheduler/iosScheduler';

jest.mock('react-native-ios-alarmkit', () => ({
  __esModule: true,
  default: {
    isSupported: false,
    requestAuthorization: jest.fn(),
    scheduleAlarm: jest.fn(),
    cancel: jest.fn(),
    getAlarms: jest.fn(),
  },
}));

describe('createScheduler', () => {
  it('returns IosScheduler when platform is ios', () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
    }));
    const { createScheduler: cs } = require('@/services/createScheduler');
    const { IosScheduler: iOS } = require('@/scheduler/iosScheduler');
    const scheduler = cs();
    expect(scheduler).toBeInstanceOf(iOS);
  });

  it('returns no-op scheduler when platform is android', () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));
    const { createScheduler: cs } = require('@/services/createScheduler');
    const scheduler = cs();
    expect(scheduler).not.toBeInstanceOf(IosScheduler);
  });

  it('no-op scheduler isAvailable returns false', async () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));
    const { createScheduler: cs } = require('@/services/createScheduler');
    const scheduler = cs();
    expect(await scheduler.isAvailable()).toBe(false);
  });

  it('no-op scheduler requestAuthorization returns notDetermined', async () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));
    const { createScheduler: cs } = require('@/services/createScheduler');
    const scheduler = cs();
    expect(await scheduler.requestAuthorization()).toBe('notDetermined');
  });

  it('no-op scheduler schedule resolves without error', async () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));
    const { createScheduler: cs } = require('@/services/createScheduler');
    const scheduler = cs();
    await expect(scheduler.schedule({} as never)).resolves.toBeUndefined();
  });
});
