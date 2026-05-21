import { getRepository } from '@/services/db';
import { createScheduler } from '@/services/createScheduler';
import { createAlarmStore } from '@/stores/alarmStore';

type AlarmStore = ReturnType<typeof createAlarmStore>;

let storePromise: Promise<AlarmStore> | null = null;

export async function getStore(): Promise<AlarmStore> {
  if (storePromise !== null) return storePromise;
  storePromise = (async () => {
    const repo = await getRepository();
    const scheduler = createScheduler();
    return createAlarmStore(repo, scheduler);
  })();
  return storePromise;
}
