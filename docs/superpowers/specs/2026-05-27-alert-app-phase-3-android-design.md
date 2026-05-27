# Alert App – Phase 3: Android Native Module 設計

**Goal:** iOS（Plan 2 完了）と同等の信頼性で「止めるまで鳴り続ける目覚ましアラーム」を Android で実現する。AlarmManager + Foreground Service + FullScreenIntent + MediaPlayer の組み合わせを自前 Expo Module（Kotlin）で実装し、Pixel 実機で Silent / DnD / アプリ kill / 端末再起動を貫通させる。

**Scope:** iOS feature parity（追加・編集・削除・スヌーズ・曜日繰り返し・kill 貫通・ロック画面アラート・boot 復活）。OEM 端末（Xiaomi / Samsung 等）のバッテリー最適化対応は Plan 5 へ繰越。

**Tech Stack 追加:** Kotlin Expo Module（local module）/ Android AlarmManager API / Foreground Service (`FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK`) / FullScreenIntent / SharedPreferences

**前提:**

- Plan 2 完了済み（iOS AlarmKit 統合 + 全 UI + alarmStore + DI 経路）
- Pixel 実機（OEM バッテリー最適化問題ゼロ）
- Android dev build (`npx expo run:android --device`) は Plan 3 Step 0 で初回起動確認する（Plan 0 task 10 で未消化）
- `expo-modules-core` は Expo SDK 55 に同梱済み

**spec の参照:** `docs/superpowers/specs/2026-05-07-alert-app-design.md` の section 5.1 / 8.3 / 9 / 11.5

---

## 1. アーキテクチャ

### 1.1 レイヤー俯瞰

```
UI 層 (既存 / 変更ゼロ)
  alarmStore  →  scheduler.schedule(alarm)
                          │
                          ▼
TS Bridge 層 (Plan 3 で新規)
  src/scheduler/androidScheduler.ts
    ├ requireNativeModule('AlarmAndroid')
    ├ addListener('onAlarmStateChanged', ...)
    └ AlarmScheduler interface (Plan 1) を満たす
                          │
                          ▼
Local Expo Module (Plan 3 で新規) modules/alarm-android/
  AlarmAndroidModule.kt   — JS 窓口 (AsyncFunction 4 個 + Events 1 個)
  AlarmScheduler.kt        — AlarmManager 操作と次回発火時刻計算
  AlarmReceiver.kt         — BroadcastReceiver、Service と Activity を起動
  AlarmService.kt          — Foreground Service + MediaPlayer ループ
  AlarmActivity.kt         — FullScreenIntent でロック画面ジャック
  BootReceiver.kt          — RECEIVE_BOOT_COMPLETED で全再登録
  AlarmStorage.kt          — SharedPreferences ミラー (BootReceiver 用)
  PermissionHelper.kt      — 3 つの runtime perm 要求
```

### 1.2 クラスごとの責務

| クラス | 責務 | 依存 |
|---|---|---|
| `AlarmAndroidModule` | Expo Module 定義。`schedule` / `cancel` / `list` / `requestPermissions` の 4 AsyncFunction と `onAlarmStateChanged` Event を公開 | AlarmScheduler, PermissionHelper |
| `AlarmScheduler` | `AlarmManager.setAlarmClock` 呼び出し、曜日繰り返しの次回発火時刻計算、AlarmStorage への永続化 | AlarmManager, AlarmStorage |
| `AlarmReceiver` | 時刻到来で OS から呼ばれる `BroadcastReceiver`。`AlarmService` 起動 + `AlarmActivity` を FullScreenIntent で起動。曜日繰り返しなら次回発火を即予約 | AlarmService, AlarmActivity, AlarmScheduler |
| `AlarmService` | `FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK` の Service。`MediaPlayer` で `raw/alarm.mp3` をループ。Stop / Snooze Intent で自己停止 | MediaPlayer |
| `AlarmActivity` | フルスクリーン Activity。ロック画面の上にデカ Stop / Snooze ボタン 2 つ | AlarmService（Intent 経由） |
| `BootReceiver` | `RECEIVE_BOOT_COMPLETED` で起動。AlarmStorage 全件を再 schedule | AlarmStorage, AlarmScheduler |
| `AlarmStorage` | SharedPreferences ベース。JSON 1 entry per key | SharedPreferences |
| `PermissionHelper` | exact alarm / notifications / full screen intent の状態取得と要求 | Context, ActivityCompat |

