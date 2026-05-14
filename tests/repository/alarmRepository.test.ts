import { BetterSqliteAdapter } from '@/repository/db/BetterSqliteAdapter';
import { migrate } from '@/repository/schema';
import { AlarmRepository } from '@/repository/alarmRepository';
import type { Alarm } from '@/domain/types';

const makeAlarm = (overrides: Partial<Alarm> = {}): Alarm => ({
  id: 'a1',
  label: 'Wake up',
  hour: 7,
  minute: 0,
  weekdays: ['mon'],
  enabled: true,
  snoozeEnabled: true,
  soundId: 'classic',
  createdAt: 1715000000000,
  updatedAt: 1715000000000,
  ...overrides,
});

describe('AlarmRepository', () => {
  let adapter: BetterSqliteAdapter;
  let repo: AlarmRepository;

  beforeEach(async () => {
    adapter = new BetterSqliteAdapter();
    await migrate(adapter);
    repo = new AlarmRepository(adapter);
  });

  afterEach(() => {
    adapter.close();
  });

  test('list returns empty array when no alarms exist', async () => {
    const result = await repo.list();
    expect(result).toEqual([]);
  });

  test('save then list returns the saved alarm', async () => {
    const alarm = makeAlarm();
    await repo.save(alarm);
    const result = await repo.list();
    expect(result).toEqual([alarm]);
  });

  test('save twice with same id replaces (upsert)', async () => {
    const original = makeAlarm({ label: 'Original' });
    const updated = makeAlarm({ label: 'Updated', updatedAt: 1715000999999 });
    await repo.save(original);
    await repo.save(updated);
    const result = await repo.list();
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Updated');
    expect(result[0].updatedAt).toBe(1715000999999);
  });

  test('getById returns the alarm when found', async () => {
    const alarm = makeAlarm({ id: 'specific-id' });
    await repo.save(alarm);
    const result = await repo.getById('specific-id');
    expect(result).toEqual(alarm);
  });

  test('getById returns null when not found', async () => {
    const result = await repo.getById('nonexistent');
    expect(result).toBeNull();
  });

  test('delete removes the alarm', async () => {
    const alarm = makeAlarm();
    await repo.save(alarm);
    await repo.delete(alarm.id);
    const result = await repo.getById(alarm.id);
    expect(result).toBeNull();
  });

  test('delete is idempotent for missing id', async () => {
    await expect(repo.delete('nonexistent')).resolves.not.toThrow();
  });

  test('list returns alarms ordered by hour then minute', async () => {
    await repo.save(makeAlarm({ id: 'a', hour: 8, minute: 30 }));
    await repo.save(makeAlarm({ id: 'b', hour: 6, minute: 0 }));
    await repo.save(makeAlarm({ id: 'c', hour: 8, minute: 0 }));
    const result = await repo.list();
    expect(result.map((a) => a.id)).toEqual(['b', 'c', 'a']);
  });

  test('handles alarm with empty weekdays', async () => {
    const alarm = makeAlarm({ weekdays: [] });
    await repo.save(alarm);
    const result = await repo.getById(alarm.id);
    expect(result?.weekdays).toEqual([]);
  });
});
