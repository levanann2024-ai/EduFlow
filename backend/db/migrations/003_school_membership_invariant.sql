ALTER TABLE users
  ADD CONSTRAINT users_id_role_unique UNIQUE (id, role);

ALTER TABLE school_memberships
  ADD COLUMN role text;

UPDATE school_memberships sm
   SET role = u.role
  FROM users u
 WHERE u.id = sm.user_id;

ALTER TABLE school_memberships
  ALTER COLUMN role SET NOT NULL;

ALTER TABLE school_memberships
  ADD CONSTRAINT school_memberships_role_valid
  CHECK (role IN ('student', 'lecturer', 'admin'));

ALTER TABLE school_memberships
  ADD CONSTRAINT school_memberships_user_role_fk
  FOREIGN KEY (user_id, role) REFERENCES users (id, role) ON DELETE RESTRICT;

CREATE UNIQUE INDEX school_memberships_one_active_student_lecturer
  ON school_memberships (user_id)
  WHERE status = 'active' AND role IN ('student', 'lecturer');
