ALTER TABLE class_memberships
  DROP CONSTRAINT class_memberships_class_id_student_user_id_key;

ALTER TABLE class_memberships
  ADD CONSTRAINT class_memberships_period_status_consistent
  CHECK (
    (status = 'active' AND ended_at IS NULL)
    OR (status = 'ended' AND ended_at IS NOT NULL)
  );

CREATE UNIQUE INDEX class_memberships_one_active_per_student_class
  ON class_memberships (class_id, student_user_id)
  WHERE status = 'active';

ALTER TABLE teacher_class_assignments
  DROP CONSTRAINT teacher_class_assignments_class_id_teacher_user_id_subject_key;

CREATE UNIQUE INDEX teacher_class_assignments_one_active_subject
  ON teacher_class_assignments (
    class_id,
    teacher_user_id,
    lower(regexp_replace(subject, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
  )
  WHERE revoked_at IS NULL;
