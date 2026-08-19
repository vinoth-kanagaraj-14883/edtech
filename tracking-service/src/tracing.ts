import 'dotenv/config';

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// The proto/HTTP exporter expects the full signal path; append /v1/traces
// if only the collector base URL was provided (matches other services'
// OTEL_EXPORTER_OTLP_ENDPOINT convention of a bare host:port or base URL).
const rawEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4318';
const otlpEndpoint = rawEndpoint.includes('/v1/traces') ? rawEndpoint : `${rawEndpoint.replace(/\/$/, '')}/v1/traces`;

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: 'tracking-service'
  }),
  traceExporter: new OTLPTraceExporter({
    url: otlpEndpoint
  }),
  instrumentations: [getNodeAutoInstrumentations()]
});

try {
  sdk.start();
} catch (error) {
  console.error('Failed to initialize OpenTelemetry SDK', error);
}

export const shutdownTracing = async (): Promise<void> => {
  try {
    await sdk.shutdown();
  } catch (error) {
    console.error('Failed to shut down OpenTelemetry SDK', error);
  }
};
