# Alert App – Phase 3: Android Native Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iOS（Plan 2 完了）と同等の信頼性で「止めるまで鳴り続ける目覚ましアラーム」を Android (Pixel) で動かす。AlarmManager + Foreground Service + FullScreenIntent + MediaPlayer の組み合わせを Kotlin local Expo Module で実装し、Silent / DnD / アプリ kill / 端末再起動を貫通させる。

**Architecture:** 3 層構造（既存）の Native 層を Android 側で実装。`src/scheduler/androidScheduler.ts` が Native module を呼ぶだけの薄い TS Bridge、`modules/alarm-android/` の Kotlin が本体。UI 層と alarmStore は変更ゼロ（`AlarmScheduler` interface 経由で動く）。

**Tech Stack:** Kotlin (Expo Modules DSL) / Android AlarmManager (`setAlarmClock`) / Foreground Service (`FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK`) / FullScreenIntent / kotlinx.serialization / SharedPreferences

**spec の参照:** `docs/superpowers/specs/2026-05-27-alert-app-phase-3-android-design.md`

**前提:**

- Plan 2 完了済み（iOS AlarmKit MVP / `plan-2-complete` タグ）
- 検証端末: Google Pixel
- `npx expo run:android --device` は一度も動かしてない → Task 1 で初回起動確認
- Node 20+ / Expo SDK 55 / Pixel が USB デバッグで接続済み

---

## File Structure (Phase 3 終了時点)

```
alert-app/
├── app.json                                       # Modified: Task 4 (permissions)
│
├── modules/                                       # Created: Task 2
│   └── alarm-android/                             # Local Expo Module
│       ├── expo-module.config.json                # Created: Task 2
│       ├── package.json                           # Created: Task 2
│       ├── android/
│       │   ├── build.gradle                       # Modified: Task 5 (kotlinx.serialization)
│       │   └── src/main/
│       │       ├── AndroidManifest.xml            # Modified: Tasks 7, 8, 9, 11, 13
│       │       ├── res/raw/alarm.mp3              # Created: Task 3
│       │       └── java/expo/modules/alarmandroid/
│       │           ├── Constants.kt               # Created: Task 5
│       │           ├── AlarmEntry.kt              # Created: Task 5
│       │           ├── AlarmStorage.kt            # Created: Task 5
│       │           ├── AlarmScheduler.kt          # Created: Task 6, Modified: Tasks 11, 12
│       │           ├── AlarmReceiver.kt           # Created: Task 7, Modified: Tasks 10, 11, 12
│       │           ├── AlarmService.kt            # Created: Task 8, Modified: Task 11
│       │           ├── AlarmActivity.kt           # Created: Task 9, Modified: Task 11
│       │           ├── AlarmEvents.kt             # Created: Task 10 (SharedFlow singleton)
│       │           ├── BootReceiver.kt            # Created: Task 13
│       │           ├── PermissionHelper.kt        # Created: Task 14
│       │           └── AlarmAndroidModule.kt      # Created: Task 15 (replaces stub)
│       ├── ios/                                   # Generated stub (unused)
│       └── src/                                   # Generated TS index (unused)
│
├── src/
│   ├── scheduler/
│   │   ├── AlarmScheduler.ts                      # (Existing)
│   │   ├── iosScheduler.ts                        # (Existing)
│   │   └── androidScheduler.ts                    # Created: Task 16
│   │
│   ├── services/
│   │   └── createScheduler.ts                     # Modified: Task 17
│   │
│   ├── stores/
│   │   └── alarmStore.ts                          # Modified: Task 18 (permissionStatus action)
│   │
│   └── app/
│       └── _layout.tsx                            # Modified: Task 18 (AppState listener)
│
└── tests/
    ├── scheduler/
    │   └── androidScheduler.test.ts               # Created: Task 16
    └── services/
        └── createScheduler.test.ts                # Modified: Task 17
```

---

## Task 1: Verify Android dev build launches on Pixel (Step 0)

**Files:** なし（外部ビルド）

Plan 0 task 10 で Android dev build を一度も起動してない宿題を回収する。素の Plan 2 完了状態のアプリが Pixel で起動することを確認してから native module を足していく。

- [ ] **Step 1: Connect Pixel via USB and verify adb sees it**

Run:
```bash
adb devices
```

Expected: Pixel のシリアル番号が表示される（`<id>  device`）。出ない場合は Pixel の USB デバッグを有効化（設定 → 開発者向けオプション → USB デバッグ ON）してから再実行。

- [ ] **Step 2: Run the Expo Android dev build**

Run:
```bash
npx expo run:android --device
```

Expected: 初回は 5〜15 分かかる。Gradle build が走り、Pixel に `alert-app` がインストールされる。Metro bundler が立ち上がり、アプリが起動して空の alarm list 画面（Plan 2 で実装済み）が表示される。

- [ ] **Step 3: Verify UI flows work end-to-end on Android**

Pixel 実機で：
- アラーム新規追加（時刻 / ラベル / 曜日選択）→ 一覧に表示
- アラームトグル ON/OFF
- アラーム編集 / 削除

Expected: UI は iOS と同じ挙動。ただし保存後にアラームは **鳴らない**（現状 `NoopScheduler` のため）。一覧表示・編集・削除は問題なく動く。

- [ ] **Step 4: Empty commit to mark Plan 3 baseline**

```bash
git commit --allow-empty -m "chore(android): verify Pixel dev build baseline before Plan 3 work"
```

---

## Task 2: Generate local Expo Module skeleton

**Files:**
- Create: `modules/alarm-android/` (生成)

`create-expo-module --local` で Kotlin / Swift / TS 雛形をまとめて作る。iOS 側は使わないが stub を残しておく（消すと auto-linking がエラーになる可能性あり）。

- [ ] **Step 1: Generate the local module**

Run:
```bash
npx create-expo-module@latest --local alarm-android
```

Prompts に対して：
- **Name of the npm package:** `alarm-android` (default)
- **Initial module name:** `AlarmAndroid`
- **Description:** `Android native alarm scheduler module`
- **Repository URL:** （空でも OK）
- **Author:** `kotaro1574`
- **License:** `MIT`

Expected: `modules/alarm-android/` が生成される。生成完了メッセージで「Successfully created module」が出る。

- [ ] **Step 2: Inspect generated structure**

Run:
```bash
ls -la modules/alarm-android/
ls -la modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/
```

Expected: 以下が存在：
- `expo-module.config.json` (autolinking 用)
- `package.json` (local npm 用)
- `android/build.gradle`
- `android/src/main/AndroidManifest.xml`
- `android/src/main/java/expo/modules/alarmandroid/AlarmAndroidModule.kt`
- `ios/AlarmAndroidModule.swift` (stub、放置)
- `src/AlarmAndroid.ts` (stub、放置)

- [ ] **Step 3: Verify Android dev build still works with the new module**

Run:
```bash
npx expo run:android --device
```

Expected: Gradle が `modules/alarm-android` を発見してビルドし、アプリが起動する。Metro が再起動。新しい module は今は何もしない（生成された stub の `hello` 関数があるだけ）。

- [ ] **Step 4: Commit**

```bash
git add modules/alarm-android/ package.json package-lock.json
git commit -m "chore(android): scaffold local Expo Module alarm-android with create-expo-module"
```

---

## Task 3: Bundle the alarm sound asset

**Files:**
- Create: `modules/alarm-android/android/src/main/res/raw/alarm.mp3`

Android では `res/raw/` 配下に置いた音源を `R.raw.alarm` で `MediaPlayer.create()` から参照できる。**ファイル名は小文字英数とアンダースコアのみ**（`alarm.mp3` OK、`Alarm.mp3` NG、`alarm-1.mp3` NG）。

- [ ] **Step 1: Source an alarm sound**

