import { Router } from 'express';
import { validate as isUuid } from 'uuid';

import { AppDataSource } from '../database';
import { Content } from '../models/Content';
import { Lesson } from '../models/Lesson';

const router = Router();

const parsePositiveInteger = (value: unknown, fieldName: string): number => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }

  return parsed;
};

const parsePagination = (value: unknown, fallback: number, fieldName: string): number => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return parsed;
};

router.get('/', async (request, response, next) => {
  try {
    const repository = AppDataSource.getRepository(Lesson);
    const page = parsePagination(request.query.page, 1, 'page');
    const limit = Math.min(parsePagination(request.query.limit, 20, 'limit'), 100);
    const courseId = request.query.courseId;

    if (courseId !== undefined && (typeof courseId !== 'string' || !isUuid(courseId))) {
      return response.status(400).json({ error: 'courseId must be a valid UUID' });
    }

    const [items, total] = await repository.findAndCount({
      where: courseId ? { courseId } : {},
      order: { orderIndex: 'ASC', createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit
    });

    return response.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (request, response, next) => {
  try {
    const { courseId, title, description = null, orderIndex, durationSeconds, isPublished = false } = request.body as {
      courseId?: string;
      title?: string;
      description?: string | null;
      orderIndex?: number;
      durationSeconds?: number;
      isPublished?: boolean;
    };

    if (!courseId || !isUuid(courseId)) {
      return response.status(400).json({ error: 'courseId must be a valid UUID' });
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return response.status(400).json({ error: 'title is required' });
    }

    const lesson = AppDataSource.getRepository(Lesson).create({
      courseId,
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : null,
      orderIndex: parsePositiveInteger(orderIndex, 'orderIndex'),
      durationSeconds: parsePositiveInteger(durationSeconds, 'durationSeconds'),
      isPublished: Boolean(isPublished)
    });

    const saved = await AppDataSource.getRepository(Lesson).save(lesson);
    return response.status(201).json(saved);
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (request, response, next) => {
  try {
    const { id } = request.params;

    if (!isUuid(id)) {
      return response.status(400).json({ error: 'id must be a valid UUID' });
    }

    const lesson = await AppDataSource.getRepository(Lesson).findOneBy({ id });

    if (!lesson) {
      return response.status(404).json({ error: 'Lesson not found' });
    }

    return response.json(lesson);
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', async (request, response, next) => {
  try {
    const { id } = request.params;

    if (!isUuid(id)) {
      return response.status(400).json({ error: 'id must be a valid UUID' });
    }

    const repository = AppDataSource.getRepository(Lesson);
    const lesson = await repository.findOneBy({ id });

    if (!lesson) {
      return response.status(404).json({ error: 'Lesson not found' });
    }

    const { courseId, title, description, orderIndex, durationSeconds, isPublished } = request.body as Partial<Lesson>;

    if (courseId !== undefined) {
      if (typeof courseId !== 'string' || !isUuid(courseId)) {
        return response.status(400).json({ error: 'courseId must be a valid UUID' });
      }
      lesson.courseId = courseId;
    }

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return response.status(400).json({ error: 'title must be a non-empty string' });
      }
      lesson.title = title.trim();
    }

    if (description !== undefined) {
      if (description !== null && typeof description !== 'string') {
        return response.status(400).json({ error: 'description must be a string or null' });
      }
      lesson.description = description === null ? null : description.trim();
    }

    if (orderIndex !== undefined) {
      lesson.orderIndex = parsePositiveInteger(orderIndex, 'orderIndex');
    }

    if (durationSeconds !== undefined) {
      lesson.durationSeconds = parsePositiveInteger(durationSeconds, 'durationSeconds');
    }

    if (isPublished !== undefined) {
      lesson.isPublished = Boolean(isPublished);
    }

    const saved = await repository.save(lesson);
    return response.json(saved);
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (request, response, next) => {
  try {
    const { id } = request.params;

    if (!isUuid(id)) {
      return response.status(400).json({ error: 'id must be a valid UUID' });
    }

    const repository = AppDataSource.getRepository(Lesson);
    const lesson = await repository.findOneBy({ id });

    if (!lesson) {
      return response.status(404).json({ error: 'Lesson not found' });
    }

    await AppDataSource.transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.getRepository(Content).delete({ lessonId: id });
      await transactionalEntityManager.getRepository(Lesson).delete({ id });
    });

    return response.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
