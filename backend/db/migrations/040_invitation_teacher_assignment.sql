ALTER TABLE account_invitations
  ADD COLUMN teacher_class_id uuid,
  ADD COLUMN teacher_subject text,
  ADD CONSTRAINT account_invitations_teacher_class_school_fkey
    FOREIGN KEY (teacher_class_id, school_id)
    REFERENCES classes(id, school_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT account_invitations_teacher_assignment_check
    CHECK (
      (teacher_class_id IS NULL AND teacher_subject IS NULL)
      OR (
        role = 'lecturer'
        AND teacher_class_id IS NOT NULL
        AND teacher_subject IS NOT NULL
        AND length(trim(teacher_subject)) BETWEEN 1 AND 120
      )
    );
