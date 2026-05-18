# E2E 通しテスト結果 (2026-05-13)

| 項目 | 値 |
|---|---|
| 実施日 | 2026-05-13 |
| 指示 | 副田さん「機能をすべて見てほしい / 大学管理者 → 教科管理者 → 教員/患者の通しフロー」 |
| 環境 | Vercel 本番 (https://v0-digital-marksheet-ui.vercel.app) + Supabase 本番 |
| データ prefix | `e2e-` / `E2E*` |
| Cleanup | `scripts/_e2e_cleanup_2026-05-13.sql.todo` (副田さん指示で apply) |

---

## 実施フロー

| Phase | 内容 | 結果 |
|---|---|---|
| 1 | 10 教員 + 5 患者 + 10 学生 + 試験セッション 「e2e-通しテスト」 を seed | ✅ |
| 2 | uni で teachers/patients/students-list 確認 | ✅(後述 注意1) |
| 3 | kyouka で問題管理画面 → 試験作成(教員側 + 患者側、アラート問題含む 各 3 問) | ✅ |
| 4 | 試験セッション割当(S101: 教 5/患 2/学 5、S102: 教 5/患 3/学 5) | ✅ |
| 5 | e2e 教員1 で S101 学生 1, 2 に出席登録 + 全 3 問採点(学生1 はアラート対象に 1) | ✅ |
| 6 | e2e 患者1 で S101 学生 1, 2 に採点(出席状態が教員側から反映 ✅) | ✅ |
| 7 | kyouka dashboard で集計確認 | ⚠ バグ#E 発見・修正 |
| 8 | 学生一覧画面で 10 名表示確認 | ✅ |
| 9 | cleanup SQL 準備 | ✅ |

---

## 機能検証マトリクス

| 機能 | 結果 | 備考 |
|---|---|---|
| ログイン(全 4 ロール) | ✅ | PR #113 で session_select 廃止後も正常 |
| 大学管理者 dashboard / マスター / アカウント / 問題管理 / 設定 | ✅ | 全画面表示・エラーなし |
| 教科管理者(subject_admin)scope | ✅ | マスター管理タブ非表示、自教科のみ表示 |
| 教員一覧/患者一覧/学生一覧 | ✅ | 試験セッション軸 fetch |
| 試験セッション割当管理(教員/患者/学生 3 タブ) | ✅ | 部屋 dropdown で割当・解除 |
| 問題管理:試験新規作成 | ✅ | 対象ロール、合格 ライン %、シート/カテゴリ/問題 入力可 |
| 試験フロー:評価テスト選択 → /teacher/exam | ✅ | PR #112 の Cookie refresh が機能 |
| 試験フロー:評価テスト選択 → /patient/exam | ✅ | 「セッション情報が不完全です」エラー出ず |
| 教員側出席登録 → 患者側に反映 | ✅ | 10 秒 polling で患者画面に「出席」表示 |
| 評価入力 + 自動保存(POST /api/evaluation-results) | ✅ | 200 で保存、合計点リアルタイム更新 |
| 入力完了 → 合算 dashboard 反映 | ✅ | 部屋 S101 出席 2 / 完了 教2/患2 / 合格 1 |
| 合格判定 % | ✅ | 合格ライン 70%、学生1=10%(不合格)/ 学生2=90%(合格) |
| アラート対象問題のパネル赤化 | ✅(修正後) | バグ#E 修正後に反映 |
| 経過時間タイマー + 残り時間プログレスバー | ✅ | ExamSessionBanner 機能 |
| 部屋管理 / 教科管理 / 大学管理 | ✅ | 既存テスト済 |
| ユーザー追加(/admin/users/new) | ✅ | 役割選択 + 入力 + 部屋 + 教科設定可 |
| 設定画面(試験時間 / 同時アクセス / 合格ライン) | ✅ | 表示・編集可 |
| 学生一覧で全情報閲覧 | ✅ | 学籍番号/氏名/メール/学部/学年/部屋 |

---

## 発見・修正したバグ

### バグ#E (修正済 PR #116): hasAlert が常に false で保存される
**症状**:
- 学生1 がアラート対象問題で警告値 (1) を選んで採点完了
- exam_results.has_alert は false で保存
- dashboard の要注意 0、部屋パネル赤化なし

**根本原因**:
- `teacher-exam-tabs.tsx` `handleMarkComplete`: `hasAlert: false` ハードコード
- `patient-exam-tabs.tsx` `handleMarkComplete`: `alertTriggers` state を参照するが
  handleAnswerChange で更新されていないため常に false
- teacher の handleAnswerChange も「今変更した 1 問」だけ判定

**修正**:
- `lib/exam/utils.ts` に `computeHasAlert(answers, questions)` 追加
- 両 tabs の handleAnswerChange / handleMarkComplete で再計算
- 過去 false データは PR #116 デプロイ後の再評価で上書き修正

---

## 残課題(別 PR 推奨)

### バグ#A: 問題管理「編集」ボタンが MCP click で反応しない
- コード自体は正しい (`onClick → handleEdit → router.push`)
- MCP click が React event を発火しない既知制約の可能性
- **副田さんに実マウスで再現するか確認依頼**

### バグ#F: /admin/users が 404
- /admin/users/new はあるが /admin/users (ルート) は 404
- 実害は低いが、ナビゲーション整合性のため /admin/users → /admin/account-management に redirect 推奨

### 注意1: 教員/患者/学生一覧が試験セッション軸で fetch
- 未 assign の教員/患者/学生は一覧に出ない
- 新規登録した直後のユーザーが見えない UX 課題
- セッション切替 selector を一覧画面にも追加するか、「全件表示」モードを追加するか要検討

### 観察事項: 設定画面で「20260505_全身テスト」の合格ライン未設定
- セッション作成時にデフォルト 70% を自動投入するか要検討

---

## cleanup
seed したテストデータの削除は `scripts/_e2e_cleanup_2026-05-13.sql.todo` を参照。
.todo 拡張子で自動 apply 対象外。副田さん指示で実行。
