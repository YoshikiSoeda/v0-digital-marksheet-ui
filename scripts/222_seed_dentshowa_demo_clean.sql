-- 2026-05-04: dentshowa のデモデータをクリーンに作り直す
--
-- 背景:
--   旧仕様時代 (B-2-c 以前) の昭和医科大学 (dentshowa) のデモデータが
--   subject_code 不整合 (700 学生が存在しない GENERAL コード) や
--   過大な件数 (rooms 50, patients 52) で判別しにくくなっていた。
--   B-2-d (過去学生から bulk assign) のデモや動作確認をしやすくするため、
--   一旦すべて削除してクリーンな最小構成で再構築する。
--
-- このスクリプトは Supabase MCP の execute_sql で 2026-05-04 に本番適用済み。
-- Git 履歴に残すために commit する (再現性確保用)。
--
-- 構成 (再構築後):
--   - subject:        dentshowa_OSCE / OSCE基本評価
--   - test_session:   2026年度デモOSCE / 2026-05-04 / 70% / 30 min / completed
--   - rooms:          S101〜S105 (第1〜第5試験室)
--   - teachers:       5 名 (showa-t1〜showa-t5@example.com / pw=showa-t1〜)
--   - patients:       5 名 (showa-p1〜showa-p5@example.com / pw=showa-p1〜)
--   - students:       25 名 (SH001〜SH025、5年生、歯学部、各部屋 5 名)
--   - tests:          教員側 + 患者役側 (各 1 sheet × 1 category × 10 questions、問1のみ alert 対象)
--   - attendance_records:  全 25 名 'present'
--   - exam_results:        50 件 (25 学生 × teacher + patient)
--
-- 合格 18 名 / 不合格 7 名(combined teacher+patient ≥ 70 が合格)。
-- 不合格学生 index: 3, 8, 12, 15, 19, 22, 25
--
-- ロールバック:
--   元のデータには戻せない (Supabase ダッシュボードの PITR を使うしかない)。
--   削除前の件数は: subjects 2, test_sessions 6, rooms 50, teachers 4, patients 52, students 700。

DO $$
DECLARE
  v_subject_code text := 'dentshowa_OSCE';
  v_subject_name text := 'OSCE基本評価';
  v_session_id uuid := gen_random_uuid();
  v_session_desc text := '2026年度デモOSCE';
  v_test_date date := '2026-05-04';

  v_teacher_test_id uuid := gen_random_uuid();
  v_patient_test_id uuid := gen_random_uuid();
  v_t_sheet_id uuid := gen_random_uuid();
  v_p_sheet_id uuid := gen_random_uuid();
  v_t_cat_id uuid := gen_random_uuid();
  v_p_cat_id uuid := gen_random_uuid();

  v_room_numbers text[] := ARRAY['S101','S102','S103','S104','S105'];
  v_room_names   text[] := ARRAY['第1試験室','第2試験室','第3試験室','第4試験室','第5試験室'];

  v_teacher_emails    text[] := ARRAY['showa-t1@example.com','showa-t2@example.com','showa-t3@example.com','showa-t4@example.com','showa-t5@example.com'];
  v_teacher_passwords text[] := ARRAY['showa-t1','showa-t2','showa-t3','showa-t4','showa-t5'];
  v_teacher_names     text[] := ARRAY['田中 健一','佐藤 美咲','鈴木 大輔','高橋 真理','山田 翔太'];

  v_patient_emails    text[] := ARRAY['showa-p1@example.com','showa-p2@example.com','showa-p3@example.com','showa-p4@example.com','showa-p5@example.com'];
  v_patient_passwords text[] := ARRAY['showa-p1','showa-p2','showa-p3','showa-p4','showa-p5'];
  v_patient_names     text[] := ARRAY['患者A','患者B','患者C','患者D','患者E'];

  v_student_names text[] := ARRAY[
    '青木 結衣','石井 拓海','井上 さくら','上田 颯','内田 葵',
    '遠藤 翔','大塚 美月','小川 蓮','加藤 桜','川口 陽菜',
    '木村 翼','工藤 凜','小林 樹','近藤 結','斉藤 蒼太',
    '坂本 心春','佐々木 海','清水 葵','須藤 千夏','瀬川 颯太',
    '田所 美羽','谷口 蓮人','千葉 杏奈','土屋 奏','中野 凛々'
  ];

  v_qt text[] := ARRAY[
    '患者の名前を確認したか','本人確認(生年月日)を行ったか','主訴を聞き取れたか','現病歴を聴取できたか','既往歴を確認できたか',
    '内服薬を確認できたか','アレルギーの有無を確認できたか','家族歴を確認できたか','生活歴を聴取できたか','質問機会を提供したか'
  ];
  v_qp text[] := ARRAY[
    '挨拶や自己紹介があったか','声のトーンは適切か','視線の合わせ方は適切か','話す速度は理解しやすいか','質問は分かりやすかったか',
    '不安を和らげる対応があったか','共感的な反応があったか','医学用語の説明はあったか','質問しやすい雰囲気だったか','全体的に信頼できると感じたか'
  ];

  v_fail_indices int[] := ARRAY[3, 8, 12, 15, 19, 22, 25];

  v_dentshowa_session_ids uuid[];
  v_i int; v_q int; v_s int;
  v_room_idx int; v_room_no text;
  v_stu_uuid uuid;
  v_eval jsonb; v_total int; v_alert boolean; v_score int;
  v_is_pass boolean;
