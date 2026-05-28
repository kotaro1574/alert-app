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

  it('returns AndroidScheduler when platform is android', () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));
    jest.doMock('expo', () => ({
      requireNativeModule: () => ({
        schedule: jest.fn(),
        cancel: jest.fn(),
        list: jest.fn(),
        requestPermissions: jest.fn(),
      }),
      NativeModule: class {},
    }));
    const { createScheduler: cs } = require('@/services/createScheduler');
    const { AndroidScheduler } = require('@/scheduler/androidScheduler');
    const scheduler = cs();
    expect(scheduler).toBeInstanceOf(AndroidScheduler);
  });
});