### 1.3 重要な技術判断

#### AlarmManager API: `setAlarmClock` 採用
`setAlarmClock(AlarmClockInfo, PendingIntent)` は Doze mode を貫通し、ステータスバーに「次のアラーム」アイコンを表示し、OS から「ユーザーが意図したアラーム」として扱われる。目覚ましアプリには第一選択。`setExactAndAllowWhileIdle` は通知向けで本用途には不適。（**未確認：実装着手時に Android Developers 公式ドキュメントで `setAlarmClock` の Doze 貫通挙動を再確認すること**）

#### Foreground Service Type: `FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK`
Android 14 (API 34) から Service には `foregroundServiceType` 必須。MediaPlayback で宣言すれば AudioFocus も自然に取れる。manifest と `startForeground()` の両方で type を一致させる必要あり。

#### Notification Channel: `IMPORTANCE_HIGH` + `setBypassDnd(true)` + `AudioAttributes.USAGE_ALARM`
Silent mode / Do Not Disturb を貫通させるための明示宣言。iOS の AlarmKit が OS レベルで保証することを、Android では Channel 属性で表現する。channel は app 初回起動時に 1 度だけ作成。

#### AlarmStorage を SharedPreferences で実装する理由
`BootReceiver` は JS runtime が起動する前に走るので `expo-sqlite` を読めない。SharedPreferences なら純 Android で読める。**SQLite が真実、SharedPreferences はそのミラー**で、保存/削除のたびに同期する。spec 5.2 の「SQLite を真実のソースとする」原則の唯一の例外。

---

## 2. データフロー

### 2.1 Flow 1: 新規アラーム作成 → schedule

```
[UI] 編集モーダル「保存」
   ▼
alarmStore.addAlarm(input)              (既存)
   ├ alarmRepository.save(alarm)         ← SQLite (真実)
   ├ scheduler.schedule(alarm)
   │   └ AndroidScheduler.schedule       (新規)
   │       └ Native.schedule(...)        ← Kotlin AsyncFunction
   │           ├ AlarmScheduler.computeNextTrigger(now, hour, min, weekdays)
   │           ├ AlarmStorage.put(id, AlarmEntry)   ← SharedPreferences ミラー
   │           └ AlarmManager.setAlarmClock(triggerMs, PendingIntent → AlarmReceiver)
   ├ store 更新
[一覧画面] 再描画
```

`Native.schedule` が throw したら既存の alarmStore ロールバック経路（Plan 2 の `addAlarm` catch 節）で repository 行を `enabled: false` に戻す。

### 2.2 Flow 2: アラーム発火（時刻到来）

```
時刻到来
   ▼
OS が PendingIntent を発射
   ▼
AlarmReceiver.onReceive(intent {id})
   ├ AlarmStorage.get(id) → AlarmEntry
   ├ Context.startForegroundService(AlarmService, EXTRA_ID=id)
   │   └ AlarmService.onStartCommand
   │       ├ startForeground(notif with FullScreenIntent → AlarmActivity)
   │       └ MediaPlayer.start() loop=true, audioAttrs.USAGE_ALARM
   └ entry.weekdays.isNotEmpty() なら
       AlarmScheduler.scheduleNextOccurrence(id)  ← すぐ次の発火を予約
                       │
   ▼
OS が FullScreenIntent
   ▼
AlarmActivity 起動 → ロック画面の上にフル画面
   ▼
Module.sendEvent('onAlarmStateChanged', {id, state: 'fired'})
```

#### 設計判断
- **「次回の schedule をいつ呼ぶか」** = `Receiver` の中で即座に。AlarmManager は単発しか登録できないので、曜日繰り返しは「鳴った瞬間に次の発火を予約する」自前ループ
- **iOS との非対称** = iOS は AlarmKit が weekdays を一括管理してくれる。Android は毎発火ごとに次を予約

### 2.3 Flow 3: Stop 押下

```
[AlarmActivity] Stop ボタンタップ
   ▼
Activity → Service に STOP intent
   ▼
AlarmService.onStartCommand(action=STOP)
   ├ MediaPlayer.stop() + release()
   ├ stopForeground(STOP_FOREGROUND_REMOVE)
   └ stopSelf()
   ▼
Activity.finishAndRemoveTask()
   ▼
Module.sendEvent('onAlarmStateChanged', {id, state: 'stopped'})
```

