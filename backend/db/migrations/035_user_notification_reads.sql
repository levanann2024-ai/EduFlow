CREATE TABLE user_notification_reads (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id text NOT NULL CHECK (length(notification_id) BETWEEN 1 AND 240),
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, notification_id)
);

CREATE INDEX user_notification_reads_read_at_idx
  ON user_notification_reads (user_id, read_at DESC);
