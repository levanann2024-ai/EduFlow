ALTER TABLE class_timetable_entries
  DROP CONSTRAINT class_timetable_entries_weekday_check,
  ADD CONSTRAINT class_timetable_entries_weekday_check
    CHECK (weekday BETWEEN 1 AND 7);

ALTER TABLE teacher_weekly_timetable_entries
  DROP CONSTRAINT teacher_weekly_timetable_entries_weekday_check,
  ADD CONSTRAINT teacher_weekly_timetable_entries_weekday_check
    CHECK (weekday BETWEEN 1 AND 7);
