import { ExpoSqliteAdapter } from '@/repository/db/ExpoSqliteAdapter';
import { migrate } from '@/repository/schema';
import { AlarmRepository } from '@/repository/alarmRepository';

let repository: AlarmRepository | null = null;

export async function getRepository(): Promise<AlarmRepository> {
  if (repository !== null) return repository;
  const adapter = await ExpoSqliteAdapter.open('alarms.db');
  await migrate(adapter);
  repository = new AlarmRepository(adapter);
  return repository;
}
