# Alert App Plan 2: iOS Minimum End-to-End MVP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iOS 実機で「アラームを追加 → アプリ kill → Silent mode でも AlarmKit が鳴らす」エンドツーエンドが動く最小 MVP を構築する。

**Architecture:** iOS Scheduler 実装（AlarmKit ラッパー）→ サービス層（DB singleton + Scheduler factory）→ Zustand store（repository + scheduler の glue）→ 最小 UI 3 画面（一覧 / 編集 / root layout）という積み上げ順序。TDD は純粋ロジック（weekday mapping・store actions・factory 選択）に適用し、AlarmKit native 呼び出しは手動 E2E で検証する。

**Tech Stack:** react-native-ios-alarmkit v0.7.6 / @react-native-community/datetimepicker / Zustand v5 / expo-sqlite / NativeWind v4 / Jest + jest-expo / React Native Testing Library / BetterSqliteAdapter（テスト専用）

**前提条件:**

- `plan-1-complete` タグ以降のコードが `main` ブランチに存在する
- `src/domain/`, `src/repository/`, `src/scheduler/AlarmScheduler.ts` が実装済み
- `react-native-ios-alarmkit` / `zustand` / `expo-sqlite` は既に `package.json` に存在する（再インストール不要）
- iOS 実機（iOS 26+）と開発ビルドが手元にある（`eas build --profile development` 済み）
- `spec の参照:` `docs/superpowers/specs/2026-05-07-alert-app-design.md`

---

## File Structure（Plan 2 終了時点）

```
alert-app/
├── src/
│   ├── app/
│   │   ├── _layout.tsx              # Modified: permission request + loadAlarms
│   │   ├── index.tsx                # Modified: alarm list screen (replaces placeholder)
│   │   └── alarm/
│   │       └── [id].tsx             # Created: edit/create modal
│   │
│   ├── components/
│   │   ├── WeekdayToggle.tsx        # Created: 7-pill weekday selector
│   │   └── AlarmListItem.tsx        # Created: list row (time + label + toggle)
│   │
│   ├── domain/
│   │   ├── types.ts                 # Unchanged (Alarm, Weekday, AlarmInput, SoundId)
│   │   ├── nextOccurrence.ts        # Unchanged
│   │   └── validation.ts            # Unchanged
│   │
│   ├── repository/
│   │   ├── db/
│   │   │   ├── DbAdapter.ts         # Unchanged
│   │   │   ├── ExpoSqliteAdapter.ts # Unchanged
│   │   │   └── BetterSqliteAdapter.ts # Unchanged (test-only)
│   │   ├── schema.ts                # Unchanged
│   │   ├── alarmMapper.ts           # Unchanged
│   │   └── alarmRepository.ts      # Unchanged
│   │
│   ├── scheduler/
│   │   ├── AlarmScheduler.ts        # Unchanged (interface)
│   │   └── iosScheduler.ts          # Created: AlarmKit wrapper
│   │
│   ├── services/
│   │   ├── db.ts                    # Created: DB singleton + getRepository()
│   │   └── createScheduler.ts       # Created: platform-based factory
│   │
│   ├── stores/
│   │   └── alarmStore.ts            # Created: Zustand store
│   │
│   └── theme/
│       └── colors.ts                # Created: accent + dark bg tokens
│
└── tests/
    ├── domain/                      # Unchanged
    ├── repository/                  # Unchanged
    ├── scheduler/
    │   └── iosScheduler.test.ts     # Created: weekday mapping + state mapping
    ├── services/
    │   └── createScheduler.test.ts  # Created: factory selection logic
    ├── stores/
    │   └── alarmStore.test.ts       # Created: store actions with BetterSqliteAdapter
    └── smoke.test.ts                # Unchanged
```

---

## Phase 2: iOS Scheduler

### Task 1: Install @react-native-community/datetimepicker

**Files:**

- Modify: `package.json` (dependency追加)

- [ ] **Step 1: Install datetimepicker via expo install**

```bash
npx expo install @react-native-community/datetimepicker
```

`npx expo install` を使うことで Expo SDK との互換バージョンが自動選択される。

Expected: `package.json` の `dependencies` に `@react-native-community/datetimepicker` が追加される。`node_modules/` にもインストールされる。

- [ ] **Step 2: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore(deps): install @react-native-community/datetimepicker

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Implement IosScheduler.isAvailable and requestAuthorization with unit tests

**Files:**

- Create: `src/scheduler/iosScheduler.ts`
- Create: `tests/scheduler/iosScheduler.test.ts`

AlarmKit の `AuthorizationState`（`'notDetermined' | 'authorized' | 'denied'`）から `AlarmScheduler` インターフェースの `'authorized' | 'denied' | 'notDetermined'` へのマッピングロジックをテストする。値は同一なので型レベルの確認。

- [ ] **Step 1: Create the test file with isAvailable and requestAuthorization tests**

`tests/scheduler/iosScheduler.test.ts`:

```ts
import { IosScheduler } from '@/scheduler/iosScheduler';

jest.mock('react-native-ios-alarmkit', () => ({
  __esModule: true,
  default: {
    isSupported: false,
    getAuthorizationState: jest.fn(),
    requestAuthorization: jest.fn(),
    scheduleAlarm: jest.fn(),
    cancel: jest.fn(),
    getAlarms: jest.fn(),
  },
}));

import AlarmKit from 'react-native-ios-alarmkit';

const mockAlarmKit = AlarmKit as jest.Mocked<typeof AlarmKit>;

describe('IosScheduler', () => {
  let scheduler: IosScheduler;

  beforeEach(() => {
    scheduler = new IosScheduler();
    jest.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('returns false when AlarmKit.isSupported is false', async () => {
      Object.defineProperty(mockAlarmKit, 'isSupported', { value: false, configurable: true });
      const result = await scheduler.isAvailable();
      expect(result).toBe(false);
    });

    it('returns true when AlarmKit.isSupported is true', async () => {
      Object.defineProperty(mockAlarmKit, 'isSupported', { value: true, configurable: true });
      const result = await scheduler.isAvailable();
      expect(result).toBe(true);
    });
  });

  describe('requestAuthorization', () => {
    it('returns authorized when AlarmKit.requestAuthorization resolves true', async () => {
      Object.defineProperty(mockAlarmKit, 'isSupported', { value: true, configurable: true });
      (mockAlarmKit.requestAuthorization as jest.Mock).mockResolvedValue(true);
      const result = await scheduler.requestAuthorization();
      expect(result).toBe('authorized');
    });

    it('returns denied when AlarmKit.requestAuthorization resolves false', async () => {
      Object.defineProperty(mockAlarmKit, 'isSupported', { value: true, configurable: true });
      (mockAlarmKit.requestAuthorization as jest.Mock).mockResolvedValue(false);
      const result = await scheduler.requestAuthorization();
      expect(result).toBe('denied');
    });

    it('returns notDetermined when AlarmKit is not supported', async () => {
      Object.defineProperty(mockAlarmKit, 'isSupported', { value: false, configurable: true });
      const result = await scheduler.requestAuthorization();
      expect(result).toBe('notDetermined');
    });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
npm test -- tests/scheduler/iosScheduler.test.ts
```

