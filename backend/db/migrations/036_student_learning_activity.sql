CREATE TABLE student_learning_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_key uuid NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN (
    'resource_view',
    'assignment_submit',
    'exam_submit',
    'result_view',
    'ai_chat',
    'ai_practice'
  )),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_key)
);

CREATE INDEX student_learning_activity_user_occurred_idx
  ON student_learning_activity (user_id, occurred_at DESC);
