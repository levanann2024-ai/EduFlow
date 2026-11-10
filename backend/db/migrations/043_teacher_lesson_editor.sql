ALTER TABLE class_learning_resources
  ADD COLUMN editor_document jsonb;

CREATE TABLE teacher_lesson_drafts (
  id uuid PRIMARY KEY,
  teacher_user_id uuid NOT NULL REFERENCES teacher_profiles(user_id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  editor_document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX teacher_lesson_drafts_owner_updated_idx
  ON teacher_lesson_drafts (teacher_user_id, updated_at DESC);

CREATE TABLE teacher_lesson_draft_assets (
  id uuid PRIMARY KEY,
  draft_id uuid NOT NULL REFERENCES teacher_lesson_drafts(id) ON DELETE CASCADE,
  original_name text NOT NULL CHECK (length(trim(original_name)) BETWEEN 1 AND 255),
  media_type text NOT NULL CHECK (media_type IN ('image/jpeg', 'image/png', 'image/gif', 'image/webp')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 3145728),
  content bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX teacher_lesson_draft_assets_draft_idx
  ON teacher_lesson_draft_assets (draft_id, created_at);

CREATE TABLE class_learning_resource_assets (
  id uuid PRIMARY KEY,
  resource_id uuid NOT NULL REFERENCES class_learning_resources(id) ON DELETE CASCADE,
  original_name text NOT NULL CHECK (length(trim(original_name)) BETWEEN 1 AND 255),
  media_type text NOT NULL CHECK (media_type IN ('image/jpeg', 'image/png', 'image/gif', 'image/webp')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 3145728),
  content bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX class_learning_resource_assets_resource_idx
  ON class_learning_resource_assets (resource_id, created_at);
