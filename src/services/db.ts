import { ExpoSqliteAdapter } from '@/repository/db/ExpoSqliteAdapter';
import { migrate } from '@/repository/schema';
import { AlarmRepository } from '@/repository/alarmRepository';

let repositoryPromise: Promise<AlarmRepository> | null = null;

export async function getRepository(): Promise<AlarmRepository> {
  if (repositoryPromise !== null) return repositoryPromise;
  repositoryPromise = (async () => {
    const adapter = await ExpoSqliteAdapter.open('alarms.db');
    await migrate(adapter);
    return new AlarmRepository(adapter);
  })();
  return repositoryPromise;
}
