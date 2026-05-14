import type { Alarm } from '@/domain/types';
import type { DbAdapter } from '@/repository/db/DbAdapter';
import { alarmToRow, rowToAlarm, type AlarmRow } from '@/repository/alarmMapper';

const UPSERT_SQL = `
  INSERT INTO alarms (id, label, hour, minute, weekdays, enabled, snooze_enabled, sound_id, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    label = excluded.label,
    hour = excluded.hour,
    minute = excluded.minute,
    weekdays = excluded.weekdays,
    enabled = excluded.enabled,
    snooze_enabled = excluded.snooze_enabled,
    sound_id = excluded.sound_id,
    updated_at = excluded.updated_at
`;

const LIST_SQL = `SELECT * FROM alarms ORDER BY hour ASC, minute ASC`;

const GET_BY_ID_SQL = `SELECT * FROM alarms WHERE id = ?`;

const DELETE_SQL = `DELETE FROM alarms WHERE id = ?`;

export class AlarmRepository {
  constructor(private readonly db: DbAdapter) {}

  async list(): Promise<Alarm[]> {
    const rows = await this.db.getAllAsync<AlarmRow>(LIST_SQL, []);
    return rows.map(rowToAlarm);
  }

  async getById(id: string): Promise<Alarm | null> {
    const row = await this.db.getFirstAsync<AlarmRow>(GET_BY_ID_SQL, [id]);
    return row ? rowToAlarm(row) : null;
  }

  async save(alarm: Alarm): Promise<void> {
    const row = alarmToRow(alarm);
    await this.db.runAsync(UPSERT_SQL, [
      row.id,
      row.label,
      row.hour,
      row.minute,
      row.weekdays,
      row.enabled,
      row.snooze_enabled,
      row.sound_id,
      row.created_at,
      row.updated_at,
    ]);
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync(DELETE_SQL, [id]);
  }
}
