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

  // The OTLP exporter requires an absolute URL. When the configured endpoint
  // is a relative path (e.g. the Next.js proxy route "/api/proxy/otel/v1/traces"),
  // resolve it against the current origin so `new URL(...)` inside the exporter
  // does not throw "Could not parse user-provided export URL".
  const configuredEndpoint = telemetryConfig.tracesEndpoint;
  const tracesEndpoint = /^https?:\/\//i.test(configuredEndpoint)
    ? configuredEndpoint
    : new URL(configuredEndpoint, window.location.origin).toString();

  const exporter = new OTLPTraceExporter({
    url: tracesEndpoint,
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
