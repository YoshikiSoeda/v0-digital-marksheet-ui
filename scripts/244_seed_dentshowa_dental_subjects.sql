-- scripts/244: 昭和医科大学 歯学部 講座を subjects に seed
--
-- 副田さん依頼 (2026-05-19): 講座一覧 17 件 を教科として登録。
-- 既存 dentshowa_OSCE (OSCE基本評価) はそのまま残置。
--
-- 注意:
--   subject_code は character varying(20) 制限のため短縮形で命名 (dent_xxx)。
--
-- 適用済 (本番 DB に MCP 経由で INSERT 済み)。
--
-- ロールバック:
--   DELETE FROM subjects
--   WHERE university_code='dentshowa' AND subject_code IN (
--     'dent_education','dent_anatomy','dent_physiology','dent_biochem',
--     'dent_microbio','dent_pharm','dent_materials','dent_oral_health',
--     'dent_conserv','dent_prostho','dent_oral_surgery','dent_ortho',
--     'dent_path','dent_implant','dent_pediatric','dent_oral_mgmt',
--     'dent_general_mgmt'
--   );

INSERT INTO subjects (subject_code, subject_name, university_code, description, is_active)
VALUES
  ('dent_education',     '歯学教育学講座',           'dentshowa', NULL, true),
  ('dent_anatomy',       '口腔解剖学講座',           'dentshowa', NULL, true),
  ('dent_physiology',    '口腔生理学講座',           'dentshowa', NULL, true),
  ('dent_biochem',       '口腔生化学講座',           'dentshowa', NULL, true),
  ('dent_microbio',      '口腔微生物学講座',         'dentshowa', NULL, true),
  ('dent_pharm',         '歯科薬理学講座',           'dentshowa', NULL, true),
  ('dent_materials',     '歯科理工学講座',           'dentshowa', NULL, true),
  ('dent_oral_health',   '口腔衛生学講座',           'dentshowa', NULL, true),
  ('dent_conserv',       '歯科保存',                 'dentshowa', NULL, true),
  ('dent_prostho',       '歯科補綴学講座',           'dentshowa', NULL, true),
  ('dent_oral_surgery',  '口腔外科学講座',           'dentshowa', NULL, true),
  ('dent_ortho',         '歯科矯正学講座',           'dentshowa', NULL, true),
  ('dent_path',          '口腔病態診断科学講座',     'dentshowa', NULL, true),
  ('dent_implant',       'インプラント歯科学講座',   'dentshowa', NULL, true),
  ('dent_pediatric',     '小児成育歯科学講座',       'dentshowa', NULL, true),
  ('dent_oral_mgmt',     '口腔健康管理学講座',       'dentshowa', NULL, true),
  ('dent_general_mgmt',  '全身管理歯科学講座',       'dentshowa', NULL, true)
ON CONFLICT (subject_code) DO UPDATE SET
  subject_name = EXCLUDED.subject_name,
  university_code = EXCLUDED.university_code,
  is_active = EXCLUDED.is_active;
