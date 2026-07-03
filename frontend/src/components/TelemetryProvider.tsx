'use client';

import { useEffect } from 'react';

import { initTelemetry } from '@/lib/telemetry';

export default function TelemetryProvider() {
  useEffect(() => {
    initTelemetry();
  }, []);

  return null;
}
