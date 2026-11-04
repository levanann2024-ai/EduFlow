ALTER TABLE student_term_grades
  ADD COLUMN previous_confirmed_average numeric(4, 2)
    CHECK (previous_confirmed_average BETWEEN 0 AND 10);

UPDATE student_term_grades
   SET confirmed_average = (
     COALESCE(regular_1, 0)
       + COALESCE(regular_2, 0)
       + COALESCE(regular_3, 0)
       + COALESCE(regular_4, 0)
       + COALESCE(midterm, 0) * 2
       + COALESCE(final, 0) * 3
   ) / NULLIF(
     (regular_1 IS NOT NULL)::int
       + (regular_2 IS NOT NULL)::int
       + (regular_3 IS NOT NULL)::int
       + (regular_4 IS NOT NULL)::int
       + (midterm IS NOT NULL)::int * 2
       + (final IS NOT NULL)::int * 3,
     0
   )
 WHERE confirmed_average IS NULL
   AND (regular_1 IS NOT NULL OR regular_2 IS NOT NULL OR regular_3 IS NOT NULL
     OR regular_4 IS NOT NULL OR midterm IS NOT NULL OR final IS NOT NULL);