### 2.4 Flow 4: Snooze 押下

```
[AlarmActivity] Snooze ボタンタップ
   ▼
Activity → Service に SNOOZE intent (id)
   ▼
AlarmService:
   ├ MediaPlayer.stop() + release() + stopForeground + stopSelf
   └ AlarmScheduler.scheduleOneShot(id, System.currentTimeMillis() + 540_000L)
       └ AlarmManager.setAlarmClock(triggerMs, PendingIntent → AlarmReceiver)
   ▼
9 分後 → Flow 2 再発火
   ▼
Module.sendEvent('onAlarmStateChanged', {id, state: 'snoozed'})
```

iOS と数値そろえる: `SNOOZE_DURATION_MS = 540_000L`（9 分、`iosScheduler.ts` の `SNOOZE_DURATION_SECONDS = 540` と一致）。

### 2.5 Flow 5: 端末再起動からの復活

```
端末再起動
   ▼
OS が ACTION_BOOT_COMPLETED broadcast
   ▼
BootReceiver.onReceive(context, intent)
   ├ AlarmStorage.getAll() → List<AlarmEntry>
   └ entries.forEach { AlarmScheduler.schedule(it) }
       └ AlarmManager.setAlarmClock(...)
```

JS runtime 不要。SharedPreferences から直接読んで純 Kotlin で再登録する。その後ユーザーがアプリを開いた時、`alarmStore.loadAlarms()` が SQLite と整合する。

### 2.6 Flow 6: cancel / トグル OFF

```
alarmStore.toggleAlarm(id, false)         (既存)
   └ scheduler.cancel(id)
       └ Native.cancel(id)
           ├ AlarmManager.cancel(PendingIntent for id)
           └ AlarmStorage.remove(id)
```

---

## 3. Bridge スキーマ

### 3.1 TS 側

```ts
// src/scheduler/androidScheduler.ts
import { requireNativeModule, NativeModule } from 'expo';
import type { AlarmScheduler, ScheduledAlarmInfo } from '@/scheduler/AlarmScheduler';
import type { Alarm, Weekday } from '@/domain/types';

type AlarmAndroidEvents = {
  onAlarmStateChanged(event: { id: string; state: 'fired' | 'stopped' | 'snoozed' }): void;
};

interface AlarmAndroidNativeModule extends NativeModule<AlarmAndroidEvents> {
  schedule(input: {
    id: string;
    hour: number;
    minute: number;
    weekdays: number[];      // ISO-8601: 1=Mon..7=Sun
    label: string;
    snoozeEnabled: boolean;
  }): Promise<void>;
  cancel(id: string): Promise<void>;
  list(): Promise<{ id: string; nextTriggerAt: number }[]>;
  requestPermissions(): Promise<{
    exactAlarm: boolean;
    notifications: boolean;
    fullScreenIntent: boolean;
  }>;
}

const Native = requireNativeModule<AlarmAndroidNativeModule>('AlarmAndroid');

const WEEKDAY_TO_ISO: Record<Weekday, number> = {
  mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7,
};

export class AndroidScheduler implements AlarmScheduler {
  async isAvailable(): Promise<boolean> { /* Platform.OS check は createScheduler 側 */ return true; }
  async requestAuthorization(): Promise<'authorized' | 'denied' | 'notDetermined'> { ... }
  async schedule(alarm: Alarm): Promise<void> { ... }
  async cancel(id: string): Promise<void> { ... }
  async listScheduled(): Promise<ScheduledAlarmInfo[]> { ... }
}
```

`createScheduler.ts` の分岐を 1 行追加：

```ts
if (Platform.OS === 'android') return new AndroidScheduler();
```

### 3.2 Kotlin 側

```kotlin
class AlarmAndroidModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AlarmAndroid")
    Events("onAlarmStateChanged")

    AsyncFunction("schedule") { id: String, hour: Int, minute: Int,
                                weekdays: List<Int>, label: String,
                                snoozeEnabled: Boolean ->
      AlarmScheduler(context).schedule(
        AlarmEntry(id, hour, minute, weekdays, label, snoozeEnabled)
      )
    }
    AsyncFunction("cancel") { id: String ->
      AlarmScheduler(context).cancel(id)
    }
    AsyncFunction("list") {
      AlarmScheduler(context).list()
    }
    AsyncFunction("requestPermissions") {
      PermissionHelper.request(context, currentActivity)
    }
  }

  private val context get() = requireNotNull(appContext.reactContext)
  private val currentActivity get() = appContext.activityProvider?.currentActivity
}
```

