import { context, trace } from '@opentelemetry/api';
import winston from 'winston';

const injectTraceContext = winston.format((info) => {
  const span = trace.getSpan(context.active());
  const spanContext = span?.spanContext();

  info.service = 'content-service';
  info.trace_id = spanContext?.traceId ?? null;
  info.span_id = spanContext?.spanId ?? null;

  return info;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    injectTraceContext(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'content-service'
  },
  transports: [new winston.transports.Console()]
});
