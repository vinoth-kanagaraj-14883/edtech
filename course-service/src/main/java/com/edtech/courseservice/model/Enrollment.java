package com.edtech.courseservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
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
        name = "enrollments",
        indexes = {
                @Index(name = "idx_enrollments_user_id", columnList = "user_id"),
                @Index(name = "idx_enrollments_course_id", columnList = "course_id")
        },
        uniqueConstraints = @UniqueConstraint(name = "uk_enrollments_user_course", columnNames = {"course_id", "user_id"})
)
@Getter
@Setter
@NoArgsConstructor
public class Enrollment {

    @Id
    @UuidGenerator
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "course_id", nullable = false)
    private UUID courseId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "enrolled_at", nullable = false, updatable = false)
    private Instant enrolledAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(nullable = false)
    private Integer progress = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private EnrollmentStatus status = EnrollmentStatus.ACTIVE;

    @PrePersist
    void onCreate() {
        if (this.enrolledAt == null) {
            this.enrolledAt = Instant.now();
        }
        if (this.progress == null) {
            this.progress = 0;
        }
        if (this.status == null) {
            this.status = EnrollmentStatus.ACTIVE;
        }
    }

    @PreUpdate
    void onUpdate() {
        if (this.progress == null) {
            this.progress = 0;
        }
    }

    public enum EnrollmentStatus {
        ACTIVE,
        COMPLETED,
        DROPPED
    }
}
