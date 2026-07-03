CREATE TABLE courses (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    instructor_id UUID NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    duration_hours INTEGER NOT NULL CHECK (duration_hours > 0),
    level VARCHAR(32) NOT NULL CHECK (level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
    status VARCHAR(32) NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    thumbnail_url VARCHAR(2048)
);

CREATE TABLE course_tags (
    course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
    tag VARCHAR(64) NOT NULL,
    PRIMARY KEY (course_id, tag)
);

CREATE TABLE enrollments (
    id UUID PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES courses (id) ON DELETE RESTRICT,
    user_id UUID NOT NULL,
    enrolled_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    status VARCHAR(32) NOT NULL CHECK (status IN ('ACTIVE', 'COMPLETED', 'DROPPED')),
    CONSTRAINT uk_enrollments_user_course UNIQUE (course_id, user_id)
);

CREATE TABLE course_progress (
    id UUID PRIMARY KEY,
    enrollment_id UUID NOT NULL REFERENCES enrollments (id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL,
    completed_at TIMESTAMPTZ,
    watched_seconds BIGINT NOT NULL DEFAULT 0 CHECK (watched_seconds >= 0),
    CONSTRAINT uk_course_progress_enrollment_lesson UNIQUE (enrollment_id, lesson_id)
);

CREATE INDEX idx_courses_instructor_id ON courses (instructor_id);
CREATE INDEX idx_courses_status ON courses (status);
CREATE INDEX idx_courses_level ON courses (level);
CREATE INDEX idx_enrollments_user_id ON enrollments (user_id);
CREATE INDEX idx_enrollments_course_id ON enrollments (course_id);
CREATE INDEX idx_course_progress_enrollment_id ON course_progress (enrollment_id);
CREATE INDEX idx_course_progress_lesson_id ON course_progress (lesson_id);
