ALTER TABLE class_assignment_submissions
  ADD COLUMN score numeric(4, 2) CHECK (score BETWEEN 0 AND 10);

ALTER TABLE class_assignment_submissions
  ADD COLUMN teacher_feedback text NOT NULL DEFAULT '' CHECK (length(teacher_feedback) <= 5000);

ALTER TABLE class_assignment_submissions
  ADD COLUMN graded_by uuid REFERENCES teacher_profiles(user_id) ON DELETE RESTRICT;

ALTER TABLE class_assignment_submissions
  ADD COLUMN graded_at timestamptz;

ALTER TABLE class_assignment_submissions
  ADD CONSTRAINT class_assignment_submissions_grading_state_check
  CHECK (
    (score IS NULL AND graded_by IS NULL AND graded_at IS NULL)
    OR (score IS NOT NULL AND graded_by IS NOT NULL AND graded_at IS NOT NULL)
  );
