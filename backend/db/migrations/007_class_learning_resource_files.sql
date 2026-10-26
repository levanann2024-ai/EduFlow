ALTER TABLE class_learning_resources
  ALTER COLUMN content SET DEFAULT '',
  DROP CONSTRAINT class_learning_resources_content_check,
  ADD CONSTRAINT class_learning_resources_content_check
    CHECK (length(trim(content)) BETWEEN 0 AND 50000);

CREATE TABLE class_learning_resource_files (
  id uuid PRIMARY KEY,
  resource_id uuid NOT NULL UNIQUE REFERENCES class_learning_resources(id) ON DELETE CASCADE,
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
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'video/mp4'
  )),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 52428800),
  content bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
