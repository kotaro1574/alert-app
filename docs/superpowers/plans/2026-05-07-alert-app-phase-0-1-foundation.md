# Alert App Plan 1: Foundation & Domain Layer (Phase 0-1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expo + EAS のプロジェクト基盤を構築し、ネイティブ非依存の Domain 層（型・繰り返し計算・バリデーション・SQLite Repository・Scheduler interface）を完成させる。

**Architecture:** 3 層分離（UI / Domain / Native）の Domain 層と、その下の Repository / Scheduler interface を先に固める。ネイティブ依存ゼロで動くため、TDD でガッツリテスト網羅できる。Plan 2 (iOS AlarmKit + Android Native Module) はこの contract に沿って実装する。

**Tech Stack:** Expo SDK 55 (`--template default@sdk-55`) / React Native New Architecture / TypeScript / NativeWind v4 / Expo Router / Zustand / expo-sqlite / Jest + jest-expo / better-sqlite3 (test only) / EAS Build

**前提条件:**
- macOS / Linux 環境
- Node.js 20.x 以上
- 課金済みの Apple Developer Program アカウント（実機 dev build 用）
- Google Play Console アカウント（dev build 用、実機テストだけなら必須ではない）
- Xcode 16.x 以上（iOS 26 SDK 必須）
- 実機 iPhone (iOS 26+) と Android 端末（Android 8.0+）

**spec の参照:** `docs/superpowers/specs/2026-05-07-alert-app-design.md`

---

## File Structure (Phase 0-1 終了時点)

```
alert-app/
├── .gitignore                      # 既存
├── package.json                    # Created: Task 1
├── tsconfig.json                   # Created: Task 1
├── app.json                        # Created: Task 1, Modified: Tasks 7, 8
├── eas.json                        # Created: Task 9
├── babel.config.js                 # Created: Task 4
├── metro.config.js                 # Created: Task 4
├── tailwind.config.js              # Created: Task 4
├── global.css                      # Created: Task 4
├── nativewind-env.d.ts             # Auto-generated: Task 4
├── jest.config.js                  # Created: Task 11
├── jest.setup.ts                   # Created: Task 11
├── .eslintrc.js                    # Created: Task 2
├── .prettierrc.js                  # Created: Task 2
│
├── app/                            # Expo Router (Created: Task 1)
│   ├── _layout.tsx
│   └── index.tsx
│
├── src/
│   ├── domain/
│   │   ├── types.ts                # Created: Task 12
│   │   ├── nextOccurrence.ts       # Created: Task 13
│   │   └── validation.ts           # Created: Task 14
│   │
│   ├── repository/
│   │   ├── db/
│   │   │   ├── DbAdapter.ts        # Created: Task 16 (interface)
│   │   │   ├── ExpoSqliteAdapter.ts# Created: Task 16
│   │   │   └── BetterSqliteAdapter.ts # Created: Task 16 (test-only)
│   │   ├── schema.ts               # Created: Task 17
│   │   ├── alarmMapper.ts          # Created: Task 18
│   │   └── alarmRepository.ts      # Created: Task 19
│   │
│   └── scheduler/
│       └── AlarmScheduler.ts       # Created: Task 20 (interface only)
│
└── tests/
    ├── domain/
    │   ├── nextOccurrence.test.ts  # Created: Task 13
    │   └── validation.test.ts      # Created: Task 14
    └── repository/
        ├── alarmMapper.test.ts     # Created: Task 18
        └── alarmRepository.test.ts # Created: Task 19
```

---

## Phase 0: Project Foundation

### Task 1: Initialize Expo SDK 55 project with TypeScript

**Files:**
- Create: `package.json`, `tsconfig.json`, `app.json`, `app/_layout.tsx`, `app/index.tsx`, etc.

- [ ] **Step 1: Run create-expo-app with SDK 55 default template**

```bash
npx create-expo-app@latest . --template default@sdk-55
```

このコマンドはカレントディレクトリ（`.`）に Expo Router 構造のテンプレートを展開する。実行時にプロジェクト名を聞かれたら `alert-app` と入力。既存の `.gitignore` / `docs/` は上書きされない。

Expected: 完了後 `app/`, `package.json`, `tsconfig.json`, `app.json` が生成される。

- [ ] **Step 2: Verify install succeeded**

```bash
ls -la
cat package.json | grep -E "(expo|react|typescript)"
```

Expected: `expo` / `react` / `typescript` のバージョンが package.json に存在する（Expo は ^55.x.x）。

- [ ] **Step 3: Replace default home screen with minimal placeholder**

`app/index.tsx` を以下に書き換える：

```tsx
import { Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Alert App – Phase 0</Text>
    </View>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(setup): scaffold Expo SDK 55 project"
```

---

### Task 2: Add ESLint + Prettier with TypeScript rules

**Files:**
- Create: `.eslintrc.js`, `.prettierrc.js`
- Modify: `package.json`

- [ ] **Step 1: Install lint/format devDependencies**

