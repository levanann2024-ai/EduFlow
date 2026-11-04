ALTER TABLE teacher_weekly_timetable_entries
  ADD COLUMN is_cancelled boolean NOT NULL DEFAULT false,
  ADD COLUMN has_homework boolean NOT NULL DEFAULT false,
  ADD COLUMN homework_title text NOT NULL DEFAULT '',
  ADD COLUMN homework_due_at timestamptz,
  ADD COLUMN has_exam boolean NOT NULL DEFAULT false,
  ADD COLUMN exam_title text NOT NULL DEFAULT '',
  ADD COLUMN exam_starts_at timestamptz,
  ADD COLUMN has_exam_return boolean NOT NULL DEFAULT false,
  ADD COLUMN exam_return_note text NOT NULL DEFAULT '',
  ADD COLUMN exam_return_at timestamptz;

UPDATE teacher_weekly_timetable_entries
   SET has_homework = entry_type = 'homework',
       homework_title = CASE WHEN entry_type = 'homework' THEN title ELSE '' END,
       homework_due_at = CASE WHEN entry_type = 'homework' THEN due_at END,
       has_exam = entry_type = 'exam',
       exam_title = CASE WHEN entry_type = 'exam' THEN title ELSE '' END,
       exam_starts_at = CASE WHEN entry_type = 'exam' THEN due_at END;

CREATE TABLE class_timetable_events (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL,
  school_id uuid NOT NULL,
  teacher_user_id uuid NOT NULL,
  academic_year text NOT NULL CHECK (length(trim(academic_year)) BETWEEN 1 AND 32),
  semester text NOT NULL CHECK (semester IN ('Kỳ 1', 'Kỳ 2')),
  event_date date NOT NULL,
  period_number smallint NOT NULL CHECK (period_number BETWEEN 1 AND 10),
  operation text NOT NULL CHECK (operation IN ('override', 'makeup', 'cancel')),
  subject text,
  title text NOT NULL DEFAULT '' CHECK (length(title) <= 200),
  lesson_topic text NOT NULL DEFAULT '' CHECK (length(lesson_topic) <= 1000),
  has_homework boolean NOT NULL DEFAULT false,
  homework_title text NOT NULL DEFAULT '' CHECK (length(homework_title) <= 200),
  homework_due_at timestamptz,
  has_exam boolean NOT NULL DEFAULT false,
  exam_title text NOT NULL DEFAULT '' CHECK (length(exam_title) <= 200),
  exam_starts_at timestamptz,
  has_exam_return boolean NOT NULL DEFAULT false,
  exam_return_note text NOT NULL DEFAULT '' CHECK (length(exam_return_note) <= 1000),
  exam_return_at timestamptz,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, event_date, period_number),
  FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (teacher_user_id, school_id)
    REFERENCES teacher_profiles(user_id, school_id) ON DELETE RESTRICT,
  CHECK (operation = 'cancel' OR (subject IS NOT NULL AND length(trim(subject)) BETWEEN 1 AND 120)),
  CHECK (has_homework OR (homework_title = '' AND homework_due_at IS NULL)),
  CHECK (has_exam OR (exam_title = '' AND exam_starts_at IS NULL)),
  CHECK (has_exam_return OR (exam_return_note = '' AND exam_return_at IS NULL))
);

CREATE INDEX class_timetable_events_class_date_idx
  ON class_timetable_events (class_id, semester, event_date, period_number);

INSERT INTO class_timetable_events
  (id, class_id, school_id, teacher_user_id, academic_year, semester, event_date,
   period_number, operation, subject, title, lesson_topic, has_homework, homework_title,
   homework_due_at, has_exam, exam_title, exam_starts_at, has_exam_return, exam_return_note,
   exam_return_at, published_at)
SELECT gen_random_uuid(), e.class_id, t.school_id, t.teacher_user_id, t.academic_year,
       t.semester, t.week_start + (e.weekday - 1), e.period_number,
       CASE WHEN e.is_cancelled THEN 'cancel'
            WHEN e.entry_type = 'makeup' THEN 'makeup' ELSE 'override' END,
       CASE WHEN e.is_cancelled THEN NULL ELSE e.subject END,
       e.title, e.topic, e.has_homework, e.homework_title, e.homework_due_at,
       e.has_exam, e.exam_title, e.exam_starts_at, e.has_exam_return, e.exam_return_note,
       e.exam_return_at,
       t.updated_at
  FROM teacher_weekly_timetables t
  JOIN teacher_weekly_timetable_entries e ON e.timetable_id = t.id
 WHERE t.status = 'published';