`Events` + `sendEvent` パターンは `AlarmService` / `AlarmActivity` から `Module` を直接参照できないため、**SharedFlow を 1 つ用意して Module は flow を購読、Service / Activity は flow に emit** という間接構造にする（Module は singleton 寿命じゃないが、SharedFlow は Application スコープで生存）。

---

## 4. AlarmStorage 設計

```kotlin
@Serializable
data class AlarmEntry(
  val id: String,
  val hour: Int,
  val minute: Int,
  val weekdays: List<Int>,     // ISO-8601: 1=Mon..7=Sun
  val label: String,
  val snoozeEnabled: Boolean,
)

class AlarmStorage(context: Context) {
  private val prefs = context.getSharedPreferences(
    context.packageName + ".alarms", Context.MODE_PRIVATE)

  fun put(entry: AlarmEntry) {
    prefs.edit().putString(entry.id, Json.encodeToString(entry)).commit()
  }
  fun get(id: String): AlarmEntry? = prefs.getString(id, null)?.let { Json.decodeFromString(it) }
  fun remove(id: String) = prefs.edit().remove(id).commit()
  fun getAll(): List<AlarmEntry> = prefs.all.values.filterIsInstance<String>()
    .mapNotNull { runCatching { Json.decodeFromString<AlarmEntry>(it) }.getOrNull() }
}
```

`.commit()` を `.apply()` の代わりに使う理由: schedule 直後に AlarmManager 登録するため同期書き込みが必要。

---

## 5. 権限フロー

### 5.1 必要な権限

| 権限 | API | manifest 宣言 | runtime 要求 |
|---|---|---|---|
| `SCHEDULE_EXACT_ALARM` | 31+ | `<uses-permission>` | system settings deep link（`ACTION_REQUEST_SCHEDULE_EXACT_ALARM`） |
| `POST_NOTIFICATIONS` | 33+ | `<uses-permission>` | `ActivityCompat.requestPermissions` |
| `USE_FULL_SCREEN_INTENT` | 14+ | `<uses-permission>` | API 34+ は app settings 確認のみ |
| `FOREGROUND_SERVICE` | 28+ | `<uses-permission>` | runtime 不要 |
| `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | 34+ | `<uses-permission>` | runtime 不要 |
| `RECEIVE_BOOT_COMPLETED` | 26+ | `<uses-permission>` | runtime 不要 |
| `WAKE_LOCK` | 26+ | `<uses-permission>` | runtime 不要 |

manifest 宣言は **`expo-build-properties` 経由 or 自前 config plugin** で `app.json` から流し込む。自前 config plugin の方が宣言が一箇所にまとまるので推奨。

### 5.2 要求タイミング

- **アプリ初回起動時**: `_layout.tsx` の startup effect で `Native.requestPermissions()` を 1 呼び出し。Kotlin 側の `PermissionHelper` は内部で順次処理する：
  1. `POST_NOTIFICATIONS` を `ActivityCompat.requestPermissions` で要求し、callback を suspend で待つ
  2. `USE_FULL_SCREEN_INTENT` の状態を取得（API 34+ はチェックのみ、要求 API なし）
  3. `SCHEDULE_EXACT_ALARM` が未許可なら system settings Intent を launch（ユーザーが戻ってくるまでは pending）
  4. 3 つの結果を集約して JS に返す
- **deep link 戻り検知**: ユーザーが SCHEDULE_EXACT_ALARM の system settings 画面で許可してアプリに戻ってきた時、`AppState.addEventListener('change')` で `background → active` を検知して `requestPermissions` を再 fetch
- **保存ボタン押下時**: schedule 失敗で `EXACT_ALARM_DENIED` を catch したら再要求モーダル

### 5.3 拒否時の挙動

- `SCHEDULE_EXACT_ALARM` 拒否 → 保存ボタンブロック + バナー（iOS と同じ UX）
- `POST_NOTIFICATIONS` 拒否 → アラームは鳴るが通知は非表示で進行
- `USE_FULL_SCREEN_INTENT` 拒否（API 34+） → ヒーズアップ通知に降格、音は鳴る

---

## 6. エラーハンドリング

### 6.1 TS 側

```ts
try {
  await scheduler.schedule(alarm);
} catch (e) {
  if (e instanceof Error && 'code' in e) {
    // code: 'EXACT_ALARM_DENIED' | 'SERVICE_FAILED' | 'INVALID_TIME'
    showToast(messageFor((e as { code: string }).code));
  }
  await alarmRepository.delete(alarm.id);  // ロールバック
  throw e;
}
```

### 6.2 Kotlin 側

```kotlin
class AlarmAndroidException(code: String, message: String)
  : CodedException(code, message, null)

