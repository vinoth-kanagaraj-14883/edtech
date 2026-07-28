import './tracing';

import 'dotenv/config';

import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

import { AppDataSource } from './database';
import { logger } from './logger';
import { metricsMiddleware, register } from './metrics';
import { Content, ContentType } from './models/Content';
import { Lesson } from './models/Lesson';
import lessonsRouter from './routes/lessons';
import contentRouter from './routes/content';
import { shutdownTracing } from './tracing';

const app = express();
const port = Number(process.env.PORT ?? 8003);
const host = process.env.HOST ?? '0.0.0.0';

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use((request, response, next) => {
  response.setHeader('X-Request-Id', request.header('X-Request-Id') ?? uuidv4());
  next();
});
app.use(metricsMiddleware);
app.use((request, response, next) => {
  const startedAt = process.hrtime.bigint();

  response.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.info('request completed', {
      request_id: response.getHeader('X-Request-Id'),
      method: request.method,
      route: request.baseUrl || request.path,
      status_code: response.statusCode,
      duration_ms: Number(durationMs.toFixed(3)),
      remote_ip: request.ip,
      user_agent: request.get('user-agent') ?? null
    });
  });

  next();
});

app.get('/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'content-service',
    uptimeSeconds: Number(process.uptime().toFixed(0))
  });
});

app.get('/ready', async (_request, response) => {
  if (!AppDataSource.isInitialized) {
    return response.status(503).json({ status: 'not_ready', checks: { database: 'not_initialized' } });
  }

  try {
    await AppDataSource.query('SELECT 1');
    return response.status(200).json({ status: 'ready', checks: { database: 'ok' } });
  } catch (error) {
    logger.error('readiness probe failed', { error });
    return response.status(503).json({ status: 'not_ready', checks: { database: 'error' } });
  }
});

app.get('/metrics', async (_request, response, next) => {
  try {
    response.setHeader('Content-Type', register.contentType);
    response.end(await register.metrics());
  } catch (error) {
    next(error);
  }
});

app.use('/lessons', lessonsRouter);
app.use('/content', contentRouter);

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' });
});

app.use((error: Error, request: Request, response: Response, _next: NextFunction) => {
  const statusCode = /valid|required|integer/.test(error.message) ? 400 : 500;
  logger.error('request failed', {
    request_id: response.getHeader('X-Request-Id'),
    method: request.method,
    path: request.originalUrl,
    status_code: statusCode,
    error: error.message,
    stack: error.stack
  });

  response.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : error.message
  });
});

let shuttingDown = false;

const shutdown = async (signal: string, server?: ReturnType<typeof app.listen>): Promise<void> => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info('shutting down service', { signal });

  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }

  await shutdownTracing();
};

interface LessonSeed {
  courseId: string;
  title: string;
  description: string;
  orderIndex: number;
  durationSeconds: number;
  articleBody: string;
}

// Stable demo course IDs shared with course-service and quiz-service seeds.
const INTRO_COURSE_ID = '11111111-1111-1111-1111-111111111111';
const WEB_COURSE_ID = '22222222-2222-2222-2222-222222222222';
const HTML_COURSE_ID = '44444444-4444-4444-4444-444444444444';
const AI_COURSE_ID = '55555555-5555-5555-5555-555555555555';
const CLOUD_COURSE_ID = '66666666-6666-6666-6666-666666666666';
const AZURE_COURSE_ID = '77777777-7777-7777-7777-777777777777';
const GCP_COURSE_ID = '88888888-8888-8888-8888-888888888888';
const AWS_COURSE_ID = '99999999-9999-9999-9999-999999999999';

