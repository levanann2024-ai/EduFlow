CREATE TABLE class_subjects (
  class_id uuid NOT NULL,
  school_id uuid NOT NULL,
  subject text NOT NULL CHECK (length(trim(subject)) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, subject),
  FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id) ON DELETE RESTRICT
);

INSERT INTO class_subjects (class_id, school_id, subject)
SELECT DISTINCT ON (tca.class_id, lower(trim(tca.subject)))
       tca.class_id, tca.school_id, trim(tca.subject)
  FROM teacher_class_assignments tca
 WHERE tca.revoked_at IS NULL
 ORDER BY tca.class_id, lower(trim(tca.subject)), tca.created_at DESC;

CREATE TABLE class_homeroom_assignments (
  class_id uuid PRIMARY KEY,
  school_id uuid NOT NULL,
  teacher_user_id uuid NOT NULL,
  subject text NOT NULL,
  assigned_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (teacher_user_id, school_id) REFERENCES teacher_profiles(user_id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (class_id, subject) REFERENCES class_subjects(class_id, subject) ON DELETE RESTRICT
);

CREATE INDEX class_homeroom_assignments_teacher_idx
  ON class_homeroom_assignments (teacher_user_id, class_id);