// 用法
if (!alarmManager.canScheduleExactAlarms()) {
  throw AlarmAndroidException("EXACT_ALARM_DENIED",
    "SCHEDULE_EXACT_ALARM permission not granted")
}
```

Expo Modules の `CodedException` は JS 側で `.code` プロパティとして受け取れる。iOS の `AlarmKitError` と扱いを揃える。

### 6.3 エッジケース

| ケース | 対応 |
|---|---|
| 過去時刻に schedule（曜日繰り返し無し） | `INVALID_TIME` throw |
| 既存 id で再 schedule | 既存 PendingIntent を cancel してから新規登録 |
| MediaPlayer が音源 load 失敗 | catch して system default ringtone にフォールバック |
| `startForegroundService` 失敗 (Service Restrictions) | catch、AlarmActivity 単独起動（音無しでも画面は出る） |
| 同時刻に複数アラーム | request code を `id.hashCode()` で分けて PendingIntent 衝突回避 |

---

## 7. テスト戦略

### 7.1 自動テスト（Jest）

| 対象 | カバー範囲 |
|---|---|
| `androidScheduler.ts` (TS Bridge) | Native module を mock して schedule/cancel/list 呼び出しと weekday 変換をテスト（iOS と同じパターン、10〜15 テスト想定） |
| `createScheduler.ts` | Platform.OS === 'android' で AndroidScheduler が返ることを追加（1 テスト） |
| `alarmStore.ts` 統合 | 既存 integration test で AndroidScheduler モックを使う。interface 経由なので追加変更ゼロ想定 |

### 7.2 Kotlin 側は書かない

spec 10.5「テストしないもの」準拠。Robolectric や Espresso は導入しない。手動 E2E で代替。

### 7.3 手動 E2E チェックリスト（Pixel 実機）

- [ ] **基本発火**: 2 分後にアラーム設定 → アプリ kill → 鳴る
- [ ] **Silent mode 貫通**: マナーモード → アラーム鳴る
- [ ] **Do Not Disturb 貫通**: DnD 有効 → アラーム鳴る
- [ ] **ロック画面**: 画面ロック状態 → AlarmActivity が全面表示
- [ ] **Stop ボタン**: タップで音停止 + 画面閉じる
- [ ] **Snooze ボタン**: タップで止まる → 9 分後に再発火
- [ ] **曜日繰り返し**: 月曜のみ設定 → 火曜に鳴らない / 翌月曜に鳴る
- [ ] **複数アラーム**: 同時刻に 2 つ → 両方鳴る
- [ ] **トグル OFF**: 一覧でトグル OFF → 時刻来ても鳴らない
- [ ] **削除**: 削除 → 時刻来ても鳴らない
- [ ] **アプリ再起動**: kill → 再開 → 一覧に表示される（Plan 2 の async race bug 退行確認）
- [ ] **端末再起動**: 端末再起動 → BootReceiver が再登録 → 鳴る
- [ ] **権限拒否 → 許可**: 初回 deny → system settings で許可 → アプリ戻り → schedule できる

---

## 8. Done 基準

1. **コード品質**: TypeScript typecheck/lint 0 errors、Jest 全 PASS（Plan 2 の 82 + Plan 3 で +10〜15 程度想定 = 92〜97）
2. **ビルド**: `npx expo run:android --device` が Pixel 実機で起動
3. **手動 E2E**: 上記 13 項目を全 ✅
4. **iOS 退行ゼロ**: Plan 2 で動いてた iOS 機能が壊れてないことを最後に再確認
5. **コミット**: `chore(milestone): Plan 3 complete – Android Native Module end-to-end` で空コミット + `plan-3-complete` タグ

---

## 9. 実装ステップ（Plan 化の素材）

```
Step 0: Android dev build 起動確認（Plan 0 task 10 回収）       — 1 commit
Step 1: Local Expo Module 雛形生成 + app.json 連携             — 2 commits
Step 2: AlarmManager 疎通（log 出るだけ）                       — 2 commits
Step 3: AlarmStorage (SharedPreferences)                       — 2 commits
Step 4: AlarmService + MediaPlayer ループ                       — 2 commits
Step 5: AlarmActivity (FullScreenIntent)                        — 2 commits
Step 6: AlarmReceiver で Service と Activity を起動             — 1 commit
Step 7: Stop/Snooze の Activity → Service intent 連携           — 2 commits
Step 8: 曜日繰り返し（Receiver で次回再登録）                   — 1 commit
Step 9: BootReceiver                                            — 1 commit
Step 10: PermissionHelper（exact alarm / notif / FSI）          — 2 commits
Step 11: AlarmAndroidModule の AsyncFunction 公開 + Events     — 2 commits
Step 12: AndroidScheduler.ts + createScheduler.ts 分岐 + Jest  — 3 commits
Step 13: iOS との parity 確認（lint/typecheck/test 全緑）       — 1 commit
Step 14: 手動 E2E チェック                                       — 1 commit (empty)
Step 15: マイルストーンコミット + tag                            — 1 commit (empty)

