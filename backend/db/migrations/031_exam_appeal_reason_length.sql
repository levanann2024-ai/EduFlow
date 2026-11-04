ALTER TABLE exam_appeals DROP CONSTRAINT exam_appeals_reason_check;
ALTER TABLE exam_appeals ADD CONSTRAINT exam_appeals_reason_check
  CHECK (length(trim(reason)) BETWEEN 1 AND 2000);
