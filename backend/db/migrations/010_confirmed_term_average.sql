ALTER TABLE student_term_grades
  ADD COLUMN confirmed_average numeric(4, 2) CHECK (confirmed_average BETWEEN 0 AND 10);
