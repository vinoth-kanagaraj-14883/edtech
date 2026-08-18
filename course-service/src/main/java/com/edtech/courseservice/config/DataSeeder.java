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
 * Seeds demo courses on startup so the catalogue is populated for local
 * development. Idempotent per-course (checked by stable UUID), so new
 * courses added here will still be created even on a database that was
 * already seeded with an earlier version of this class. Course IDs are
 * stable and shared with quiz-service / content-service seed data.
 */
@Configuration
public class DataSeeder {

    private static final Logger LOG = LoggerFactory.getLogger(DataSeeder.class);

    static final UUID INTRO_COURSE_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    static final UUID WEB_COURSE_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    static final UUID DEMO_INSTRUCTOR_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

    // Stable IDs for the additional catalog courses. Shared with
    // content-service's lesson seeding so lessons attach to the right course.
    static final UUID HTML_COURSE_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
    static final UUID AI_COURSE_ID = UUID.fromString("55555555-5555-5555-5555-555555555555");
    static final UUID CLOUD_COURSE_ID = UUID.fromString("66666666-6666-6666-6666-666666666666");
    static final UUID AZURE_COURSE_ID = UUID.fromString("77777777-7777-7777-7777-777777777777");
    static final UUID GCP_COURSE_ID = UUID.fromString("88888888-8888-8888-8888-888888888888");
    static final UUID AWS_COURSE_ID = UUID.fromString("99999999-9999-9999-9999-999999999999");

    @Bean
    CommandLineRunner seedCourses(CourseRepository courseRepository) {
        return args -> {
            int created = 0;
            created += seedIfMissing(courseRepository, INTRO_COURSE_ID, () -> {
                Course course = baseCourse(INTRO_COURSE_ID, "Programming Fundamentals",
                        "Learn the core building blocks of programming: variables, control flow, "
                                + "functions, and data structures.",
                        new BigDecimal("0.00"), 8, Course.CourseLevel.BEGINNER,
                        "https://picsum.photos/seed/programming/640/360",
                        tags("programming", "fundamentals", "beginner"));
                return course;
            });

            created += seedIfMissing(courseRepository, WEB_COURSE_ID, () -> baseCourse(WEB_COURSE_ID,
                    "Web Development Basics",
                    "Build your first website with HTML, CSS, and an introduction to HTTP and how "
                            + "the web works.",
                    new BigDecimal("19.99"), 12, Course.CourseLevel.BEGINNER,
                    "https://picsum.photos/seed/webdev/640/360",
                    tags("web", "html", "css")));

            created += seedIfMissing(courseRepository, HTML_COURSE_ID, () -> baseCourse(HTML_COURSE_ID,
                    "HTML & CSS Mastery",
                    "A deep dive into semantic HTML5, modern CSS layout (Flexbox & Grid), "
                            + "responsive design, and accessibility best practices.",
                    new BigDecimal("0.00"), 10, Course.CourseLevel.BEGINNER,
                    "https://picsum.photos/seed/html/640/360",
                    tags("html", "css", "frontend", "web")));

            created += seedIfMissing(courseRepository, AI_COURSE_ID, () -> baseCourse(AI_COURSE_ID,
                    "Artificial Intelligence Foundations",
                    "Explore the fundamentals of AI: machine learning, neural networks, "
                            + "natural language processing, and how modern AI systems are built and evaluated.",
                    new BigDecimal("49.99"), 20, Course.CourseLevel.INTERMEDIATE,
                    "https://picsum.photos/seed/ai/640/360",
                    tags("ai", "machine-learning", "data-science")));

            created += seedIfMissing(courseRepository, CLOUD_COURSE_ID, () -> baseCourse(CLOUD_COURSE_ID,
                    "Cloud Computing Essentials",
                    "Understand core cloud concepts -- compute, storage, networking, and "
                            + "security -- that apply across every major cloud provider.",
                    new BigDecimal("29.99"), 14, Course.CourseLevel.BEGINNER,
                    "https://picsum.photos/seed/cloud/640/360",
                    tags("cloud", "infrastructure", "devops")));

            created += seedIfMissing(courseRepository, AZURE_COURSE_ID, () -> baseCourse(AZURE_COURSE_ID,
                    "Microsoft Azure Fundamentals",
                    "Get hands-on with Azure: resource groups, virtual machines, Azure App "
                            + "Service, storage accounts, and identity with Entra ID.",
                    new BigDecimal("39.99"), 16, Course.CourseLevel.INTERMEDIATE,
                    "https://picsum.photos/seed/azure/640/360",
                    tags("azure", "cloud", "microsoft")));

            created += seedIfMissing(courseRepository, GCP_COURSE_ID, () -> baseCourse(GCP_COURSE_ID,
                    "Google Cloud Platform Essentials",
                    "Learn the building blocks of GCP: Compute Engine, Cloud Storage, "
                            + "BigQuery, and IAM, with practical, project-based examples.",
                    new BigDecimal("39.99"), 16, Course.CourseLevel.INTERMEDIATE,
                    "https://picsum.photos/seed/gcp/640/360",
                    tags("gcp", "cloud", "google")));

            created += seedIfMissing(courseRepository, AWS_COURSE_ID, () -> baseCourse(AWS_COURSE_ID,
                    "AWS Cloud Practitioner",
                    "A practical introduction to Amazon Web Services: EC2, S3, IAM, VPC "
                            + "networking, and the AWS Well-Architected Framework.",
                    new BigDecimal("39.99"), 16, Course.CourseLevel.INTERMEDIATE,
                    "https://picsum.photos/seed/aws/640/360",
                    tags("aws", "cloud", "amazon")));

            // Bulk-seed a large catalog (1000+ courses) so the search feature has
            // realistic volume to work against and the separate search-service has
            // a meaningful "hot courses" set to cache. These use a dedicated UUID
            // namespace (bulkCourseId) that never collides with the well-known
            // 1111…-9999… demo course IDs above.
            created += seedBulkCatalog(courseRepository);

            LOG.info("Course seeding complete: {} new course(s) created", created);
        };
    }

