import { Router } from 'express';
import { validate as isUuid } from 'uuid';

import { AppDataSource } from '../database';
import { Content, ContentType } from '../models/Content';
import { Lesson } from '../models/Lesson';

const router = Router();

const parseSizeBytes = (value: unknown): number => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('sizeBytes must be a non-negative integer');
  }

  return parsed;
};

const isValidContentType = (value: unknown): value is ContentType =>
  typeof value === 'string' && Object.values(ContentType).includes(value as ContentType);

router.get('/:lessonId', async (request, response, next) => {
  try {
    const { lessonId } = request.params;

    if (!isUuid(lessonId)) {
      return response.status(400).json({ error: 'lessonId must be a valid UUID' });
    }

    const lessonExists = await AppDataSource.getRepository(Lesson).exist({ where: { id: lessonId } });

    if (!lessonExists) {
      return response.status(404).json({ error: 'Lesson not found' });
    }

    const items = await AppDataSource.getRepository(Content).find({
      where: { lessonId },
      order: { createdAt: 'ASC' }
    });

    return response.json({ items });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (request, response, next) => {
  try {
    const { lessonId, type, url, filename, mimeType, sizeBytes } = request.body as {
      lessonId?: string;
      type?: ContentType;
      url?: string;
      filename?: string;
      mimeType?: string;
      sizeBytes?: number;
    };

    if (!lessonId || !isUuid(lessonId)) {
      return response.status(400).json({ error: 'lessonId must be a valid UUID' });
    }

    if (!isValidContentType(type)) {
      return response.status(400).json({ error: 'type must be one of VIDEO, DOCUMENT, QUIZ_REF' });
    }

    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return response.status(400).json({ error: 'url is required' });
    }

    if (!filename || typeof filename !== 'string' || filename.trim().length === 0) {
      return response.status(400).json({ error: 'filename is required' });
    }

    if (!mimeType || typeof mimeType !== 'string' || mimeType.trim().length === 0) {
      return response.status(400).json({ error: 'mimeType is required' });
    }

    const lessonExists = await AppDataSource.getRepository(Lesson).exist({ where: { id: lessonId } });

    if (!lessonExists) {
      return response.status(404).json({ error: 'Lesson not found' });
    }

    const repository = AppDataSource.getRepository(Content);
    const content = repository.create({
      lessonId,
      type,
      url: url.trim(),
      filename: filename.trim(),
      mimeType: mimeType.trim(),
      sizeBytes: parseSizeBytes(sizeBytes)
    });

    const saved = await repository.save(content);
    return response.status(201).json(saved);
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

    const repository = AppDataSource.getRepository(Content);
    const content = await repository.findOneBy({ id });

    if (!content) {
      return response.status(404).json({ error: 'Content item not found' });
    }

    const { lessonId, type, url, filename, mimeType, sizeBytes } = request.body as Partial<Content>;

    if (lessonId !== undefined) {
      if (typeof lessonId !== 'string' || !isUuid(lessonId)) {
        return response.status(400).json({ error: 'lessonId must be a valid UUID' });
      }

      const lessonExists = await AppDataSource.getRepository(Lesson).exist({ where: { id: lessonId } });
      if (!lessonExists) {
        return response.status(404).json({ error: 'Lesson not found' });
      }

      content.lessonId = lessonId;
    }

    if (type !== undefined) {
      if (!isValidContentType(type)) {
        return response.status(400).json({ error: 'type must be one of VIDEO, DOCUMENT, QUIZ_REF' });
      }
      content.type = type;
    }

    if (url !== undefined) {
      if (typeof url !== 'string' || url.trim().length === 0) {
        return response.status(400).json({ error: 'url must be a non-empty string' });
      }
      content.url = url.trim();
    }

    if (filename !== undefined) {
      if (typeof filename !== 'string' || filename.trim().length === 0) {
        return response.status(400).json({ error: 'filename must be a non-empty string' });
      }
      content.filename = filename.trim();
    }

    if (mimeType !== undefined) {
      if (typeof mimeType !== 'string' || mimeType.trim().length === 0) {
        return response.status(400).json({ error: 'mimeType must be a non-empty string' });
      }
      content.mimeType = mimeType.trim();
    }

    if (sizeBytes !== undefined) {
      content.sizeBytes = parseSizeBytes(sizeBytes);
    }

    const saved = await repository.save(content);
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

    const repository = AppDataSource.getRepository(Content);
    const content = await repository.findOneBy({ id });

    if (!content) {
      return response.status(404).json({ error: 'Content item not found' });
    }

    await repository.remove(content);
    return response.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
