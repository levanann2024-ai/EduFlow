CREATE TABLE exam_appeals (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL UNIQUE REFERENCES teacher_exam_sessions(id) ON DELETE CASCADE,
  student_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'rejected')),
  teacher_response text NOT NULL DEFAULT '' CHECK (length(teacher_response) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CHECK ((status = 'pending' AND reviewed_at IS NULL) OR (status <> 'pending' AND reviewed_at IS NOT NULL))
);

CREATE INDEX exam_appeals_student_created_idx
  ON exam_appeals (student_user_id, created_at DESC);

CREATE INDEX exam_appeals_status_created_idx
  ON exam_appeals (status, created_at DESC);
