CREATE TABLE schools (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('student', 'lecturer', 'admin')),
  admin_scope text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  must_change_password boolean NOT NULL DEFAULT false,
  profile_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (role = 'admin' AND admin_scope IS NOT NULL AND admin_scope IN ('system', 'school'))
    OR (role <> 'admin' AND admin_scope IS NULL)
  )
);

CREATE UNIQUE INDEX users_email_normalized_unique ON users (lower(email));
CREATE INDEX users_role_status_idx ON users (role, status);

CREATE TABLE school_memberships (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, school_id),
  UNIQUE (id, user_id, school_id)
);

CREATE INDEX school_memberships_school_status_idx ON school_memberships (school_id, status);

CREATE TABLE student_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL UNIQUE,
  school_id uuid NOT NULL,
  grade text,
  student_number text,
  FOREIGN KEY (membership_id, user_id, school_id)
    REFERENCES school_memberships(id, user_id, school_id) ON DELETE RESTRICT,
  UNIQUE (user_id, school_id)
);

CREATE TABLE teacher_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL UNIQUE,
  school_id uuid NOT NULL,
  employee_number text,
  FOREIGN KEY (membership_id, user_id, school_id)
    REFERENCES school_memberships(id, user_id, school_id) ON DELETE RESTRICT,
  UNIQUE (user_id, school_id)
);

CREATE TABLE classes (
  id uuid PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  grade text NOT NULL,
  academic_year text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  UNIQUE (school_id, code, academic_year),
  UNIQUE (id, school_id)
);

CREATE INDEX classes_school_status_idx ON classes (school_id, status);

CREATE TABLE class_memberships (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  student_user_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE RESTRICT,
  school_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  UNIQUE (class_id, student_user_id),
  FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (student_user_id, school_id) REFERENCES student_profiles(user_id, school_id) ON DELETE RESTRICT
);

CREATE INDEX class_memberships_student_status_idx ON class_memberships (student_user_id, status);

CREATE TABLE teacher_class_assignments (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  teacher_user_id uuid NOT NULL REFERENCES teacher_profiles(user_id) ON DELETE RESTRICT,
  school_id uuid NOT NULL,
  subject text NOT NULL,
  assigned_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (class_id, teacher_user_id, subject),
  FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (teacher_user_id, school_id) REFERENCES teacher_profiles(user_id, school_id) ON DELETE RESTRICT
);

CREATE INDEX teacher_class_assignments_teacher_active_idx
  ON teacher_class_assignments (teacher_user_id, class_id) WHERE revoked_at IS NULL;

CREATE TABLE account_invitations (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('student', 'lecturer', 'admin')),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  invited_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX account_invitations_email_pending_idx ON account_invitations (lower(email), expires_at)
  WHERE consumed_at IS NULL;
CREATE UNIQUE INDEX account_invitations_one_pending_per_role_school
  ON account_invitations (lower(email), role, school_id) WHERE consumed_at IS NULL;

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_sessions_user_active_idx ON auth_sessions (user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE auth_refresh_tokens (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES auth_sessions(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  replaced_by uuid REFERENCES auth_refresh_tokens(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_refresh_tokens_session_idx ON auth_refresh_tokens (session_id, expires_at);