合計 26 commits 前後想定（Plan 2 が 24 commits）
```

---

## 10. リスクと対処

| リスク | 影響度 | 対処 |
|---|---|---|
| Step 0 で Android dev build が壊れている | 高 | Step 0 で発覚させる、build error 解消が Plan 3 の本実装より優先 |
| Foreground Service Restrictions で Service 起動失敗 | 中 | `setForegroundServiceType` 明示、API 34+ の制限事項を実装前に再確認 |
| FullScreenIntent が API 34+ で limited | 中 | manifest 宣言 + USAGE_ALARM の組み合わせで多くのケースで通る前提だが、Pixel で実機確認 |
| BootReceiver が呼ばれない（一部端末で broadcast 制限） | 中 | Pixel では通常通る。OEM 端末は Plan 5 で対応 |
| AlarmManager + PendingIntent の id 衝突 | 低 | request code を `id.hashCode()` で分ける |
| MediaPlayer が一定時間後に OS から殺される | 中 | Foreground Service の永続化通知で生存維持、`setWakeMode(PARTIAL_WAKE_LOCK)` 併用 |
| Plan 2 の async singleton race bug が Android でも顕在化 | 低 | Plan 2 で fix 済み (`beb179e`)、E2E で「kill → 再開で一覧表示」を確認 |

---

## 11. Plan 4 へのバトン

Plan 4 以降で必要になりうる項目（Plan 3 では着手しない）：

- **OEM バッテリー最適化対応** (Xiaomi / Samsung / OPPO / Vivo / Huawei): `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` + 端末別 FAQ。spec 9.2 参照
- **音源選択機能**: `soundId` を両 OS で実装、`raw/` に 3〜5 個 bundle
- **音量・バイブ設定画面**: spec 7.1 の設定モーダル
- **次回アラームまでの残り時間表示**: spec 2.2 で「不要」と確定済みなので扱わない
- **Maestro E2E スクリプト**: spec 10.4 のシナリオ自動化
- **CI で Android Build** (GitHub Actions + EAS): Plan 0 のスコープ
- **TestFlight / Play 内部テスト配布**: ユーザーの ADP 加入待ち（memory: user_ios_beginner）

---

## 12. 用語

| 用語 | 説明 |
|---|---|
| AlarmManager | Android OS の時刻トリガー API |
| `setAlarmClock` | AlarmManager のメソッド。「ユーザーが意図したアラーム」として Doze 貫通 |
| Foreground Service | Android で「ユーザーに見える形で」継続実行する Service。永続化通知必須 |
| FullScreenIntent | 通知到達時にロック画面を覆ってフルスクリーン UI を表示する仕組み |
| Doze mode | Android の省電力モード。多くのバックグラウンド処理を制限 |
| `setBypassDnd` | Notification Channel のフラグ。Do Not Disturb を貫通させる |
| `USAGE_ALARM` | `AudioAttributes` の usage 値。アラーム音として OS に認識させる |
| `CodedException` | Expo Modules の Exception 基底クラス。code フィールド付き |
| SharedPreferences | Android の軽量永続化 KV ストア。`MODE_PRIVATE` でアプリ専用 |
| Local Expo Module | `modules/<name>/` 配下に置く、配布不要のアプリ内 native module |
