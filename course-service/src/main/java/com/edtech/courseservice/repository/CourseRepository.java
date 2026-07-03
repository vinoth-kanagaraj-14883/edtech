package com.edtech.courseservice.repository;

import com.edtech.courseservice.model.Course;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseRepository extends JpaRepository<Course, UUID> {

    List<Course> findByInstructorId(UUID instructorId);

    List<Course> findByStatus(Course.CourseStatus status);

    List<Course> findByLevel(Course.CourseLevel level);

    Page<Course> findAllByLevel(Course.CourseLevel level, Pageable pageable);

    Page<Course> findAllByStatus(Course.CourseStatus status, Pageable pageable);

    Page<Course> findAllByLevelAndStatus(Course.CourseLevel level, Course.CourseStatus status, Pageable pageable);
}
