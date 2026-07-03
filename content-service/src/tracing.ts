import 'dotenv/config';

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4317';

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: 'content-service'
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
