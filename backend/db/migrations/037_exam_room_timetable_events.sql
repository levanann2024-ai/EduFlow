ALTER TABLE class_timetable_events
  ADD COLUMN source_exam_room_id uuid,
  ADD COLUMN source_exam_room_created_event boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT class_timetable_events_exam_room_fk
    FOREIGN KEY (teacher_user_id, source_exam_room_id)
    REFERENCES teacher_exam_rooms(teacher_user_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT class_timetable_events_exam_room_created_check
    CHECK (NOT source_exam_room_created_event OR source_exam_room_id IS NOT NULL);

CREATE INDEX class_timetable_events_exam_room_idx
  ON class_timetable_events (source_exam_room_id)
  WHERE source_exam_room_id IS NOT NULL;
