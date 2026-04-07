'use client';

import { useReportWebVitals } from 'next/web-vitals';

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[web-vitals]', metric);
      return;
    }

    const payload = JSON.stringify({
      id: metric.id,
      name: metric.name,
      label: metric.label,
      value: metric.value,
      rating: metric.rating,
      navigationType: metric.navigationType,
    });

    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      navigator.sendBeacon('/api/web-vitals', payload);
    }
  });

  return null;
}
