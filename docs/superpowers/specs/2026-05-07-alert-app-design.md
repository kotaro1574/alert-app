# Alert App 設計書

- **作成日**: 2026-05-07
- **対象**: Expo + React Native 製のアラーム時計アプリ
- **配布形態**: TestFlight / Google Play 内部テスト（個人開発、自己使用想定）

---

## 1. 概要

### 1.1 目的

iOS純正 Clock アプリと同等の信頼性で「止めるまで鳴り続ける目覚ましアラーム」を、iOS 26+ と Android の両プラットフォームで実現するモバイルアプリを構築する。

### 1.2 コアな価値

- **鳴らないリスクを最小化**: 端末の Silent / Focus mode・バッテリー最適化・再起動を貫通して鳴る
- **純正同等のUX**: ロック画面の全画面アラート・スヌーズ・繰り返し設定など、ユーザーが既に知っている操作モデルをそのまま提供
- **2OS共通の操作感**: 同じ機能セット・同じ画面構成・同じ見た目（プラットフォーム適応はしない）

### 1.3 想定外（Non-goals）

- クラウド同期・複数端末間共有
- カスタム音源インポート（内蔵音源のみ提供）
- 起床ミッション（数式を解く・写真を撮る等のギミック）
- ウィジェット・Apple Watch コンパニオンアプリ（将来的拡張枠）
- Web 版

---

## 2. 機能要件

### 2.1 機能一覧（採用）

| #   | 機能                   | 内容                                 |
| --- | ---------------------- | ------------------------------------ |
| F1  | 複数アラーム登録       | 任意件数のアラームを並行登録できる   |
| F2  | 曜日繰り返し           | 平日のみ・特定曜日・毎日・単発の選択 |
| F3  | スヌーズ               | 9 分後（既定値）に再発火、回数無制限 |
| F4  | アラーム名・ラベル     | 自由テキスト入力                     |
| F5  | アラーム ON/OFF トグル | 一覧画面から即時切替可               |
| F6  | サウンド選択           | 内蔵音源 3〜5 種から選択             |
| F7  | 編集・削除             | 既存アラームの全項目編集と削除       |
| F8  | 音量・バイブ設定       | 設定画面でグローバルに調整           |

### 2.2 不要と確定した機能

- 次のアラームまでの残り時間表示

### 2.3 鳴動仕様

- **iOS**: AlarmKit が提供するシステムレベルのアラート挙動に準拠（Silent / Focus mode 貫通）
- **Android**: ユーザーが「停止」または「スヌーズ」を押すまで Foreground Service 上で MediaPlayer がループ再生

---

## 3. 対応プラットフォーム

| OS      | 最低バージョン            | 備考                                               |
| ------- | ------------------------- | -------------------------------------------------- |
| iOS     | iOS 26.0 以上             | AlarmKit 必須。iOS 25 以下は起動時に非対応画面表示 |
| Android | Android 8.0 (API 26) 以上 | Notification Channel 必須化を境界点として採用      |

### 3.1 配布

- iOS: TestFlight（自身で利用、招待による限定共有）
- Android: Google Play 内部テスト

### 3.2 検証方針

- iOS / Android 両 OS で **物理実機検証必須**（Simulator / Emulator は AlarmKit や FullScreenIntent の挙動再現に限界がある）

---

## 4. 技術スタック

### 4.1 採用技術一覧

| レイヤー         | 採用技術                                                                |
| ---------------- | ----------------------------------------------------------------------- |
| Framework        | Expo SDK 55+ + React Native New Architecture                            |
| Build            | EAS Build / Expo dev build（Expo Go は使えない）                        |
| Routing          | Expo Router（file-based）                                               |
| Styling          | NativeWind（Tailwind for React Native）                                 |
| State            | Zustand                                                                 |
| Persistence      | expo-sqlite                                                             |
| iOS Alarm        | react-native-ios-alarmkit（AlarmKit ラッパー、Expo config plugin 対応） |
| Android Alarm    | 自前 Expo Module（Kotlin 実装）                                         |
| 時刻入力         | @react-native-community/datetimepicker                                  |
| Test - Unit      | Jest                                                                    |
| Test - Component | React Native Testing Library                                            |
| Test - E2E       | Maestro                                                                 |
| Lint / Format    | ESLint + Prettier                                                       |
| CI               | GitHub Actions                                                          |

