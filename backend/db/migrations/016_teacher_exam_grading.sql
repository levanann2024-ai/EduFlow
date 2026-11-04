CREATE TABLE teacher_exam_session_grades (
  session_id uuid PRIMARY KEY REFERENCES teacher_exam_sessions(id) ON DELETE CASCADE,
  grader_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  question_scores jsonb NOT NULL CHECK (jsonb_typeof(question_scores) = 'object'),
  total_score numeric(8, 2) NOT NULL CHECK (total_score >= 0),
  teacher_feedback text NOT NULL DEFAULT '' CHECK (length(teacher_feedback) <= 5000),
  graded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX teacher_exam_session_grades_grader_idx
  ON teacher_exam_session_grades (grader_user_id, graded_at DESC);
