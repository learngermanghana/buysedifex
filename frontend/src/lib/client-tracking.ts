'use client';

export type TrackEventName = 'product_view' | 'whatsapp_click' | 'request_submit' | 'promo_impression' | 'promo_click' | 'save_item';

export async function trackEvent(eventName: TrackEventName, payload: Record<string, unknown> = {}) {
  try {
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ eventName, payload }),
      keepalive: true,
    });
  } catch {
    // no-op for tracking failures
  }
}
