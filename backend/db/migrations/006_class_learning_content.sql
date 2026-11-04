ALTER TABLE class_assignments
  ADD COLUMN chapter text NOT NULL DEFAULT '',
  ADD COLUMN lesson text NOT NULL DEFAULT '',
  ADD COLUMN period text;

CREATE TABLE class_learning_resources (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL,
  school_id uuid NOT NULL,
  teacher_user_id uuid NOT NULL REFERENCES teacher_profiles(user_id) ON DELETE RESTRICT,
  subject text NOT NULL,
  academic_year text NOT NULL,
  semester text NOT NULL CHECK (semester IN ('Kỳ 1', 'Kỳ 2')),
  chapter text NOT NULL CHECK (length(trim(chapter)) BETWEEN 1 AND 160),
  lesson text NOT NULL CHECK (length(trim(lesson)) BETWEEN 1 AND 200),
  period text,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  content text NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 50000),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id) ON DELETE RESTRICT
);

CREATE INDEX class_learning_resources_class_period_idx
  ON class_learning_resources (class_id, academic_year, semester, subject, created_at DESC);