```bash
npm install --save-dev eslint prettier eslint-config-expo @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-prettier eslint-config-prettier
```

- [ ] **Step 2: Create `.eslintrc.js`**

```js
module.exports = {
  extends: [
    'expo',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  parser: '@typescript-eslint/parser',
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/consistent-type-imports': 'warn',
    'prettier/prettier': 'error',
  },
  ignorePatterns: ['node_modules', 'dist', 'ios', 'android', '.expo'],
};
```

- [ ] **Step 3: Create `.prettierrc.js`**

```js
module.exports = {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  arrowParens: 'always',
};
```

- [ ] **Step 4: Add lint scripts to package.json**

`package.json` の `scripts` セクションに追加：

```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write \"**/*.{ts,tsx,js,json,md}\"",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 5: Verify lint and typecheck run cleanly**

```bash
npm run lint
npm run typecheck
```

Expected: 両方とも 0 エラーで完了。

- [ ] **Step 6: Commit**

```bash
git add .eslintrc.js .prettierrc.js package.json package-lock.json
git commit -m "chore(setup): configure ESLint and Prettier"
```

---

### Task 3: Enable React Native New Architecture

**Files:**
- Modify: `app.json`

- [ ] **Step 1: Read current app.json**

```bash
cat app.json
```

- [ ] **Step 2: Merge the following keys into `app.json` `expo` object**

既存の `app.json` を **置き換えるのではなく、以下のキーを `expo` オブジェクトにマージ** する。`name` / `slug` 等のテンプレートが生成した既存キーはそのまま残す。

追加・上書きするキー：

```json
{
  "expo": {
    "newArchEnabled": true,
    "ios": {
      "bundleIdentifier": "com.example.alertapp",
      "supportsTablet": false,
      "deploymentTarget": "26.0",
      "infoPlist": {
        "NSAlarmKitUsageDescription": "アラーム時刻に確実に通知するため、AlarmKit へのアクセスが必要です。"
      }
    },
    "android": {
      "package": "com.example.alertapp",
      "minSdkVersion": 26,
      "permissions": []
    }
  }
}
```

注意：

- `com.example.alertapp` は自分の実際のドメインに置き換える（例: `com.yourname.alertapp`）。一度決めたら変更が大変なので慎重に。
- 既に `ios` / `android` キーがテンプレートに存在する場合は、上のキーを既存のオブジェクトに **マージ** する（完全に置き換えない）。

- [ ] **Step 3: Commit**

```bash
git add app.json
git commit -m "chore(setup): enable New Architecture and set platform identifiers"
```

---

### Task 4: Set up NativeWind v4

**Files:**
- Create: `metro.config.js`, `tailwind.config.js`, `global.css`, `babel.config.js`
- Modify: `app/_layout.tsx`, `package.json`

- [ ] **Step 1: Install NativeWind and peer dependencies**

```bash
npx expo install nativewind react-native-reanimated react-native-safe-area-context
npm install --save-dev tailwindcss@^3.4.17 prettier-plugin-tailwindcss@^0.5.11
```

- [ ] **Step 2: Generate `tailwind.config.js`**

```bash
npx tailwindcss init
```

そのあと中身を以下に書き換える：

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        accent: '#FF9500',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: Create `global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Create `metro.config.js`**

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
```

- [ ] **Step 5: Create `babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
```

- [ ] **Step 6: Import `global.css` in root layout**

`app/_layout.tsx` を以下に書き換え：

```tsx
import '../global.css';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 7: Verify NativeWind applies styles**

`app/index.tsx` を以下に書き換え：

```tsx
import { Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View className="flex-1 justify-center items-center bg-black">
      <Text className="text-accent text-2xl font-bold">Alert App – Phase 0</Text>
    </View>
  );
}
```

- [ ] **Step 8: Run typecheck to confirm types resolve**

```bash
npm run typecheck
```

Expected: エラーなし。NativeWind の `className` prop が型認識されている。

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat(setup): configure NativeWind v4 with Tailwind preset"
```

---

### Task 5: Install Zustand and expo-sqlite

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
npx expo install expo-sqlite
npm install zustand
```

- [ ] **Step 2: Verify installs**

```bash
cat package.json | grep -E "(zustand|expo-sqlite)"
```

Expected: 両方とも `dependencies` に含まれる。

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(setup): add Zustand and expo-sqlite dependencies"
```

---

### Task 6: Install react-native-ios-alarmkit (Expo config plugin)

**Files:**
- Modify: `app.json`, `package.json`

- [ ] **Step 1: Install AlarmKit wrapper and Nitro modules peer dep**

```bash
npx expo install react-native-ios-alarmkit react-native-nitro-modules
```

- [ ] **Step 2: Add config plugin to `app.json`**

`app.json` の `expo` 配下に `plugins` 配列を追加（既に存在する場合は要素を追加）：

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      "expo-sqlite",
      "react-native-ios-alarmkit"
    ]
  }
}
```

- [ ] **Step 3: Verify install**

```bash
cat package.json | grep -E "(alarmkit|nitro)"
```

