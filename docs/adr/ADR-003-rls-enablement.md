# ADR-003: Phase 9 — Row Level Security (RLS) 有効化と公開関数のロックダウン

**Status:** Accepted
**Date:** 2026-05-02
**Decided:** 2026-05-02(soeda@ediand.co.jp による承認予定)
**Deciders:** soeda@ediand.co.jp(プロダクトオーナー)/ Claude(設計補助)
**関連:** ADR-001 §6 Phase 9 / ADR-002 §7 9c-6

---

## 1. Context

### 1.1 これまでの経緯

Phase 9c で `lib/data-storage.ts` の anon SELECT/UPSERT を完全撲滅し、すべてのデータアクセスが `app/api/*` のサーバ側ルート(service role client 経由)に集約された。これにより、**Supabase 側で RLS を有効化しても UI は壊れない**前提が整った。

### 1.2 現状の Supabase advisor(2026-05-02 時点)

`get_advisors(security)` の結果:

#### ERROR(16 件)
| 問題 | 対象 | 件数 |
|---|---|---|
| `rls_disabled_in_public` | 13 テーブル(`universities`、`subjects`、`test_sessions`、`students`、`teachers`、`patients`、`rooms`、`tests`、`sheets`、`categories`、`questions`、`attendance_records`、`exam_results`、`admins`)| 13 |
| `sensitive_columns_exposed` | `admins`、`teachers`、`patients`(`password` 列が anon API 経由で見える)| 3 |

#### WARN(主要)
| 問題 | 対象 |
|---|---|
| `function_search_path_mutable` | `hash_password_if_plain`、`update_user_password`、`register_patients_bulk`、`register_teachers_bulk` |
| `anon_security_definer_function_executable` | `verify_*_login`、`register_*_bulk`、`update_*_password_bulk`、`update_user_password`(計 8 関数) |
| `authenticated_security_definer_function_executable` | 同上 8 関数 |

### 1.3 制約と前提

- すべての DB アクセスは `app/api/*` ルートから `getServiceClient()`(service role)経由。
  - Service role は **RLS をバイパス** する Supabase の仕様。policy 定義不要。
