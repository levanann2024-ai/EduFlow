CREATE TABLE class_learning_resource_chapters (
  class_id uuid NOT NULL,
  school_id uuid NOT NULL,
  subject text NOT NULL CHECK (length(trim(subject)) BETWEEN 1 AND 120),
  academic_year text NOT NULL CHECK (length(trim(academic_year)) BETWEEN 4 AND 20),
  semester text NOT NULL CHECK (semester IN ('Kỳ 1', 'Kỳ 2')),
  chapter text NOT NULL CHECK (length(trim(chapter)) BETWEEN 1 AND 160),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, school_id, academic_year, semester, subject, chapter),
  FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX class_learning_resource_chapters_normalized_unique
  ON class_learning_resource_chapters
    (class_id, school_id, academic_year, semester, lower(trim(subject)), lower(trim(chapter)));

CREATE INDEX class_learning_resource_chapters_scope_idx
  ON class_learning_resource_chapters (class_id, academic_year, semester, subject);
