/**
 * UUID validation for request parameters.
 *
 * We deliberately do NOT use `uuid`'s `validate()` here. That function enforces
 * full RFC 4122 conformance: the version nibble must be 1-5 and the variant
 * nibble must be 8, 9, a or b. The platform's seed data uses readable patterned
 * ids that are shared across course-service, content-service and quiz-service so
 * lessons and quizzes attach to the right course, for example:
 *
 *     11111111-1111-1111-1111-111111111111   variant nibble '1' -> not RFC 4122
 *     88888888-8888-8888-8888-888888888888   version nibble '8' -> not RFC 4122
 *
 * Postgres and MySQL both accept and store these as ordinary UUIDs, so they are
 * perfectly valid identifiers as far as the database is concerned. Validating
 * against RFC 4122 therefore rejected legitimate ids and made every seeded
 * lesson unreachable via `?courseId=` — the endpoint returned
 * "courseId must be a valid UUID" for ids that were sitting in its own table.
 *
 * Validate the canonical 8-4-4-4-12 hex shape instead, which is what actually
 * protects the query from injection and malformed input.
 */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuidLike = (value: unknown): value is string =>
  typeof value === 'string' && UUID_SHAPE.test(value);