- Supabase Auth は使っていない。`auth.uid()` などの組み込み関数は使えない。
- 認証は HttpOnly Cookie ベース(`/api/auth/login` で発行 → middleware でガード)。
- ユーザーがブラウザから anon key で直接 Supabase に接続する経路は実質ゼロ(anon key は `NEXT_PUBLIC_SUPABASE_URL` と一緒に bundle に乗るが、middleware で /api/* が認証必須のため、anon SDK の直接呼び出しはコード上もうない)。
- 利用ユーザーは少数(試用フェーズ)。安全側の設定でいい。

---

## 2. Decision

### 2.1 結論

**Option A: Deny-by-default RLS + service role bypass + SECURITY DEFINER 関数のロックダウン** を採用する。

具体的には:

1. **全 13 テーブルに RLS を ENABLE**(`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`)
2. **anon / authenticated 用の policy は一切定義しない** → これらのロールからは行が見えない
3. **service role はそもそも RLS をバイパスする**(Supabase の仕様)ため、`/api/*` 経由のアクセスは無変更で動く
4. **SECURITY DEFINER 関数 8 つ**(`verify_*_login` / `register_*_bulk` / `update_*_password_bulk` / `update_user_password`)から **anon と authenticated の EXECUTE 権限を REVOKE**。`service_role` のみ実行可能にする
5. **`search_path` 未固定の関数 4 つ** に `SET search_path = public, extensions` を追加

### 2.2 採用理由

- **シンプル**: 細かい行レベル policy(university 単位、role 単位)を書く必要がない
- **セキュア**: anon / authenticated からは何も見えない・実行できない。漏洩経路が物理的にゼロ
- **実装速度**: 1 マイグレーションで完結(13 ENABLE + 関数 REVOKE + search_path 固定)
- **将来性**: 将来 Supabase Auth に切り替えて認証行の owner ベース policy を入れる場合でも、deny-by-default が下敷きになっているので追加 policy が許可だけ書けばよい

---

## 3. Options Considered

### Option A: Deny-by-default + service role bypass(推奨・採用)

| Dimension | Assessment |
|---|---|
| 複雑度 | Low |
| 工数 | 1 PR、SQL 1 ファイル |
| advisor 影響 | RLS ERROR 13 件 + sensitive ERROR 3 件 + SECURITY DEFINER WARN 16 件 解消 |
| ロールアウトリスク | 低(service role bypass のため UI 影響なし) |
| 将来性 | ◎ |

**内容**: 上記 §2.1 の通り。

**Pros**:
- RLS 設計の中で最もシンプル
- 「anon / authenticated はそもそも DB に触れない」という運用前提を policy にも反映
- アプリ側コード変更不要

**Cons**:
- 直接 `psql` や Supabase Studio から anon key で叩こうとしても見えない(普段の運用では問題なし、開発時に anon SDK で SELECT したいなら service role に切り替えが必要)
- 将来 Supabase Auth に切り替えるなら policy を都度追加する必要がある

### Option B: row-owner / university scope ベースの細粒度 policy

| Dimension | Assessment |
|---|---|
| 複雑度 | High |
| 工数 | 大(各テーブル 4 policy = 13 × 4 = 52 policy) |
| advisor 影響 | 同程度に解消するが、policy のバグで本番が空になるリスク |
| 前提 | Supabase Auth 利用が前提(`auth.uid()` か custom JWT claim が要る) |

**内容**: たとえば teachers テーブルに `CREATE POLICY ... USING (university_code = current_setting('app.current_university')::text)` のように、リクエスト元の大学コードでフィルタする policy を全テーブルに定義する。

**Pros**:
- アプリ層で大学スコープを意識しなくても、DB が自動で絞り込んでくれる
- アプリのバグ・データ漏洩を policy が二重に防げる

**Cons**:
- **そもそも Supabase Auth を使っていないので `auth.uid()` が NULL**。代替として `current_setting('app.xxx')` を毎リクエストで設定する仕組みが必要 = アプリ層に大きな変更
- 開発・テストの複雑度が増える(policy を間違えると本番が空に)
- 現状の `/api/*` 集約により、大学スコープはアプリ側の cookie で確実に効いている。policy の二重防御メリットが薄い
- 試用フェーズの規模に対して過剰

### Option C: 認証された supabase JWT を流す(custom JWT claims)

| Dimension | Assessment |
|---|---|
| 複雑度 | Very High |
| 工数 | 大(JWT 発行・検証ロジックを自作 or Supabase Auth 移行) |
| advisor 影響 | 解消するが、設計変更が大きい |

**内容**: `/api/auth/login` で Supabase JWT 風のトークンを発行 → クライアントが Supabase JS SDK で持って直接 DB 接続 → policy が `auth.jwt() ->> 'role'` で判定。

**Cons**:
- 現行の Cookie ベース認証を捨てて JWT 方式に作り直す必要がある(ADR-001 / Phase 9b の前提を覆す)
- Phase 9c で苦労して `/api/*` に集約した設計と相反(クライアント直 DB 接続に逆戻り)
- Supabase Auth に乗らないなら自前 JWT の検証ライブラリが必要
- 実装・運用負担が試用フェーズに不釣合い

---

## 4. Trade-off Analysis

| 観点 | A(推奨) | B | C |
|---|:-:|:-:|:-:|
| advisor 解消 | ◎ | ◎ | ◎ |
| 実装の単純さ | ◎ | × | × |
| ロールアウトリスク | ◎ | △ | × |
| 既存設計との整合 | ◎ | △ | × |
| 試用フェーズに見合うコスト | ◎ | × | × |
| 将来 Supabase Auth 移行時の追加コスト | 低(policy 追記のみ) | 中 | 中(設計重複) |

A を選ばない理由が現状ない。B/C は将来 Supabase Auth に切替えた段階で再検討する。

---

## 5. 実装詳細(SQL)

### 5.1 RLS ENABLE(13 テーブル)

```sql
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
```

policy は **一切定義しない**。これにより anon / authenticated は全 SELECT/INSERT/UPDATE/DELETE が拒否される(0 行返却 / エラー)。

### 5.2 SECURITY DEFINER 関数の EXECUTE REVOKE

```sql
-- anon / authenticated からの実行を拒否、service_role のみ許可
DO $$
DECLARE
  fn record;
  fn_signatures text[] := ARRAY[
    'verify_admin_login(text, text)',
    'verify_teacher_login(text, text)',
    'verify_patient_login(text, text)',
    'register_teachers_bulk(jsonb)',
    'register_patients_bulk(jsonb)',
    'update_user_password(text, text)',
    'update_teacher_password_bulk(uuid[], text)',
    'update_patient_password_bulk(uuid[], text)',
    'hash_password_if_plain(text)'
  ];
  sig text;
BEGIN
  FOREACH sig IN ARRAY fn_signatures LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, authenticated, public', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', sig);
  END LOOP;
END $$;
```

### 5.3 関数 search_path の固定

```sql
ALTER FUNCTION public.hash_password_if_plain(text) SET search_path = public, extensions;
ALTER FUNCTION public.update_user_password(text, text) SET search_path = public, extensions;
ALTER FUNCTION public.register_teachers_bulk(jsonb) SET search_path = public, extensions;
ALTER FUNCTION public.register_patients_bulk(jsonb) SET search_path = public, extensions;
```

### 5.4 検証 SQL(ロールバック判断用)

```sql
-- 期待: 全 13 テーブルが rowsecurity = true
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('universities','subjects','test_sessions','students','teachers',
                    'patients','admins','rooms','tests','sheets','categories',
                    'questions','attendance_records','exam_results')
ORDER BY tablename;

-- 期待: 上記関数の anon / authenticated 実行権限なし
SELECT routine_name,
       has_function_privilege('anon', oid, 'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated', oid, 'EXECUTE') AS auth_exec,
       has_function_privilege('service_role', oid, 'EXECUTE') AS svc_exec
FROM pg_proc, information_schema.routines
WHERE routines.specific_schema = 'public'
  AND routines.routine_name = pg_proc.proname
  AND routines.routine_name IN ('verify_admin_login','verify_teacher_login',
                                'verify_patient_login','register_teachers_bulk',
                                'register_patients_bulk','update_user_password',
                                'update_teacher_password_bulk','update_patient_password_bulk',
                                'hash_password_if_plain');
```

---

## 6. Consequences

### 楽になること
- Supabase advisor の ERROR 16 件 + 関連 WARN 16 件が一気に解消
- データ層のセキュリティが完全に **「`/api/*` を通らない経路は何も見えない」** に統一
- 開発時に「うっかり anon SDK で SELECT して動いた」事故が物理的に起きない

### 難しくなること
- **直接 anon key で SELECT できなくなる**
  - 現状でも UI からは行っていないが、開発時に Supabase Studio や psql から anon で接続して挙動確認は不可になる
  - 必要時は Supabase Studio の SQL Editor(service role)を使う or `getServiceClient()` 経由
- **新テーブル追加時に毎回 RLS ENABLE を忘れない運用** が要る(Supabase advisor で気づけるが、PR レビューでも要チェック)

### 後で見直すかもしれない箇所
- 利用ユーザーが増えて Supabase Auth に移行する場合、role-based / row-owner policy を追加する(本 ADR の deny-by-default を維持しつつ、authenticated 向けの permissive policy を追加する流れ)
- `password` 列を `admins` / `teachers` / `patients` から外して別テーブル(`user_credentials` 等)に分離する可否(Phase 10 候補)

---

## 7. Action Items

### 9-RLS-1: SQL マイグレーション適用(本 PR)
- [ ] `scripts/209_enable_rls_and_lock_definer_functions.sql` を作成(本 ADR §5 の SQL を含む)
- [ ] Supabase MCP `apply_migration` で本番に適用
- [ ] 検証 SQL(§5.4)で適用結果を確認
- [ ] `get_advisors` で ERROR 0 件、WARN が予想通り減少していることを確認

### 9-RLS-2: 本番 smoke test
- [ ] 全 5 ロール(admin/uni/kyouka/ippan/kanjya)でログイン成功
- [ ] admin/admin → `/admin/dashboard` で全データ表示
- [ ] uni/uni、kyouka/kyouka でも同様
- [ ] ippan/ippan → `/teacher/exam-info` → `/teacher/exam` で評価入力 + 保存
- [ ] kanjya/kanjya → `/patient/exam-info` → `/patient/exam` で同様
- [ ] 直接 anon SDK で `SELECT * FROM students` などを叩いて 0 行 / 拒否されることを確認(別途 curl)

### 9-RLS-3: HANDOVER.md 更新
- [ ] Phase 9 完了として現状を反映
- [ ] 残課題(`password` 列分離、Supabase Auth 移行など)を Open Questions に整理

---

## 8. Open Questions

1. **`password` 列を別テーブルに分離するか**: 現状 `admins.password` / `teachers.password` / `patients.password` は bcrypt 化済み(Phase 8 で対応)。Sensitive columns advisor は RLS で解消されるが、長期的には credentials を別テーブルに切るのが望ましい。これは Phase 10 候補
2. **Supabase Auth への移行**: 現行は独自認証(Cookie ベース)。長期運用では Supabase Auth に乗せた方が JWT、MFA、メール認証など標準機能を活用できる。Phase 11 候補
3. **`anon_security_definer_function_executable` を REVOKE すると、Supabase Studio や PostgREST 直叩きで `verify_admin_login` を anon で呼べなくなる** — これは正しい(`/api/auth/login` 経由 = service role でしか呼べないようにしたい)。意図通りの挙動

---

## 9. References

- ADR-001 — UI/UX 再設計(Phase 9 RLS は §6 Action Items の Phase 9 に対応)
- ADR-002 — データ取得層 API 集約(Phase 9c で完了、本 ADR の前提)
- Supabase RLS 公式ドキュメント: https://supabase.com/docs/guides/auth/row-level-security
- 現行マイグレーション: `scripts/205_enable_pgcrypto.sql`、`scripts/206_hash_existing_passwords.sql`、`scripts/207_register_and_password_rpcs.sql`、`scripts/208_deprecate_patient_admin_role.sql`