const LESSON_SEEDS: LessonSeed[] = [
  {
    courseId: INTRO_COURSE_ID,
    title: 'Welcome & Setting Up Your Environment',
    description: 'Install your tools and write your first line of code.',
    orderIndex: 0,
    durationSeconds: 480,
    articleBody: 'Set up an editor, a runtime, and run your first "Hello, World!" program.'
  },
  {
    courseId: INTRO_COURSE_ID,
    title: 'Variables and Data Types',
    description: 'Understand how programs store and represent data.',
    orderIndex: 1,
    durationSeconds: 720,
    articleBody: 'Learn about numbers, strings, booleans, and how to declare variables.'
  },
  {
    courseId: INTRO_COURSE_ID,
    title: 'Control Flow: Conditionals and Loops',
    description: 'Make decisions and repeat work in your programs.',
    orderIndex: 2,
    durationSeconds: 900,
    articleBody: 'Use if/else statements and for/while loops to control program execution.'
  },
  {
    courseId: WEB_COURSE_ID,
    title: 'How the Web Works',
    description: 'Clients, servers, and the HTTP request/response cycle.',
    orderIndex: 0,
    durationSeconds: 600,
    articleBody: 'A browser sends an HTTP request to a server, which returns an HTTP response.'
  },
  {
    courseId: WEB_COURSE_ID,
    title: 'Your First HTML Page',
    description: 'Structure content with semantic HTML elements.',
    orderIndex: 1,
    durationSeconds: 840,
    articleBody: 'Use <header>, <main>, <section>, and <footer> to structure a page semantically.'
  },
  {
    courseId: HTML_COURSE_ID,
    title: 'Semantic HTML5 Elements',
    description: 'Write meaningful markup with semantic tags.',
    orderIndex: 0,
    durationSeconds: 720,
    articleBody: 'Semantic elements like <article>, <nav>, and <figure> describe their meaning to browsers and assistive technology.'
  },
  {
    courseId: HTML_COURSE_ID,
    title: 'CSS Flexbox Fundamentals',
    description: 'Build flexible one-dimensional layouts.',
    orderIndex: 1,
    durationSeconds: 900,
    articleBody: 'Flexbox arranges items along a main axis and cross axis using display: flex.'
  },
  {
    courseId: HTML_COURSE_ID,
    title: 'CSS Grid for Two-Dimensional Layouts',
    description: 'Design complex page layouts with CSS Grid.',
    orderIndex: 2,
    durationSeconds: 960,
    articleBody: 'CSS Grid lets you define rows and columns explicitly with grid-template-columns/rows.'
  },
  {
    courseId: HTML_COURSE_ID,
    title: 'Responsive Design & Accessibility',
    description: 'Make your pages work well on any device for any user.',
    orderIndex: 3,
    durationSeconds: 780,
    articleBody: 'Use media queries, relative units, and ARIA attributes to build responsive, accessible pages.'
  },
  {
    courseId: AI_COURSE_ID,
    title: 'What Is Artificial Intelligence?',
    description: 'A tour of AI, machine learning, and deep learning.',
    orderIndex: 0,
    durationSeconds: 780,
    articleBody: 'AI is the broader field; machine learning and deep learning are subsets that learn patterns from data.'
  },
  {
    courseId: AI_COURSE_ID,
    title: 'Supervised vs. Unsupervised Learning',
    description: 'Understand the two foundational machine learning paradigms.',
    orderIndex: 1,
    durationSeconds: 840,
    articleBody: 'Supervised learning trains on labeled data; unsupervised learning finds structure in unlabeled data.'
  },
  {
    courseId: AI_COURSE_ID,
    title: 'Introduction to Neural Networks',
    description: 'How artificial neurons combine to learn complex functions.',
    orderIndex: 2,
    durationSeconds: 900,
    articleBody: 'Neural networks stack layers of weighted connections and activation functions to approximate functions.'
  },
  {
    courseId: AI_COURSE_ID,
    title: 'Natural Language Processing Basics',
    description: 'Teaching machines to understand and generate text.',
    orderIndex: 3,
    durationSeconds: 840,
    articleBody: 'NLP techniques range from tokenization and embeddings to modern transformer-based language models.'
  },
  {
    courseId: CLOUD_COURSE_ID,
    title: 'Core Cloud Concepts',
    description: 'Compute, storage, and networking in the cloud.',
    orderIndex: 0,
    durationSeconds: 720,
    articleBody: 'Cloud providers offer on-demand compute instances, object/block storage, and virtual networks.'
  },
  {
    courseId: CLOUD_COURSE_ID,
    title: 'Shared Responsibility Model',
    description: 'Understand what the provider secures vs. what you secure.',
    orderIndex: 1,
    durationSeconds: 660,
    articleBody: 'Providers secure the underlying infrastructure; customers are responsible for data, access, and configuration.'
  },
  {
    courseId: CLOUD_COURSE_ID,
    title: 'Scalability & Elasticity',
    description: 'Scale resources up, down, in, and out automatically.',
    orderIndex: 2,
    durationSeconds: 780,
    articleBody: 'Autoscaling adjusts compute capacity automatically in response to demand.'
  },
  {
    courseId: AZURE_COURSE_ID,
    title: 'Azure Resource Groups & Subscriptions',
    description: 'Organize and manage your Azure resources.',
    orderIndex: 0,
    durationSeconds: 720,
    articleBody: 'Resource groups are logical containers for resources that share a lifecycle within a subscription.'
  },
  {
    courseId: AZURE_COURSE_ID,
    title: 'Azure App Service & Virtual Machines',
    description: 'Compare PaaS and IaaS compute options on Azure.',
    orderIndex: 1,
    durationSeconds: 840,
    articleBody: 'App Service is a managed PaaS for web apps; Virtual Machines give full control over the OS (IaaS).'
  },
  {
    courseId: AZURE_COURSE_ID,
    title: 'Identity with Microsoft Entra ID',
    description: 'Authenticate and authorize users and apps on Azure.',
    orderIndex: 2,
    durationSeconds: 780,
    articleBody: 'Microsoft Entra ID (formerly Azure AD) provides identity, SSO, and RBAC across Azure services.'
  },
  {
    courseId: GCP_COURSE_ID,
    title: 'Compute Engine & Cloud Storage',
    description: 'Run VMs and store objects on Google Cloud.',
    orderIndex: 0,
    durationSeconds: 720,
    articleBody: 'Compute Engine provides virtual machines; Cloud Storage offers durable object storage buckets.'
  },
  {
    courseId: GCP_COURSE_ID,
    title: 'Introduction to BigQuery',
    description: 'Run fast SQL analytics over massive datasets.',
    orderIndex: 1,
    durationSeconds: 840,
    articleBody: 'BigQuery is a serverless, highly scalable data warehouse for running SQL analytics at scale.'
  },
  {
    courseId: GCP_COURSE_ID,
    title: 'IAM & Least Privilege on GCP',
    description: 'Grant only the access users and services need.',
    orderIndex: 2,
    durationSeconds: 720,
    articleBody: 'GCP IAM uses roles and policies to grant fine-grained permissions on resources.'
  },
  {
    courseId: AWS_COURSE_ID,
    title: 'EC2 & S3 Fundamentals',
    description: 'Amazon\u2019s core compute and storage services.',
    orderIndex: 0,
    durationSeconds: 720,
    articleBody: 'EC2 provides resizable compute capacity; S3 offers durable, highly available object storage.'
  },
  {
    courseId: AWS_COURSE_ID,
    title: 'VPC Networking Basics',
    description: 'Design isolated virtual networks on AWS.',
    orderIndex: 1,
    durationSeconds: 840,
    articleBody: 'A VPC lets you provision a logically isolated network with subnets, route tables, and gateways.'
  },
  {
    courseId: AWS_COURSE_ID,
    title: 'The AWS Well-Architected Framework',
    description: 'Design reliable, secure, and cost-effective systems.',
    orderIndex: 2,
    durationSeconds: 780,
    articleBody: 'The framework covers six pillars: operational excellence, security, reliability, performance, cost, and sustainability.'
  }
];

