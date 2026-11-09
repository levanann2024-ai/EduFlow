CREATE TABLE academic_years (
  id uuid PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  starts_on date,
  ends_on date,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'closed', 'legacy')),
  is_current boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_on IS NULL OR ends_on IS NULL OR starts_on <= ends_on),
  CHECK (NOT is_current OR status = 'active'),
  UNIQUE (id, school_id)
);

CREATE UNIQUE INDEX academic_years_name_normalized_unique
  ON academic_years (school_id, lower(regexp_replace(name, '^[[:space:]]+|[[:space:]]+$', '', 'g')));

CREATE UNIQUE INDEX academic_years_one_current_per_school
  ON academic_years (school_id) WHERE is_current;

INSERT INTO academic_years (id, school_id, name, status, is_current)
SELECT DISTINCT ON (
         c.school_id,
         lower(regexp_replace(c.academic_year, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
       )
       gen_random_uuid(),
       c.school_id,
       regexp_replace(c.academic_year, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
       'legacy',
       false
  FROM classes c
 ORDER BY c.school_id,
          lower(regexp_replace(c.academic_year, '^[[:space:]]+|[[:space:]]+$', '', 'g')),
          regexp_replace(c.academic_year, '^[[:space:]]+|[[:space:]]+$', '', 'g');

ALTER TABLE classes
  ADD COLUMN academic_year_id uuid;

UPDATE classes c
   SET academic_year_id = ay.id
  FROM academic_years ay
 WHERE ay.school_id = c.school_id
   AND lower(regexp_replace(ay.name, '^[[:space:]]+|[[:space:]]+$', '', 'g')) =
       lower(regexp_replace(c.academic_year, '^[[:space:]]+|[[:space:]]+$', '', 'g'));

ALTER TABLE classes
  ADD CONSTRAINT classes_academic_year_school_fk
  FOREIGN KEY (academic_year_id, school_id)
  REFERENCES academic_years(id, school_id) ON DELETE RESTRICT;

ALTER TABLE classes
  ALTER COLUMN academic_year_id SET NOT NULL;

ALTER TABLE classes
  ADD CONSTRAINT classes_id_school_academic_year_unique
  UNIQUE (id, school_id, academic_year_id);

CREATE INDEX classes_school_academic_year_idx
  ON classes (school_id, academic_year_id, status);

CREATE UNIQUE INDEX classes_code_normalized_per_year_unique
  ON classes (school_id, upper(regexp_replace(trim(code), '[[:space:]]+', '', 'g')), academic_year_id)
  WHERE academic_year_id IS NOT NULL;

ALTER TABLE class_memberships
  ADD COLUMN academic_year_id uuid;

UPDATE class_memberships cm
   SET academic_year_id = c.academic_year_id
  FROM classes c
 WHERE c.id = cm.class_id AND c.school_id = cm.school_id;

ALTER TABLE class_memberships
  ADD CONSTRAINT class_memberships_class_school_academic_year_fk
  FOREIGN KEY (class_id, school_id, academic_year_id)
  REFERENCES classes(id, school_id, academic_year_id) ON DELETE RESTRICT;

ALTER TABLE class_memberships
  ALTER COLUMN academic_year_id SET NOT NULL;

CREATE UNIQUE INDEX class_memberships_one_active_per_student_year
  ON class_memberships (student_user_id, school_id, academic_year_id)
  WHERE status = 'active' AND academic_year_id IS NOT NULL;

CREATE TABLE school_subjects (
  id uuid PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  code text CHECK (code IS NULL OR length(trim(code)) BETWEEN 1 AND 32),
  created_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, school_id)
);

INSERT INTO school_subjects (id, school_id, name)
SELECT DISTINCT ON (
         subject_rows.school_id,
         lower(regexp_replace(subject_rows.subject, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
       )
       gen_random_uuid(),
       subject_rows.school_id,
       regexp_replace(subject_rows.subject, '^[[:space:]]+|[[:space:]]+$', '', 'g')
  FROM (
    SELECT school_id, subject FROM class_subjects
    UNION ALL
    SELECT school_id, subject FROM teacher_class_assignments
  ) subject_rows
 WHERE subject_rows.subject ~ '[^[:space:]]'
 ORDER BY subject_rows.school_id,
          lower(regexp_replace(subject_rows.subject, '^[[:space:]]+|[[:space:]]+$', '', 'g')),
          regexp_replace(subject_rows.subject, '^[[:space:]]+|[[:space:]]+$', '', 'g');

CREATE UNIQUE INDEX school_subjects_name_normalized_unique
  ON school_subjects (school_id, lower(regexp_replace(name, '^[[:space:]]+|[[:space:]]+$', '', 'g')));

CREATE UNIQUE INDEX school_subjects_code_normalized_unique
  ON school_subjects (school_id, upper(trim(code)))
  WHERE code IS NOT NULL;

ALTER TABLE class_subjects
  ADD COLUMN school_subject_id uuid;

UPDATE class_subjects cs
   SET school_subject_id = ss.id
  FROM school_subjects ss
 WHERE ss.school_id = cs.school_id
   AND lower(regexp_replace(ss.name, '^[[:space:]]+|[[:space:]]+$', '', 'g')) =
       lower(regexp_replace(cs.subject, '^[[:space:]]+|[[:space:]]+$', '', 'g'));

ALTER TABLE class_subjects
  ADD CONSTRAINT class_subjects_school_subject_fk
  FOREIGN KEY (school_subject_id, school_id)
  REFERENCES school_subjects(id, school_id) ON DELETE RESTRICT;

ALTER TABLE class_subjects
  ALTER COLUMN school_subject_id SET NOT NULL;

ALTER TABLE teacher_class_assignments
  ADD COLUMN school_subject_id uuid;

UPDATE teacher_class_assignments tca
   SET school_subject_id = ss.id
  FROM school_subjects ss
 WHERE ss.school_id = tca.school_id
   AND lower(regexp_replace(ss.name, '^[[:space:]]+|[[:space:]]+$', '', 'g')) =
       lower(regexp_replace(tca.subject, '^[[:space:]]+|[[:space:]]+$', '', 'g'));

ALTER TABLE teacher_class_assignments
  ADD CONSTRAINT teacher_class_assignments_school_subject_fk
  FOREIGN KEY (school_subject_id, school_id)
  REFERENCES school_subjects(id, school_id) ON DELETE RESTRICT;

ALTER TABLE teacher_class_assignments
  ALTER COLUMN school_subject_id SET NOT NULL;

CREATE UNIQUE INDEX teacher_class_assignments_one_active_school_subject
  ON teacher_class_assignments (class_id, school_id, school_subject_id)
  WHERE revoked_at IS NULL AND school_subject_id IS NOT NULL;

CREATE INDEX teacher_class_assignments_school_subject_active_idx
  ON teacher_class_assignments (school_id, school_subject_id, class_id)
  WHERE revoked_at IS NULL;

ALTER TABLE class_homeroom_assignments
  ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE class_homeroom_assignments
  DROP CONSTRAINT class_homeroom_assignments_pkey;

ALTER TABLE class_homeroom_assignments
  ADD CONSTRAINT class_homeroom_assignments_pkey PRIMARY KEY (id);

ALTER TABLE class_homeroom_assignments
  ADD COLUMN ended_at timestamptz,
  ADD COLUMN ended_by uuid REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE class_homeroom_assignments
  DROP CONSTRAINT class_homeroom_assignments_class_id_subject_fkey;

CREATE UNIQUE INDEX class_homeroom_assignments_one_active_per_class
  ON class_homeroom_assignments (class_id)
  WHERE ended_at IS NULL;

CREATE INDEX class_homeroom_assignments_teacher_active_idx
  ON class_homeroom_assignments (teacher_user_id, class_id)
  WHERE ended_at IS NULL;
