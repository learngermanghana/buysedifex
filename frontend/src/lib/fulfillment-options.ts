export type FulfillmentType = 'SAME_DAY_DELIVERY' | 'NEXT_DAY_DELIVERY' | 'STORE_PICKUP';

export type FulfillmentOption = {
  type: FulfillmentType;
  title: string;
  label: string;
  helper: string;
  badge: string;
  available: boolean;
};

const GHANA_TIME_ZONE = 'Africa/Accra';
const SAME_DAY_CUTOFF_HOUR = 16;

export function getGhanaHour(date = new Date()) {
  const hourText = new Intl.DateTimeFormat('en-GB', {
    timeZone: GHANA_TIME_ZONE,
    hour: '2-digit',
    hour12: false,
  }).format(date);
  const hour = Number(hourText);
  return Number.isFinite(hour) ? hour : date.getUTCHours();
}

export function isBeforeSameDayCutoff(date = new Date()) {
  return getGhanaHour(date) < SAME_DAY_CUTOFF_HOUR;
}

export function getDefaultFulfillmentType(date = new Date()): FulfillmentType {
  return isBeforeSameDayCutoff(date) ? 'SAME_DAY_DELIVERY' : 'NEXT_DAY_DELIVERY';
}

export function getDeliveryEtaLabel(type: FulfillmentType, date = new Date()) {
  const beforeCutoff = isBeforeSameDayCutoff(date);
  if (type === 'STORE_PICKUP') return 'Store pickup available after order confirmation';
  if (type === 'SAME_DAY_DELIVERY') {
    return beforeCutoff ? 'Same-day delivery today' : 'Same-day delivery has closed for today';
  }
  return beforeCutoff ? 'Tomorrow delivery also available' : 'Delivery tomorrow';
}

export function getFulfillmentOptions(date = new Date()): FulfillmentOption[] {
  const beforeCutoff = isBeforeSameDayCutoff(date);
  return [
    {
      type: 'SAME_DAY_DELIVERY',
      title: 'Same-day delivery',
      label: beforeCutoff ? 'Same-day delivery today' : 'Same-day delivery closed for today',
      helper: beforeCutoff
        ? 'Order and pay before 4:00 PM for same-day delivery where the store can deliver.'
        : 'Same-day delivery closes at 4:00 PM. Choose tomorrow delivery or store pickup.',
      badge: beforeCutoff ? 'Before 4 PM' : 'Closed after 4 PM',
      available: beforeCutoff,
    },
    {
      type: 'NEXT_DAY_DELIVERY',
      title: 'Tomorrow delivery',
      label: 'Delivery tomorrow',
      helper: beforeCutoff
        ? 'Choose this if you prefer delivery tomorrow instead of today.'
        : 'Orders placed after 4:00 PM are prepared for delivery tomorrow.',
      badge: 'After 4 PM fallback',
      available: true,
    },
    {
      type: 'STORE_PICKUP',
      title: 'Store pickup',
      label: 'Store pickup available',
      helper: 'Pay through Sedifex, keep your payment record, then pick up from the store after confirmation.',
      badge: 'Pickup option',
      available: true,
    },
  ];
}

export function getFulfillmentOption(type: FulfillmentType, date = new Date()) {
  return getFulfillmentOptions(date).find((option) => option.type === type) ?? getFulfillmentOptions(date)[0];
}

export function isDeliveryFulfillment(type: FulfillmentType) {
  return type !== 'STORE_PICKUP';
}
