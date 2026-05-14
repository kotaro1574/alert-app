import type { DbAdapter } from '@/repository/db/DbAdapter';

export const ALARM_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS alarms (
    id TEXT PRIMARY KEY NOT NULL,
    label TEXT NOT NULL,
    hour INTEGER NOT NULL,
    minute INTEGER NOT NULL,
    weekdays TEXT NOT NULL,
    enabled INTEGER NOT NULL,
    snooze_enabled INTEGER NOT NULL,
    sound_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_alarms_enabled ON alarms(enabled);
`;

export async function migrate(db: DbAdapter): Promise<void> {
  await db.execAsync(ALARM_SCHEMA_SQL);
}
