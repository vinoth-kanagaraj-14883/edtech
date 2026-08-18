package com.edtech.courseservice.repository;

import com.edtech.courseservice.model.Course;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CourseRepository extends JpaRepository<Course, UUID> {

    List<Course> findByInstructorId(UUID instructorId);

    List<Course> findByStatus(Course.CourseStatus status);

    List<Course> findByLevel(Course.CourseLevel level);

    Page<Course> findAllByLevel(Course.CourseLevel level, Pageable pageable);

    Page<Course> findAllByStatus(Course.CourseStatus status, Pageable pageable);

    Page<Course> findAllByLevelAndStatus(Course.CourseLevel level, Course.CourseStatus status, Pageable pageable);

    // Free-text search across title, description, and tags. Case-insensitive
    // LIKE match; the optional :level filter is applied when provided. DISTINCT
    // because the join over the course_tags collection can duplicate rows.
    @Query("""
            select distinct c from Course c left join c.tags t
            where (:level is null or c.level = :level)
              and (
                lower(c.title) like lower(concat('%', :q, '%'))
                or lower(c.description) like lower(concat('%', :q, '%'))
                or lower(t) like lower(concat('%', :q, '%'))
              )
            """)
    Page<Course> search(@Param("q") String query, @Param("level") Course.CourseLevel level, Pageable pageable);
}
