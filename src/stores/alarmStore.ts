import { createStore } from 'zustand/vanilla';
import type { AlarmRepository } from '@/repository/alarmRepository';
import type { AlarmScheduler } from '@/scheduler/AlarmScheduler';
import type { Alarm, AlarmInput } from '@/domain/types';

interface AlarmState {
  alarms: readonly Alarm[];
  permissionStatus: 'authorized' | 'denied' | 'notDetermined' | 'loading';
  loadAlarms: () => Promise<void>;
  addAlarm: (input: AlarmInput) => Promise<void>;
  updateAlarm: (id: string, input: AlarmInput) => Promise<void>;
  toggleAlarm: (id: string, enabled: boolean) => Promise<void>;
  deleteAlarm: (id: string) => Promise<void>;
}

function buildAlarm(input: AlarmInput): Alarm {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    ...input,
    createdAt: now,
    updatedAt: now,
  };
}

export function createAlarmStore(repo: AlarmRepository, scheduler: AlarmScheduler) {
  return createStore<AlarmState>()((set, get) => ({
    alarms: [],
    permissionStatus: 'notDetermined',

    async loadAlarms() {
      const alarms = await repo.list();
      set({ alarms });
      for (const alarm of alarms) {
        if (alarm.enabled) {
          await scheduler.schedule(alarm).catch(() => {});
        }
      }
    },

    async addAlarm(input) {
      const alarm = buildAlarm(input);
      await repo.save(alarm);
      try {
        await scheduler.schedule(alarm);
        set((s) => ({ alarms: [...s.alarms, alarm] }));
      } catch {
        const disabled: Alarm = { ...alarm, enabled: false };
        await repo.save(disabled);
        set((s) => ({ alarms: [...s.alarms, disabled] }));
      }
    },

    async updateAlarm(id, input) {
      const existing = get().alarms.find((a) => a.id === id);
      if (!existing) return;
      const updated: Alarm = { ...existing, ...input, updatedAt: Date.now() };
      await repo.save(updated);
      if (updated.enabled) {
        await scheduler.schedule(updated).catch(() => {});
      } else {
        await scheduler.cancel(id).catch(() => {});
      }
      set((s) => ({ alarms: s.alarms.map((a) => (a.id === id ? updated : a)) }));
    },

    async toggleAlarm(id, enabled) {
      const alarm = get().alarms.find((a) => a.id === id);
      if (!alarm) return;
      const updated: Alarm = { ...alarm, enabled, updatedAt: Date.now() };
      await repo.save(updated);
      if (enabled) {
        await scheduler.schedule(updated).catch(() => {});
      } else {
        await scheduler.cancel(id).catch(() => {});
      }
      set((s) => ({ alarms: s.alarms.map((a) => (a.id === id ? updated : a)) }));
    },

    async deleteAlarm(id) {
      await repo.delete(id);
      await scheduler.cancel(id).catch(() => {});
      set((s) => ({ alarms: s.alarms.filter((a) => a.id !== id) }));
    },
  }));
}
