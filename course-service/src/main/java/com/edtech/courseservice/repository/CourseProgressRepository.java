package com.edtech.courseservice.repository;

import com.edtech.courseservice.model.CourseProgress;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Per-lesson completion records. The `course_progress` table has existed since
 * V1 but had no repository, so nothing ever wrote to it: content-service's
 * `POST /lessons/{id}/complete` acknowledged completions without persisting
 * them, which meant lesson progress never stuck and the XP/streak layer derived
 * from it was always zero.
 */
public interface CourseProgressRepository extends JpaRepository<CourseProgress, UUID> {

    List<CourseProgress> findByEnrollmentId(UUID enrollmentId);

    Optional<CourseProgress> findByEnrollmentIdAndLessonId(UUID enrollmentId, UUID lessonId);

    long countByEnrollmentIdAndCompletedAtIsNotNull(UUID enrollmentId);
}
