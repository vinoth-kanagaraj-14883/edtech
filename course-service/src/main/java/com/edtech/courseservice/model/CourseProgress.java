package com.edtech.courseservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(
        name = "course_progress",
        indexes = {
                @Index(name = "idx_course_progress_enrollment_id", columnList = "enrollment_id"),
                @Index(name = "idx_course_progress_lesson_id", columnList = "lesson_id")
        },
        uniqueConstraints = @UniqueConstraint(name = "uk_course_progress_enrollment_lesson", columnNames = {"enrollment_id", "lesson_id"})
)
@Getter
@Setter
@NoArgsConstructor
public class CourseProgress {

    @Id
    @UuidGenerator
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "enrollment_id", nullable = false)
    private UUID enrollmentId;

    @Column(name = "lesson_id", nullable = false)
    private UUID lessonId;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "watched_seconds", nullable = false)
    private Long watchedSeconds = 0L;

    @PrePersist
    void onCreate() {
        if (this.watchedSeconds == null) {
            this.watchedSeconds = 0L;
        }
    }
}
