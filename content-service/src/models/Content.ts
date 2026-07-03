import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum ContentType {
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
  QUIZ_REF = 'QUIZ_REF'
}

const bigintNumberTransformer = {
  to: (value: number): number => value,
  from: (value: string | number): number => Number(value)
};

@Entity({ name: 'content_items' })
export class Content {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_content_items_lesson_id')
  @Column({ type: 'char', length: 36 })
  lessonId!: string;

  @Column({ type: 'enum', enum: ContentType })
  type!: ContentType;

  @Column({ type: 'varchar', length: 2048 })
  url!: string;

  @Column({ type: 'varchar', length: 255 })
  filename!: string;

  @Column({ type: 'varchar', length: 255 })
  mimeType!: string;

  @Column({
    type: 'bigint',
    unsigned: true,
    transformer: bigintNumberTransformer
  })
  sizeBytes!: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
