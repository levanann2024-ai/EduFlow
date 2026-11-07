CREATE TABLE saved_items (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('quiz', 'answer', 'resource', 'question', 'exam', 'assignment', 'lesson')),
  item_id text NOT NULL CHECK (length(item_id) BETWEEN 1 AND 240),
  saved_at timestamptz NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  PRIMARY KEY (user_id, item_type, item_id)
);

CREATE INDEX saved_items_owner_saved_at_idx
  ON saved_items (user_id, saved_at DESC, item_type, item_id);
