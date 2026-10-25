CREATE TABLE student_term_grades (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL,
  school_id uuid NOT NULL,
  student_user_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE RESTRICT,
  subject text NOT NULL,
  academic_year text NOT NULL,
  semester text NOT NULL CHECK (semester IN ('Kỳ 1', 'Kỳ 2')),
  regular_1 numeric(4, 2) CHECK (regular_1 BETWEEN 0 AND 10),
  regular_2 numeric(4, 2) CHECK (regular_2 BETWEEN 0 AND 10),
  regular_3 numeric(4, 2) CHECK (regular_3 BETWEEN 0 AND 10),
  regular_4 numeric(4, 2) CHECK (regular_4 BETWEEN 0 AND 10),
  midterm numeric(4, 2) CHECK (midterm BETWEEN 0 AND 10),
  final numeric(4, 2) CHECK (final BETWEEN 0 AND 10),
  created_by uuid NOT NULL REFERENCES teacher_profiles(user_id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES teacher_profiles(user_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_user_id, subject, academic_year, semester),
  FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id) ON DELETE RESTRICT
);

CREATE INDEX student_term_grades_lookup_idx
  ON student_term_grades (class_id, academic_year, semester, subject);

CREATE TABLE class_assignments (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL,
  school_id uuid NOT NULL,
  teacher_user_id uuid NOT NULL REFERENCES teacher_profiles(user_id) ON DELETE RESTRICT,
  subject text NOT NULL,
  academic_year text NOT NULL,
  semester text NOT NULL CHECK (semester IN ('Kỳ 1', 'Kỳ 2')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '',
  due_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, class_id),
  FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id) ON DELETE RESTRICT
);

CREATE INDEX class_assignments_class_period_idx
  ON class_assignments (class_id, academic_year, semester, subject, due_at);

CREATE TABLE class_assignment_submissions (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL,
  class_id uuid NOT NULL,
  student_user_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE RESTRICT,
  response_text text NOT NULL CHECK (length(trim(response_text)) BETWEEN 1 AND 20000),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_user_id),
  FOREIGN KEY (assignment_id, class_id)
    REFERENCES class_assignments(id, class_id) ON DELETE RESTRICT
);

CREATE INDEX class_assignment_submissions_student_idx
  ON class_assignment_submissions (student_user_id, submitted_at);
