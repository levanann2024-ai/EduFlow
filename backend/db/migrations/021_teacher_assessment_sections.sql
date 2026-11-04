ALTER TABLE teacher_assessments
  ADD COLUMN sections jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(sections) = 'array');
