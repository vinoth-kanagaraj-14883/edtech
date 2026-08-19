import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'certificate_issues' })
@Index('uq_certificate_issues_user_course', ['userId', 'courseId'], { unique: true })
export class CertificateIssue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'char', length: 36 })
  userId!: string;

  @Column({ type: 'char', length: 36 })
  courseId!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
