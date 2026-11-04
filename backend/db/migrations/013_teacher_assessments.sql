CREATE TABLE teacher_assessments (
  id uuid PRIMARY KEY,
  teacher_user_id uuid NOT NULL,
  school_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('exam', 'assignment')),
  client_id text NOT NULL CHECK (length(trim(client_id)) BETWEEN 1 AND 160),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_user_id, kind, client_id),
  FOREIGN KEY (teacher_user_id, school_id)
    REFERENCES teacher_profiles(user_id, school_id) ON DELETE RESTRICT
);

CREATE INDEX teacher_assessments_owner_kind_updated_idx
  ON teacher_assessments (teacher_user_id, kind, updated_at DESC);
