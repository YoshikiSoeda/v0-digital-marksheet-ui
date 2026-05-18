# 負荷テスト計画(200 名同時利用想定)

| 項目 | 値 |
|---|---|
| 作成日 | 2026-05-13 |
| 作成経緯 | 副田さん「200 名同時利用が見込まれる、負荷テストの提案を欲しい」→ 提案後「夜間に実施するので一旦後回し」 |
| 状態 | **保留(夜間 or 副田さんの判断で着手)** |
| 想定実施タイミング | 本番試験日の 1〜2 週間前まで |

---

## 結論サマリ

| 項目 | 推奨 |
|---|---|
| ツール | **k6**(open-source、JS で scenario 記述) |
| 環境 | **Vercel preview deploy + Supabase Branch**(本番影響ゼロ) |
| 計測項目 | API ごとの p50/p95/p99 latency、エラー率、Supabase DB CPU/Connections |
| 段階 | 静的解析 → スモーク 1 VU → 50 VU → 200 VU → 実ユーザー dress rehearsal |

---

## 識別済みのリスク(2026-05-13 時点)

### A. ログインバースト(試験開始時)
- 200 ユーザーが 5 分以内に `/api/auth/login` を叩く
- `verify_*_login` RPC が bcrypt 検証(約 100ms/件)→ 同時 200 で DB CPU スパイク
- **最も危険な瞬間**

### B. 出席ポーリング(患者役側)
- `patient-exam-tabs.tsx` が **10 秒ごと**に `GET /api/attendance-records` を polling
- 患者役 100 名 = 常時 **10 req/s** 定常負荷
- 試験中 30 分なら 18,000 req
- ⚠️ 見落とされがちな定常負荷

### C. リアルタイム保存(評価入力)
- `handleAnswerChange` がボタン押下ごとに `POST /api/evaluation-results`
- 200 ユーザー × 10 問 = 2000 req/30 分
- ピーク数 req/s 程度、DB 書込は軽い

### D. ダッシュボード集計
- admin が `/admin/dashboard` を開くと、students + attendance + evaluation_results + alerts を集計
- 200 学生分の集計クエリ

### E. Supabase advisor の既知問題(2026-05-13 取得)
- **`exam_results` テーブルに excessive bloat** → 書込ホット路の劣化リスク
- `unindexed_foreign_keys` on `subjects.fk_subject_university`
- `auth_db_connections` が absolute 10(percentage 化推奨)
- legacy session 系の `unused_index` 多数(C-7 物理 DROP のタイミングで cleanup)

---

## Phase 1 — 事前準備(1〜2 日)

### 1-1. プラン確認
- Supabase plan(Free / Pro / Team)で max_connections、CPU cores 上限
- Vercel plan(Hobby / Pro)で Function 同時数 / duration

### 1-2. 環境準備
- **Supabase Branch** で本番 DB clone
- **Vercel Preview Deployment** をその Branch に紐付け
- 200 名分の test teacher / patient / student を seed する SQL

### 1-3. 既知 perf 問題の修正
- `exam_results` の `VACUUM FULL`(maintenance window 中)
- `subjects.fk_subject_university` に index 追加
- C-7 で物理 DROP した legacy 列に対応する unused index 削除(scripts/237 と同時)

---

## Phase 2 — スモークテスト(1 VU で baseline)

```js
// loadtest/login_smoke.js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = { vus: 1, duration: '30s' }

export default function () {
  const login = http.post(`${__ENV.BASE_URL}/api/auth/login`,
    JSON.stringify({ loginId: 'showa-t1', password: 'showa-t1' }),
    { headers: { 'Content-Type': 'application/json' } })
  check(login, { 'login 200': r => r.status === 200 })
  sleep(1)
}
```

```bash
k6 run -e BASE_URL=https://v0-...vercel.app loadtest/login_smoke.js
```

正常系で 1 ユーザー何 ms か確認。Supabase 側で `EXPLAIN ANALYZE` も同時に取る。

---

## Phase 3 — 段階的負荷テスト

### 3-1. ログインバースト(50 → 100 → 200 VU)
```js
export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
}
```
- 合格基準: p95 < 2s、エラー率 < 1%

### 3-2. 出席ポーリング(100 VU × 30 分)
```js
export const options = {
  scenarios: {
    polling: { executor: 'constant-vus', vus: 100, duration: '30m' },
  },
}
export default function () {
  http.get(`${__ENV.BASE_URL}/api/attendance-records?...`, { cookies: ... })
  sleep(10)
}
```
- 合格基準: 30 分間 p95 < 500ms、エラー率 0%

### 3-3. 採点入力(200 同時、ランダム間隔)
- 合格基準: POST p95 < 1s、エラー率 < 0.5%、DB CPU < 70%

### 3-4. 複合シナリオ
3-1 + 3-2 + 3-3 を並行実行 + admin 1 名がダッシュボードを時々リロード = 本番試験中の実負荷再現。

---

## Phase 4 — 実ユーザー dress rehearsal(試験 1 週間前)

合成負荷では見えない UX バグを捕捉:
- 教員 / 患者役 / 学生 50 名で同時ログイン → 評価入力 → 結果確認
- UI レンダリング、回線弱いユーザー、Cookie 失効など

---

## 本番試験当日のモニタリング

- **Supabase Dashboard**: DB CPU / Connections / Query latency を別画面に開きっぱなし
- **Vercel Dashboard**: Function invocations / Error rate
- 当日待機要員(副田さん or Claude セッション)が pool 枯渇 / 5xx 急増に即時対応
- ロールバック手順: polling 間隔を伸ばす feature flag、緊急 RPC 無効化

---

## 着手前に副田さんの判断が必要

- Supabase plan アップグレード(Free → Pro 等)が必要か
- Vercel plan アップグレード(必要なら)
- Supabase Branch の予算
- dress rehearsal 用 50 名の調達

---

## 次に着手するときの初手

1. このドキュメントを読み返す
2. Phase 1-3「既知 perf 問題の事前修正」を別 PR で実施(scripts/240 系)
3. `loadtest/` フォルダ作成 + k6 スモークスクリプト雛形
4. Supabase plan / Vercel plan の現状確認
