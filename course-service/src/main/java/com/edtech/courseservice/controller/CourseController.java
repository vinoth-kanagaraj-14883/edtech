package com.edtech.courseservice.controller;

import com.edtech.courseservice.model.Course;
import com.edtech.courseservice.model.Enrollment;
import com.edtech.courseservice.service.CourseService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping
public class CourseController {

    private final CourseService courseService;

    @GetMapping("/courses")
    public Page<Course> getCourses(
            @RequestParam(required = false) Course.CourseLevel level,
            @RequestParam(required = false) Course.CourseStatus status,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {
        return courseService.listCourses(level, status, pageable);
    }

    @PostMapping("/courses")
    public ResponseEntity<Course> createCourse(@Valid @RequestBody CourseRequest request) {
        Course createdCourse = courseService.createCourse(toCourse(request));
        return ResponseEntity.created(URI.create("/courses/" + createdCourse.getId())).body(createdCourse);
    }

    @GetMapping("/courses/{id}")
    public Course getCourse(@PathVariable UUID id) {
        return courseService.getCourse(id);
    }

    @PutMapping("/courses/{id}")
    public Course updateCourse(@PathVariable UUID id, @Valid @RequestBody CourseRequest request) {
        return courseService.updateCourse(id, toCourse(request));
    }

    @DeleteMapping("/courses/{id}")
    public ResponseEntity<Void> deleteCourse(@PathVariable UUID id) {
        courseService.deleteCourse(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/courses/{id}/enroll")
    public ResponseEntity<Enrollment> enroll(@PathVariable UUID id, @Valid @RequestBody EnrollmentRequest request) {
        Enrollment enrollment = courseService.enrollUser(id, request.userId());
        return ResponseEntity.created(URI.create("/enrollments/" + enrollment.getId())).body(enrollment);
    }

    @GetMapping("/courses/{id}/enrollments")
    public List<Enrollment> getCourseEnrollments(@PathVariable UUID id) {
        return courseService.getCourseEnrollments(id);
    }

    @PutMapping("/enrollments/{id}/progress")
    public Enrollment updateProgress(@PathVariable UUID id, @Valid @RequestBody ProgressUpdateRequest request) {
        return courseService.updateEnrollmentProgress(id, request.progress(), request.lessonId(), request.watchedSeconds());
    }

    @GetMapping("/users/{userId}/enrollments")
    public List<Enrollment> getUserEnrollments(@PathVariable UUID userId) {
        return courseService.getUserEnrollments(userId);
    }

    private Course toCourse(CourseRequest request) {
        Course course = new Course();
        course.setTitle(request.title());
        course.setDescription(request.description());
        course.setInstructorId(request.instructorId());
        course.setPrice(request.price());
        course.setDurationHours(request.durationHours());
        course.setLevel(request.level());
        course.setStatus(request.status());
        course.setThumbnailUrl(request.thumbnailUrl());
        course.setTags(request.tags());
        return course;
    }

    public record CourseRequest(
            @NotBlank @Size(max = 255) String title,
            @NotBlank String description,
            @NotNull UUID instructorId,
            @NotNull @DecimalMin(value = "0.0", inclusive = true) BigDecimal price,
            @NotNull @Positive Integer durationHours,
            @NotNull Course.CourseLevel level,
            @NotNull Course.CourseStatus status,
            @Size(max = 2048) String thumbnailUrl,
            Set<@NotBlank @Size(max = 64) String> tags) {
    }

    public record EnrollmentRequest(@NotNull UUID userId) {
    }

    public record ProgressUpdateRequest(
            @NotNull @Min(0) @Max(100) Integer progress,
            UUID lessonId,
            @PositiveOrZero Long watchedSeconds) {
    }
}