Expected: 両方 `dependencies` に存在。

- [ ] **Step 4: Commit**

```bash
git add app.json package.json package-lock.json
git commit -m "chore(setup): add react-native-ios-alarmkit config plugin"
```

---

### Task 7: Create directory structure for Domain / Repository / Scheduler

**Files:**
- Create: `src/domain/.gitkeep`, `src/repository/.gitkeep`, `src/scheduler/.gitkeep`, `tests/.gitkeep`

- [ ] **Step 1: Create empty directories**

```bash
mkdir -p src/domain src/repository/db src/scheduler tests/domain tests/repository
touch src/domain/.gitkeep src/repository/.gitkeep src/scheduler/.gitkeep tests/.gitkeep
```

- [ ] **Step 2: Update tsconfig path aliases**

`tsconfig.json` を読んで、`compilerOptions` に以下を追加：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 3: Commit**

```bash
git add tsconfig.json src/ tests/
git commit -m "chore(setup): create directory structure and path aliases"
```

---

### Task 8: Configure EAS Build with development profile

**Files:**
- Create: `eas.json`

- [ ] **Step 1: Install EAS CLI globally if not present**

```bash
which eas || npm install -g eas-cli
eas --version
```

Expected: `eas-cli` のバージョン番号が表示される。

- [ ] **Step 2: Initialize EAS project**

```bash
eas init
```

このコマンドは Expo アカウントへのログインと、プロジェクト ID の付与を行う。`app.json` に `extra.eas.projectId` が自動で追加される。

- [ ] **Step 3: Create `eas.json`**

```json
{
  "cli": {
    "version": ">= 7.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": false,
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

`appVersionSource: "remote"` は EAS 側でビルド番号を採番させる設定。

- [ ] **Step 4: Commit**

```bash
git add eas.json app.json
git commit -m "chore(setup): configure EAS Build with development profile"
```

---

### Task 9: Run first development build on iOS

**Files:** なし（外部ビルド）

- [ ] **Step 1: Build iOS development client**

```bash
eas build --profile development --platform ios
```

iOS 実機が必要なので、初回は Apple Developer 証明書設定で対話プロンプトが出る。EAS が自動で provisioning profile を発行・管理する設定にする。

- [ ] **Step 2: Install build on iOS device**

ビルド完了後、表示される QR コードを実機で読み取り、`.ipa` をインストール。

- [ ] **Step 3: Run dev server and connect to device**

```bash
npx expo start --dev-client
```

表示された URL に実機でアクセス（同じ QR コードでもOK）。

- [ ] **Step 4: Verify app launches and NativeWind styles render**

実機で「Alert App – Phase 0」がオレンジ色（`text-accent`）で黒背景に表示されること。

- [ ] **Step 5: Commit any auto-generated EAS metadata**

```bash
git status
```

新規ファイル（`credentials.json` 等）があればステージして commit。なければスキップ。

```bash
git commit -m "chore(setup): iOS development build verified" --allow-empty
```

---

### Task 10: Run first development build on Android

**Files:** なし（外部ビルド）

- [ ] **Step 1: Build Android development client**

```bash
eas build --profile development --platform android
```

- [ ] **Step 2: Install APK on Android device**

ビルド完了後、表示される URL から `.apk` をダウンロードして実機にインストール。USB デバッグ経由なら：

```bash
adb install <download-path>.apk
```

- [ ] **Step 3: Run dev server and connect**

すでに iOS 用に dev server が動いていなければ：

```bash
npx expo start --dev-client
```

- [ ] **Step 4: Verify app launches on Android**

Android 実機で「Alert App – Phase 0」が表示されること。

- [ ] **Step 5: Empty commit to mark Phase 0 complete**

```bash
git commit -m "chore(setup): Phase 0 complete – iOS and Android dev builds verified" --allow-empty
```

---

## Phase 1: Domain Layer

### Task 11: Configure Jest with jest-expo preset

**Files:**
- Create: `jest.config.js`, `jest.setup.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Jest and testing dependencies**

```bash
npx expo install jest-expo jest @types/jest --dev
npm install --save-dev @testing-library/react-native ts-jest better-sqlite3 @types/better-sqlite3
```

- [ ] **Step 2: Create `jest.config.js`**

```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-clone-referenced-element|@react-native-community|expo-modules-core|@unimodules/.*|sentry-expo|native-base|react-native-svg))',
  ],
};
```

- [ ] **Step 3: Create `jest.setup.ts`**

```ts
// Reserved for future setup (e.g., global mocks). Currently empty but required.
```

- [ ] **Step 4: Add test script to package.json**

`package.json` の `scripts` を更新：

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

- [ ] **Step 5: Create a smoke test to verify Jest runs**

`tests/smoke.test.ts`:

