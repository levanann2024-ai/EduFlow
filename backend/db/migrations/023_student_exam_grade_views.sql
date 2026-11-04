CREATE TABLE teacher_exam_grade_views (
  session_id uuid NOT NULL REFERENCES teacher_exam_sessions(id) ON DELETE CASCADE,
  student_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_graded_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, student_user_id)
);