### 4.2 採用理由

- AlarmKit の Expo 対応ラッパーが既に存在し、再発明不要
- EAS Build によりネイティブビルド〜配布が一気通貫
- 「目覚まし」用途では信頼性が最優先 → 公式準拠で枯れた構成を採用
- New Architecture / Expo Router / NativeWind は 2026 年現在のモダン Expo の標準セット

---

## 5. アーキテクチャ

### 5.1 3 層構造

```
┌──────────────────────────────────────────────────────────────┐
│  UI 層 (React Native + Expo Router + NativeWind)             │
│   ・画面: 一覧 / 編集モーダル / 設定モーダル                 │
│   ・状態: Zustand store                                      │
└──────────────────────────────┬───────────────────────────────┘
                               │ TypeScript API (純粋関数)
┌──────────────────────────────▼───────────────────────────────┐
│  Domain 層 (TypeScript / Pure logic)                         │
│   ・Alarm モデル定義 (型・バリデーション・繰り返し計算)      │
│   ・AlarmRepository (永続化 = expo-sqlite)                   │
│   ・AlarmScheduler (OS 抽象: scheduleAlarm/cancelAlarm)      │
└──────────────────────────────┬───────────────────────────────┘
                               │ Native Bridge
┌──────────────────────────────▼───────────────────────────────┐
│  Native 層 (Platform-specific)                               │
│   iOS:     react-native-ios-alarmkit (AlarmKit ラッパー)     │
│   Android: 自前 Expo Module (Kotlin)                         │
│           ├ AlarmManager (時刻トリガー)                      │
│           ├ Foreground Service (鳴ってる間の生存)            │
│           ├ FullScreenIntent (ロック画面ジャック)            │
│           └ MediaPlayer (サウンドのループ再生)               │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 設計原則

- **層は次層の実装詳細を知らない**: UI 層は scheduler の中身が iOS / Android のどちらかを意識しない
- **SQLite を真実のソースとする**: ネイティブ層のアラーム情報は SQLite からのミラーとして扱う
- **ネイティブ層は薄く保つ**: 繰り返し計算・バリデーション等のビジネスロジックは TS 側に集約。Native は「指定 UNIX 時刻に鳴らす」だけに専念
- **ID は 3 層で同じ UUID を使い回す**: SQLite 行 ID = Native 側のアラーム ID = JS 側オブジェクト ID で照合

---

## 6. プロジェクト構造

```
alert-app/
├── app/                          # Expo Router (file-based routing)
│   ├── _layout.tsx               # ルートレイアウト・テーマ・store provider
│   ├── index.tsx                 # アラーム一覧 (メイン画面)
│   ├── alarm/[id].tsx            # 編集モーダル (id='new' で新規)
│   └── settings.tsx              # 設定モーダル
│
├── src/
│   ├── components/               # 再利用UI部品
│   │   ├── AlarmListItem.tsx
│   │   ├── TimePicker.tsx
│   │   ├── WeekdaySelector.tsx
│   │   ├── SoundPicker.tsx
│   │   └── ToggleRow.tsx
│   │
│   ├── stores/
│   │   └── alarmStore.ts         # Zustand store
│   │
│   ├── domain/                   # 純粋ロジック (Native 依存ゼロ)
│   │   ├── types.ts              # Alarm, Weekday, Sound 型定義
│   │   ├── nextOccurrence.ts     # 次回発火時刻計算 (pure)
│   │   └── validation.ts
│   │
│   ├── repository/               # 永続化層
│   │   ├── db.ts                 # expo-sqlite 初期化・マイグレーション
│   │   └── alarmRepository.ts    # CRUD
│   │
│   ├── scheduler/                # OS 抽象化層
│   │   ├── AlarmScheduler.ts     # 共通 interface
│   │   ├── iosScheduler.ts       # AlarmKit ラッパー呼び出し
│   │   └── androidScheduler.ts   # 自前 Expo Module 呼び出し
│   │
│   └── theme/
│       └── colors.ts
│
├── modules/
│   └── alarm-android/            # 自前 Expo Module (Android only)
│       ├── android/src/main/java/expo/modules/alarmandroid/
│       │   ├── AlarmAndroidModule.kt
│       │   ├── AlarmReceiver.kt
│       │   ├── AlarmService.kt
│       │   └── AlarmActivity.kt
│       └── expo-module.config.json
│
├── assets/sounds/                # 内蔵アラーム音 (3〜5個)
│
├── docs/superpowers/specs/       # 設計書 (本ファイル含む)
├── app.json                      # Expo 設定 + plugin 宣言
└── package.json
```

### 6.1 主要モジュールの責務

| モジュール                      | 責務                                                            |
| ------------------------------- | --------------------------------------------------------------- |
| `app/*.tsx`                     | 画面組み立て・ナビゲーション・store 購読                        |
| `components/*.tsx`              | 見た目のみ（ロジックを持たない）                                |
| `stores/alarmStore.ts`          | UI から触る状態管理。actions 内で repository + scheduler を呼ぶ |
| `domain/*`                      | 純粋関数のビジネスロジック（テスト容易）                        |
| `repository/alarmRepository.ts` | SQLite からアラーム CRUD                                        |
| `scheduler/AlarmScheduler.ts`   | iOS / Android 分岐を隠す唯一の窓口                              |
| `modules/alarm-android`         | Android のネイティブアラーム本体                                |

---

## 7. UI 仕様

### 7.1 画面構成（3 画面）

1. **アラーム一覧画面**（`app/index.tsx`、メイン画面）
   - 登録済みアラームをリスト表示
   - 各行: 時刻（大）/ ラベル / 繰り返し曜日 / ON/OFF トグル
   - 右上に「追加」ボタン → 編集モーダル（新規モード）を開く
   - 行タップで編集モーダル（既存モード）を開く

2. **編集モーダル**（`app/alarm/[id].tsx`、新規・既存兼用）
   - 時刻ホイール（大きく表示）
   - ラベル入力欄
   - 曜日選択チップ群（月〜日）
   - サウンド選択（リスト or ピッカー）
   - スヌーズ ON/OFF
   - 保存ボタン / 削除ボタン（既存モードのみ）

3. **設定モーダル**（`app/settings.tsx`）
   - 音量スライダー
   - バイブ ON/OFF
   - 電池最適化への誘導（Android のみ表示）

### 7.2 デザイン方針

- **iOS 純正 Clock 寄せ**を両 OS 共通で適用（プラットフォーム適応はしない）
- **背景**: 黒〜ダークグレー
- **時刻フォント**: 大きめ・細字
- **アクセントカラー**: オレンジ（純正 Clock と同系統）
- **テーマ**: ダークを主とし、ライトモードもサポート（OS 設定追従）

### 7.3 鳴動中のUI（OS 任せ）

「鳴っている瞬間」の全画面 UI は OS 側が描画する。

- iOS: AlarmKit が提供するシステムフルスクリーンアラート
- Android: FullScreenIntent で起動された `AlarmActivity` がロック画面を覆う

---

## 8. データフロー

### 8.1 Flow 1: アラーム新規作成

```
User → [編集モーダル] 「保存」タップ
   │
   ▼
alarmStore.addAlarm(input)
   │
   ├─ 1. validation.ts          → 入力チェック
   ├─ 2. domain.createAlarm()    → UUID 生成 + Alarm オブジェクト構築
   ├─ 3. alarmRepository.save()  → SQLite に永続化（先に DB が真実）
   ├─ 4. scheduler.schedule(alarm)
   │     ├─ iOS:     AlarmKit.scheduleAlarm(uuid, {hour, minute, weekdays, ...})
   │     └─ Android: AlarmAndroidModule.schedule(uuid, triggerAtMillis, ...)
   ├─ 5. store 内の alarms[] を更新
   │
   ▼
[一覧画面] 再描画
```

`schedule` が失敗した場合は DB から該当アラームを削除してロールバック。

### 8.2 Flow 2: アラーム発火（iOS / AlarmKit）

```
時刻到来
   ▼
iOS が AlarmKit システム UI でフルスクリーンアラート表示
   │ (アプリ起動不要 / バックグラウンドでも鳴る / Silent mode 貫通)
   │
   ├─ User: ロック画面の「停止」or「スヌーズ」を押下
   ▼
AlarmKit が状態変化を発行 (alerting → scheduled / countdown)
   ▼
アプリ内で addAlarmUpdatesListener が発火
   ▼
alarmStore が状態同期
   ▼
[一覧画面] のトグル等が更新
```

アプリは「鳴らす」処理に関与しない。OS が完全管理する。

### 8.3 Flow 3: アラーム発火（Android / 自前 Module）

```
時刻到来
   ▼
AlarmManager が AlarmReceiver に Intent 送信
   ▼
AlarmReceiver.onReceive()
   ├─ Foreground Service (AlarmService) を起動
   │   └─ MediaPlayer.start() でループ再生
   └─ FullScreenIntent で AlarmActivity を起動
       └─ ロック画面に「停止 / スヌーズ」ボタン全画面表示
   │
   ├─ User: 「停止」押下
   │     └─ Activity → Service.stopSelf() → MediaPlayer.stop()
   └─ User: 「スヌーズ」押下
         └─ Service 停止 + AlarmManager に新たに「9 分後」を登録
   │
   ▼
JS 側に発火結果を broadcast (DeviceEventEmitter)
   ▼
alarmStore が状態同期 → UI 更新
```

Foreground Service が生存している限り音は鳴り続ける。Service が死ねば音も止まる。

### 8.4 Flow 4: アプリ起動時の整合性チェック

```
アプリ起動
   ▼
_layout.tsx の useEffect で sync() 実行
   │
   ├─ 1. alarmRepository.list()       → DB 上の全アラーム取得
   ├─ 2. scheduler.listScheduled()    → Native 層に登録されている全アラーム取得
   │
   ├─ 3. diff 計算
   │   ├─ DB 側にあって Native 側にない → schedule() 再登録（再起動後の復活）
   │   ├─ Native 側にあって DB 側にない → cancel() で削除（孤児を掃除）
   │   └─ ON/OFF が食い違う           → DB 側に合わせる
   │
   ▼
store に反映 → UI に反映
```

「再起動しても消えない」を担保する関門。DB を真実として、毎回起動時に Native を矯正する。

### 8.5 スヌーズの実装場所

- **iOS**: AlarmKit が `snoozeDuration` 引数で全部処理
- **Android**: 自前で「Service 停止 + AlarmManager 再登録」を実装

スヌーズ実装は 2 OS 非対称となる（仕様の相違）。

---

## 9. エラーハンドリング & エッジケース

### 9.1 権限・パーミッション

| OS      | パーミッション                                                   | タイミング               | 失敗時の振る舞い                       |
| ------- | ---------------------------------------------------------------- | ------------------------ | -------------------------------------- |
| iOS     | `NSAlarmKitUsageDescription` (Info.plist) + ランタイム auth 要求 | アラーム保存ボタン押下時 | 保存ブロック → 設定画面誘導モーダル    |
| Android | `SCHEDULE_EXACT_ALARM` (Android 12+)                             | アプリ初回起動時         | システム設定画面に飛ばし許可後リトライ |
| Android | `POST_NOTIFICATIONS` (Android 13+)                               | 同上                     | 未許可なら通知非表示でも内部動作続行   |
| Android | `USE_FULL_SCREEN_INTENT` (Android 14+)                           | manifest 宣言            | 未許可ならヒーズアップに降格           |

権限要求は **必要になったタイミングで都度** 行う。拒否されてもアプリは動作するが、保存ボタンが押せず注意バナーが表示される。

### 9.2 Android のバッテリー最適化対策

中華系端末（Xiaomi / OPPO / Vivo / Huawei）と Samsung は独自のバッテリー最適化で Foreground Service を強制終了する場合がある。3rd party 目覚ましアプリにとって最大の課題。

**対策**:

1. `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` 権限要求 → 最適化対象から除外を依頼
2. 設定画面に「電池最適化を無効化」案内ボタンを常設
3. 起動時に最適化状態をチェックし、有効なら警告バナーを表示
4. README / FAQ に端末メーカー別の対処法を記載

### 9.3 端末再起動からの復活

| OS      | 対応                                                                                          |
| ------- | --------------------------------------------------------------------------------------------- |
| iOS     | AlarmKit が自動で永続化（OS 仕様）。念のため起動時 sync で再確認                              |
| Android | `BOOT_COMPLETED` BroadcastReceiver を仕込む。再起動後初回起動時に Flow 4 が全アラームを再登録 |

### 9.4 ネイティブ呼び出しの失敗

```ts
try {
  await scheduler.schedule(alarm);
} catch (e) {
  if (e instanceof AlarmKitError) {
    // iOS 固有: 認可拒否、上限超え、無効な schedule
  } else if (e instanceof AlarmAndroidError) {
    // Android 固有: SCHEDULE_EXACT_ALARM 未許可、Service 起動失敗
  }
  await alarmRepository.delete(alarm.id); // ロールバック
  throw e;
}
```

ネイティブ層は必ずカスタム Error クラスを throw（code フィールド付き）。JS 側は code で分岐表示する。

### 9.5 その他のエッジケース

| ケース                               | 対応                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------- |
| ユーザーがシステム時刻を手動変更     | OS 任せ。アプリは関与しない                                                |
| タイムゾーン変更                     | アラームはローカル時刻基準で保存。移動先のローカル時刻で鳴る（純正と同じ） |
| 夏時間（DST）切替                    | OS 仕様に従う。アプリで個別対応はしない                                    |
| 編集中に発火時刻到来                 | 楽観的: store の最新値を使用。編集中の変更は保存ボタン押下まで非反映       |
| 同一時刻に複数アラーム               | OS 的に問題なし。両方とも鳴る。UI は別々に表示                             |
| 音源ファイル欠損                     | デフォルト音にフォールバック + 起動時に bundle チェック                    |
| 権限がランタイム途中で revoke される | 起動時 sync で発覚 → 警告バナー + 該当アラームに「⚠️鳴らない可能性」マーク |
| AlarmKit が iOS 25 以下で利用不可    | `if (!AlarmKit.isSupported)` ガード → 「iOS 26 以上が必要です」画面を表示  |

### 9.6 手動 E2E チェックリスト（リリース前必須）

- [ ] iOS 実機で 5 分後にアラーム設定 → アプリ kill → 鳴る
- [ ] iOS 実機で Silent / Focus mode → 鳴る
- [ ] Android 実機（できれば中華系）で 5 分後 → アプリ kill → 鳴る
- [ ] Android 実機で電池最適化 ON → 鳴らないことを確認 → 警告バナー表示確認
- [ ] 端末再起動後、再起動前に登録したアラームが鳴る（両 OS）
- [ ] スヌーズ → 9 分後に再発火（両 OS）
- [ ] タイムゾーン変更 → 移動先の現地時刻で鳴る
- [ ] アラーム ON/OFF トグル → schedule / cancel が呼ばれる

---

## 10. テスト戦略

### 10.1 テストピラミッド

| 層          | ツール                              | 対象                                                    |
| ----------- | ----------------------------------- | ------------------------------------------------------- |
| Unit        | Jest                                | `domain/*` の純粋関数                                   |
| Component   | Jest + React Native Testing Library | `components/*.tsx`                                      |
| Integration | Jest + scheduler モック             | `stores/alarmStore.ts` + `repository/*` + `scheduler/*` |
| E2E (自動)  | Maestro                             | 画面遷移・基本フロー（5〜10 シナリオ）                  |
| 手動 E2E    | 実機                                | アラーム発火・音・OS 連携（9.6 のチェックリスト）       |

### 10.2 Unit テストの重点

`domain/nextOccurrence.ts` を最重点でテストする：

- 毎日繰り返しで現時刻より後の今日を返す
- 毎日繰り返しで現時刻より前なら明日を返す
- 平日設定で土曜に呼ぶと月曜を返す
- 単発アラームで時刻を過ぎていたら null を返す
- DST 切替日でも正しい時刻を返す
- うるう年 2/29 でも壊れない
- weekdays が空配列なら単発として扱う

### 10.3 Integration テストの重点

`scheduler` をインメモリ実装で差し替えて store の振る舞いを確認：

- `addAlarm` 成功 → repo に保存 + scheduler に登録 + store 更新
- `addAlarm` で scheduler 失敗 → repo から削除 + store 元に戻る
- `toggleAlarm(off)` → `scheduler.cancel` が呼ばれる
- 起動時 sync → DB と Native の差分が解消される

### 10.4 E2E (Maestro) シナリオ

1. 新規アラーム作成 → 一覧表示
2. アラーム編集 → 時刻変更が反映
3. アラーム削除 → 一覧から消える
4. ON/OFF トグル → 表示が変わる
5. 曜日繰り返し設定 → ラベル表示
6. ラベル編集 → 一覧に反映
7. 設定画面でサウンド変更 → 永続化される
8. アラーム 0 件状態の空表示
9. 不正入力（時刻なし）でバリデーション
10. 編集中にキャンセル → 変更破棄

### 10.5 テストしないもの（割り切り）

- AlarmKit / 自前 Android Module のネイティブコード自体（手動 E2E で検証）
- OS の権限ダイアログ（モック不可、E2E ではスキップ）
- 音が実際に鳴るか（自動検出不可、手動確認のみ）
- バッテリー最適化下での挙動（実環境のみ）

### 10.6 CI 戦略

| ステップ                       | ツール                         | 失敗時           |
| ------------------------------ | ------------------------------ | ---------------- |
| Lint                           | ESLint + Prettier              | PR ブロック      |
| Type check                     | tsc --noEmit                   | PR ブロック      |
| Unit + Component + Integration | Jest                           | PR ブロック      |
| Build                          | EAS Build (PR 毎)              | PR ブロック      |
| E2E (Maestro)                  | Maestro Cloud or 自前 runner   | PR ブロック      |
| 手動 E2E                       | リリース前に実機チェックリスト | リリースブロック |

---

## 11. 実装ロードマップ

### 11.1 フェーズ分け

| Phase   | 内容                  | 目安      |
| ------- | --------------------- | --------- |
| Phase 0 | プロジェクト基盤      | 0.5〜1 日 |
| Phase 1 | Domain + Repository   | 1〜2 日   |
| Phase 2 | iOS AlarmKit 統合     | 2〜3 日   |
| Phase 3 | Android Native Module | 3〜5 日   |
| Phase 4 | UI 実装               | 2〜3 日   |
| Phase 5 | 統合 & ポリッシュ     | 2〜3 日   |
| Phase 6 | テスト & 配布準備     | 2〜3 日   |

「リスクの高いところから先に潰す」順序。Phase 0〜1 は並行可能。

### 11.2 Phase 0: プロジェクト基盤

- `npx create-expo-app` で雛形生成（New Architecture 有効化）
- TypeScript / ESLint / Prettier 設定
- NativeWind セットアップ
- Expo Router セットアップ（`app/` 構造）
- EAS CLI 設定 + dev profile 作成
- Apple Developer / Google Play Console アカウント準備
- `app.json` で plugin 宣言、`react-native-ios-alarmkit` 追加

**完了基準**: 空の Expo アプリが iOS 実機 / Android 実機で `eas build --profile development` でビルド・起動できる

### 11.3 Phase 1: Domain + Repository

- `domain/types.ts` で型定義（Alarm / Weekday / Sound）
- `domain/nextOccurrence.ts` 実装 + Jest ユニットテスト網羅
- `domain/validation.ts` 実装 + テスト
- `repository/db.ts` で expo-sqlite 初期化・スキーマ定義・マイグレーション
- `repository/alarmRepository.ts` で CRUD + テスト

**完了基準**: ネイティブ抜きで「アラーム作成・取得・更新・削除」が完結し、ユニットテスト全緑

### 11.4 Phase 2: iOS AlarmKit 統合

- `react-native-ios-alarmkit` インストール、Info.plist に `NSAlarmKitUsageDescription` 追加
- `scheduler/iosScheduler.ts` 実装（schedule / cancel / list / 認可要求）
- 認可フロー組み込み
- iOS 実機で手動疎通: スクリプト一発で「3 分後にアラーム鳴らす」

**完了基準**: iOS 実機でアプリ kill 状態でも、Silent mode でも、ロック画面で純正同等にアラームが鳴る

### 11.5 Phase 3: Android Native Module（最大の山）

サブ段階に分割：

- 3a. Expo Module 雛形作成（`expo-module:create`）
- 3b. AlarmManager 単体疎通（1 分後にログ出力するだけのレシーバ）
- 3c. Foreground Service 追加（MediaPlayer で音をループ再生）
- 3d. FullScreenIntent + AlarmActivity（全画面 + 停止/スヌーズボタン）
- 3e. AndroidManifest 権限・宣言（`SCHEDULE_EXACT_ALARM`, `USE_FULL_SCREEN_INTENT`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `RECEIVE_BOOT_COMPLETED`）
- 3f. BOOT_COMPLETED Receiver（再起動後の復活）
- 3g. JS Bridge 実装（`AlarmAndroidModule.kt` で promise / event を発行）
- 3h. `scheduler/androidScheduler.ts` 実装

**完了基準**: Android 実機でアプリ kill 状態 / 端末ロック状態 / 端末再起動後すべてでアラームが鳴り、停止 / スヌーズが動く

### 11.6 Phase 4: UI 実装

- ダーク / ライトテーマ定義（`theme/colors.ts`）
- `components/` 配下の UI 部品実装
- `app/index.tsx` 一覧画面
- `app/alarm/[id].tsx` 編集モーダル
- `app/settings.tsx` 設定モーダル
- 純正 Clock 寄せのスタイリング適用
- Component テスト併走

**完了基準**: モック scheduler で UI が完全に動く

### 11.7 Phase 5: 統合 & ポリッシュ

- `stores/alarmStore.ts` で actions 実装（repo + scheduler 接続）
- 起動時 sync 実装（`app/_layout.tsx` の useEffect）
- 権限要求フロー組み込み
- バッテリー最適化警告バナー（Android）
- iOS 25 以下のフォールバック画面
- エラートースト・ロールバック処理
- ローディング / 空状態の表示

**完了基準**: Section 8 のシーケンスが全て動く

### 11.8 Phase 6: テスト & 配布準備

- Maestro E2E シナリオ書く
- 9.6 の手動 E2E チェックリスト全消化
- CI 設定（GitHub Actions）
- アプリアイコン・スプラッシュ作成
- App Store Connect / Play Console のメタデータ準備
- Privacy Policy 作成
- TestFlight / 内部テストトラックで配布
- 自身のメイン端末で 1 週間ドッグフード

**完了基準**: 自分が毎朝このアプリで起きられる状態

### 11.9 マイルストーン

| 段階                           | 目安      | アウトカム                           |
| ------------------------------ | --------- | ------------------------------------ |
| PoC 完了（Phase 0〜3 終了）    | 1〜2 週間 | 両 OS の実機でアラームが鳴る最小実装 |
| MVP 完了（Phase 0〜5 終了）    | 3〜4 週間 | UI 付きで自分で使える状態            |
| v1 リリース（Phase 0〜6 終了） | 4〜6 週間 | TestFlight / 内部テスト配布可能      |

### 11.10 リスクと対処

| リスク                           | 影響度 | 対処                                                      |
| -------------------------------- | ------ | --------------------------------------------------------- |
| Android 端末メーカー差で鳴らない | 高     | 早期に手元の端末で実機テスト、無理なら FAQ 整備           |
| AlarmKit ラッパーのバグ          | 中     | Phase 2 の早期検証で発覚 → 必要なら自前ラッパー化         |
| EAS Build 失敗・環境不一致       | 中     | Phase 0 で疎通確認、ローカル `expo prebuild` バックアップ |
| iOS 26 限定で配布範囲狭い        | 中     | リリースノートに明記、サポート機種絞ると割り切る          |
| Privacy / 審査                   | 低〜中 | AlarmKit の利用目的を明記、Apple 推奨パターンに従う       |

---

## 12. 用語

| 用語               | 説明                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| AlarmKit           | Apple が iOS 26 で公開したシステムレベルのアラーム API。3rd party アプリに純正 Clock と同等の機能を提供 |
| Foreground Service | Android で「ユーザーに見える形で」継続実行するサービス。バッテリー最適化の影響を受けにくい              |
| FullScreenIntent   | Android で通知到達時にロック画面を覆ってフルスクリーン UI を表示する仕組み                              |
| EAS Build          | Expo Application Services が提供するクラウドビルド。ネイティブコード込みのビルドを生成可能              |
| Expo Go            | Expo アプリの簡易ビルド版。ネイティブモジュールが必要なアプリでは使えない                               |
| Maestro            | YAML ベースのモバイル E2E テストツール                                                                  |
