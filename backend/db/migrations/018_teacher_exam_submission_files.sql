CREATE TABLE teacher_exam_submission_files (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES teacher_exam_sessions(id) ON DELETE CASCADE,
  question_number integer NOT NULL CHECK (question_number BETWEEN 1 AND 500),
  original_name text NOT NULL CHECK (length(trim(original_name)) BETWEEN 1 AND 255),
  media_type text NOT NULL CHECK (media_type IN ('image/jpeg', 'image/png', 'image/gif', 'image/webp')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  content bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX teacher_exam_submission_files_session_idx
  ON teacher_exam_submission_files (session_id, question_number, created_at);
