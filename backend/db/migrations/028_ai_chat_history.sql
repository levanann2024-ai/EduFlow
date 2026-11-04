CREATE TABLE ai_chat_conversations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_role text NOT NULL CHECK (user_role IN ('student', 'lecturer', 'admin')),
  legacy_id text,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  subject text NOT NULL DEFAULT '' CHECK (length(subject) <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_chat_conversations_owner_updated_idx
  ON ai_chat_conversations (user_id, user_role, updated_at DESC);

CREATE UNIQUE INDEX ai_chat_conversations_legacy_owner_idx
  ON ai_chat_conversations (user_id, user_role, legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE TABLE ai_chat_messages (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES ai_chat_conversations(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('user', 'assistant')),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 40000),
  subject text NOT NULL DEFAULT '' CHECK (length(subject) <= 120),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_chat_messages_conversation_created_idx
  ON ai_chat_messages (conversation_id, created_at, id);
