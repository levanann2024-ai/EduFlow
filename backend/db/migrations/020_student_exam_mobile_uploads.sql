CREATE TABLE teacher_exam_mobile_upload_sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  session_id uuid NOT NULL REFERENCES teacher_exam_sessions(id) ON DELETE CASCADE,
  question_number integer NOT NULL CHECK (question_number BETWEEN 1 AND 500),
  expires_at timestamptz NOT NULL,
  original_name text CHECK (original_name IS NULL OR length(trim(original_name)) BETWEEN 1 AND 255),
  media_type text CHECK (media_type IS NULL OR media_type IN ('image/jpeg', 'image/png', 'image/gif', 'image/webp')),
  size_bytes integer CHECK (size_bytes IS NULL OR size_bytes BETWEEN 1 AND 10485760),
  content bytea,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (content IS NULL AND original_name IS NULL AND media_type IS NULL AND size_bytes IS NULL)
    OR (content IS NOT NULL AND original_name IS NOT NULL AND media_type IS NOT NULL AND size_bytes IS NOT NULL)
  )
);

CREATE INDEX teacher_exam_mobile_upload_sessions_expiry_idx
  ON teacher_exam_mobile_upload_sessions (expires_at);

CREATE INDEX teacher_exam_mobile_upload_sessions_exam_idx
  ON teacher_exam_mobile_upload_sessions (session_id, question_number, expires_at);
