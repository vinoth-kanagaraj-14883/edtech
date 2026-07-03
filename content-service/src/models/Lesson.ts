import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'lessons' })
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_lessons_course_id')
  @Column({ type: 'char', length: 36 })
  courseId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'int', unsigned: true })
  orderIndex!: number;

  @Column({ type: 'int', unsigned: true })
  durationSeconds!: number;

  @Column({ type: 'boolean', default: false })
  isPublished!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