Expected: FAIL — `Cannot find module '@/scheduler/iosScheduler'`

- [ ] **Step 3: Create the skeleton IosScheduler with isAvailable and requestAuthorization**

`src/scheduler/iosScheduler.ts`:

```ts
import AlarmKit from 'react-native-ios-alarmkit';
import type { Alarm } from '@/domain/types';
import type { AlarmScheduler, ScheduledAlarmInfo } from '@/scheduler/AlarmScheduler';

export class IosScheduler implements AlarmScheduler {
  async isAvailable(): Promise<boolean> {
    return AlarmKit.isSupported;
  }

  async requestAuthorization(): Promise<'authorized' | 'denied' | 'notDetermined'> {
    if (!AlarmKit.isSupported) return 'notDetermined';
    const authorized = await AlarmKit.requestAuthorization();
    return authorized ? 'authorized' : 'denied';
  }

  async schedule(_alarm: Alarm): Promise<void> {
    throw new Error('Not implemented');
  }

  async cancel(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async listScheduled(): Promise<ScheduledAlarmInfo[]> {
    throw new Error('Not implemented');
  }
}
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
npm test -- tests/scheduler/iosScheduler.test.ts
```

Expected: 5 テスト全て PASS。

- [ ] **Step 5: Commit**

```bash
git add src/scheduler/iosScheduler.ts tests/scheduler/iosScheduler.test.ts
git commit -m "$(cat <<'EOF'
feat(scheduler): implement IosScheduler.isAvailable and requestAuthorization with tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Implement IosScheduler.schedule with weekday translation tests

**Files:**

- Modify: `src/scheduler/iosScheduler.ts`
- Modify: `tests/scheduler/iosScheduler.test.ts`

`Weekday`（`'mon' | 'tue' | ...`）から AlarmKit の `Weekday`（`'monday' | 'tuesday' | ...`）へのマッピングと `scheduleAlarm` の呼び出しをテストする。

- [ ] **Step 1: Add weekday translation helper tests to the test file**

`tests/scheduler/iosScheduler.test.ts` の `describe('IosScheduler', ...)` ブロック末尾に追加：

```ts
describe('schedule – weekday translation', () => {
  const baseAlarm: Alarm = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    label: 'Wake Up',
    hour: 7,
    minute: 30,
    weekdays: ['mon', 'wed', 'fri'],
    enabled: true,
    snoozeEnabled: true,
    soundId: 'default',
    createdAt: 1000,
    updatedAt: 1000,
  };

  beforeEach(() => {
    Object.defineProperty(mockAlarmKit, 'isSupported', { value: true, configurable: true });
    (mockAlarmKit.scheduleAlarm as jest.Mock).mockResolvedValue(undefined);
  });

  it('translates mon/wed/fri to monday/wednesday/friday', async () => {
    await scheduler.schedule(baseAlarm);
    expect(mockAlarmKit.scheduleAlarm).toHaveBeenCalledWith(
      baseAlarm.id,
      expect.objectContaining({
        weekdays: ['monday', 'wednesday', 'friday'],
      }),
    );
  });

  it('passes hour, minute, title, snoozeEnabled', async () => {
    await scheduler.schedule(baseAlarm);
    expect(mockAlarmKit.scheduleAlarm).toHaveBeenCalledWith(
      baseAlarm.id,
      expect.objectContaining({
        hour: 7,
        minute: 30,
        title: 'Wake Up',
        snoozeEnabled: true,
      }),
    );
  });

  it('passes empty weekdays array for one-shot alarm', async () => {
    await scheduler.schedule({ ...baseAlarm, weekdays: [] });
    expect(mockAlarmKit.scheduleAlarm).toHaveBeenCalledWith(
      baseAlarm.id,
      expect.objectContaining({ weekdays: [] }),
    );
  });

  it('does not call scheduleAlarm when not supported', async () => {
    Object.defineProperty(mockAlarmKit, 'isSupported', { value: false, configurable: true });
    await scheduler.schedule(baseAlarm);
    expect(mockAlarmKit.scheduleAlarm).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests and verify new ones fail**

```bash
npm test -- tests/scheduler/iosScheduler.test.ts
```

Expected: 5 テスト PASS、4 テスト FAIL（`schedule – weekday translation`）。

- [ ] **Step 3: Implement schedule with weekday translation in IosScheduler**

`src/scheduler/iosScheduler.ts` の `schedule` メソッドを置き換える（ファイル全体を以下に更新）：

```ts
import AlarmKit from 'react-native-ios-alarmkit';
import type { Weekday as AlarmKitWeekday } from 'react-native-ios-alarmkit';
import type { Alarm, Weekday } from '@/domain/types';
import type { AlarmScheduler, ScheduledAlarmInfo } from '@/scheduler/AlarmScheduler';

const WEEKDAY_MAP: Record<Weekday, AlarmKitWeekday> = {
  mon: 'monday',
  tue: 'tuesday',
  wed: 'wednesday',
  thu: 'thursday',
  fri: 'friday',
  sat: 'saturday',
  sun: 'sunday',
};

export class IosScheduler implements AlarmScheduler {
  async isAvailable(): Promise<boolean> {
    return AlarmKit.isSupported;
  }

  async requestAuthorization(): Promise<'authorized' | 'denied' | 'notDetermined'> {
    if (!AlarmKit.isSupported) return 'notDetermined';
    const authorized = await AlarmKit.requestAuthorization();
    return authorized ? 'authorized' : 'denied';
  }

  async schedule(alarm: Alarm): Promise<void> {
    if (!AlarmKit.isSupported) return;
    await AlarmKit.scheduleAlarm(alarm.id, {
      hour: alarm.hour,
      minute: alarm.minute,
      weekdays: alarm.weekdays.map((w) => WEEKDAY_MAP[w]),
      title: alarm.label || 'アラーム',
      snoozeEnabled: alarm.snoozeEnabled,
    });
  }

  async cancel(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async listScheduled(): Promise<ScheduledAlarmInfo[]> {
    throw new Error('Not implemented');
  }
}
```

- [ ] **Step 4: Run tests and verify all 9 pass**

```bash
npm test -- tests/scheduler/iosScheduler.test.ts
```

Expected: 9 テスト全て PASS。

- [ ] **Step 5: Commit**

```bash
git add src/scheduler/iosScheduler.ts tests/scheduler/iosScheduler.test.ts
git commit -m "$(cat <<'EOF'
feat(scheduler): implement IosScheduler.schedule with weekday mapping tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Implement IosScheduler.cancel and listScheduled with state-mapping tests

**Files:**

- Modify: `src/scheduler/iosScheduler.ts`
- Modify: `tests/scheduler/iosScheduler.test.ts`

AlarmKit の `AlarmState`（`'scheduled' | 'countdown' | 'paused' | 'alerting'`）から `ScheduledAlarmInfo.state`（`'scheduled' | 'alerting' | 'snoozed' | 'unknown'`）へのマッピングをテストする。

- [ ] **Step 1: Add cancel and listScheduled tests to the test file**

`tests/scheduler/iosScheduler.test.ts` の `describe('IosScheduler', ...)` ブロック末尾に追加：

```ts
describe('cancel', () => {
  it('calls AlarmKit.cancel with the given id', async () => {
    Object.defineProperty(mockAlarmKit, 'isSupported', { value: true, configurable: true });
    (mockAlarmKit.cancel as jest.Mock).mockResolvedValue(true);
    await scheduler.cancel('550e8400-e29b-41d4-a716-446655440000');
    expect(mockAlarmKit.cancel).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
  });

  it('no-ops when not supported', async () => {
    Object.defineProperty(mockAlarmKit, 'isSupported', { value: false, configurable: true });
    await scheduler.cancel('550e8400-e29b-41d4-a716-446655440000');
    expect(mockAlarmKit.cancel).not.toHaveBeenCalled();
  });
});

describe('listScheduled – AlarmKit state mapping', () => {
  it('maps scheduled → scheduled', async () => {
    Object.defineProperty(mockAlarmKit, 'isSupported', { value: true, configurable: true });
    (mockAlarmKit.getAlarms as jest.Mock).mockResolvedValue([
      { id: 'id-1', state: 'scheduled', countdownDuration: null, schedule: null },
    ]);
    const result = await scheduler.listScheduled();
    expect(result).toEqual([{ id: 'id-1', state: 'scheduled' }]);
  });

  it('maps alerting → alerting', async () => {
    Object.defineProperty(mockAlarmKit, 'isSupported', { value: true, configurable: true });
    (mockAlarmKit.getAlarms as jest.Mock).mockResolvedValue([
      { id: 'id-2', state: 'alerting', countdownDuration: null, schedule: null },
    ]);
    const result = await scheduler.listScheduled();
    expect(result).toEqual([{ id: 'id-2', state: 'alerting' }]);
  });

  it('maps countdown → snoozed', async () => {
    Object.defineProperty(mockAlarmKit, 'isSupported', { value: true, configurable: true });
    (mockAlarmKit.getAlarms as jest.Mock).mockResolvedValue([
      { id: 'id-3', state: 'countdown', countdownDuration: null, schedule: null },
    ]);
    const result = await scheduler.listScheduled();
    expect(result).toEqual([{ id: 'id-3', state: 'snoozed' }]);
  });

  it('maps paused → unknown', async () => {
    Object.defineProperty(mockAlarmKit, 'isSupported', { value: true, configurable: true });
    (mockAlarmKit.getAlarms as jest.Mock).mockResolvedValue([
      { id: 'id-4', state: 'paused', countdownDuration: null, schedule: null },
    ]);
    const result = await scheduler.listScheduled();
    expect(result).toEqual([{ id: 'id-4', state: 'unknown' }]);
  });

  it('returns empty array when not supported', async () => {
    Object.defineProperty(mockAlarmKit, 'isSupported', { value: false, configurable: true });
    const result = await scheduler.listScheduled();
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests and verify new ones fail**

```bash
npm test -- tests/scheduler/iosScheduler.test.ts
```

Expected: 9 テスト PASS、7 テスト FAIL（cancel と listScheduled）。

- [ ] **Step 3: Implement cancel and listScheduled in IosScheduler**

`src/scheduler/iosScheduler.ts` を以下の最終版に置き換える：

```ts
import AlarmKit from 'react-native-ios-alarmkit';
import type { Weekday as AlarmKitWeekday } from 'react-native-ios-alarmkit';
import type { Alarm, Weekday } from '@/domain/types';
import type { AlarmScheduler, ScheduledAlarmInfo } from '@/scheduler/AlarmScheduler';

const WEEKDAY_MAP: Record<Weekday, AlarmKitWeekday> = {
  mon: 'monday',
  tue: 'tuesday',
  wed: 'wednesday',
  thu: 'thursday',
  fri: 'friday',
  sat: 'saturday',
  sun: 'sunday',
};

type AlarmKitState = 'scheduled' | 'countdown' | 'paused' | 'alerting';

function mapAlarmKitState(state: AlarmKitState): ScheduledAlarmInfo['state'] {
  switch (state) {
    case 'scheduled':
      return 'scheduled';
    case 'alerting':
      return 'alerting';
    case 'countdown':
      return 'snoozed';
    default:
      return 'unknown';
  }
}

export class IosScheduler implements AlarmScheduler {
  async isAvailable(): Promise<boolean> {
    return AlarmKit.isSupported;
  }

  async requestAuthorization(): Promise<'authorized' | 'denied' | 'notDetermined'> {
    if (!AlarmKit.isSupported) return 'notDetermined';
    const authorized = await AlarmKit.requestAuthorization();
    return authorized ? 'authorized' : 'denied';
  }

  async schedule(alarm: Alarm): Promise<void> {
    if (!AlarmKit.isSupported) return;
    await AlarmKit.scheduleAlarm(alarm.id, {
      hour: alarm.hour,
      minute: alarm.minute,
      weekdays: alarm.weekdays.map((w) => WEEKDAY_MAP[w]),
      title: alarm.label || 'アラーム',
      snoozeEnabled: alarm.snoozeEnabled,
    });
  }

  async cancel(id: string): Promise<void> {
    if (!AlarmKit.isSupported) return;
    await AlarmKit.cancel(id);
  }

  async listScheduled(): Promise<ScheduledAlarmInfo[]> {
    if (!AlarmKit.isSupported) return [];
    const alarms = await AlarmKit.getAlarms();
    return alarms.map((a) => ({
      id: a.id,
      state: mapAlarmKitState(a.state as AlarmKitState),
    }));
  }
}
```

- [ ] **Step 4: Run tests and verify all 16 pass**

```bash
npm test -- tests/scheduler/iosScheduler.test.ts
```

Expected: 16 テスト全て PASS。

- [ ] **Step 5: Commit**

```bash
git add src/scheduler/iosScheduler.ts tests/scheduler/iosScheduler.test.ts
git commit -m "$(cat <<'EOF'
feat(scheduler): implement IosScheduler.cancel and listScheduled with state-mapping tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Create scheduler factory with platform selection tests

**Files:**

- Create: `src/services/createScheduler.ts`
- Create: `tests/services/createScheduler.test.ts`

`Platform.OS` が `'ios'` の場合は `IosScheduler` を、それ以外は no-op scheduler を返すファクトリ。テストは Jest 環境（`Platform.OS === 'ios'` にはならない）でファクトリが no-op を返すことと、モックした `'ios'` で `IosScheduler` が返ることを確認する。

- [ ] **Step 1: Write the factory test**

`tests/services/createScheduler.test.ts`:

```ts
import { createScheduler } from '@/services/createScheduler';
import { IosScheduler } from '@/scheduler/iosScheduler';

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
    const scheduler = cs();
    expect(scheduler).toBeInstanceOf(IosScheduler);
  });

  it('returns no-op scheduler when platform is android', () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));
    const { createScheduler: cs } = require('@/services/createScheduler');
    const scheduler = cs();
    expect(scheduler).not.toBeInstanceOf(IosScheduler);
  });

  it('no-op scheduler isAvailable returns false', async () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));
    const { createScheduler: cs } = require('@/services/createScheduler');
    const scheduler = cs();
    expect(await scheduler.isAvailable()).toBe(false);
  });

  it('no-op scheduler requestAuthorization returns notDetermined', async () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));
    const { createScheduler: cs } = require('@/services/createScheduler');
    const scheduler = cs();
    expect(await scheduler.requestAuthorization()).toBe('notDetermined');
  });

  it('no-op scheduler schedule resolves without error', async () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));
    const { createScheduler: cs } = require('@/services/createScheduler');
    const scheduler = cs();
    await expect(scheduler.schedule({} as never)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
npm test -- tests/services/createScheduler.test.ts
```

Expected: FAIL — `Cannot find module '@/services/createScheduler'`

- [ ] **Step 3: Implement createScheduler factory**

`src/services/createScheduler.ts`:

```ts
import { Platform } from 'react-native';
import { IosScheduler } from '@/scheduler/iosScheduler';
import type { AlarmScheduler, ScheduledAlarmInfo } from '@/scheduler/AlarmScheduler';
import type { Alarm } from '@/domain/types';

class NoopScheduler implements AlarmScheduler {
  async isAvailable(): Promise<boolean> {
    return false;
  }

  async requestAuthorization(): Promise<'authorized' | 'denied' | 'notDetermined'> {
    return 'notDetermined';
  }

  async schedule(_alarm: Alarm): Promise<void> {}

  async cancel(_id: string): Promise<void> {}

  async listScheduled(): Promise<ScheduledAlarmInfo[]> {
    return [];
  }
}

export function createScheduler(): AlarmScheduler {
  if (Platform.OS === 'ios') {
    return new IosScheduler();
  }
  return new NoopScheduler();
}
```

- [ ] **Step 4: Run the test and verify all 5 pass**

```bash
npm test -- tests/services/createScheduler.test.ts
```

Expected: 5 テスト全て PASS。

- [ ] **Step 5: Commit**

```bash
git add src/services/createScheduler.ts tests/services/createScheduler.test.ts
git commit -m "$(cat <<'EOF'
feat(services): create platform-based scheduler factory with tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 Minimum: UI Components and Screens

### Task 6: Create DB singleton helper

**Files:**

- Create: `src/services/db.ts`

アプリ内で唯一の `AlarmRepository` インスタンスを提供するシングルトン。`ExpoSqliteAdapter` を使って `alarms.db` を開き、マイグレーションを実行してからリポジトリを返す。一度 open したら同インスタンスをキャッシュする。

- [ ] **Step 1: Create the db service**

`src/services/db.ts`:

```ts
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
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 3: Commit**

```bash
git add src/services/db.ts
git commit -m "$(cat <<'EOF'
feat(services): add DB singleton helper with lazy init and migration

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Create theme color tokens and extend Tailwind config

**Files:**

- Create: `src/theme/colors.ts`
- Modify: `tailwind.config.js`

NativeWind クラスでカバーできない色を TypeScript 定数として定義し、同じ値を `tailwind.config.js` の `colors` にも追加して `bg-surface`, `text-secondary`, `bg-danger`, `text-danger`, `border-border` のような NativeWind クラスが使えるようにする。

- [ ] **Step 1: Create theme colors**

`src/theme/colors.ts`:

```ts
export const colors = {
  accent: '#FF9500',
  background: '#000000',
  surface: '#1C1C1E',
  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  border: '#38383A',
  danger: '#FF3B30',
} as const;
```

- [ ] **Step 2: Extend tailwind.config.js with the same color palette**

`tailwind.config.js` を以下に書き換える：

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        accent: '#FF9500',
        surface: '#1C1C1E',
        secondary: '#8E8E93',
        border: '#38383A',
        danger: '#FF3B30',
      },
    },
  },
  plugins: [],
};
```

これにより `bg-surface`, `text-secondary`, `bg-danger`, `text-danger`, `border-border`, `bg-accent` が NativeWind クラスとして使えるようになる。

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 4: Commit**

```bash
git add src/theme/colors.ts tailwind.config.js
git commit -m "$(cat <<'EOF'
feat(theme): add dark theme color tokens and extend Tailwind config

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Build WeekdayToggle component with tests

