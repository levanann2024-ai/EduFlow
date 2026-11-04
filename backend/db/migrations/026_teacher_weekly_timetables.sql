CREATE TABLE teacher_weekly_timetables (
  id uuid PRIMARY KEY,
  teacher_user_id uuid NOT NULL,
  school_id uuid NOT NULL,
  academic_year text NOT NULL CHECK (length(trim(academic_year)) BETWEEN 1 AND 32),
  semester text NOT NULL CHECK (semester IN ('Kỳ 1', 'Kỳ 2')),
  week_start date NOT NULL,
  session text NOT NULL CHECK (session IN ('morning', 'afternoon')),
  period_count smallint NOT NULL CHECK (period_count BETWEEN 1 AND 10),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  is_estimated boolean NOT NULL DEFAULT false,
  daily_note text NOT NULL DEFAULT '' CHECK (length(daily_note) <= 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_user_id, school_id, week_start),
  FOREIGN KEY (teacher_user_id, school_id)
    REFERENCES teacher_profiles(user_id, school_id) ON DELETE RESTRICT
);

CREATE TABLE teacher_weekly_timetable_entries (
  id uuid PRIMARY KEY,
  timetable_id uuid NOT NULL REFERENCES teacher_weekly_timetables(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 6),
  period_number smallint NOT NULL CHECK (period_number BETWEEN 1 AND 10),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  subject text NOT NULL CHECK (length(trim(subject)) BETWEEN 1 AND 120),
  entry_type text NOT NULL CHECK (entry_type IN ('lesson', 'makeup', 'homework', 'exam')),
  title text NOT NULL DEFAULT '' CHECK (length(title) <= 200),
  topic text NOT NULL DEFAULT '' CHECK (length(topic) <= 1000),
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (timetable_id, weekday, period_number)
);

CREATE INDEX teacher_weekly_timetables_teacher_week_idx
  ON teacher_weekly_timetables (teacher_user_id, week_start);

CREATE INDEX teacher_weekly_timetable_entries_class_idx
  ON teacher_weekly_timetable_entries (class_id, timetable_id, weekday, period_number);
