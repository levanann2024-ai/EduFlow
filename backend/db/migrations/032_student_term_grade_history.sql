CREATE TABLE student_term_grade_history (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL,
  school_id uuid NOT NULL,
  student_user_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE RESTRICT,
  subject text NOT NULL,
  academic_year text NOT NULL,
  semester text NOT NULL CHECK (semester IN ('Kỳ 1', 'Kỳ 2')),
  average numeric(4, 2) NOT NULL CHECK (average BETWEEN 0 AND 10),
  recorded_by uuid NOT NULL REFERENCES teacher_profiles(user_id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id) ON DELETE RESTRICT
);

CREATE INDEX student_term_grade_history_lookup_idx
  ON student_term_grade_history (class_id, academic_year, semester, subject, student_user_id, recorded_at);

INSERT INTO student_term_grade_history (
  id, class_id, school_id, student_user_id, subject, academic_year, semester,
  average, recorded_by, recorded_at
)
SELECT gen_random_uuid(), class_id, school_id, student_user_id, subject, academic_year, semester,
       confirmed_average, updated_by, updated_at
  FROM student_term_grades
 WHERE confirmed_average IS NOT NULL;