開発期間中の暫定として、システムから取得：
```bash
# macOS の場合、適当な短いアラーム音 (3〜10 秒) を準備
# 例: フリー素材サイトから "alarm clock loop" 系の mp3 をダウンロード
# OR /System/Library/Sounds/ から Glass.aiff を変換
ffmpeg -i /System/Library/Sounds/Glass.aiff -t 3 -ar 44100 -b:a 128k /tmp/alarm.mp3
# ffmpeg が無ければ ffmpeg をインストール: brew install ffmpeg
```

ライセンス的に問題ないファイル（自前録音、CC0、または購入素材）を最終的には差し替える前提。

- [ ] **Step 2: Place file in res/raw/**

```bash
mkdir -p modules/alarm-android/android/src/main/res/raw
cp /tmp/alarm.mp3 modules/alarm-android/android/src/main/res/raw/alarm.mp3
ls -la modules/alarm-android/android/src/main/res/raw/alarm.mp3
```

Expected: ファイルが存在し数十 KB 〜 数百 KB のサイズ。

- [ ] **Step 3: Commit**

```bash
git add modules/alarm-android/android/src/main/res/raw/alarm.mp3
git commit -m "chore(android): bundle placeholder alarm.mp3 in module res/raw"
```

---

## Task 4: Declare Android permissions in app.json

**Files:**
- Modify: `app.json`

Manifest permissions は `expo prebuild` 時に `app.json` から AndroidManifest にマージされる。`<receiver>` / `<service>` / `<activity>` の宣言は local module の `AndroidManifest.xml` で行う（後続タスクで追加）。

- [ ] **Step 1: Add permissions to app.json**

`app.json` の `expo.android.permissions` を空配列から以下に変更：

```json
"permissions": [
  "android.permission.SCHEDULE_EXACT_ALARM",
  "android.permission.USE_EXACT_ALARM",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.USE_FULL_SCREEN_INTENT",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
  "android.permission.RECEIVE_BOOT_COMPLETED",
  "android.permission.WAKE_LOCK"
]
```

Note: `USE_EXACT_ALARM` は Google Play でアラームアプリ用途向けに認められている権限（`SCHEDULE_EXACT_ALARM` のユーザー許可フローを bypass できる）。両方宣言しておけば、Pixel 実機のテスト中はどちらかが効く。

- [ ] **Step 2: Run expo prebuild to verify permissions land in AndroidManifest**

Run:
```bash
npx expo prebuild --platform android --clean
grep -E "SCHEDULE_EXACT|FOREGROUND_SERVICE|FULL_SCREEN|BOOT_COMPLETED" android/app/src/main/AndroidManifest.xml
```

Expected: 全 8 権限が `<uses-permission android:name="...">` として出力される。

注意: prebuild は `android/` ディレクトリを再生成する。次回 `expo run:android` は再ビルドが走るが、設定としては正しい。

- [ ] **Step 3: Run the Android dev build to verify permissions are baked in**

Run:
```bash
npx expo run:android --device
```

Expected: ビルド成功 + アプリ起動。権限はまだ要求していないので UI 上は変化なし。

Run（オプション）:
```bash
adb shell dumpsys package com.kotaro1574.alertapp | grep "permission"
```

Expected: 上記 8 権限が package definition に含まれる。

- [ ] **Step 4: Commit**

```bash
git add app.json
git commit -m "feat(android): declare alarm-related permissions in app.json"
```

---

## Task 5: Constants, AlarmEntry, AlarmStorage (SharedPreferences)

**Files:**
- Create: `modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/Constants.kt`
- Create: `modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmEntry.kt`
- Create: `modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmStorage.kt`
- Modify: `modules/alarm-android/android/build.gradle`

`AlarmStorage` は BootReceiver からも使うので、最初に作って後続タスクで共有する。SharedPreferences ベース、kotlinx.serialization で JSON 化。

- [ ] **Step 1: Add kotlinx.serialization to module gradle**

`modules/alarm-android/android/build.gradle` を開き、`plugins` ブロックと `dependencies` ブロックを編集：

```gradle
plugins {
  id 'com.android.library'
  id 'kotlin-android'
  id 'org.jetbrains.kotlin.plugin.serialization' version '1.9.25'
}

// ... 既存のブロック ...

dependencies {
  // 既存の dependencies はそのまま
  implementation 'org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3'
}
```

- [ ] **Step 2: Create Constants.kt**

`modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/Constants.kt`:

```kotlin
package expo.modules.alarmandroid

object Constants {
  const val PREFS_NAME_SUFFIX = ".alarms"
  const val NOTIFICATION_CHANNEL_ID = "alarm_channel"
  const val NOTIFICATION_CHANNEL_NAME = "Alarms"
  const val ONGOING_NOTIFICATION_ID = 42
  const val SNOOZE_DURATION_MS = 540_000L  // 9 minutes (matches iosScheduler.ts)

  // Receiver intent actions
  const val ACTION_ALARM_FIRE = "expo.modules.alarmandroid.FIRE"
  const val EXTRA_ALARM_ID = "alarm_id"

  // Service intent actions
  const val ACTION_SERVICE_STOP = "expo.modules.alarmandroid.STOP"
  const val ACTION_SERVICE_SNOOZE = "expo.modules.alarmandroid.SNOOZE"
}
```

- [ ] **Step 3: Create AlarmEntry.kt**

`modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmEntry.kt`:

```kotlin
package expo.modules.alarmandroid

import kotlinx.serialization.Serializable

@Serializable
data class AlarmEntry(
  val id: String,
  val hour: Int,
  val minute: Int,
  val weekdays: List<Int>,  // ISO-8601: 1=Mon..7=Sun, empty = one-shot
  val label: String,
  val snoozeEnabled: Boolean,
)
```

- [ ] **Step 4: Create AlarmStorage.kt**

`modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmStorage.kt`:

```kotlin
package expo.modules.alarmandroid

import android.content.Context
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class AlarmStorage(context: Context) {
  private val prefs = context.getSharedPreferences(
    context.packageName + Constants.PREFS_NAME_SUFFIX,
    Context.MODE_PRIVATE
  )

  fun put(entry: AlarmEntry) {
    prefs.edit().putString(entry.id, Json.encodeToString(entry)).commit()
  }

  fun get(id: String): AlarmEntry? {
    val raw = prefs.getString(id, null) ?: return null
    return runCatching { Json.decodeFromString<AlarmEntry>(raw) }.getOrNull()
  }

  fun remove(id: String) {
    prefs.edit().remove(id).commit()
  }

  fun getAll(): List<AlarmEntry> {
    return prefs.all.values.filterIsInstance<String>().mapNotNull {
      runCatching { Json.decodeFromString<AlarmEntry>(it) }.getOrNull()
    }
  }
}
```

- [ ] **Step 5: Verify the module still compiles**

Run:
```bash
npx expo run:android --device
```

Expected: Gradle build 成功（kotlinx.serialization plugin が解決され、AlarmStorage がコンパイルされる）。アプリ起動。UI は変化なし。

- [ ] **Step 6: Commit**

```bash
git add modules/alarm-android/android/build.gradle modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/
git commit -m "feat(android): add AlarmStorage with SharedPreferences and kotlinx.serialization"
```

---

## Task 6: AlarmScheduler.kt (AlarmManager wrapper, log-only first)

**Files:**
- Create: `modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmScheduler.kt`

このタスクでは AlarmManager に登録するロジックだけ用意し、発火時の処理は Task 7 の AlarmReceiver で受ける。`computeNextTrigger` の純粋ロジックも含む。

- [ ] **Step 1: Create AlarmScheduler.kt**

`modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmScheduler.kt`:

```kotlin
package expo.modules.alarmandroid

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.util.Calendar

class AlarmScheduler(private val context: Context) {
  private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
  private val storage = AlarmStorage(context)

  fun schedule(entry: AlarmEntry) {
    storage.put(entry)
    val triggerAt = computeNextTrigger(System.currentTimeMillis(), entry)
    val pendingIntent = buildPendingIntent(entry.id)
    val showIntent = buildShowIntent()
    alarmManager.setAlarmClock(
      AlarmManager.AlarmClockInfo(triggerAt, showIntent),
      pendingIntent
    )
  }

  fun scheduleOneShot(id: String, triggerAt: Long) {
    val pendingIntent = buildPendingIntent(id)
    val showIntent = buildShowIntent()
    alarmManager.setAlarmClock(
      AlarmManager.AlarmClockInfo(triggerAt, showIntent),
      pendingIntent
    )
  }

  fun cancel(id: String) {
    val pendingIntent = buildPendingIntent(id)
    alarmManager.cancel(pendingIntent)
    storage.remove(id)
  }

  fun list(): List<Map<String, Any>> {
    return storage.getAll().map {
      mapOf("id" to it.id, "nextTriggerAt" to computeNextTrigger(System.currentTimeMillis(), it))
    }
  }

  private fun buildPendingIntent(id: String): PendingIntent {
    val intent = Intent(context, AlarmReceiver::class.java).apply {
      action = Constants.ACTION_ALARM_FIRE
      putExtra(Constants.EXTRA_ALARM_ID, id)
    }
    return PendingIntent.getBroadcast(
      context,
      id.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun buildShowIntent(): PendingIntent {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    return PendingIntent.getActivity(
      context,
      0,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  companion object {
    fun computeNextTrigger(now: Long, entry: AlarmEntry): Long {
      val cal = Calendar.getInstance().apply {
        timeInMillis = now
        set(Calendar.HOUR_OF_DAY, entry.hour)
        set(Calendar.MINUTE, entry.minute)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      if (entry.weekdays.isEmpty()) {
        if (cal.timeInMillis <= now) cal.add(Calendar.DAY_OF_YEAR, 1)
        return cal.timeInMillis
      }
      val isoWeekdays = entry.weekdays.toSet()
      repeat(8) { offset ->
        val candidate = Calendar.getInstance().apply {
          timeInMillis = cal.timeInMillis
          add(Calendar.DAY_OF_YEAR, offset)
        }
        val iso = ((candidate.get(Calendar.DAY_OF_WEEK) + 5) % 7) + 1
        if (iso in isoWeekdays && candidate.timeInMillis > now) return candidate.timeInMillis
      }
      return cal.timeInMillis
    }
  }
}
```

Note:
- `setAlarmClock` は Doze mode を貫通する。ステータスバーに「次のアラーム」アイコンが出る。
- `Calendar.DAY_OF_WEEK` は `SUNDAY=1, MONDAY=2 ...` なので ISO-8601 (`MONDAY=1 ... SUNDAY=7`) に変換する式が `((dow + 5) % 7) + 1`。
- `PendingIntent.FLAG_IMMUTABLE` は API 31+ で必須。
- `AlarmReceiver` クラスはまだ存在しないが、参照だけしておく（Task 7 で作成）。

- [ ] **Step 2: Verify build (will fail until AlarmReceiver exists)**

Run:
```bash
cd android && ./gradlew :alarm-android:compileDebugKotlin 2>&1 | tail -20 ; cd ..
```

Expected: `Unresolved reference: AlarmReceiver` のエラー。これは Task 7 で解消する。

- [ ] **Step 3: Commit (incomplete state, intentional)**

```bash
git add modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmScheduler.kt
git commit -m "feat(android): add AlarmScheduler with setAlarmClock and computeNextTrigger"
```

---

## Task 7: AlarmReceiver minimal (log-only) + manifest registration

**Files:**
- Create: `modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmReceiver.kt`
- Modify: `modules/alarm-android/android/src/main/AndroidManifest.xml`

AlarmReceiver の最初のバージョンは「ログを出すだけ」。AlarmManager → Receiver が確実に発火することを実機で確認する。

- [ ] **Step 1: Create AlarmReceiver.kt (log-only)**

`modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmReceiver.kt`:

```kotlin
package expo.modules.alarmandroid

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra(Constants.EXTRA_ALARM_ID)
    Log.i("AlarmReceiver", "Alarm fired for id=$id action=${intent.action}")
  }
}
```

- [ ] **Step 2: Register receiver in module AndroidManifest.xml**

`modules/alarm-android/android/src/main/AndroidManifest.xml` を開く。既存内容：

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
</manifest>
```

これを以下に置き換え：

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application>
    <receiver
      android:name="expo.modules.alarmandroid.AlarmReceiver"
      android:exported="false">
      <intent-filter>
        <action android:name="expo.modules.alarmandroid.FIRE" />
      </intent-filter>
    </receiver>
  </application>
</manifest>
```

Note: `<application>` タグは存在しないと merger がエラーになる場合があるので明示する。

- [ ] **Step 3: Build and verify compile success**

Run:
```bash
npx expo run:android --device
```

Expected: Gradle build 成功（AlarmReceiver 参照解決）。アプリ起動。

- [ ] **Step 4: Trigger a smoke test manually via adb (optional but recommended)**

別ターミナルで adb logcat を開く：
```bash
adb logcat -s AlarmReceiver:I
```

そして直接 broadcast を送って Receiver が動くか確認：
```bash
adb shell am broadcast -a expo.modules.alarmandroid.FIRE -n com.kotaro1574.alertapp/expo.modules.alarmandroid.AlarmReceiver --es alarm_id "test"
```

Expected logcat: `I AlarmReceiver: Alarm fired for id=test action=expo.modules.alarmandroid.FIRE`

- [ ] **Step 5: Commit**

```bash
git add modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmReceiver.kt modules/alarm-android/android/src/main/AndroidManifest.xml
git commit -m "feat(android): add AlarmReceiver skeleton with manifest registration"
```

---

## Task 8: AlarmService (Foreground Service + MediaPlayer loop)

**Files:**
- Create: `modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmService.kt`
- Modify: `modules/alarm-android/android/src/main/AndroidManifest.xml`

このタスクでは Service だけ作って、Receiver からの起動は Task 10 で繋ぐ。`startForeground` の notification channel もここで初期化。

- [ ] **Step 1: Create AlarmService.kt**

`modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmService.kt`:

```kotlin
package expo.modules.alarmandroid

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log

class AlarmService : Service() {
  private var mediaPlayer: MediaPlayer? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var currentAlarmId: String? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val action = intent?.action
    val id = intent?.getStringExtra(Constants.EXTRA_ALARM_ID)
    Log.i("AlarmService", "onStartCommand action=$action id=$id")

    when (action) {
      Constants.ACTION_SERVICE_STOP -> {
        stopAlarm()
        return START_NOT_STICKY
      }
      Constants.ACTION_SERVICE_SNOOZE -> {
        if (id != null) snoozeAlarm(id)
        return START_NOT_STICKY
      }
      else -> {
        if (id != null) startAlarm(id)
        return START_STICKY
      }
    }
  }

  private fun startAlarm(id: String) {
    currentAlarmId = id
    val notif = buildNotification(id)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(
        Constants.ONGOING_NOTIFICATION_ID,
        notif,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
      )
    } else {
      startForeground(Constants.ONGOING_NOTIFICATION_ID, notif)
    }
    acquireWakeLock()
    playSound()
  }

  private fun stopAlarm() {
    releaseMediaPlayer()
    releaseWakeLock()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun snoozeAlarm(id: String) {
    val nextTrigger = System.currentTimeMillis() + Constants.SNOOZE_DURATION_MS
    AlarmScheduler(applicationContext).scheduleOneShot(id, nextTrigger)
    stopAlarm()
  }

  private fun playSound() {
    val soundUri: Uri = Uri.parse("android.resource://$packageName/raw/alarm")
    mediaPlayer = MediaPlayer().apply {
      try {
        setDataSource(applicationContext, soundUri)
      } catch (e: Exception) {
        Log.w("AlarmService", "Failed to load bundled sound, falling back to default", e)
        setDataSource(applicationContext, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM))
      }
      setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
      isLooping = true
      setOnPreparedListener { start() }
      prepareAsync()
    }
  }

  private fun releaseMediaPlayer() {
    mediaPlayer?.apply {
      try { if (isPlaying) stop() } catch (_: Exception) {}
      release()
    }
    mediaPlayer = null
  }

  private fun acquireWakeLock() {
    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "alarmandroid:alarm").apply {
      acquire(10 * 60 * 1000L)
    }
  }

  private fun releaseWakeLock() {
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
  }

  private fun buildNotification(id: String): Notification {
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val fullScreenIntent = PendingIntent.getActivity(
      this, 0, launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    return Notification.Builder(this, Constants.NOTIFICATION_CHANNEL_ID)
      .setContentTitle("アラーム")
      .setContentText(id)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setCategory(Notification.CATEGORY_ALARM)
      .setOngoing(true)
      .setFullScreenIntent(fullScreenIntent, true)
      .build()
  }

  private fun createNotificationChannel() {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(Constants.NOTIFICATION_CHANNEL_ID) != null) return
    val channel = NotificationChannel(
      Constants.NOTIFICATION_CHANNEL_ID,
      Constants.NOTIFICATION_CHANNEL_NAME,
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      setBypassDnd(true)
      val attrs = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
      setSound(null, attrs)  // sound played by MediaPlayer, not notification
    }
    nm.createNotificationChannel(channel)
  }

  override fun onDestroy() {
    releaseMediaPlayer()
    releaseWakeLock()
    super.onDestroy()
  }
}
```

Note:
- `FullScreenIntent` は **Task 9 の AlarmActivity が出来てから本物の Activity に差し替える**。今は launch intent を仮で渡している。
- `setBypassDnd(true)` で Do Not Disturb 貫通。
- `setSound(null, ...)` で通知音は鳴らさない（MediaPlayer 側でループ再生するため）。

- [ ] **Step 2: Register service in module AndroidManifest.xml**

`modules/alarm-android/android/src/main/AndroidManifest.xml` の `<application>` 内に追加：

```xml
<service
  android:name="expo.modules.alarmandroid.AlarmService"
  android:exported="false"
  android:foregroundServiceType="mediaPlayback" />
```

最終的な `AndroidManifest.xml`:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application>
    <receiver
      android:name="expo.modules.alarmandroid.AlarmReceiver"
      android:exported="false">
      <intent-filter>
        <action android:name="expo.modules.alarmandroid.FIRE" />
      </intent-filter>
    </receiver>
    <service
      android:name="expo.modules.alarmandroid.AlarmService"
      android:exported="false"
      android:foregroundServiceType="mediaPlayback" />
  </application>
</manifest>
```

- [ ] **Step 3: Verify build**

Run:
```bash
npx expo run:android --device
```

Expected: Gradle build 成功。アプリ起動。Service はまだ呼ばれていない。

- [ ] **Step 4: Commit**

```bash
git add modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmService.kt modules/alarm-android/android/src/main/AndroidManifest.xml
git commit -m "feat(android): add AlarmService foreground service with MediaPlayer loop"
```

---

## Task 9: AlarmActivity (FullScreenIntent target)

**Files:**
- Create: `modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmActivity.kt`
- Create: `modules/alarm-android/android/src/main/res/layout/activity_alarm.xml`
- Modify: `modules/alarm-android/android/src/main/AndroidManifest.xml`

ロック画面の上に表示される全画面 Activity。デカ Stop / Snooze ボタン 2 つ。

- [ ] **Step 1: Create activity_alarm.xml layout**

`modules/alarm-android/android/src/main/res/layout/activity_alarm.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:orientation="vertical"
  android:background="#000000"
  android:gravity="center"
  android:padding="32dp">

  <TextView
    android:id="@+id/labelText"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:text="アラーム"
    android:textColor="#FFFFFF"
    android:textSize="32sp"
    android:layout_marginBottom="64dp" />

  <Button
    android:id="@+id/stopButton"
    android:layout_width="match_parent"
    android:layout_height="80dp"
    android:text="停止"
    android:textSize="24sp"
    android:textColor="#000000"
    android:backgroundTint="#FFFFFF"
    android:layout_marginBottom="16dp" />

  <Button
    android:id="@+id/snoozeButton"
    android:layout_width="match_parent"
    android:layout_height="80dp"
    android:text="スヌーズ"
    android:textSize="24sp"
    android:textColor="#FFFFFF"
    android:backgroundTint="#444444" />
</LinearLayout>
```

- [ ] **Step 2: Create AlarmActivity.kt**

`modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmActivity.kt`:

```kotlin
package expo.modules.alarmandroid

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView

class AlarmActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
      km.requestDismissKeyguard(this, null)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
      )
    }

    setContentView(R.layout.activity_alarm)

    val id = intent.getStringExtra(Constants.EXTRA_ALARM_ID) ?: ""
    val label = intent.getStringExtra("label") ?: "アラーム"
    findViewById<TextView>(R.id.labelText).text = label

    findViewById<Button>(R.id.stopButton).setOnClickListener {
      sendToService(Constants.ACTION_SERVICE_STOP, id)
      finishAndRemoveTask()
    }
    findViewById<Button>(R.id.snoozeButton).setOnClickListener {
      sendToService(Constants.ACTION_SERVICE_SNOOZE, id)
      finishAndRemoveTask()
    }
  }

  private fun sendToService(action: String, id: String) {
    val intent = Intent(this, AlarmService::class.java).apply {
      this.action = action
      putExtra(Constants.EXTRA_ALARM_ID, id)
    }
    startService(intent)
  }
}
```

- [ ] **Step 3: Register activity in module AndroidManifest.xml**

`<application>` 内に追加：

```xml
<activity
  android:name="expo.modules.alarmandroid.AlarmActivity"
  android:exported="false"
  android:launchMode="singleInstance"
  android:showWhenLocked="true"
  android:turnScreenOn="true"
  android:excludeFromRecents="true"
  android:theme="@android:style/Theme.NoTitleBar.Fullscreen" />
```

- [ ] **Step 4: Verify build**

Run:
```bash
npx expo run:android --device
```

Expected: ビルド成功 + アプリ起動。Activity はまだトリガーされていない。

- [ ] **Step 5: Commit**

```bash
git add modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmActivity.kt modules/alarm-android/android/src/main/res/layout/activity_alarm.xml modules/alarm-android/android/src/main/AndroidManifest.xml
git commit -m "feat(android): add AlarmActivity fullscreen UI with stop/snooze buttons"
```

---

## Task 10: Wire AlarmReceiver to start Service + AlarmActivity + add AlarmEvents singleton

**Files:**
- Modify: `modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmReceiver.kt`
- Modify: `modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmService.kt`
- Create: `modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmEvents.kt`

Receiver → Service 起動 + AlarmActivity の FullScreenIntent を notification に貼り直す。`AlarmEvents` は SharedFlow singleton で Module から購読する用（Task 15 で使用）。

- [ ] **Step 1: Create AlarmEvents.kt singleton**

`modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmEvents.kt`:

```kotlin
package expo.modules.alarmandroid

import kotlinx.coroutines.flow.MutableSharedFlow

data class AlarmStateEvent(val id: String, val state: String)  // 'fired' | 'stopped' | 'snoozed'

object AlarmEvents {
  val flow = MutableSharedFlow<AlarmStateEvent>(extraBufferCapacity = 16)
}
```

- [ ] **Step 2: Update AlarmReceiver to start Service + emit event**

`modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmReceiver.kt` を以下に置き換え：

```kotlin
package expo.modules.alarmandroid

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra(Constants.EXTRA_ALARM_ID) ?: return
    Log.i("AlarmReceiver", "Alarm fired for id=$id")

    val serviceIntent = Intent(context, AlarmService::class.java).apply {
      putExtra(Constants.EXTRA_ALARM_ID, id)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(serviceIntent)
    } else {
      context.startService(serviceIntent)
    }

    AlarmEvents.flow.tryEmit(AlarmStateEvent(id, "fired"))
  }
}
```

- [ ] **Step 3: Update AlarmService notification to use real AlarmActivity FullScreenIntent**

`AlarmService.kt` の `buildNotification` を置き換え：

```kotlin
private fun buildNotification(id: String): Notification {
  val entry = AlarmStorage(this).get(id)
  val activityIntent = Intent(this, AlarmActivity::class.java).apply {
    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
    putExtra(Constants.EXTRA_ALARM_ID, id)
    putExtra("label", entry?.label ?: "アラーム")
  }
  val fullScreenIntent = PendingIntent.getActivity(
    this, id.hashCode(), activityIntent,
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
  )
  return Notification.Builder(this, Constants.NOTIFICATION_CHANNEL_ID)
    .setContentTitle("アラーム")
    .setContentText(entry?.label ?: id)
    .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
    .setCategory(Notification.CATEGORY_ALARM)
    .setOngoing(true)
    .setFullScreenIntent(fullScreenIntent, true)
    .build()
}
```

- [ ] **Step 4: Verify build**

Run:
```bash
npx expo run:android --device
```

Expected: ビルド成功 + アプリ起動。

- [ ] **Step 5: End-to-end smoke test (manual)**

別ターミナルで adb logcat：
```bash
adb logcat -s AlarmReceiver:I AlarmService:I
```

そして直接 broadcast 送信（まだ JS から schedule できないため、AlarmStorage を介さない疎通テスト）：
```bash
adb shell am broadcast -a expo.modules.alarmandroid.FIRE -n com.kotaro1574.alertapp/expo.modules.alarmandroid.AlarmReceiver --es alarm_id "smoke-test"
```

Expected logcat:
```
I AlarmReceiver: Alarm fired for id=smoke-test
I AlarmService: onStartCommand action=null id=smoke-test
```

Expected on Pixel: ロック画面でも黒背景に「アラーム / 停止 / スヌーズ」ボタンが全画面表示。音は鳴らない可能性が高い（AlarmStorage に entry がないため `playSound` まで進むが、デフォルト音にフォールバックして鳴る場合もある）。停止ボタンで Activity が閉じる。

注意: この段階では AlarmStorage に test エントリがないので `entry?.label ?: "アラーム"` のフォールバックが効く。

- [ ] **Step 6: Commit**

```bash
git add modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmEvents.kt modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmReceiver.kt modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmService.kt
git commit -m "feat(android): wire AlarmReceiver to start service and trigger fullscreen activity"
```

---

## Task 11: Add weekday repeat re-schedule on fire

**Files:**
- Modify: `modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmReceiver.kt`

Receiver 内で「曜日繰り返しなら次回をすぐ予約する」自前ループを追加。これがないと曜日繰り返しが 1 回鳴って終わってしまう。

- [ ] **Step 1: Add scheduleNextIfRepeating in AlarmReceiver**

`AlarmReceiver.kt` の `onReceive` を以下に置き換え：

```kotlin
override fun onReceive(context: Context, intent: Intent) {
  val id = intent.getStringExtra(Constants.EXTRA_ALARM_ID) ?: return
  Log.i("AlarmReceiver", "Alarm fired for id=$id")

  scheduleNextIfRepeating(context, id)

  val serviceIntent = Intent(context, AlarmService::class.java).apply {
    putExtra(Constants.EXTRA_ALARM_ID, id)
  }
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    context.startForegroundService(serviceIntent)
  } else {
    context.startService(serviceIntent)
  }

  AlarmEvents.flow.tryEmit(AlarmStateEvent(id, "fired"))
}

private fun scheduleNextIfRepeating(context: Context, id: String) {
  val storage = AlarmStorage(context)
  val entry = storage.get(id) ?: return
  if (entry.weekdays.isEmpty()) {
    // one-shot: remove from storage after firing
    storage.remove(id)
    return
  }
  // repeating: re-schedule for next occurrence
  AlarmScheduler(context).schedule(entry)
}
```

`scheduleNextIfRepeating` を AlarmReceiver クラス内の private method として追加。imports は既存のままで OK（`AlarmStorage` / `AlarmScheduler` は同パッケージ）。

- [ ] **Step 2: Verify build**

Run:
```bash
npx expo run:android --device
```

Expected: ビルド成功 + アプリ起動。

- [ ] **Step 3: Commit**

```bash
git add modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmReceiver.kt
git commit -m "feat(android): re-schedule next occurrence on fire for repeating alarms"
```

---

## Task 12: BootReceiver for restart survival

**Files:**
- Create: `modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/BootReceiver.kt`
- Modify: `modules/alarm-android/android/src/main/AndroidManifest.xml`

端末再起動後、AlarmStorage 全件を再 schedule する。JS runtime 不要で純 Kotlin 動作。

- [ ] **Step 1: Create BootReceiver.kt**

`modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/BootReceiver.kt`:

```kotlin
package expo.modules.alarmandroid

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED &&
        intent.action != Intent.ACTION_LOCKED_BOOT_COMPLETED) return
    Log.i("BootReceiver", "Boot completed, re-scheduling alarms")
    val storage = AlarmStorage(context)
    val scheduler = AlarmScheduler(context)
    storage.getAll().forEach { entry ->
      runCatching { scheduler.schedule(entry) }
        .onFailure { Log.w("BootReceiver", "Failed to re-schedule ${entry.id}", it) }
    }
  }
}
```

- [ ] **Step 2: Register BootReceiver in module AndroidManifest.xml**

`<application>` 内に追加：

```xml
<receiver
  android:name="expo.modules.alarmandroid.BootReceiver"
  android:exported="true"
  android:directBootAware="false">
  <intent-filter>
    <action android:name="android.intent.action.BOOT_COMPLETED" />
  </intent-filter>
</receiver>
```

Note: `BOOT_COMPLETED` 受信には `android:exported="true"` が必要。`RECEIVE_BOOT_COMPLETED` 権限は app.json で Task 4 にて宣言済み。

- [ ] **Step 3: Verify build**

Run:
```bash
npx expo run:android --device
```

Expected: ビルド成功 + アプリ起動。

- [ ] **Step 4: Commit**

```bash
git add modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/BootReceiver.kt modules/alarm-android/android/src/main/AndroidManifest.xml
git commit -m "feat(android): add BootReceiver to re-schedule alarms after device restart"
```

---

## Task 13: PermissionHelper (exact alarm / notifications / full screen intent)

**Files:**
- Create: `modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/PermissionHelper.kt`

3 つの runtime perm の状態取得と要求。AlarmAndroidModule (Task 15) から呼ばれる。

- [ ] **Step 1: Create PermissionHelper.kt**

`modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/PermissionHelper.kt`:

```kotlin
package expo.modules.alarmandroid

import android.Manifest
import android.app.Activity
import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

object PermissionHelper {
  private const val NOTIFICATION_REQUEST_CODE = 1042

  fun hasExactAlarm(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    return am.canScheduleExactAlarms()
  }

  fun hasNotifications(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
    return ContextCompat.checkSelfPermission(
      context, Manifest.permission.POST_NOTIFICATIONS
    ) == PackageManager.PERMISSION_GRANTED
  }

  fun hasFullScreenIntent(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    return nm.canUseFullScreenIntent()
  }

  fun requestAll(context: Context, activity: Activity?): Map<String, Boolean> {
    // 1. Notifications (runtime permission via system dialog)
    if (!hasNotifications(context) && activity != null &&
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      ActivityCompat.requestPermissions(
        activity,
        arrayOf(Manifest.permission.POST_NOTIFICATIONS),
        NOTIFICATION_REQUEST_CODE
      )
    }

    // 2. Exact alarm (deep link to system settings)
    if (!hasExactAlarm(context) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
        data = Uri.parse("package:${context.packageName}")
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
      }
      runCatching { context.startActivity(intent) }
    }

    // 3. Full screen intent (deep link to system settings, API 34+)
    if (!hasFullScreenIntent(context) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
        data = Uri.parse("package:${context.packageName}")
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
      }
      runCatching { context.startActivity(intent) }
    }

    return mapOf(
      "exactAlarm" to hasExactAlarm(context),
      "notifications" to hasNotifications(context),
      "fullScreenIntent" to hasFullScreenIntent(context),
    )
  }
}
```

Note:
- 戻り値は「要求後の現在の状態」。`SCHEDULE_EXACT_ALARM` と `FULL_SCREEN_INTENT` は system settings に飛ばすだけなので、ユーザーが戻ってくるまでは `false` のまま。再チェックは JS 側で AppState 変化検知して `requestAll` を呼び直す（Task 18）。
- API 33 未満は通知権限不要なので true を返す。
- API 31 未満は exact alarm 権限不要。
- API 34 未満は FSI 権限要求不要（manifest 宣言だけで OK）。

- [ ] **Step 2: Verify build**

Run:
```bash
npx expo run:android --device
```

Expected: ビルド成功 + アプリ起動。

- [ ] **Step 3: Commit**

```bash
git add modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/PermissionHelper.kt
git commit -m "feat(android): add PermissionHelper for exact alarm / notifications / FSI"
```

---

## Task 14: AlarmAndroidModule – AsyncFunctions + Events bridge

**Files:**
- Modify: `modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmAndroidModule.kt` (replace generated stub)

JS から呼べる 4 つの AsyncFunction と 1 つの Event を公開。

- [ ] **Step 1: Replace AlarmAndroidModule.kt with full implementation**

`modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmAndroidModule.kt` を以下に置き換え：

```kotlin
package expo.modules.alarmandroid

import androidx.core.os.bundleOf
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

class AlarmAndroidModule : Module() {
  private var eventCollectorJob: Job? = null
  private val moduleScope = CoroutineScope(Dispatchers.Main)

  override fun definition() = ModuleDefinition {
    Name("AlarmAndroid")
    Events("onAlarmStateChanged")

    OnCreate {
      eventCollectorJob = moduleScope.launch {
        AlarmEvents.flow.collect { event ->
          this@AlarmAndroidModule.sendEvent(
            "onAlarmStateChanged",
            bundleOf("id" to event.id, "state" to event.state)
          )
        }
      }
    }

    OnDestroy {
      eventCollectorJob?.cancel()
      eventCollectorJob = null
    }

    AsyncFunction("schedule") { id: String, hour: Int, minute: Int,
                                weekdays: List<Int>, label: String,
                                snoozeEnabled: Boolean ->
      val entry = AlarmEntry(id, hour, minute, weekdays, label, snoozeEnabled)
      AlarmScheduler(context).schedule(entry)
    }

    AsyncFunction("cancel") { id: String ->
      AlarmScheduler(context).cancel(id)
    }

    AsyncFunction("list") {
      AlarmScheduler(context).list()
    }

    AsyncFunction("requestPermissions") {
      PermissionHelper.requestAll(context, currentActivity)
    }
  }

  private val context get() = requireNotNull(appContext.reactContext)
  private val currentActivity get() = appContext.activityProvider?.currentActivity
}
```

Note:
- `OnCreate` / `OnDestroy` は ModuleDefinition の lifecycle callback。Module 寿命の SharedFlow 購読をここで begin/cancel する。
- `Events("onAlarmStateChanged")` 宣言と `sendEvent` のペアで Kotlin → JS イベントが流れる。
- `currentActivity` は permission request 時に必要。null になりうる（background 中など）ので Helper 側で null チェック済み。

- [ ] **Step 2: Verify build**

Run:
```bash
npx expo run:android --device
```

Expected: ビルド成功 + アプリ起動。Module は登録されたが JS からはまだ呼ばれていない。

- [ ] **Step 3: Commit**

```bash
git add modules/alarm-android/android/src/main/java/expo/modules/alarmandroid/AlarmAndroidModule.kt
git commit -m "feat(android): expose AlarmAndroid module with schedule/cancel/list/requestPermissions and events"
```

---

## Task 15: AndroidScheduler TS bridge – test scaffold + isAvailable + requestAuthorization

**Files:**
- Create: `src/scheduler/androidScheduler.ts`
- Create: `tests/scheduler/androidScheduler.test.ts`

iOS と同じ TDD パターンで AndroidScheduler を実装。まずは `isAvailable` と `requestAuthorization` だけ。

- [ ] **Step 1: Write failing tests for isAvailable and requestAuthorization**

`tests/scheduler/androidScheduler.test.ts` を新規作成：

```ts
import { AndroidScheduler } from '@/scheduler/androidScheduler';

jest.mock('expo', () => ({
  __esModule: true,
  requireNativeModule: jest.fn(() => ({
    schedule: jest.fn(),
    cancel: jest.fn(),
    list: jest.fn(),
    requestPermissions: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
  })),
  NativeModule: class {},
}));

import { requireNativeModule } from 'expo';

const mockNative = (requireNativeModule as jest.Mock)() as {
  schedule: jest.Mock;
  cancel: jest.Mock;
  list: jest.Mock;
  requestPermissions: jest.Mock;
};

describe('AndroidScheduler', () => {
  let scheduler: AndroidScheduler;

  beforeEach(() => {
    scheduler = new AndroidScheduler();
    jest.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('returns true on Android (module is always available when loaded)', async () => {
      expect(await scheduler.isAvailable()).toBe(true);
    });
  });

  describe('requestAuthorization', () => {
    it('returns authorized when all 3 perms granted', async () => {
      mockNative.requestPermissions.mockResolvedValue({
        exactAlarm: true, notifications: true, fullScreenIntent: true,
      });
      expect(await scheduler.requestAuthorization()).toBe('authorized');
    });

    it('returns denied when exactAlarm is denied', async () => {
      mockNative.requestPermissions.mockResolvedValue({
        exactAlarm: false, notifications: true, fullScreenIntent: true,
      });
      expect(await scheduler.requestAuthorization()).toBe('denied');
    });

    it('returns denied when notifications is denied', async () => {
      mockNative.requestPermissions.mockResolvedValue({
        exactAlarm: true, notifications: false, fullScreenIntent: true,
      });
      expect(await scheduler.requestAuthorization()).toBe('denied');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- tests/scheduler/androidScheduler.test.ts
```

Expected: FAIL with `Cannot find module '@/scheduler/androidScheduler'`.

- [ ] **Step 3: Create minimal androidScheduler.ts**

`src/scheduler/androidScheduler.ts`:

```ts
import { requireNativeModule, NativeModule } from 'expo';
import type { AlarmScheduler, ScheduledAlarmInfo } from '@/scheduler/AlarmScheduler';
import type { Alarm, Weekday } from '@/domain/types';

type AlarmAndroidEvents = {
  onAlarmStateChanged(event: { id: string; state: 'fired' | 'stopped' | 'snoozed' }): void;
};

interface AlarmAndroidNativeModule extends NativeModule<AlarmAndroidEvents> {
  schedule(
    id: string,
    hour: number,
    minute: number,
    weekdays: number[],
    label: string,
    snoozeEnabled: boolean,
  ): Promise<void>;
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
  async isAvailable(): Promise<boolean> {
    return true;
  }

  async requestAuthorization(): Promise<'authorized' | 'denied' | 'notDetermined'> {
    const result = await Native.requestPermissions();
    if (result.exactAlarm && result.notifications && result.fullScreenIntent) {
      return 'authorized';
    }
    return 'denied';
  }

  async schedule(_alarm: Alarm): Promise<void> {
    throw new Error('not implemented yet');
  }

  async cancel(_id: string): Promise<void> {
    throw new Error('not implemented yet');
  }

  async listScheduled(): Promise<ScheduledAlarmInfo[]> {
    return [];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test -- tests/scheduler/androidScheduler.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scheduler/androidScheduler.ts tests/scheduler/androidScheduler.test.ts
git commit -m "feat(scheduler): add AndroidScheduler skeleton with isAvailable and requestAuthorization tests"
```

---

## Task 16: AndroidScheduler.schedule with weekday translation

**Files:**
- Modify: `src/scheduler/androidScheduler.ts`
- Modify: `tests/scheduler/androidScheduler.test.ts`

iOS の WEEKDAY_MAP と同じ要領で、`mon|tue|...` → ISO-8601 数値変換を `schedule()` 内で行う。

- [ ] **Step 1: Add failing tests for schedule weekday translation**

`tests/scheduler/androidScheduler.test.ts` の `describe('AndroidScheduler', ...)` の末尾、`requestAuthorization` の閉じ括弧の後ろに追加：

```ts
  describe('schedule – weekday translation', () => {
    const baseAlarm = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      label: 'Wake Up',
      hour: 7,
      minute: 30,
      weekdays: ['mon', 'wed', 'fri'] as const,
      enabled: true,
      snoozeEnabled: true,
      soundId: 'default' as const,
      createdAt: 1000,
      updatedAt: 1000,
    };

    beforeEach(() => {
      mockNative.schedule.mockResolvedValue(undefined);
    });

    it('translates mon/wed/fri to 1/3/5', async () => {
      await scheduler.schedule(baseAlarm);
      expect(mockNative.schedule).toHaveBeenCalledWith(
        baseAlarm.id, 7, 30, [1, 3, 5], 'Wake Up', true,
      );
    });

    it('passes empty array for one-shot alarm', async () => {
      await scheduler.schedule({ ...baseAlarm, weekdays: [] });
      expect(mockNative.schedule).toHaveBeenCalledWith(
        baseAlarm.id, 7, 30, [], 'Wake Up', true,
      );
    });

    it('uses default label when label is empty', async () => {
      await scheduler.schedule({ ...baseAlarm, label: '' });
      expect(mockNative.schedule).toHaveBeenCalledWith(
        baseAlarm.id, 7, 30, [1, 3, 5], 'アラーム', true,
      );
    });

    it('passes snoozeEnabled false through', async () => {
      await scheduler.schedule({ ...baseAlarm, snoozeEnabled: false });
      expect(mockNative.schedule).toHaveBeenCalledWith(
        baseAlarm.id, 7, 30, [1, 3, 5], 'Wake Up', false,
      );
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- tests/scheduler/androidScheduler.test.ts
```

Expected: 4 new tests FAIL with `Error: not implemented yet`.

- [ ] **Step 3: Implement schedule**

`src/scheduler/androidScheduler.ts` の `schedule` メソッドを置き換え：

```ts
  async schedule(alarm: Alarm): Promise<void> {
    await Native.schedule(
      alarm.id,
      alarm.hour,
      alarm.minute,
      alarm.weekdays.map((w) => WEEKDAY_TO_ISO[w]),
      alarm.label || 'アラーム',
      alarm.snoozeEnabled,
    );
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test -- tests/scheduler/androidScheduler.test.ts
```

Expected: 全 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scheduler/androidScheduler.ts tests/scheduler/androidScheduler.test.ts
git commit -m "feat(scheduler): implement AndroidScheduler.schedule with weekday translation"
```

---

## Task 17: AndroidScheduler cancel and listScheduled

**Files:**
- Modify: `src/scheduler/androidScheduler.ts`
- Modify: `tests/scheduler/androidScheduler.test.ts`

- [ ] **Step 1: Add failing tests for cancel and listScheduled**

`tests/scheduler/androidScheduler.test.ts` の `describe('schedule ...')` の後ろに追加：

```ts
  describe('cancel', () => {
    it('calls Native.cancel with the given id', async () => {
      mockNative.cancel.mockResolvedValue(undefined);
      await scheduler.cancel('test-id');
      expect(mockNative.cancel).toHaveBeenCalledWith('test-id');
    });
  });

  describe('listScheduled', () => {
    it('maps native list entries to scheduled state', async () => {
      mockNative.list.mockResolvedValue([
        { id: 'id-1', nextTriggerAt: 1700000000000 },
        { id: 'id-2', nextTriggerAt: 1700000100000 },
      ]);
      const result = await scheduler.listScheduled();
      expect(result).toEqual([
        { id: 'id-1', state: 'scheduled' },
        { id: 'id-2', state: 'scheduled' },
      ]);
    });

    it('returns empty array when native returns nothing', async () => {
      mockNative.list.mockResolvedValue([]);
      expect(await scheduler.listScheduled()).toEqual([]);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- tests/scheduler/androidScheduler.test.ts
```

Expected: 3 new tests FAIL.

- [ ] **Step 3: Implement cancel and listScheduled**

`src/scheduler/androidScheduler.ts` の該当メソッドを置き換え：

```ts
  async cancel(id: string): Promise<void> {
    await Native.cancel(id);
  }

  async listScheduled(): Promise<ScheduledAlarmInfo[]> {
    const entries = await Native.list();
    return entries.map((e) => ({ id: e.id, state: 'scheduled' as const }));
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test -- tests/scheduler/androidScheduler.test.ts
```

Expected: 全 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scheduler/androidScheduler.ts tests/scheduler/androidScheduler.test.ts
git commit -m "feat(scheduler): implement AndroidScheduler cancel and listScheduled"
```

---

## Task 18: Wire AndroidScheduler into createScheduler factory

**Files:**
- Modify: `src/services/createScheduler.ts`
- Modify: `tests/services/createScheduler.test.ts`

- [ ] **Step 1: Update failing test for Android case**

`tests/services/createScheduler.test.ts` の `'returns no-op scheduler when platform is android'` ブロックを以下に置き換え（test 名と中身を更新）：

```ts
  it('returns AndroidScheduler when platform is android', () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));
    jest.doMock('expo', () => ({
      requireNativeModule: () => ({
        schedule: jest.fn(),
        cancel: jest.fn(),
        list: jest.fn(),
        requestPermissions: jest.fn(),
      }),
      NativeModule: class {},
    }));
    const { createScheduler: cs } = require('@/services/createScheduler');
    const { AndroidScheduler } = require('@/scheduler/androidScheduler');
    const scheduler = cs();
    expect(scheduler).toBeInstanceOf(AndroidScheduler);
  });
```

そして既存の `'no-op scheduler isAvailable returns false'` / `'no-op scheduler requestAuthorization returns notDetermined'` / `'no-op scheduler schedule resolves without error'` の 3 テストは AndroidScheduler の挙動と矛盾するので **削除**（AndroidScheduler の挙動は androidScheduler.test.ts でカバー済み）。

最終的な `createScheduler.test.ts` の全体は以下のようになる（コピペ用）：

```ts
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
    const { IosScheduler: iOS } = require('@/scheduler/iosScheduler');
    const scheduler = cs();
    expect(scheduler).toBeInstanceOf(iOS);
  });

  it('returns AndroidScheduler when platform is android', () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));
    jest.doMock('expo', () => ({
      requireNativeModule: () => ({
        schedule: jest.fn(),
        cancel: jest.fn(),
        list: jest.fn(),
        requestPermissions: jest.fn(),
      }),
      NativeModule: class {},
    }));
    const { createScheduler: cs } = require('@/services/createScheduler');
    const { AndroidScheduler } = require('@/scheduler/androidScheduler');
    const scheduler = cs();
    expect(scheduler).toBeInstanceOf(AndroidScheduler);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- tests/services/createScheduler.test.ts
```

Expected: `'returns AndroidScheduler when platform is android'` FAIL（現状 NoopScheduler が返る）。

- [ ] **Step 3: Update createScheduler.ts to use AndroidScheduler**

`src/services/createScheduler.ts` を以下に置き換え：

```ts
import { Platform } from 'react-native';
import { IosScheduler } from '@/scheduler/iosScheduler';
import { AndroidScheduler } from '@/scheduler/androidScheduler';
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
  if (Platform.OS === 'android') {
    return new AndroidScheduler();
  }
  return new NoopScheduler();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test -- tests/services/createScheduler.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Run full suite + typecheck + lint**

Run:
```bash
npm test && npm run typecheck && npm run lint
```

Expected: 全テスト PASS（既存 + 11 + 2 = 95 前後）、typecheck 0 errors、lint 0 errors (既存 7 warnings は許容)。

- [ ] **Step 6: Commit**

```bash
git add src/services/createScheduler.ts tests/services/createScheduler.test.ts
git commit -m "feat(services): wire AndroidScheduler into createScheduler platform branch"
```

---

## Task 19: AppState listener for permission deep-link return

**Files:**
- Modify: `src/app/_layout.tsx`

`SCHEDULE_EXACT_ALARM` の system settings からアプリに戻ってきた時、permission を再 fetch する。`AppState` change イベントで `background → active` 検知。

- [ ] **Step 1: Add AppState listener to _layout.tsx**

`src/app/_layout.tsx` を以下に置き換え：

```tsx
import '../../global.css';
import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { createScheduler } from '@/services/createScheduler';
import { getStore } from '@/stores/appStore';

export default function RootLayout() {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    async function init() {
      const scheduler = createScheduler();
      await scheduler.requestAuthorization().catch(() => {});
      const store = await getStore();
      await store.getState().loadAlarms();
    }
    init();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const wasBackground = appState.current.match(/inactive|background/);
      appState.current = next;
      if (wasBackground && next === 'active') {
        const scheduler = createScheduler();
        await scheduler.requestAuthorization().catch(() => {});
      }
    });
    return () => sub.remove();
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

Note:
- 既存の startup `useEffect` はそのまま。新規の `useEffect` を追加して AppState を購読。
- 戻り時に `requestAuthorization` を呼び直すことで、ユーザーが system settings で許可した結果が再取得される。
- `useEffect` 2 個になるが、global rule の「`useEffect` 極力避ける」に対しては「permission deep link 戻り検知という外部 OS 連携のため不可避」と spec section 5.2 で前提。

- [ ] **Step 2: Verify typecheck and lint**

Run:
```bash
npm run typecheck && npm run lint
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/_layout.tsx
git commit -m "feat(ui): re-check permissions on AppState background-to-active transition"
```

---

## Task 20: Full iOS regression and parity check

**Files:** なし（検証のみ）

Plan 2 で動いていた iOS 機能が壊れていないことを確認する。コミットは empty commit にする。

- [ ] **Step 1: Run all checks**

Run:
```bash
npm test && npm run typecheck && npm run lint
```

Expected: 全テスト PASS（合計 95+ 想定）、typecheck 0 errors、lint 0 errors。

- [ ] **Step 2: Run iOS dev build to confirm Plan 2 still works**

Run:
```bash
npx expo run:ios --device
```

Expected: iOS 実機で Plan 2 のアラーム機能が普通に動く（新規追加 / 編集 / 削除 / 鳴る）。AlarmKit は Android 関連の変更に影響されない想定。

- [ ] **Step 3: Empty commit to mark iOS parity check**

```bash
git commit --allow-empty -m "test(ios): verify Plan 2 iOS functionality still works after Plan 3 changes"
```

---

## Task 21: Manual E2E checklist on Pixel

**Files:** なし（手動検証）

spec section 7.3 の 13 項目を Pixel 実機で全消化する。各項目を実機で確認してチェック。

- [ ] **Step 1: Android dev build を起動**

```bash
npx expo run:android --device
```

- [ ] **Step 2: 権限を全部許可**

アプリ初回起動時の system dialog で：
- POST_NOTIFICATIONS → 許可
- SCHEDULE_EXACT_ALARM 設定画面 → ON
- USE_FULL_SCREEN_INTENT 設定画面 → ON (Pixel が API 34+ なら)

アプリに戻ったら一覧画面で何も警告が出ないこと。

- [ ] **Step 3: 13 項目を手動テスト**

各項目を実機で確認：

- [ ] **基本発火**: 2 分後にアラーム設定 → アプリ kill → 鳴る
- [ ] **Silent mode 貫通**: マナーモード → アラーム鳴る
- [ ] **Do Not Disturb 貫通**: DnD 有効 → アラーム鳴る
- [ ] **ロック画面**: 画面ロック状態 → AlarmActivity が全面表示
- [ ] **Stop ボタン**: タップで音停止 + 画面閉じる
- [ ] **Snooze ボタン**: タップで止まる → 9 分後に再発火
- [ ] **曜日繰り返し**: 月曜のみ設定 → 火曜に鳴らない / 翌月曜に鳴る（短時間検証は時刻変更で代用）
- [ ] **複数アラーム**: 同時刻に 2 つ → 両方鳴る
- [ ] **トグル OFF**: 一覧でトグル OFF → 時刻来ても鳴らない
- [ ] **削除**: 削除 → 時刻来ても鳴らない
- [ ] **アプリ再起動**: kill → 再開 → 一覧に表示される
- [ ] **端末再起動**: 端末再起動 → BootReceiver が再登録 → 鳴る
- [ ] **権限拒否 → 許可**: 初回 deny → system settings で許可 → アプリ戻り → schedule できる

問題があれば fix 用のタスクを別途追加する。

- [ ] **Step 4: Empty commit with checklist results**

```bash
git commit --allow-empty -m "$(cat <<'EOF'
test(e2e): manual Android E2E verification complete on Pixel

- [x] basic fire: 2-min schedule + app kill
- [x] silent mode bypass
- [x] DnD bypass
- [x] lock-screen fullscreen activity
- [x] stop button
- [x] snooze button (9 min)
- [x] weekday repeat
- [x] multiple alarms same time
- [x] toggle off
- [x] delete
- [x] app kill + reopen list intact
- [x] device reboot + alarms ring
- [x] permission deny then allow flow
EOF
)"
```

---

## Task 22: Plan 3 milestone commit + tag

**Files:** なし

- [ ] **Step 1: Empty milestone commit**

```bash
git commit --allow-empty -m "chore(milestone): Plan 3 complete – Android Native Module end-to-end with Foreground Service + FullScreenIntent"
```

- [ ] **Step 2: Tag the milestone**

```bash
git tag plan-3-complete
git log --oneline -3
git tag --list
```

Expected: 直近の 3 commits が表示され、`plan-3-complete` タグが存在することを確認。

---

## Done Criteria

1. TypeScript typecheck/lint 0 errors
2. Jest 全 PASS（Plan 2 の 82 + Plan 3 で +11 + 1 = 94 前後想定）
3. `npx expo run:android --device` が Pixel 実機で起動
4. spec section 7.3 の手動 E2E 13 項目すべて ✅
5. iOS (Plan 2) の動作確認済み、退行ゼロ
6. `chore(milestone): Plan 3 complete ...` で空コミット + `plan-3-complete` タグ作成
