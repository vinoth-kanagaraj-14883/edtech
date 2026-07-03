package com.edtech.courseservice.service;

import com.edtech.courseservice.model.Course;
import com.edtech.courseservice.model.CourseProgress;
import com.edtech.courseservice.model.Enrollment;
import com.edtech.courseservice.repository.CourseRepository;
import com.edtech.courseservice.repository.EnrollmentRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CourseService {

    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final EntityManager entityManager;

    public Page<Course> listCourses(Course.CourseLevel level, Course.CourseStatus status, Pageable pageable) {
        if (level != null && status != null) {
            return courseRepository.findAllByLevelAndStatus(level, status, pageable);
        }
        if (level != null) {
            return courseRepository.findAllByLevel(level, pageable);
        }
        if (status != null) {
            return courseRepository.findAllByStatus(status, pageable);
        }
        return courseRepository.findAll(pageable);
    }

    public Course getCourse(UUID id) {
        return courseRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found"));
    }

    @Transactional
    public Course createCourse(Course course) {
        course.setId(null);
        course.setTags(normalizeTags(course.getTags()));
        return courseRepository.save(course);
    }

    @Transactional
    public Course updateCourse(UUID id, Course updatedCourse) {
        Course existing = getCourse(id);
        existing.setTitle(updatedCourse.getTitle());
        existing.setDescription(updatedCourse.getDescription());
        existing.setInstructorId(updatedCourse.getInstructorId());
        existing.setPrice(updatedCourse.getPrice());
        existing.setDurationHours(updatedCourse.getDurationHours());
        existing.setLevel(updatedCourse.getLevel());
        existing.setStatus(updatedCourse.getStatus());
        existing.setThumbnailUrl(updatedCourse.getThumbnailUrl());
        existing.setTags(normalizeTags(updatedCourse.getTags()));
        return courseRepository.save(existing);
    }

    @Transactional
    public void deleteCourse(UUID id) {
        Course course = getCourse(id);
        if (!enrollmentRepository.findByCourseId(id).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot delete a course with enrollments");
        }
        courseRepository.delete(course);
    }

    @Transactional
    public Enrollment enrollUser(UUID courseId, UUID userId) {
        Course course = getCourse(courseId);
        if (course.getStatus() != Course.CourseStatus.PUBLISHED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only published courses can be enrolled in");
        }

        enrollmentRepository.findByUserIdAndCourseId(userId, courseId).ifPresent(existing -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User is already enrolled in this course");
        });

        Enrollment enrollment = new Enrollment();
        enrollment.setCourseId(courseId);
        enrollment.setUserId(userId);
        enrollment.setProgress(0);
        enrollment.setStatus(Enrollment.EnrollmentStatus.ACTIVE);
        return enrollmentRepository.save(enrollment);
    }

    public List<Enrollment> getCourseEnrollments(UUID courseId) {
        getCourse(courseId);
        return enrollmentRepository.findByCourseId(courseId);
    }

    public List<Enrollment> getUserEnrollments(UUID userId) {
        return enrollmentRepository.findByUserId(userId);
    }

    @Transactional
    public Enrollment updateEnrollmentProgress(UUID enrollmentId, Integer progress, UUID lessonId, Long watchedSeconds) {
        if (progress == null || progress < 0 || progress > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Progress must be between 0 and 100");
        }

        Enrollment enrollment = enrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Enrollment not found"));

        if (enrollment.getStatus() == Enrollment.EnrollmentStatus.DROPPED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot update progress for a dropped enrollment");
        }

        enrollment.setProgress(progress);
        if (progress == 100) {
            enrollment.setStatus(Enrollment.EnrollmentStatus.COMPLETED);
            if (enrollment.getCompletedAt() == null) {
                enrollment.setCompletedAt(Instant.now());
            }
        } else {
            enrollment.setStatus(Enrollment.EnrollmentStatus.ACTIVE);
            enrollment.setCompletedAt(null);
        }

        if (lessonId != null) {
            CourseProgress courseProgress = findCourseProgress(enrollmentId, lessonId)
                    .orElseGet(() -> {
                        CourseProgress progressEntry = new CourseProgress();
                        progressEntry.setEnrollmentId(enrollmentId);
                        progressEntry.setLessonId(lessonId);
                        return progressEntry;
                    });
            courseProgress.setWatchedSeconds(watchedSeconds == null ? Optional.ofNullable(courseProgress.getWatchedSeconds()).orElse(0L) : Math.max(0L, watchedSeconds));
            courseProgress.setCompletedAt(Instant.now());
            persistCourseProgress(courseProgress);
        }

        return enrollmentRepository.save(enrollment);
    }

    private Optional<CourseProgress> findCourseProgress(UUID enrollmentId, UUID lessonId) {
        return entityManager.createQuery(
                        "select cp from CourseProgress cp where cp.enrollmentId = :enrollmentId and cp.lessonId = :lessonId",
                        CourseProgress.class)
                .setParameter("enrollmentId", enrollmentId)
                .setParameter("lessonId", lessonId)
                .getResultStream()
                .findFirst();
    }

    private void persistCourseProgress(CourseProgress courseProgress) {
        if (courseProgress.getId() == null) {
            entityManager.persist(courseProgress);
            return;
        }
        entityManager.merge(courseProgress);
    }

    private Set<String> normalizeTags(Set<String> tags) {
        Set<String> normalizedTags = new LinkedHashSet<>();
        if (tags == null) {
            return normalizedTags;
        }
        for (String tag : tags) {
            if (tag == null) {
                continue;
            }
            String normalized = tag.trim();
            if (!normalized.isEmpty()) {
                normalizedTags.add(normalized);
            }
        }
        return normalizedTags;
    }
}
