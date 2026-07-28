package com.edtech.courseservice.config;

import com.edtech.courseservice.model.Course;
import com.edtech.courseservice.repository.CourseRepository;
import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Seeds a couple of demo courses on startup so the catalogue is populated for
 * local development. Idempotent: only runs when no courses exist. The course
 * IDs are stable and shared with the quiz-service seed data.
 */
@Configuration
public class DataSeeder {

    private static final Logger LOG = LoggerFactory.getLogger(DataSeeder.class);

    static final UUID INTRO_COURSE_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    static final UUID WEB_COURSE_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    static final UUID DEMO_INSTRUCTOR_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

    @Bean
    CommandLineRunner seedCourses(CourseRepository courseRepository) {
        return args -> {
            if (courseRepository.count() > 0) {
                LOG.info("Courses already present; skipping seed");
                return;
            }

            Course intro = new Course();
            intro.setId(INTRO_COURSE_ID);
            intro.setTitle("Programming Fundamentals");
            intro.setDescription("Learn the core building blocks of programming: variables, "
                    + "control flow, functions, and data structures.");
            intro.setInstructorId(DEMO_INSTRUCTOR_ID);
            intro.setPrice(new BigDecimal("0.00"));
            intro.setDurationHours(8);
            intro.setLevel(Course.CourseLevel.BEGINNER);
            intro.setStatus(Course.CourseStatus.PUBLISHED);
            intro.setThumbnailUrl("https://picsum.photos/seed/programming/640/360");
            intro.setTags(tags("programming", "fundamentals", "beginner"));

            Course web = new Course();
            web.setId(WEB_COURSE_ID);
            web.setTitle("Web Development Basics");
            web.setDescription("Build your first website with HTML, CSS, and an introduction to "
                    + "HTTP and how the web works.");
            web.setInstructorId(DEMO_INSTRUCTOR_ID);
            web.setPrice(new BigDecimal("19.99"));
            web.setDurationHours(12);
            web.setLevel(Course.CourseLevel.BEGINNER);
            web.setStatus(Course.CourseStatus.PUBLISHED);
            web.setThumbnailUrl("https://picsum.photos/seed/webdev/640/360");
            web.setTags(tags("web", "html", "css"));

            courseRepository.save(intro);
            courseRepository.save(web);
            LOG.info("Seeded {} demo courses", 2);
        };
    }

    private static Set<String> tags(String... values) {
        Set<String> set = new LinkedHashSet<>();
        for (String value : values) {
            set.add(value);
        }
        return set;
    }
}
