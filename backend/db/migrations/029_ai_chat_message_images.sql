ALTER TABLE ai_chat_messages ADD COLUMN image_content bytea;
ALTER TABLE ai_chat_messages ADD COLUMN image_mime_type text;
ALTER TABLE ai_chat_messages ADD COLUMN image_name text;
ALTER TABLE ai_chat_messages ADD CONSTRAINT ai_chat_messages_image_fields_check CHECK (
  (image_content IS NULL AND image_mime_type IS NULL AND image_name IS NULL)
  OR (
    image_content IS NOT NULL
    AND octet_length(image_content) BETWEEN 1 AND 5242880
    AND image_mime_type IN ('image/jpeg', 'image/png', 'image/webp')
    AND length(trim(image_name)) BETWEEN 1 AND 255
  )
);