**Files:**

- Create: `src/components/WeekdayToggle.tsx`
- Create: `tests/components/WeekdayToggle.test.tsx`

7 つの曜日ピルを横並びに表示し、タップで ON/OFF を切り替えるコンポーネント。選択状態は `value` prop で管理し、`onChange` で通知する（controlled）。

- [ ] **Step 1: Write the component tests**

`tests/components/WeekdayToggle.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { WeekdayToggle } from '@/components/WeekdayToggle';
import type { Weekday } from '@/domain/types';

describe('WeekdayToggle', () => {
  it('renders 7 day pills', () => {
    const { getAllByRole } = render(<WeekdayToggle value={[]} onChange={jest.fn()} />);
    expect(getAllByRole('button')).toHaveLength(7);
  });

  it('displays Japanese day labels', () => {
    const { getByText } = render(<WeekdayToggle value={[]} onChange={jest.fn()} />);
    expect(getByText('月')).toBeTruthy();
    expect(getByText('日')).toBeTruthy();
  });

  it('calls onChange with added weekday when inactive pill is tapped', () => {
    const onChange = jest.fn();
    const { getByText } = render(<WeekdayToggle value={[]} onChange={onChange} />);
    fireEvent.press(getByText('月'));
    expect(onChange).toHaveBeenCalledWith(['mon'] as Weekday[]);
  });

  it('calls onChange with removed weekday when active pill is tapped', () => {
    const onChange = jest.fn();
    const { getByText } = render(<WeekdayToggle value={['mon', 'tue']} onChange={onChange} />);
    fireEvent.press(getByText('月'));
    expect(onChange).toHaveBeenCalledWith(['tue'] as Weekday[]);
  });

  it('does not call onChange for already active pill that stays active (no double toggle)', () => {
    const onChange = jest.fn();
    const { getByText } = render(<WeekdayToggle value={['mon']} onChange={onChange} />);
    fireEvent.press(getByText('月'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test -- tests/components/WeekdayToggle.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/WeekdayToggle'`

