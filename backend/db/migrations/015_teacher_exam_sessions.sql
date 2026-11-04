CREATE UNIQUE INDEX teacher_exam_rooms_school_code_uidx
  ON teacher_exam_rooms (school_id, code);

CREATE TABLE teacher_exam_sessions (
  id uuid PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES teacher_exam_rooms(id) ON DELETE CASCADE,
  student_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'in-progress' CHECK (status IN ('in-progress', 'review', 'submitted')),
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(answers) = 'object'),
  result jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(result) = 'object'),
  UNIQUE (room_id, student_user_id)
);

CREATE INDEX teacher_exam_sessions_room_status_idx
  ON teacher_exam_sessions (room_id, status, started_at);

CREATE TABLE teacher_exam_events (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES teacher_exam_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'tab-hidden', 'window-blur', 'fullscreen-exit', 'connection-lost', 'connection-restored'
  )),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX teacher_exam_events_session_time_idx
  ON teacher_exam_events (session_id, occurred_at);