    // ── Bulk catalog generation ──────────────────────────────────────────
    // Number of generated catalog courses. Combined with the 8 curated demo
    // courses above this keeps the catalog well over 1000 entries.
    static final int BULK_COURSE_COUNT = 1000;

    // A stable UUID namespace for generated courses: 0xC0FFEE… + index. This is
    // deterministic (so re-runs are idempotent) and disjoint from the demo IDs.
    static UUID bulkCourseId(int index) {
        return new UUID(0xC0FFEE0000000000L | (long) index, 0x0000000000000000L | (long) index);
    }

    // Subject areas paired with representative tags. The generator rotates
    // through these to produce a varied, searchable catalog.
    private static final String[][] SUBJECTS = {
            {"Python", "python", "programming", "backend"},
            {"JavaScript", "javascript", "web", "frontend"},
            {"TypeScript", "typescript", "web", "frontend"},
            {"React", "react", "frontend", "web"},
            {"Node.js", "nodejs", "backend", "javascript"},
            {"Go", "go", "backend", "systems"},
            {"Java", "java", "backend", "enterprise"},
            {"Spring Boot", "spring", "java", "backend"},
            {"Ruby on Rails", "ruby", "rails", "backend"},
            {"Kubernetes", "kubernetes", "devops", "cloud"},
            {"Docker", "docker", "devops", "containers"},
            {"Terraform", "terraform", "devops", "iac"},
            {"AWS", "aws", "cloud", "amazon"},
            {"Azure", "azure", "cloud", "microsoft"},
            {"Google Cloud", "gcp", "cloud", "google"},
            {"Machine Learning", "machine-learning", "ai", "data-science"},
            {"Deep Learning", "deep-learning", "ai", "neural-networks"},
            {"Data Engineering", "data-engineering", "data", "pipelines"},
            {"SQL & Databases", "sql", "databases", "data"},
            {"Cybersecurity", "security", "cybersecurity", "networking"},
            {"DevOps", "devops", "cicd", "automation"},
            {"Prompt Engineering", "prompt-engineering", "ai", "llm"},
            {"Linux Administration", "linux", "sysadmin", "systems"},
            {"Networking", "networking", "infrastructure", "systems"},
            {"Mobile Development", "mobile", "android", "ios"}
    };