- [ ] **Step 3: Implement WeekdayToggle**

`src/components/WeekdayToggle.tsx`:

```tsx
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ALL_WEEKDAYS } from '@/domain/types';
import type { Weekday } from '@/domain/types';

const DAY_LABEL: Record<Weekday, string> = {
  mon: '月',
  tue: '火',
  wed: '水',
  thu: '木',
  fri: '金',
  sat: '土',
  sun: '日',
};

interface Props {
  value: readonly Weekday[];
  onChange: (days: Weekday[]) => void;
}

export function WeekdayToggle({ value, onChange }: Props) {
  const toggle = (day: Weekday) => {
    if (value.includes(day)) {
      onChange(value.filter((d) => d !== day));
    } else {
      onChange([...value, day]);
    }
  };

  return (
    <View className="flex-row justify-between px-2">
      {ALL_WEEKDAYS.map((day) => {
        const active = value.includes(day);
        return (
          <Pressable
            key={day}
            role="button"
            onPress={() => toggle(day)}
            className={`h-10 w-10 items-center justify-center rounded-full ${
              active ? 'bg-accent' : 'bg-surface border-border border'
            }`}
          >
            <Text className={`text-sm font-semibold ${active ? 'text-black' : 'text-white'}`}>
              {DAY_LABEL[day]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 4: Run tests and verify all 5 pass**

```bash
npm test -- tests/components/WeekdayToggle.test.tsx
```

Expected: 5 テスト全て PASS。

- [ ] **Step 5: Commit**

```bash
git add src/components/WeekdayToggle.tsx tests/components/WeekdayToggle.test.tsx
git commit -m "$(cat <<'EOF'
feat(components): add WeekdayToggle with 7-pill controlled selector and tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Build AlarmListItem component with tests

