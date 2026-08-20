-- Repairs the fallout from Course.id being annotated @UuidGenerator.
--
-- Hibernate 6's @UuidGenerator always generates a fresh UUID on persist, which
-- silently discarded the stable ids DataSeeder assigns (11111111-…, 22222222-…).
-- Two consequences:
--
--   1. DataSeeder's idempotency check is `existsById(STABLE_ID)`. Because the
--      stable id was never actually stored, that check never matched and the
--      seeder re-inserted all 8 demo courses on every single startup. A
--      long-running dev stack had accumulated 1008 course rows.
--
--   2. content-service seeds its lessons against those same stable course ids.
--      Since no course ever had one, every lesson pointed at a non-existent
--      course and the entire catalogue appeared to have zero lessons.
--
-- The entity now assigns the id in @PrePersist only when it is null, so explicit
-- ids survive. This migration clears the accumulated duplicates so the seeder
-- can recreate the 8 demo courses with their intended stable ids on next boot,
-- at which point the existing lesson rows line up.
--
-- Scope: only rows owned by the demo instructor that DataSeeder uses. Courses
-- created through the API by real users have a different instructor_id and are
-- left untouched. Enrollments against the demo courses are load-generator
-- artefacts, so removing them is safe (enrollments.course_id is ON DELETE
-- RESTRICT, hence the explicit ordering below; course_tags cascades on its own).

-- 1. Progress rows hang off enrollments (ON DELETE CASCADE from enrollments,
--    but delete explicitly so the intent is readable).
DELETE FROM course_progress
 WHERE enrollment_id IN (
     SELECT e.id
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
      WHERE c.instructor_id = '33333333-3333-3333-3333-333333333333'
 );

-- 2. Enrollments must go before the courses they RESTRICT.
DELETE FROM enrollments
 WHERE course_id IN (
     SELECT id FROM courses
      WHERE instructor_id = '33333333-3333-3333-3333-333333333333'
 );

-- 3. The duplicated demo courses themselves (course_tags cascades).
DELETE FROM courses
 WHERE instructor_id = '33333333-3333-3333-3333-333333333333';