```ts
describe('Jest smoke test', () => {
  test('arithmetic works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run tests and verify pass**

```bash
npm test
```

Expected: 1 test passed。

- [ ] **Step 7: Commit**

```bash
git add jest.config.js jest.setup.ts package.json package-lock.json tests/smoke.test.ts
git commit -m "chore(setup): configure Jest with jest-expo preset"
```

---

### Task 12: Define Alarm domain types

**Files:**
- Create: `src/domain/types.ts`

- [ ] **Step 1: Create `src/domain/types.ts`**

```ts
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const ALL_WEEKDAYS: ReadonlyArray<Weekday> = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

export type SoundId = 'classic' | 'chime' | 'gentle' | 'urgent' | 'default';

export const ALL_SOUND_IDS: ReadonlyArray<SoundId> = [
  'classic',
  'chime',
  'gentle',
  'urgent',
  'default',
];

export interface Alarm {
  id: string;
  label: string;
  hour: number;
  minute: number;
  weekdays: ReadonlyArray<Weekday>;
  enabled: boolean;
  snoozeEnabled: boolean;
  soundId: SoundId;
  createdAt: number;
  updatedAt: number;
}

export interface AlarmInput {
  label: string;
  hour: number;
  minute: number;
  weekdays: ReadonlyArray<Weekday>;
  enabled: boolean;
  snoozeEnabled: boolean;
  soundId: SoundId;
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat(domain): define Alarm and Weekday types"
```

---

### Task 13: Implement nextOccurrence (TDD)

**Files:**
- Create: `tests/domain/nextOccurrence.test.ts`, `src/domain/nextOccurrence.ts`

- [ ] **Step 1: Write the failing tests**

`tests/domain/nextOccurrence.test.ts`:

```ts
import { nextOccurrence } from '@/domain/nextOccurrence';
import type { Alarm } from '@/domain/types';

const baseAlarm: Omit<Alarm, 'hour' | 'minute' | 'weekdays' | 'id'> = {
  label: 'Test',
  enabled: true,
  snoozeEnabled: false,
  soundId: 'default',
  createdAt: 0,
  updatedAt: 0,
};

const makeAlarm = (overrides: Partial<Alarm>): Alarm => ({
  id: 'a1',
  hour: 7,
  minute: 0,
  weekdays: [],
  ...baseAlarm,
  ...overrides,
});

describe('nextOccurrence', () => {
  describe('single occurrence (no weekdays)', () => {
    test('returns null when target time has already passed today', () => {
      const now = new Date('2026-05-07T10:00:00');
      const alarm = makeAlarm({ hour: 7, minute: 0, weekdays: [] });
      expect(nextOccurrence(alarm, now)).toBeNull();
    });

    test('returns today at target time when target is in the future', () => {
      const now = new Date('2026-05-07T06:00:00');
      const alarm = makeAlarm({ hour: 7, minute: 30, weekdays: [] });
      const expected = new Date('2026-05-07T07:30:00');
      expect(nextOccurrence(alarm, now)?.getTime()).toBe(expected.getTime());
    });

    test('returns target time when now equals target', () => {
      const now = new Date('2026-05-07T07:00:00.000');
      const alarm = makeAlarm({ hour: 7, minute: 0, weekdays: [] });
      const result = nextOccurrence(alarm, now);
      expect(result?.getTime()).toBe(now.getTime());
    });
  });

  describe('daily repeat (all weekdays)', () => {
    test('returns today at target time when target is in the future', () => {
      const now = new Date('2026-05-07T06:00:00');
      const alarm = makeAlarm({
        hour: 7,
        minute: 0,
        weekdays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      });
      const expected = new Date('2026-05-07T07:00:00');
      expect(nextOccurrence(alarm, now)?.getTime()).toBe(expected.getTime());
    });

    test('returns tomorrow when target time has passed today', () => {
      const now = new Date('2026-05-07T08:00:00');
      const alarm = makeAlarm({
        hour: 7,
        minute: 0,
        weekdays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      });
      const expected = new Date('2026-05-08T07:00:00');
      expect(nextOccurrence(alarm, now)?.getTime()).toBe(expected.getTime());
    });
  });

  describe('weekday filter', () => {
    test('weekdays mon-fri, called Sunday returns Monday', () => {
      const now = new Date('2026-05-10T10:00:00');
      const alarm = makeAlarm({
        hour: 7,
        minute: 0,
        weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      });
      const result = nextOccurrence(alarm, now);
      expect(result?.getDay()).toBe(1);
      expect(result?.getDate()).toBe(11);
    });

    test('weekdays sat-sun, called Monday returns Saturday', () => {
      const now = new Date('2026-05-04T10:00:00');
      const alarm = makeAlarm({ hour: 7, minute: 0, weekdays: ['sat', 'sun'] });
      const result = nextOccurrence(alarm, now);
      expect(result?.getDay()).toBe(6);
      expect(result?.getDate()).toBe(9);
    });

    test('weekday today but time has passed returns next valid weekday', () => {
      const now = new Date('2026-05-08T08:00:00');
      const alarm = makeAlarm({ hour: 7, minute: 0, weekdays: ['mon', 'fri'] });
      const result = nextOccurrence(alarm, now);
      expect(result?.getDay()).toBe(1);
      expect(result?.getDate()).toBe(11);
    });
  });

  describe('disabled alarm', () => {
    test('returns null when alarm.enabled is false', () => {
      const now = new Date('2026-05-07T06:00:00');
      const alarm = makeAlarm({ hour: 7, minute: 0, weekdays: [], enabled: false });
      expect(nextOccurrence(alarm, now)).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test -- tests/domain/nextOccurrence.test.ts
```

Expected: FAIL — `nextOccurrence` がモジュール解決できない。

- [ ] **Step 3: Implement `nextOccurrence`**

`src/domain/nextOccurrence.ts`:

```ts
import type { Alarm, Weekday } from '@/domain/types';

const WEEKDAY_INDEX: Record<Weekday, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const setTime = (date: Date, hour: number, minute: number): Date => {
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export function nextOccurrence(alarm: Alarm, now: Date): Date | null {
  if (!alarm.enabled) return null;

  const targetToday = setTime(now, alarm.hour, alarm.minute);

  if (alarm.weekdays.length === 0) {
    return targetToday.getTime() >= now.getTime() ? targetToday : null;
  }

  const validIndices = new Set(alarm.weekdays.map((w) => WEEKDAY_INDEX[w]));

  for (let offset = 0; offset < 8; offset++) {
    const candidate = setTime(addDays(now, offset), alarm.hour, alarm.minute);
    const isValidWeekday = validIndices.has(candidate.getDay());
    const isFuture = candidate.getTime() >= now.getTime();
    if (isValidWeekday && isFuture) return candidate;
  }

  return null;
}
```

- [ ] **Step 4: Run the tests and verify all pass**

```bash
npm test -- tests/domain/nextOccurrence.test.ts
```

Expected: 全 9 テスト緑。

- [ ] **Step 5: Commit**

```bash
git add tests/domain/nextOccurrence.test.ts src/domain/nextOccurrence.ts
git commit -m "feat(domain): implement nextOccurrence with weekday repeat support"
```

---

### Task 14: Implement validation (TDD)

**Files:**
- Create: `tests/domain/validation.test.ts`, `src/domain/validation.ts`

- [ ] **Step 1: Write the failing tests**

`tests/domain/validation.test.ts`:

```ts
import { validateAlarmInput } from '@/domain/validation';
import type { AlarmInput } from '@/domain/types';

const validInput: AlarmInput = {
  label: 'Wake up',
  hour: 7,
  minute: 0,
  weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  enabled: true,
  snoozeEnabled: true,
  soundId: 'classic',
};

describe('validateAlarmInput', () => {
  test('returns ok for valid input', () => {
    const result = validateAlarmInput(validInput);
    expect(result.ok).toBe(true);
  });

  test('rejects hour below 0', () => {
    const result = validateAlarmInput({ ...validInput, hour: -1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('hour');
  });

  test('rejects hour above 23', () => {
    const result = validateAlarmInput({ ...validInput, hour: 24 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('hour');
  });

  test('rejects minute below 0', () => {
    const result = validateAlarmInput({ ...validInput, minute: -1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('minute');
  });

  test('rejects minute above 59', () => {
    const result = validateAlarmInput({ ...validInput, minute: 60 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('minute');
  });

  test('rejects non-integer hour or minute', () => {
    const result = validateAlarmInput({ ...validInput, hour: 7.5 });
    expect(result.ok).toBe(false);
  });

  test('accepts empty label', () => {
    const result = validateAlarmInput({ ...validInput, label: '' });
    expect(result.ok).toBe(true);
  });

  test('rejects label longer than 100 characters', () => {
    const longLabel = 'a'.repeat(101);
    const result = validateAlarmInput({ ...validInput, label: longLabel });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('label');
  });

  test('accepts empty weekdays (single occurrence)', () => {
    const result = validateAlarmInput({ ...validInput, weekdays: [] });
    expect(result.ok).toBe(true);
  });

  test('rejects duplicate weekdays', () => {
    const result = validateAlarmInput({
      ...validInput,
      weekdays: ['mon', 'mon', 'tue'] as AlarmInput['weekdays'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('weekdays');
  });

  test('rejects unknown soundId', () => {
    const result = validateAlarmInput({
      ...validInput,
      soundId: 'nonexistent' as AlarmInput['soundId'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('soundId');
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm test -- tests/domain/validation.test.ts
```

Expected: FAIL — モジュール解決失敗。

- [ ] **Step 3: Implement validation**

`src/domain/validation.ts`:

```ts
import { ALL_SOUND_IDS, ALL_WEEKDAYS } from '@/domain/types';
import type { AlarmInput } from '@/domain/types';

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

const isInteger = (n: number): boolean => Number.isInteger(n);

export function validateAlarmInput(input: AlarmInput): ValidationResult {
  const errors: string[] = [];

  if (!isInteger(input.hour) || input.hour < 0 || input.hour > 23) {
    errors.push('hour');
  }

  if (!isInteger(input.minute) || input.minute < 0 || input.minute > 59) {
    errors.push('minute');
  }

  if (input.label.length > 100) {
    errors.push('label');
  }

  const weekdaySet = new Set(input.weekdays);
  if (weekdaySet.size !== input.weekdays.length) {
    errors.push('weekdays');
  }

  for (const w of input.weekdays) {
    if (!ALL_WEEKDAYS.includes(w)) {
      if (!errors.includes('weekdays')) errors.push('weekdays');
    }
  }

  if (!ALL_SOUND_IDS.includes(input.soundId)) {
    errors.push('soundId');
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
```

- [ ] **Step 4: Run tests and verify all pass**

```bash
npm test -- tests/domain/validation.test.ts
```

Expected: 全 11 テスト緑。

- [ ] **Step 5: Commit**

```bash
git add tests/domain/validation.test.ts src/domain/validation.ts
git commit -m "feat(domain): implement AlarmInput validation"
```

---

## Phase 1: Repository Layer

### Task 15: Define DbAdapter interface

**Files:**
- Create: `src/repository/db/DbAdapter.ts`

- [ ] **Step 1: Define the adapter interface**

`src/repository/db/DbAdapter.ts`:

```ts
export interface DbAdapter {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: ReadonlyArray<unknown>): Promise<void>;
  getAllAsync<T>(sql: string, params: ReadonlyArray<unknown>): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: ReadonlyArray<unknown>): Promise<T | null>;
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 3: Commit**

```bash
git add src/repository/db/DbAdapter.ts
git commit -m "feat(repo): define DbAdapter interface"
```

---

### Task 16: Implement ExpoSqliteAdapter and BetterSqliteAdapter

**Files:**
- Create: `src/repository/db/ExpoSqliteAdapter.ts`, `src/repository/db/BetterSqliteAdapter.ts`

- [ ] **Step 1: Implement ExpoSqliteAdapter (production runtime)**

`src/repository/db/ExpoSqliteAdapter.ts`:

```ts
import * as SQLite from 'expo-sqlite';
import type { DbAdapter } from '@/repository/db/DbAdapter';

export class ExpoSqliteAdapter implements DbAdapter {
  private constructor(private readonly db: SQLite.SQLiteDatabase) {}

  static async open(databaseName: string): Promise<ExpoSqliteAdapter> {
    const db = await SQLite.openDatabaseAsync(databaseName);
    return new ExpoSqliteAdapter(db);
  }

  async execAsync(sql: string): Promise<void> {
    await this.db.execAsync(sql);
  }

  async runAsync(sql: string, params: ReadonlyArray<unknown>): Promise<void> {
    await this.db.runAsync(sql, params as unknown[]);
  }

  async getAllAsync<T>(sql: string, params: ReadonlyArray<unknown>): Promise<T[]> {
    return this.db.getAllAsync<T>(sql, params as unknown[]);
  }

  async getFirstAsync<T>(sql: string, params: ReadonlyArray<unknown>): Promise<T | null> {
    const result = await this.db.getFirstAsync<T>(sql, params as unknown[]);
    return result ?? null;
  }
}
```

- [ ] **Step 2: Implement BetterSqliteAdapter (test-only)**

`src/repository/db/BetterSqliteAdapter.ts`:

```ts
import Database from 'better-sqlite3';
import type { DbAdapter } from '@/repository/db/DbAdapter';

export class BetterSqliteAdapter implements DbAdapter {
  private readonly db: Database.Database;

  constructor(filePath: string = ':memory:') {
    this.db = new Database(filePath);
  }

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async runAsync(sql: string, params: ReadonlyArray<unknown>): Promise<void> {
    this.db.prepare(sql).run(...(params as unknown[]));
  }

  async getAllAsync<T>(sql: string, params: ReadonlyArray<unknown>): Promise<T[]> {
    return this.db.prepare(sql).all(...(params as unknown[])) as T[];
  }

  async getFirstAsync<T>(sql: string, params: ReadonlyArray<unknown>): Promise<T | null> {
    const result = this.db.prepare(sql).get(...(params as unknown[]));
    return (result ?? null) as T | null;
  }

  close(): void {
    this.db.close();
  }
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 4: Commit**

```bash
git add src/repository/db/ExpoSqliteAdapter.ts src/repository/db/BetterSqliteAdapter.ts
git commit -m "feat(repo): implement ExpoSqlite and BetterSqlite adapters"
```

---

### Task 17: Define schema and migration

**Files:**
- Create: `src/repository/schema.ts`

- [ ] **Step 1: Define schema SQL and migration runner**

`src/repository/schema.ts`:

```ts
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
```

設計メモ：
- `weekdays` は CSV 文字列で保存（例: `'mon,tue,wed'`、空配列は空文字列）。SQLite で配列型を扱うのが面倒なため、ここでは単純化を選ぶ
- `enabled` / `snooze_enabled` は SQLite の真偽値慣習に従い `0` / `1` 整数で保存
- `created_at` / `updated_at` は UNIX ミリ秒の整数

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 3: Commit**

```bash
git add src/repository/schema.ts
git commit -m "feat(repo): define alarms table schema"
```

---

### Task 18: Implement Alarm <-> row mapper (TDD)

**Files:**
- Create: `tests/repository/alarmMapper.test.ts`, `src/repository/alarmMapper.ts`

- [ ] **Step 1: Write failing tests**

`tests/repository/alarmMapper.test.ts`:

```ts
import { alarmToRow, rowToAlarm } from '@/repository/alarmMapper';
import type { Alarm } from '@/domain/types';

const sampleAlarm: Alarm = {
  id: 'a1',
  label: 'Wake up',
  hour: 7,
  minute: 30,
  weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  enabled: true,
  snoozeEnabled: false,
  soundId: 'classic',
  createdAt: 1715000000000,
  updatedAt: 1715000000000,
};

describe('alarmToRow', () => {
  test('serializes weekdays as comma-separated string', () => {
    const row = alarmToRow(sampleAlarm);
    expect(row.weekdays).toBe('mon,tue,wed,thu,fri');
  });

  test('serializes empty weekdays as empty string', () => {
    const row = alarmToRow({ ...sampleAlarm, weekdays: [] });
    expect(row.weekdays).toBe('');
  });

  test('serializes booleans as 0/1', () => {
    const row = alarmToRow({ ...sampleAlarm, enabled: true, snoozeEnabled: false });
    expect(row.enabled).toBe(1);
    expect(row.snooze_enabled).toBe(0);
  });

  test('preserves all numeric fields', () => {
    const row = alarmToRow(sampleAlarm);
    expect(row.id).toBe('a1');
    expect(row.label).toBe('Wake up');
    expect(row.hour).toBe(7);
    expect(row.minute).toBe(30);
    expect(row.sound_id).toBe('classic');
    expect(row.created_at).toBe(1715000000000);
    expect(row.updated_at).toBe(1715000000000);
  });
});

describe('rowToAlarm', () => {
  test('parses weekdays from comma-separated string', () => {
    const alarm = rowToAlarm({
      id: 'a1',
      label: 'Wake up',
      hour: 7,
      minute: 30,
      weekdays: 'mon,tue,wed',
      enabled: 1,
      snooze_enabled: 0,
      sound_id: 'classic',
      created_at: 1715000000000,
      updated_at: 1715000000000,
    });
    expect(alarm.weekdays).toEqual(['mon', 'tue', 'wed']);
  });

  test('parses empty weekdays string as empty array', () => {
    const alarm = rowToAlarm({
      id: 'a1',
      label: 'Wake up',
      hour: 7,
      minute: 30,
      weekdays: '',
      enabled: 1,
      snooze_enabled: 0,
      sound_id: 'classic',
      created_at: 1715000000000,
      updated_at: 1715000000000,
    });
    expect(alarm.weekdays).toEqual([]);
  });

  test('parses booleans from 0/1', () => {
    const alarm = rowToAlarm({
      id: 'a1',
      label: 'Wake up',
      hour: 7,
      minute: 30,
      weekdays: '',
      enabled: 1,
      snooze_enabled: 0,
      sound_id: 'classic',
      created_at: 1715000000000,
      updated_at: 1715000000000,
    });
    expect(alarm.enabled).toBe(true);
    expect(alarm.snoozeEnabled).toBe(false);
  });
});

describe('round-trip', () => {
  test('alarm -> row -> alarm preserves all fields', () => {
    const row = alarmToRow(sampleAlarm);
    const restored = rowToAlarm(row);
    expect(restored).toEqual(sampleAlarm);
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm test -- tests/repository/alarmMapper.test.ts
```

Expected: FAIL — モジュール解決失敗。

- [ ] **Step 3: Implement the mapper**

`src/repository/alarmMapper.ts`:

```ts
import type { Alarm, SoundId, Weekday } from '@/domain/types';

export interface AlarmRow {
  id: string;
  label: string;
  hour: number;
  minute: number;
  weekdays: string;
  enabled: number;
  snooze_enabled: number;
  sound_id: string;
  created_at: number;
  updated_at: number;
}

export function alarmToRow(alarm: Alarm): AlarmRow {
  return {
    id: alarm.id,
    label: alarm.label,
    hour: alarm.hour,
    minute: alarm.minute,
    weekdays: alarm.weekdays.join(','),
    enabled: alarm.enabled ? 1 : 0,
    snooze_enabled: alarm.snoozeEnabled ? 1 : 0,
    sound_id: alarm.soundId,
    created_at: alarm.createdAt,
    updated_at: alarm.updatedAt,
  };
}

export function rowToAlarm(row: AlarmRow): Alarm {
  const weekdays =
    row.weekdays === '' ? [] : (row.weekdays.split(',') as Weekday[]);
  return {
    id: row.id,
    label: row.label,
    hour: row.hour,
    minute: row.minute,
    weekdays,
    enabled: row.enabled === 1,
    snoozeEnabled: row.snooze_enabled === 1,
    soundId: row.sound_id as SoundId,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

- [ ] **Step 4: Run tests and verify all pass**

```bash
npm test -- tests/repository/alarmMapper.test.ts
```

Expected: 全 8 テスト緑。

- [ ] **Step 5: Commit**

```bash
git add tests/repository/alarmMapper.test.ts src/repository/alarmMapper.ts
git commit -m "feat(repo): implement Alarm <-> row mapper"
```

---

### Task 19: Implement AlarmRepository CRUD against real SQLite (TDD)

**Files:**
- Create: `tests/repository/alarmRepository.test.ts`, `src/repository/alarmRepository.ts`

- [ ] **Step 1: Write failing tests using BetterSqliteAdapter**

`tests/repository/alarmRepository.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm test -- tests/repository/alarmRepository.test.ts
```

Expected: FAIL — `AlarmRepository` がモジュール解決できない。

- [ ] **Step 3: Implement AlarmRepository**

`src/repository/alarmRepository.ts`:

```ts
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
```

- [ ] **Step 4: Run tests and verify all pass**

```bash
npm test -- tests/repository/alarmRepository.test.ts
```

Expected: 全 9 テスト緑。

- [ ] **Step 5: Commit**

```bash
git add tests/repository/alarmRepository.test.ts src/repository/alarmRepository.ts
git commit -m "feat(repo): implement AlarmRepository CRUD with real SQLite tests"
```

---

### Task 20: Define AlarmScheduler interface (contract for Plan 2)

**Files:**
- Create: `src/scheduler/AlarmScheduler.ts`

- [ ] **Step 1: Define the scheduler interface**

`src/scheduler/AlarmScheduler.ts`:

```ts
import type { Alarm } from '@/domain/types';

export interface ScheduledAlarmInfo {
  id: string;
  state: 'scheduled' | 'alerting' | 'snoozed' | 'unknown';
}

export interface AlarmScheduler {
  isAvailable(): Promise<boolean>;

  requestAuthorization(): Promise<'authorized' | 'denied' | 'notDetermined'>;

  schedule(alarm: Alarm): Promise<void>;

  cancel(id: string): Promise<void>;

  listScheduled(): Promise<ScheduledAlarmInfo[]>;
}
```

設計メモ：
- Plan 2 で iOS 用と Android 用の実装を作る
- `listScheduled` は起動時 sync で「Native 層に何が残っているか」を確認するのに使う
- `isAvailable` は iOS 25 以下や、Android で必要権限が無い場合に false を返す

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 3: Commit**

```bash
git add src/scheduler/AlarmScheduler.ts
git commit -m "feat(scheduler): define AlarmScheduler interface for Plan 2"
```

---

### Task 21: Final verification and Phase 1 completion

**Files:** なし（検証のみ）

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: 全テスト緑（smoke 1 + nextOccurrence 9 + validation 11 + alarmMapper 8 + alarmRepository 9 = 38 テスト）。

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
ls -la src/domain src/repository src/repository/db src/scheduler tests/domain tests/repository
```

Expected: File Structure セクションに記載した全ファイルが存在する。

- [ ] **Step 5: Empty commit to mark Plan 1 complete and tag**

```bash
git commit -m "chore(milestone): Plan 1 complete – Foundation + Domain + Repository" --allow-empty
git tag plan-1-complete
```

- [ ] **Step 6: Confirm with user before proceeding to Plan 2**

Plan 1 完了。Plan 2（iOS AlarmKit + Android Native Module）に進むかユーザー確認。

---

## Plan 1 Completion Criteria

以下が全て満たされていること：

- [x] Expo SDK 55 プロジェクトが New Architecture 有効で起動する
- [x] iOS 実機 / Android 実機で `eas build --profile development` でビルドし、起動できる
- [x] NativeWind v4 がスタイリングを反映する
- [x] `expo-sqlite` / `react-native-ios-alarmkit` がインストール済みで、`app.json` に正しく宣言されている
- [x] `src/domain/` に Alarm 型・nextOccurrence・validation が実装され、ユニットテスト全緑
- [x] `src/repository/` に DbAdapter / ExpoSqliteAdapter / BetterSqliteAdapter / schema / mapper / AlarmRepository が実装され、real SQLite (`better-sqlite3`) に対するテスト全緑
- [x] `src/scheduler/AlarmScheduler.ts` interface が定義済み
- [x] `npm run lint`, `npm run typecheck`, `npm test` の3コマンドが全てクリーンに通る

---

## Notes for Plan 2

Plan 2 (Phase 2-3: iOS AlarmKit + Android Native Module) で必要になる前提：

- `AlarmScheduler` interface に準拠した `IosScheduler` (using `react-native-ios-alarmkit`) と `AndroidScheduler` (using 自前 Expo Module) を実装する
- `Platform.OS` 分岐で適切な実装を返すファクトリを `src/scheduler/index.ts` に作る（例: `getScheduler()`）
- Android Native Module は `modules/alarm-android/` に新規作成する（Plan 2 で詳細設計）
- 起動時 sync (`AlarmRepository.list()` ⇄ `scheduler.listScheduled()`) は Plan 3 で実装する
