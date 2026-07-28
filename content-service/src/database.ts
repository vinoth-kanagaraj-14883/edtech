import 'dotenv/config';
import 'reflect-metadata';

import path from 'node:path';

import { DataSource } from 'typeorm';

const port = Number(process.env.DB_PORT ?? 3306);

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'mysql',
  port,
  username: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? 'password',
  database: process.env.DB_NAME ?? 'content_service',
  entities: [path.join(__dirname, 'models', '*.{js,ts}')],
  // Auto-create tables from entities for local/dev. The MySQL init only creates
  // the empty database; there are no migrations, so synchronize builds the schema.
  synchronize: process.env.DB_SYNCHRONIZE !== 'false',
  logging: false,
  charset: 'utf8mb4_unicode_ci',
  // Disable TLS for the internal MySQL connection. MySQL 8.4 presents a
  // self-signed cert that the mysql2 driver rejects by default, causing
  // "self-signed certificate in certificate chain" connection failures.
  ssl: false,
  extra: {
    ssl: false,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_MAX ?? 10),
    maxIdle: Number(process.env.DB_POOL_IDLE ?? 10),
    idleTimeout: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? 60000),
    queueLimit: Number(process.env.DB_QUEUE_LIMIT ?? 0),
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  }
});
