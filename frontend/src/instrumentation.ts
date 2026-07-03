import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';

const defaultTracesEndpoint = process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  ? process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  : process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/otel/v1/traces`
    : '/api/proxy/otel/v1/traces';

export const telemetryConfig = {
  serviceName: process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME || 'edtech-frontend',
  tracesEndpoint: defaultTracesEndpoint,
  headers: process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_HEADERS
    ? Object.fromEntries(
        process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_HEADERS.split(',')
          .map((header) => header.trim())
          .filter(Boolean)
          .map((header) => {
            const [key, ...rest] = header.split('=');
            return [key.trim(), rest.join('=').trim()];
          })
      )
    : undefined
};

export async function register() {
  if (process.env.OTEL_DEBUG === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
  }
}
