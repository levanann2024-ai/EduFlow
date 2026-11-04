CREATE TABLE class_assignment_submission_files (
  id uuid PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES class_assignment_submissions(id) ON DELETE CASCADE,
  original_name text NOT NULL CHECK (length(trim(original_name)) BETWEEN 1 AND 255),
  media_type text NOT NULL CHECK (media_type IN (
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  content bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX class_assignment_submission_files_submission_idx
  ON class_assignment_submission_files (submission_id, created_at);
