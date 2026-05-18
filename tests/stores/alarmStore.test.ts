import { BetterSqliteAdapter } from '@/repository/db/BetterSqliteAdapter';
import { AlarmRepository } from '@/repository/alarmRepository';
import { migrate } from '@/repository/schema';
import { createAlarmStore } from '@/stores/alarmStore';
import type { AlarmScheduler, ScheduledAlarmInfo } from '@/scheduler/AlarmScheduler';
import type { Alarm, AlarmInput } from '@/domain/types';

class NoopScheduler implements AlarmScheduler {
  readonly scheduleLog: string[] = [];
  readonly cancelLog: string[] = [];

  async isAvailable() {
    return false;
  }
  async requestAuthorization(): Promise<'authorized' | 'denied' | 'notDetermined'> {
    return 'notDetermined';
  }
  async schedule(alarm: Alarm) {
    this.scheduleLog.push(alarm.id);
  }
  async cancel(id: string) {
    this.cancelLog.push(id);
  }
  async listScheduled(): Promise<ScheduledAlarmInfo[]> {
    return [];
  }
}

const baseInput: AlarmInput = {
  label: 'Test',
  hour: 7,
  minute: 0,
  weekdays: ['mon'],
  enabled: true,
  snoozeEnabled: false,
  soundId: 'default',
};

async function setupStore() {
  const adapter = new BetterSqliteAdapter(':memory:');
  await migrate(adapter);
  const repo = new AlarmRepository(adapter);
  const scheduler = new NoopScheduler();
  const store = createAlarmStore(repo, scheduler);
  return { store, repo, scheduler, adapter };
}

describe('alarmStore', () => {
  describe('loadAlarms', () => {
    it('loads all alarms from repository into store', async () => {
      const { store, repo } = await setupStore();
      const alarm: Alarm = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        ...baseInput,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await repo.save(alarm);
      await store.getState().loadAlarms();
      expect(store.getState().alarms).toHaveLength(1);
      expect(store.getState().alarms[0]?.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('calls scheduler.schedule for each enabled alarm on load', async () => {
      const { store, repo, scheduler } = await setupStore();
      const alarm: Alarm = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        ...baseInput,
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await repo.save(alarm);
      await store.getState().loadAlarms();
      expect(scheduler.scheduleLog).toContain('550e8400-e29b-41d4-a716-446655440001');
    });
  });

  describe('addAlarm', () => {
    it('saves alarm to repo and updates store alarms', async () => {
      const { store } = await setupStore();
      await store.getState().addAlarm(baseInput);
      expect(store.getState().alarms).toHaveLength(1);
    });

    it('calls scheduler.schedule with the new alarm', async () => {
      const { store, scheduler } = await setupStore();
      await store.getState().addAlarm(baseInput);
      const id = store.getState().alarms[0]?.id;
      expect(id).toBeDefined();
      expect(scheduler.scheduleLog).toContain(id);
    });

    it('sets enabled:false and does not call scheduler when scheduler throws', async () => {
      const adapter = new BetterSqliteAdapter(':memory:');
      await migrate(adapter);
      const repo = new AlarmRepository(adapter);
      const failScheduler: AlarmScheduler = {
        isAvailable: async () => false,
        requestAuthorization: async () => 'notDetermined',
        schedule: async () => {
          throw new Error('scheduler failed');
        },
        cancel: async () => {},
        listScheduled: async () => [],
      };
      const store = createAlarmStore(repo, failScheduler);
      await store.getState().addAlarm(baseInput);
      expect(store.getState().alarms[0]?.enabled).toBe(false);
    });
  });

  describe('toggleAlarm', () => {
    it('calls scheduler.cancel when toggling off an enabled alarm', async () => {
      const { store, scheduler } = await setupStore();
      await store.getState().addAlarm(baseInput);
      const id = store.getState().alarms[0]!.id;
      await store.getState().toggleAlarm(id, false);
      expect(scheduler.cancelLog).toContain(id);
    });

    it('calls scheduler.schedule when toggling on a disabled alarm', async () => {
      const { store, scheduler } = await setupStore();
      await store.getState().addAlarm({ ...baseInput, enabled: false });
      const id = store.getState().alarms[0]!.id;
      scheduler.scheduleLog.length = 0;
      await store.getState().toggleAlarm(id, true);
      expect(scheduler.scheduleLog).toContain(id);
    });

    it('updates enabled in repo and store', async () => {
      const { store, repo } = await setupStore();
      await store.getState().addAlarm(baseInput);
      const id = store.getState().alarms[0]!.id;
      await store.getState().toggleAlarm(id, false);
      const saved = await repo.getById(id);
      expect(saved?.enabled).toBe(false);
      expect(store.getState().alarms[0]?.enabled).toBe(false);
    });
  });

  describe('deleteAlarm', () => {
    it('removes alarm from repo and store', async () => {
      const { store, repo } = await setupStore();
      await store.getState().addAlarm(baseInput);
      const id = store.getState().alarms[0]!.id;
      await store.getState().deleteAlarm(id);
      expect(store.getState().alarms).toHaveLength(0);
      expect(await repo.getById(id)).toBeNull();
    });

    it('calls scheduler.cancel', async () => {
      const { store, scheduler } = await setupStore();
      await store.getState().addAlarm(baseInput);
      const id = store.getState().alarms[0]!.id;
      await store.getState().deleteAlarm(id);
      expect(scheduler.cancelLog).toContain(id);
    });
  });

  describe('updateAlarm', () => {
    it('saves updated alarm to repo and store', async () => {
      const { store } = await setupStore();
      await store.getState().addAlarm(baseInput);
      const id = store.getState().alarms[0]!.id;
      await store.getState().updateAlarm(id, { ...baseInput, label: 'Updated', hour: 8 });
      expect(store.getState().alarms[0]?.label).toBe('Updated');
      expect(store.getState().alarms[0]?.hour).toBe(8);
    });

    it('calls scheduler.schedule with updated alarm when enabled', async () => {
      const { store, scheduler } = await setupStore();
      await store.getState().addAlarm(baseInput);
      const id = store.getState().alarms[0]!.id;
      scheduler.scheduleLog.length = 0;
      await store.getState().updateAlarm(id, { ...baseInput, label: 'Updated', enabled: true });
      expect(scheduler.scheduleLog).toContain(id);
    });
  });
});