BEGIN
  SELECT array_agg(id) INTO v_dentshowa_session_ids FROM public.test_sessions WHERE university_code = 'dentshowa';

  ---------------- Phase 1: 削除 (FK 順 + university_code/test_session_id 二重条件で取りこぼし防止) ----------------
  DELETE FROM public.exam_results WHERE test_session_id = ANY(COALESCE(v_dentshowa_session_ids, ARRAY[]::uuid[])) OR university_code = 'dentshowa';
  DELETE FROM public.attendance_records WHERE test_session_id = ANY(COALESCE(v_dentshowa_session_ids, ARRAY[]::uuid[])) OR university_code = 'dentshowa';
  DELETE FROM public.student_test_session_assignments
    WHERE test_session_id = ANY(COALESCE(v_dentshowa_session_ids, ARRAY[]::uuid[]))
       OR student_id IN (SELECT id FROM public.students WHERE university_code = 'dentshowa');

  DELETE FROM public.questions
    WHERE category_id IN (
      SELECT c.id FROM public.categories c
      JOIN public.sheets s ON c.sheet_id = s.id
      JOIN public.tests t ON s.test_id = t.id
      WHERE t.university_code = 'dentshowa' OR t.test_session_id = ANY(COALESCE(v_dentshowa_session_ids, ARRAY[]::uuid[]))
    );
  DELETE FROM public.categories
    WHERE sheet_id IN (
      SELECT s.id FROM public.sheets s
      JOIN public.tests t ON s.test_id = t.id
      WHERE t.university_code = 'dentshowa' OR t.test_session_id = ANY(COALESCE(v_dentshowa_session_ids, ARRAY[]::uuid[]))
    );
  DELETE FROM public.sheets
    WHERE test_id IN (
      SELECT id FROM public.tests
      WHERE university_code = 'dentshowa' OR test_session_id = ANY(COALESCE(v_dentshowa_session_ids, ARRAY[]::uuid[]))
    );
  DELETE FROM public.tests WHERE university_code = 'dentshowa' OR test_session_id = ANY(COALESCE(v_dentshowa_session_ids, ARRAY[]::uuid[]));

  DELETE FROM public.rooms WHERE university_code = 'dentshowa' OR test_session_id = ANY(COALESCE(v_dentshowa_session_ids, ARRAY[]::uuid[]));
  DELETE FROM public.teachers WHERE university_code = 'dentshowa' OR test_session_id = ANY(COALESCE(v_dentshowa_session_ids, ARRAY[]::uuid[]));
  DELETE FROM public.patients WHERE university_code = 'dentshowa' OR test_session_id = ANY(COALESCE(v_dentshowa_session_ids, ARRAY[]::uuid[]));
  DELETE FROM public.students WHERE university_code = 'dentshowa';

  DELETE FROM public.test_sessions WHERE university_code = 'dentshowa';
  DELETE FROM public.subjects WHERE university_code = 'dentshowa';

  ---------------- Phase 2: 挿入 ----------------
  INSERT INTO public.subjects (subject_code, subject_name, university_code, is_active)
  VALUES (v_subject_code, v_subject_name, 'dentshowa', true);

  INSERT INTO public.test_sessions
    (id, description, test_date, university_code, subject_code, passing_score, status, duration_minutes)
  VALUES
    (v_session_id, v_session_desc, v_test_date, 'dentshowa', v_subject_code, 70, 'completed', 30);

  FOR v_i IN 1..5 LOOP
    INSERT INTO public.rooms (room_number, room_name, university_code, subject_code, test_session_id)
    VALUES (v_room_numbers[v_i], v_room_names[v_i], 'dentshowa', v_subject_code, v_session_id);
  END LOOP;

  FOR v_i IN 1..5 LOOP
    INSERT INTO public.teachers
      (name, email, password, role, assigned_room_number, university_code, account_type, subject_code, test_session_id)
    VALUES
      (v_teacher_names[v_i], v_teacher_emails[v_i],
       extensions.crypt(v_teacher_passwords[v_i], extensions.gen_salt('bf', 10)),
       'general', v_room_numbers[v_i], 'dentshowa', 'teacher', v_subject_code, v_session_id);
  END LOOP;

  FOR v_i IN 1..5 LOOP
    INSERT INTO public.patients
      (name, email, password, role, assigned_room_number, university_code, account_type, subject_code, test_session_id)
    VALUES
      (v_patient_names[v_i], v_patient_emails[v_i],
       extensions.crypt(v_patient_passwords[v_i], extensions.gen_salt('bf', 10)),
       'general', v_room_numbers[v_i], 'dentshowa', 'patient', v_subject_code, v_session_id);
  END LOOP;

  INSERT INTO public.tests (id, title, university_code, test_session_id, subject_code, role_type)
    VALUES (v_teacher_test_id, '教員側評価シート', 'dentshowa', v_session_id, v_subject_code, 'teacher');
  INSERT INTO public.tests (id, title, university_code, test_session_id, subject_code, role_type)
    VALUES (v_patient_test_id, '患者役評価シート', 'dentshowa', v_session_id, v_subject_code, 'patient');

  INSERT INTO public.sheets (id, test_id, title) VALUES (v_t_sheet_id, v_teacher_test_id, '評価シート');
  INSERT INTO public.sheets (id, test_id, title) VALUES (v_p_sheet_id, v_patient_test_id, '評価シート');

  INSERT INTO public.categories (id, sheet_id, title, number) VALUES (v_t_cat_id, v_t_sheet_id, '評価項目', 1);
  INSERT INTO public.categories (id, sheet_id, title, number) VALUES (v_p_cat_id, v_p_sheet_id, '評価項目', 1);

  FOR v_q IN 1..10 LOOP
    INSERT INTO public.questions (category_id, number, text, option1, option2, option3, option4, option5, is_alert_target, alert_options)
    VALUES (v_t_cat_id, v_q, v_qt[v_q],
      '実施しなかった','不十分','一部実施','概ね実施','十分実施',
      (v_q = 1), CASE WHEN v_q = 1 THEN ARRAY[1,2] ELSE NULL::int[] END);
    INSERT INTO public.questions (category_id, number, text, option1, option2, option3, option4, option5, is_alert_target, alert_options)
    VALUES (v_p_cat_id, v_q, v_qp[v_q],
      '全く感じなかった','あまり感じなかった','どちらでもない','やや感じた','十分感じた',
      (v_q = 1), CASE WHEN v_q = 1 THEN ARRAY[1,2] ELSE NULL::int[] END);
  END LOOP;

  FOR v_s IN 1..25 LOOP
    v_room_idx := ((v_s - 1) / 5) + 1;
    v_room_no := v_room_numbers[v_room_idx];
    v_stu_uuid := gen_random_uuid();
    v_is_pass := NOT (v_s = ANY(v_fail_indices));

    INSERT INTO public.students
      (id, student_id, name, department, grade, university_code, subject_code, test_session_id, room_number)
    VALUES
      (v_stu_uuid, 'SH' || lpad(v_s::text, 3, '0'), v_student_names[v_s], '歯学部', '5年',
       'dentshowa', v_subject_code, NULL, NULL);

    INSERT INTO public.student_test_session_assignments (student_id, test_session_id, room_number)
    VALUES (v_stu_uuid, v_session_id, v_room_no);

    INSERT INTO public.attendance_records
      (student_id, room_number, status, recorded_at, university_code, subject_code, test_session_id)
    VALUES
      (v_stu_uuid::text, v_room_no, 'present', now(), 'dentshowa', v_subject_code, v_session_id);

    -- teacher eval
    v_eval := '{}'::jsonb; v_total := 0; v_alert := false;
    FOR v_q IN 1..10 LOOP
      v_score := CASE WHEN v_is_pass THEN 3 + floor(random()*3)::int ELSE 1 + floor(random()*3)::int END;
      v_eval := v_eval || jsonb_build_object(v_q::text, v_score);
      v_total := v_total + v_score;
      IF v_q = 1 AND v_score <= 2 THEN v_alert := true; END IF;
    END LOOP;
    INSERT INTO public.exam_results
      (student_id, room_number, evaluator_email, evaluator_type, test_id, evaluations, total_score, max_score, is_completed, has_alert, university_code, subject_code, test_session_id)
    VALUES
      (v_stu_uuid::text, v_room_no, v_teacher_emails[v_room_idx], 'teacher', v_teacher_test_id,
       v_eval, v_total, 50, true, v_alert, 'dentshowa', v_subject_code, v_session_id);

    -- patient eval
    v_eval := '{}'::jsonb; v_total := 0; v_alert := false;
    FOR v_q IN 1..10 LOOP
      v_score := CASE WHEN v_is_pass THEN 3 + floor(random()*3)::int ELSE 1 + floor(random()*3)::int END;
      v_eval := v_eval || jsonb_build_object(v_q::text, v_score);
      v_total := v_total + v_score;
      IF v_q = 1 AND v_score <= 2 THEN v_alert := true; END IF;
    END LOOP;
    INSERT INTO public.exam_results
      (student_id, room_number, evaluator_email, evaluator_type, test_id, evaluations, total_score, max_score, is_completed, has_alert, university_code, subject_code, test_session_id)
    VALUES
      (v_stu_uuid::text, v_room_no, v_patient_emails[v_room_idx], 'patient', v_patient_test_id,
       v_eval, v_total, 50, true, v_alert, 'dentshowa', v_subject_code, v_session_id);
  END LOOP;
END $$;
