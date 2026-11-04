ALTER TABLE class_assignment_submissions
  ADD COLUMN question_scores jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(question_scores) = 'object');

ALTER TABLE class_assignment_submissions
  ADD COLUMN question_feedback jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(question_feedback) = 'object');
