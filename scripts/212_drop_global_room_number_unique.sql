-- ADR-005 F2: rooms テーブルから「部屋番号がグローバルにユニーク」な UNIQUE 制約を削除
--
-- 背景:
--   - rooms_room_number_key UNIQUE (room_number) — 部屋番号が DB 全体で一意。
--     dentshowa が "101" を持っていると EDIAND は "101" を作れない、という複数大学運用に
--     耐えない制約が残っていた。
--   - rooms_unique_per_session UNIQUE (room_number, university_code, subject_code, test_session_id)
--     — 同一試験セッション内での部屋番号一意。こちらが正しい設計意図。
--
-- 適用順序の注意:
--   このマイグレーションを適用する前に、必ず app/api/rooms/route.ts の
--   onConflict を 4 列に揃えた版をデプロイしておくこと(ADR-005 F1 fix)。
--   さもないと、UI 側の onConflict("room_number,test_session_id") 指定と
--   DB の UNIQUE 制約集合が依然不一致のままになる。
--
-- 既存データへの影響:
--   なし。rooms_unique_per_session が同等以上の制約を担保するため、
--   既存の挿入が壊れることはない。dentshowa の "101" と ediand の "E101" は
--   引き続き共存可能、かつ将来 ediand を "101" にリネームしても衝突しない。

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.rooms'::regclass
      AND conname  = 'rooms_room_number_key'
  ) THEN
    ALTER TABLE public.rooms DROP CONSTRAINT rooms_room_number_key;
    RAISE NOTICE 'Dropped UNIQUE constraint rooms_room_number_key';
  ELSE
    RAISE NOTICE 'Constraint rooms_room_number_key already absent';
  END IF;
END $$;

-- 検証: 残るべき UNIQUE は rooms_pkey と rooms_unique_per_session のみ
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt
  FROM pg_constraint
  WHERE conrelid = 'public.rooms'::regclass
    AND contype  = 'u'
    AND conname  = 'rooms_room_number_key';
  IF cnt <> 0 THEN
    RAISE EXCEPTION 'Migration failed: rooms_room_number_key still present';
  END IF;

  SELECT count(*) INTO cnt
  FROM pg_constraint
  WHERE conrelid = 'public.rooms'::regclass
    AND contype  = 'u'
    AND conname  = 'rooms_unique_per_session';
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'Migration failed: rooms_unique_per_session missing — manual recreation required';
  END IF;

  RAISE NOTICE 'OK: rooms now has only rooms_unique_per_session as UNIQUE';
END $$;
