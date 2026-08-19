import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum TrackingEventType {
  LESSON_VIEWED = 'lesson.viewed',
  LESSON_COMPLETED = 'lesson.completed',
  QUIZ_SUBMITTED = 'quiz.submitted',
  COURSE_ENROLLED = 'course.enrolled'
}

export const TRACKING_EVENT_TYPES: readonly string[] = Object.values(TrackingEventType);

@Entity({ name: 'tracking_events' })
@Index('idx_tracking_events_user_course', ['userId', 'courseId'])
export class TrackingEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_tracking_events_user_id')
  @Column({ type: 'char', length: 36 })
  userId!: string;

  @Index('idx_tracking_events_course_id')
  @Column({ type: 'char', length: 36, nullable: true })
  courseId!: string | null;

  @Column({ type: 'char', length: 36, nullable: true })
  lessonId!: string | null;

  @Column({ type: 'char', length: 36, nullable: true })
  quizId!: string | null;

  @Column({ type: 'varchar', length: 32 })
  eventType!: TrackingEventType;

  @Column({ type: 'float', nullable: true })
  score!: number | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
