CREATE TABLE teacher_exam_rooms (
  id uuid PRIMARY KEY,
  teacher_user_id uuid NOT NULL,
  school_id uuid NOT NULL,
  code text NOT NULL CHECK (length(trim(code)) BETWEEN 1 AND 32),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  status text NOT NULL CHECK (status IN ('draft', 'scheduled', 'open', 'closed', 'completed')),
  starts_at timestamptz NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_user_id, id),
  FOREIGN KEY (teacher_user_id, school_id)
    REFERENCES teacher_profiles(user_id, school_id) ON DELETE RESTRICT
);

CREATE INDEX teacher_exam_rooms_owner_status_start_idx
  ON teacher_exam_rooms (teacher_user_id, status, starts_at);