**Files:**

- Create: `src/components/AlarmListItem.tsx`
- Create: `tests/components/AlarmListItem.test.tsx`

一覧行コンポーネント。時刻（HH:MM 表示）・ラベル・繰り返し曜日テキスト・ON/OFF の Switch を表示する。ロジックなし、表示のみ。

- [ ] **Step 1: Write the component tests**

`tests/components/AlarmListItem.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AlarmListItem } from '@/components/AlarmListItem';
import type { Alarm } from '@/domain/types';

const alarm: Alarm = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  label: 'Morning',
  hour: 7,
  minute: 5,
  weekdays: ['mon', 'tue'],
  enabled: true,
  snoozeEnabled: false,
  soundId: 'default',
  createdAt: 1000,
  updatedAt: 1000,
};

describe('AlarmListItem', () => {
  it('renders time as HH:MM with zero-padding', () => {
    const { getByText } = render(
      <AlarmListItem alarm={alarm} onToggle={jest.fn()} onPress={jest.fn()} />,
    );
    expect(getByText('07:05')).toBeTruthy();
  });

  it('renders the alarm label', () => {
    const { getByText } = render(
      <AlarmListItem alarm={alarm} onToggle={jest.fn()} onPress={jest.fn()} />,
    );
    expect(getByText('Morning')).toBeTruthy();
  });

  it('renders weekday abbreviations', () => {
    const { getByText } = render(
      <AlarmListItem alarm={alarm} onToggle={jest.fn()} onPress={jest.fn()} />,
    );
    expect(getByText('月 火')).toBeTruthy();
  });

  it('calls onToggle with new value when switch is pressed', () => {
    const onToggle = jest.fn();
    const { getByRole } = render(
      <AlarmListItem alarm={alarm} onToggle={onToggle} onPress={jest.fn()} />,
    );
    fireEvent(getByRole('switch'), 'valueChange', false);
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('calls onPress when row is pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <AlarmListItem alarm={alarm} onToggle={jest.fn()} onPress={onPress} />,
    );
    fireEvent.press(getByTestId('alarm-list-item'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test -- tests/components/AlarmListItem.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/AlarmListItem'`

- [ ] **Step 3: Implement AlarmListItem**

`src/components/AlarmListItem.tsx`:

```tsx
import React from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import type { Alarm, Weekday } from '@/domain/types';

const DAY_LABEL: Record<Weekday, string> = {
  mon: '月',
  tue: '火',
  wed: '水',
  thu: '木',
  fri: '金',
  sat: '土',
  sun: '日',
};

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

interface Props {
  alarm: Alarm;
  onToggle: (enabled: boolean) => void;
  onPress: () => void;
}

export function AlarmListItem({ alarm, onToggle, onPress }: Props) {
  const weekdayText = alarm.weekdays.map((w) => DAY_LABEL[w]).join(' ');

  return (
    <Pressable
      testID="alarm-list-item"
      onPress={onPress}
      className="border-border flex-row items-center justify-between border-b px-4 py-3"
    >
      <View className="flex-1">
        <Text className="text-4xl font-thin text-white">
          {formatTime(alarm.hour, alarm.minute)}
        </Text>
        <Text className="text-secondary mt-0.5 text-sm">{alarm.label}</Text>
        {weekdayText.length > 0 && (
          <Text className="text-secondary mt-0.5 text-xs">{weekdayText}</Text>
        )}
      </View>
      <Switch
        value={alarm.enabled}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.text}
      />
    </Pressable>
  );
}
```

- [ ] **Step 4: Run tests and verify all 5 pass**

```bash
npm test -- tests/components/AlarmListItem.test.tsx
```

Expected: 5 テスト全て PASS。

- [ ] **Step 5: Commit**

```bash
git add src/components/AlarmListItem.tsx tests/components/AlarmListItem.test.tsx
git commit -m "$(cat <<'EOF'
feat(components): add AlarmListItem with time, label, weekdays display and tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Build list screen skeleton (src/app/index.tsx)

**Files:**

- Modify: `src/app/index.tsx`

ストアをまだ繋がない段階で、リスト画面の UI 骨格（FlatList + FAB + permission banner エリア）を作る。ストアは Task 14 で繋ぐ。この段階では空リストを表示する静的版。

- [ ] **Step 1: Replace the placeholder with list screen skeleton**

`src/app/index.tsx`:

```tsx
import React from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ListScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Text className="text-2xl font-semibold text-white">アラーム</Text>
        <Pressable
          accessibilityLabel="アラームを追加"
          onPress={() => router.push('/alarm/new')}
          className="h-8 w-8 items-center justify-center rounded-full bg-accent"
        >
          <Text className="text-xl font-bold text-black">+</Text>
        </Pressable>
      </View>

      <FlatList
        data={[]}
        keyExtractor={(item: never) => item}
        renderItem={() => null}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-32">
            <Text className="text-secondary text-base">アラームがありません</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 3: Commit**

