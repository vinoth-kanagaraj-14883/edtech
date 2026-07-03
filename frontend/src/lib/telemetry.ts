'use client';

import { trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

import { telemetryConfig } from '@/instrumentation';

let initialized = false;

const reportMetric = (
  name: string,
  value: number,
  id: string,
  rating: string,
  navigationType: string
) => {
  const tracer = trace.getTracer(telemetryConfig.serviceName);
  const span = tracer.startSpan(`web-vital.${name}`);

  span.setAttribute('metric.id', id);
  span.setAttribute('metric.name', name);
  span.setAttribute('metric.rating', rating);
  span.setAttribute('metric.value', value);
  span.setAttribute('metric.navigation_type', navigationType);
  span.end();
};

export const initTelemetry = () => {
  if (initialized || typeof window === 'undefined') {
    return;
  }

  const exporter = new OTLPTraceExporter({
    url: telemetryConfig.tracesEndpoint,
    headers: telemetryConfig.headers
  });

  const provider = new WebTracerProvider();
  provider.addSpanProcessor(new BatchSpanProcessor(exporter));
  provider.register();

  const report = ({
    id,
    name,
    value,
    rating,
    navigationType
  }: {
    id: string;
    name: string;
    value: number;
    rating: string;
    navigationType: string;
  }) => reportMetric(name, value, id, rating, navigationType);

  onCLS(report);
  onFCP(report);
  onINP(report);
  onLCP(report);
  onTTFB(report);

  initialized = true;
};
