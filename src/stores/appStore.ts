import { getRepository } from '@/services/db';
import { createScheduler } from '@/services/createScheduler';
import { createAlarmStore } from '@/stores/alarmStore';

type AlarmStore = ReturnType<typeof createAlarmStore>;

let storeInstance: AlarmStore | null = null;

export async function getStore(): Promise<AlarmStore> {
  if (storeInstance !== null) return storeInstance;
  const repo = await getRepository();
  const scheduler = createScheduler();
  storeInstance = createAlarmStore(repo, scheduler);
  return storeInstance;
}
