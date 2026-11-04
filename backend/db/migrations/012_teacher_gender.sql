ALTER TABLE teacher_profiles
  ADD COLUMN gender text NOT NULL DEFAULT 'unspecified'
  CHECK (gender IN ('female', 'male', 'other', 'unspecified'));