    private static final String[] LEVEL_LABELS = {"Fundamentals", "in Practice", "Deep Dive"};
    private static final Course.CourseLevel[] LEVELS = {
            Course.CourseLevel.BEGINNER, Course.CourseLevel.INTERMEDIATE, Course.CourseLevel.ADVANCED
    };

    private static int seedBulkCatalog(CourseRepository courseRepository) {
        // Fast path: if the last generated id already exists, the bulk catalog
        // was seeded on a previous startup — skip the whole batch.
        if (courseRepository.existsById(bulkCourseId(BULK_COURSE_COUNT - 1))) {
            return 0;
        }

        java.util.List<Course> batch = new java.util.ArrayList<>(BULK_COURSE_COUNT);
        for (int i = 0; i < BULK_COURSE_COUNT; i++) {
            UUID id = bulkCourseId(i);
            if (courseRepository.existsById(id)) {
                continue;
            }
            String[] subject = SUBJECTS[i % SUBJECTS.length];
            int levelIdx = (i / SUBJECTS.length) % LEVELS.length;
            String subjectName = subject[0];
            String title = String.format("%s %s (Vol. %d)", subjectName, LEVEL_LABELS[levelIdx], (i / (SUBJECTS.length * LEVELS.length)) + 1);
            String description = String.format(
                    "A %s-level course on %s. Master %s through hands-on projects, real-world examples, "
                            + "and practice quizzes that reinforce every concept as you learn it.",
                    LEVELS[levelIdx].name().toLowerCase(), subjectName, subjectName);
            // Vary price: every 5th course is free, otherwise 19.99–99.99.
            BigDecimal price = (i % 5 == 0)
                    ? new BigDecimal("0.00")
                    : new BigDecimal(String.valueOf(19.99 + (i % 8) * 10));
            int durationHours = 6 + (i % 30);
            String thumb = "https://picsum.photos/seed/course" + i + "/640/360";
            Set<String> courseTags = tags(subject[1], subject[2], subject[3]);

            Course course = baseCourse(id, title, description, price, durationHours,
                    LEVELS[levelIdx], thumb, courseTags);
            batch.add(course);
        }

        if (!batch.isEmpty()) {
            courseRepository.saveAll(batch);
        }
        return batch.size();
    }

    private interface CourseSupplier {
        Course get();
    }

    private static int seedIfMissing(CourseRepository courseRepository, UUID id, CourseSupplier supplier) {
        if (courseRepository.existsById(id)) {
            return 0;
        }
        courseRepository.save(supplier.get());
        return 1;
    }

    private static Course baseCourse(UUID id, String title, String description, BigDecimal price,
            int durationHours, Course.CourseLevel level, String thumbnailUrl, Set<String> courseTags) {
        Course course = new Course();
        course.setId(id);
        course.setTitle(title);
        course.setDescription(description);
        course.setInstructorId(DEMO_INSTRUCTOR_ID);
        course.setPrice(price);
        course.setDurationHours(durationHours);
        course.setLevel(level);
        course.setStatus(Course.CourseStatus.PUBLISHED);
        course.setThumbnailUrl(thumbnailUrl);
        course.setTags(courseTags);
        return course;
    }

    private static Set<String> tags(String... values) {
        Set<String> set = new LinkedHashSet<>();
        for (String value : values) {
            set.add(value);
        }
        return set;
    }
}