```bash
git add src/app/index.tsx
git commit -m "$(cat <<'EOF'
feat(ui): scaffold alarm list screen with empty state

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Build edit screen (src/app/alarm/[id].tsx)

**Files:**

- Create: `src/app/alarm/[id].tsx`

`id=new` で新規作成、UUID 文字列で既存編集。時刻ピッカー・ラベル入力・WeekdayToggle・スヌーズ ON/OFF・保存ボタン・削除ボタン（既存のみ）を持つ。ストアへの接続は Task 15 で行う。この段階では UI 構造のみ（ボタン押下は console.log）。

- [ ] **Step 1: Create the directory and edit screen**

```bash
mkdir -p src/app/alarm
```

`src/app/alarm/[id].tsx`:

```tsx
import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WeekdayToggle } from '@/components/WeekdayToggle';
import { colors } from '@/theme/colors';
import type { Weekday } from '@/domain/types';

function buildInitialDate(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

export default function EditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';

  const [date, setDate] = useState<Date>(buildInitialDate(7, 0));
  const [label, setLabel] = useState('');
  const [weekdays, setWeekdays] = useState<readonly Weekday[]>([]);
  const [snoozeEnabled, setSnoozeEnabled] = useState(true);

  const handleSave = () => {
    console.log('save', { isNew, id, date, label, weekdays, snoozeEnabled });
    router.back();
  };

  const handleDelete = () => {
    console.log('delete', id);
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable onPress={() => router.back()}>
          <Text className="text-base text-accent">キャンセル</Text>
        </Pressable>
        <Text className="text-base font-semibold text-white">
          {isNew ? 'アラームを追加' : 'アラームを編集'}
        </Text>
        <Pressable onPress={handleSave}>
          <Text className="text-base font-semibold text-accent">保存</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1">
        <View className="items-center py-6">
          <DateTimePicker
            value={date}
            mode="time"
            display="spinner"
            onChange={(_event, selected) => selected && setDate(selected)}
            textColor={colors.text}
            style={{ height: 200 }}
          />
        </View>

        <View className="bg-surface mx-4 mb-4 rounded-xl px-4 py-3">
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="ラベル"
            placeholderTextColor={colors.textSecondary}
            className="text-base text-white"
            maxLength={100}
          />
        </View>

        <View className="bg-surface mx-4 mb-4 rounded-xl px-4 py-4">
          <Text className="text-secondary mb-3 text-sm">曜日</Text>
          <WeekdayToggle value={weekdays} onChange={setWeekdays} />
        </View>

        <View className="bg-surface mx-4 mb-4 flex-row items-center justify-between rounded-xl px-4 py-3">
          <Text className="text-base text-white">スヌーズ</Text>
          <Switch
            value={snoozeEnabled}
            onValueChange={setSnoozeEnabled}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.text}
          />
        </View>

        {!isNew && (
          <Pressable onPress={handleDelete} className="bg-surface mx-4 mb-8 rounded-xl px-4 py-3">
            <Text className="text-danger text-center text-base">アラームを削除</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 3: Commit**

```bash
git add src/app/alarm/
git commit -m "$(cat <<'EOF'
feat(ui): scaffold alarm edit screen with time picker, weekday selector, snooze toggle

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Configure stack navigation in root layout

**Files:**

- Modify: `src/app/_layout.tsx`

Expo Router でリスト画面と編集画面をスタックナビゲーションで繋ぐ。編集画面はモーダルとして表示する。permission request と startup sync は Task 16 で追加する。

- [ ] **Step 1: Update root layout with Stack configuration**

`src/app/_layout.tsx`:

```tsx
import '../../global.css';
import React from 'react';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="alarm/[id]"
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
```

注意: `global.css` は `src/app/_layout.tsx` の 2 つ上、プロジェクトルートにある（既存の `_layout.tsx` が `../../global.css` でインポートしているのと同じ）。

- [ ] **Step 2: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 3: Verify lint passes**

```bash
npm run lint
```

Expected: エラーなし。

- [ ] **Step 4: Commit**

```bash
git add src/app/_layout.tsx
git commit -m "$(cat <<'EOF'
feat(navigation): configure Stack navigator with modal presentation for edit screen

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 Minimum: Integration Glue

### Task 13: Implement Zustand store with TDD

**Files:**

- Create: `src/stores/alarmStore.ts`
- Create: `tests/stores/alarmStore.test.ts`

store の actions（`loadAlarms`, `addAlarm`, `updateAlarm`, `toggleAlarm`, `deleteAlarm`）を `BetterSqliteAdapter` + `NoopScheduler`（ファイル内定義）で統合テスト。

- [ ] **Step 1: Write store tests**

`tests/stores/alarmStore.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test -- tests/stores/alarmStore.test.ts
```

Expected: FAIL — `Cannot find module '@/stores/alarmStore'`

- [ ] **Step 3: Implement alarmStore**

`src/stores/alarmStore.ts`:

```ts
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
```

- [ ] **Step 4: Run tests and verify all pass**

```bash
npm test -- tests/stores/alarmStore.test.ts
```

Expected: 12 テスト全て PASS。

- [ ] **Step 5: Commit**

```bash
git add src/stores/alarmStore.ts tests/stores/alarmStore.test.ts
git commit -m "$(cat <<'EOF'
feat(store): implement alarmStore with addAlarm/update/toggle/delete actions and integration tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Create app-level store singleton and wire to list screen

**Files:**

- Create: `src/stores/appStore.ts`
- Modify: `src/app/index.tsx`

アプリ全体で使うストアインスタンス（`getRepository()` + `createScheduler()` で初期化）。React Context なしで module-level singleton にする（Zustand vanilla store）。

- [ ] **Step 1: Create app store singleton**

`src/stores/appStore.ts`:

```ts
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
```

- [ ] **Step 2: Wire store to list screen**

`src/app/index.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlarmListItem } from '@/components/AlarmListItem';
import { getStore } from '@/stores/appStore';
import type { Alarm } from '@/domain/types';

export default function ListScreen() {
  const router = useRouter();
  const [alarms, setAlarms] = useState<readonly Alarm[]>([]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    getStore().then((store) => {
      setAlarms(store.getState().alarms);
      unsub = store.subscribe((state) => setAlarms(state.alarms));
    });
    return () => {
      unsub?.();
    };
  }, []);

  const handleToggle = async (id: string, enabled: boolean) => {
    const store = await getStore();
    await store.getState().toggleAlarm(id, enabled);
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Text className="text-2xl font-semibold text-white">アラーム</Text>
        <Pressable
          accessibilityLabel="アラームを追加"
          onPress={() => router.push('/alarm/new')}
          className="h-8 w-8 items-center justify-center rounded-full bg-accent"
        >
          <Text className="text-xl font-bold text-black">+</Text>
        </Pressable>
      </View>

      <FlatList
        data={[...alarms]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AlarmListItem
            alarm={item}
            onToggle={(enabled) => handleToggle(item.id, enabled)}
            onPress={() => router.push(`/alarm/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-32">
            <Text className="text-secondary text-base">アラームがありません</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
```

Zustand vanilla store の `subscribe` を使って store 更新を React state に橋渡しする。`useStore` hook の代わりにこのパターンを使う理由：`getStore()` が async で返るため、モジュールトップレベルに store インスタンスがない。

- [ ] **Step 3: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 4: Commit**

```bash
git add src/stores/appStore.ts src/app/index.tsx
git commit -m "$(cat <<'EOF'
feat(ui): wire alarm list screen to Zustand store with live updates

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Wire store to edit screen

**Files:**

- Modify: `src/app/alarm/[id].tsx`

`id=new` で `addAlarm`、UUID で `updateAlarm`。既存アラームは `getById` で読み込んで初期値にセットする。

- [ ] **Step 1: Update edit screen to use store**

`src/app/alarm/[id].tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WeekdayToggle } from '@/components/WeekdayToggle';
import { getStore } from '@/stores/appStore';
import { colors } from '@/theme/colors';
import type { Weekday } from '@/domain/types';

function buildInitialDate(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

export default function EditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';

  const [date, setDate] = useState<Date>(buildInitialDate(7, 0));
  const [label, setLabel] = useState('');
  const [weekdays, setWeekdays] = useState<readonly Weekday[]>([]);
  const [snoozeEnabled, setSnoozeEnabled] = useState(true);

  useEffect(() => {
    if (isNew) return;
    getStore().then(async (store) => {
      const alarm = store.getState().alarms.find((a) => a.id === id);
      if (!alarm) return;
      setDate(buildInitialDate(alarm.hour, alarm.minute));
      setLabel(alarm.label);
      setWeekdays(alarm.weekdays);
      setSnoozeEnabled(alarm.snoozeEnabled);
    });
  }, [id, isNew]);

  const handleSave = async () => {
    const store = await getStore();
    const input = {
      label,
      hour: date.getHours(),
      minute: date.getMinutes(),
      weekdays,
      enabled: true,
      snoozeEnabled,
      soundId: 'default' as const,
    };
    if (isNew) {
      await store.getState().addAlarm(input);
    } else {
      await store.getState().updateAlarm(id, input);
    }
    router.back();
  };

  const handleDelete = async () => {
    const store = await getStore();
    await store.getState().deleteAlarm(id);
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable onPress={() => router.back()}>
          <Text className="text-base text-accent">キャンセル</Text>
        </Pressable>
        <Text className="text-base font-semibold text-white">
          {isNew ? 'アラームを追加' : 'アラームを編集'}
        </Text>
        <Pressable onPress={handleSave}>
          <Text className="text-base font-semibold text-accent">保存</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1">
        <View className="items-center py-6">
          <DateTimePicker
            value={date}
            mode="time"
            display="spinner"
            onChange={(_event, selected) => selected && setDate(selected)}
            textColor={colors.text}
            style={{ height: 200 }}
          />
        </View>

        <View className="bg-surface mx-4 mb-4 rounded-xl px-4 py-3">
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="ラベル"
            placeholderTextColor={colors.textSecondary}
            className="text-base text-white"
            maxLength={100}
          />
        </View>

        <View className="bg-surface mx-4 mb-4 rounded-xl px-4 py-4">
          <Text className="text-secondary mb-3 text-sm">曜日</Text>
          <WeekdayToggle value={weekdays} onChange={setWeekdays} />
        </View>

        <View className="bg-surface mx-4 mb-4 flex-row items-center justify-between rounded-xl px-4 py-3">
          <Text className="text-base text-white">スヌーズ</Text>
          <Switch
            value={snoozeEnabled}
            onValueChange={setSnoozeEnabled}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.text}
          />
        </View>

        {!isNew && (
          <Pressable onPress={handleDelete} className="bg-surface mx-4 mb-8 rounded-xl px-4 py-3">
            <Text className="text-danger text-center text-base">アラームを削除</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 3: Commit**

```bash
git add src/app/alarm/
git commit -m "$(cat <<'EOF'
feat(ui): wire edit screen to store – create, update, delete alarm actions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Add permission request and startup sync to root layout

**Files:**

- Modify: `src/app/_layout.tsx`
- Modify: `src/app/index.tsx`

アプリ起動時に `requestAuthorization()` を呼び、その後 `loadAlarms()` で DB のアラームを読み込んでスケジューラに再登録する。権限が denied の場合は一覧画面でバナーを表示する。`permissionDenied` 状態は一覧画面自身が `AlarmKit.getAuthorizationState()` を購読して管理する。

- [ ] **Step 1: Update root layout with startup permission + loadAlarms**

`src/app/_layout.tsx`:

```tsx
import '../../global.css';
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { createScheduler } from '@/services/createScheduler';
import { getStore } from '@/stores/appStore';

export default function RootLayout() {
  useEffect(() => {
    async function init() {
      const scheduler = createScheduler();
      await scheduler.requestAuthorization().catch(() => {});
      const store = await getStore();
      await store.getState().loadAlarms();
    }
    init();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="alarm/[id]"
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
```

- [ ] **Step 2: Add permission denied banner to list screen**

`src/app/index.tsx` を以下に全置き換えする：

```tsx
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlarmListItem } from '@/components/AlarmListItem';
import { createScheduler } from '@/services/createScheduler';
import { getStore } from '@/stores/appStore';
import type { Alarm } from '@/domain/types';

export default function ListScreen() {
  const router = useRouter();
  const [alarms, setAlarms] = useState<readonly Alarm[]>([]);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | null = null;

    async function setup() {
      const scheduler = createScheduler();
      const authStatus = await scheduler.requestAuthorization().catch(() => 'denied' as const);
      setPermissionDenied(authStatus === 'denied');

      const store = await getStore();
      setAlarms(store.getState().alarms);
      unsub = store.subscribe((state) => setAlarms(state.alarms));
    }

    setup();
    return () => {
      unsub?.();
    };
  }, []);

  const handleToggle = async (id: string, enabled: boolean) => {
    const store = await getStore();
    await store.getState().toggleAlarm(id, enabled);
  };

  const handleRetryPermission = async () => {
    const scheduler = createScheduler();
    const status = await scheduler.requestAuthorization().catch(() => 'denied' as const);
    setPermissionDenied(status === 'denied');
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Text className="text-2xl font-semibold text-white">アラーム</Text>
        <Pressable
          accessibilityLabel="アラームを追加"
          onPress={() => router.push('/alarm/new')}
          className="h-8 w-8 items-center justify-center rounded-full bg-accent"
        >
          <Text className="text-xl font-bold text-black">+</Text>
        </Pressable>
      </View>

      {permissionDenied && (
        <Pressable
          onPress={handleRetryPermission}
          className="bg-danger mx-4 my-2 rounded-xl px-4 py-3"
        >
          <Text className="text-center text-sm text-white">
            アラームの権限が必要です。タップして再許可
          </Text>
        </Pressable>
      )}

      <FlatList
        data={[...alarms]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AlarmListItem
            alarm={item}
            onToggle={(enabled) => handleToggle(item.id, enabled)}
            onPress={() => router.push(`/alarm/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-32">
            <Text className="text-secondary text-base">アラームがありません</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Verify typecheck and lint**

```bash
npm run typecheck && npm run lint
```

Expected: 両方エラーなし。

- [ ] **Step 4: Commit**

```bash
git add src/app/_layout.tsx src/app/index.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add startup permission request and loadAlarms sync in root layout

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Manual Verification

### Task 17: Manual E2E verification on iPhone

**Files:** なし（検証のみ）

実機 iPhone (iOS 26+) の開発ビルド（`eas build --profile development` で生成済み）を使って動作確認する。

- [ ] **Step 1: Rebuild dev client to pick up datetimepicker and layout changes**

```bash
eas build --profile development --platform ios
```

ビルド完了後、生成された `.ipa` を iPhone にインストールする。

Expected: ビルドが成功し、iPhone にインストールできる。

- [ ] **Step 2: First launch – permission dialog**

iPhone で開発ビルドを起動する。

Expected: AlarmKit の権限ダイアログが表示される。「許可」をタップする。

- [ ] **Step 3: Add a 1-minute alarm**

一覧画面の「+」ボタンをタップ → 編集画面が開く。

現在時刻から 1 分後の時刻を時刻ピッカーで設定する。

「保存」をタップする。

Expected: 一覧画面に追加したアラームが表示される。

- [ ] **Step 4: Kill the app and wait**

iPhone のホームボタン（またはスワイプ上）でアプリをバックグラウンドに送り、アプリスイッチャーでスワイプアップして完全に kill する。

1 分後まで待つ。

Expected: アプリが kill された状態でも、設定した時刻に AlarmKit のシステムアラートが全画面で表示され、音が鳴る。

- [ ] **Step 5: Test Silent mode**

別のアラームを 1〜2 分後に設定する。iPhone のサイレントスイッチをオレンジ（サイレントモード ON）にする。アプリを kill して待つ。

Expected: サイレントモードでも AlarmKit アラームが鳴る（AlarmKit は Silent mode を貫通する仕様）。

- [ ] **Step 6: Test snooze**

アラート表示中に「スヌーズ」をタップする。

Expected: アラートが消え、9 分後（AlarmKit デフォルト）に再度アラートが表示される。

- [ ] **Step 7: Test ON/OFF toggle**

一覧画面でアラームのスイッチをオフにする。

Expected: スケジュールがキャンセルされ、そのアラームが時刻になっても鳴らない。

- [ ] **Step 8: Test edit and delete**

既存アラームをタップ → 時刻を変更 → 保存する。一覧に反映されることを確認。

削除ボタンをタップ。一覧から消えることを確認。

- [ ] **Step 9: Document E2E results**

以下のチェックリストに実施結果を記録する（コミットメッセージに含める）：

```
[ ] permission dialog が起動時に表示された
[ ] アラーム追加 → 一覧に表示された
[ ] アプリ kill 後にアラームが鳴った
[ ] Silent mode でもアラームが鳴った
[ ] スヌーズが機能した（9 分後に再発火）
[ ] ON/OFF トグルでキャンセルできた
[ ] 編集が反映された
[ ] 削除ができた
```

- [ ] **Step 10: Commit E2E results**

```bash
git commit -m "$(cat <<'EOF'
test(e2e): manual iOS E2E verification complete – AlarmKit fires through silent mode and app kill

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)" --allow-empty
```

---

## Phase 2 Closeout

### Task 18: Full verification + tag plan-2-complete

**Files:** なし（検証のみ）

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: 全テスト PASS。内訳：

- smoke: 1
- domain/nextOccurrence: 9
- domain/validation: 11
- repository/alarmMapper: 8
- repository/alarmRepository: 9
- scheduler/iosScheduler: 16
- services/createScheduler: 5
- components/WeekdayToggle: 5
- components/AlarmListItem: 5
- stores/alarmStore: 12

合計: **81 テスト**

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: エラーなし。

- [ ] **Step 4: Verify project tree**

```bash
ls src/scheduler/ src/services/ src/stores/ src/components/ src/theme/
ls src/app/ src/app/alarm/
ls tests/scheduler/ tests/services/ tests/stores/ tests/components/
```

Expected: File Structure セクションに記載した全ファイルが存在する。

- [ ] **Step 5: Tag plan-2-complete**

```bash
git commit -m "$(cat <<'EOF'
chore(milestone): Plan 2 complete – iOS MVP end-to-end with AlarmKit integration

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)" --allow-empty
git tag plan-2-complete
```

---

## Plan 2 Completion Criteria

以下が全て満たされていること：

- [ ] `npm test` が 81 テスト全緑で通る
- [ ] `npm run typecheck` が 0 エラー
- [ ] `npm run lint` が 0 エラー
- [ ] `src/scheduler/iosScheduler.ts` が `AlarmScheduler` interface を完全実装している
- [ ] `src/services/createScheduler.ts` が iOS では `IosScheduler`、それ以外では `NoopScheduler` を返す
- [ ] `src/services/db.ts` が `AlarmRepository` シングルトンを提供する
- [ ] `src/stores/alarmStore.ts` が `addAlarm / updateAlarm / toggleAlarm / deleteAlarm / loadAlarms` を実装している
- [ ] `src/app/index.tsx` がアラーム一覧を FlatList で表示し、ON/OFF トグルが動く
- [ ] `src/app/alarm/[id].tsx` が新規作成・編集・削除に対応している
- [ ] `src/app/_layout.tsx` が起動時に権限要求と `loadAlarms()` を実行する
- [ ] iOS 実機で Task 17 の手動 E2E チェックリストが全て通っている

---

## Notes for Plan 3

Plan 3（Android Native Module）で必要になる前提：

- `AlarmScheduler` interface の `androidScheduler.ts` 実装（`modules/alarm-android/` の Kotlin Expo Module と連携）
- `createScheduler.ts` の `Platform.OS === 'android'` 分岐に `AndroidScheduler` を追加
- `BOOT_COMPLETED` BroadcastReceiver による再起動復活
- Android 権限フロー（`SCHEDULE_EXACT_ALARM`, `POST_NOTIFICATIONS`, `USE_FULL_SCREEN_INTENT`）
