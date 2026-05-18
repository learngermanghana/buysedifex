import { getMerchantToken } from './sedifex-checkout';

type BookingCustomer = { name: string; phone?: string; email?: string };

type CreateBookingInput = {
  merchantId: string;
  serviceId: string;
  serviceName?: string;
  slotId?: string;
  customer: BookingCustomer;
  quantity?: number;
  notes?: string;
  paymentMethod?: string;
  paymentAmount?: number | null;
  bookingDate: string;
  bookingTime: string;
  branchLocationName?: string;
  attributes?: Record<string, unknown>;
};

const getBaseUrl = () => {
  const value = process.env.SEDIFEX_INTEGRATION_API_BASE_URL?.trim();
  if (!value) throw new Error('SEDIFEX_INTEGRATION_API_BASE_URL is not configured');
  return value.replace(/\/$/, '');
};

const getContractVersion = () => process.env.SEDIFEX_INTEGRATION_API_VERSION?.trim() || '2026-04-13';

const buildHeaders = (merchantId: string) => {
  const token = getMerchantToken(merchantId);
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-api-key': token,
    'X-Sedifex-Contract-Version': getContractVersion(),
  };
};

export async function getIntegrationAvailability(merchantId: string, serviceId: string) {
  const url = new URL(`${getBaseUrl()}/v1IntegrationAvailability`);
  url.searchParams.set('storeId', merchantId);
  url.searchParams.set('serviceId', serviceId);
  const response = await fetch(url.toString(), { method: 'GET', headers: buildHeaders(merchantId), cache: 'no-store' });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Sedifex availability failed (${response.status}): ${text}`);
  }
  return response.json();
}

export async function createIntegrationBooking(input: CreateBookingInput) {
  const url = new URL(`${getBaseUrl()}/v1IntegrationBookings`);
  url.searchParams.set('storeId', input.merchantId);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: buildHeaders(input.merchantId),
    body: JSON.stringify({
      serviceId: input.serviceId,
      slotId: input.slotId || undefined,
      customer: input.customer,
      quantity: input.quantity ?? 1,
      notes: input.notes || undefined,
      paymentMethod: input.paymentMethod || 'manual',
      paymentAmount: typeof input.paymentAmount === 'number' ? input.paymentAmount : undefined,
      bookingDate: input.bookingDate,
      bookingTime: input.bookingTime,
      branchLocationName: input.branchLocationName || undefined,
      attributes: input.attributes,
      serviceName: input.serviceName,
    }),
    cache: 'no-store',
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Sedifex booking failed (${response.status}): ${text}`);
  }
  return response.json();
}
