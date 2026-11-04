CREATE TABLE class_timetables (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL,
  school_id uuid NOT NULL,
  semester text NOT NULL CHECK (semester IN ('Kỳ 1', 'Kỳ 2')),
  session text NOT NULL CHECK (session IN ('morning', 'afternoon')),
  effective_from date NOT NULL,
  period_count smallint NOT NULL CHECK (period_count BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, semester),
  FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id) ON DELETE RESTRICT
);

CREATE INDEX class_timetables_school_semester_idx
  ON class_timetables (school_id, semester);

CREATE TABLE class_timetable_entries (
  id uuid PRIMARY KEY,
  timetable_id uuid NOT NULL REFERENCES class_timetables(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 6),
  period_number smallint NOT NULL CHECK (period_number BETWEEN 1 AND 10),
  subject text NOT NULL CHECK (length(trim(subject)) > 0),
  UNIQUE (timetable_id, weekday, period_number)
);

CREATE INDEX class_timetable_entries_timetable_idx
  ON class_timetable_entries (timetable_id, weekday, period_number);