const seedLessons = async (): Promise<void> => {
  const lessonRepository = AppDataSource.getRepository(Lesson);
  const contentRepository = AppDataSource.getRepository(Content);

  let created = 0;
  for (const seed of LESSON_SEEDS) {
    const existing = await lessonRepository.findOne({
      where: { courseId: seed.courseId, orderIndex: seed.orderIndex }
    });
    if (existing) {
      continue;
    }

    const lesson = await lessonRepository.save(
      lessonRepository.create({
        courseId: seed.courseId,
        title: seed.title,
        description: seed.description,
        orderIndex: seed.orderIndex,
        durationSeconds: seed.durationSeconds,
        isPublished: true
      })
    );

    await contentRepository.save(
      contentRepository.create({
        lessonId: lesson.id,
        type: ContentType.DOCUMENT,
        url: `https://learn.eduforge.dev/articles/${lesson.id}`,
        filename: `${seed.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`,
        mimeType: 'text/markdown',
        sizeBytes: Buffer.byteLength(seed.articleBody, 'utf8')
      })
    );

    created += 1;
  }

  logger.info('seeded demo lessons', { count: created });
};


const bootstrap = async (): Promise<void> => {
  await AppDataSource.initialize();
  logger.info('database connection initialized', {
    host: process.env.DB_HOST ?? 'mysql',
    database: process.env.DB_NAME ?? 'content_service'
  });

  await seedLessons().catch((error: unknown) => {
    logger.error('lesson seed skipped', {
      error: error instanceof Error ? error.message : String(error)
    });
  });

  const server = app.listen(port, host, () => {
    logger.info('content service started', { host, port });
  });

  const handleSignal = (signal: NodeJS.Signals) => {
    void shutdown(signal, server)
      .then(() => process.exit(0))
      .catch((error: Error) => {
        logger.error('graceful shutdown failed', { error: error.message, stack: error.stack });
        process.exit(1);
      });
  };

  process.on('SIGTERM', handleSignal);
  process.on('SIGINT', handleSignal);
  process.on('uncaughtException', (error) => {
    logger.error('uncaught exception', { error: error.message, stack: error.stack });
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled rejection', {
      reason: reason instanceof Error ? reason.message : String(reason)
    });
  });
};

void bootstrap().catch((error: Error) => {
  logger.error('failed to start content service', { error: error.message, stack: error.stack });
  void shutdown('bootstrap_failure').finally(() => process.exit(1));
});
