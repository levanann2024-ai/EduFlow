CREATE TABLE exam_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES teacher_exam_sessions(id) ON DELETE CASCADE,
  student_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('tab_hidden', 'face_missing', 'multiple_faces', 'speech_activity')),
  occurred_at timestamptz NOT NULL,
  duration_seconds numeric(8, 3) NOT NULL CHECK (duration_seconds BETWEEN 0 AND 36000),
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX exam_logs_session_event_received_idx
  ON exam_logs (session_id, event_type, received_at DESC);
