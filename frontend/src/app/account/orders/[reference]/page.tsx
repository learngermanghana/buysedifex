'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type OrderPayload = Record<string, unknown>;

type OrderView = {
  recordType?: string;
  reference: string;
  paymentStatus: string;
  orderStatus: string;
  storeId?: string;
  storeName?: string;
  amount?: string;
  currency?: string;
  customerEmail?: string;
  customerPhone?: string;
  productName?: string;
  productUrl?: string;
  storeUrl?: string;
  quantity?: string;
  merchantIds: string[];
  childReferences: string[];
  merchantOrders: Array<{ merchantId: string; storeId: string; amount: string; orderStatus: string }>;
};
const shortRef = (reference: string) => (reference.length > 18 ? `${reference.slice(0, 8)}...${reference.slice(-8)}` : reference);

const pickString = (source: OrderPayload | undefined, keys: string[], fallback = '') => {
  if (!source) return fallback;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return fallback;
};

const pickNestedObject = (payload: OrderPayload): OrderPayload => {
  for (const key of ['order', 'data', 'checkout', 'integrationOrder']) {
    const value = payload[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as OrderPayload;
  }
  return payload;
};

const statusClass = (status: string) => {
  const normalized = status.toLowerCase();
  if (['confirmed', 'completed', 'success', 'paid', 'captured'].includes(normalized)) return 'success';
  if (['failed', 'rejected', 'cancelled', 'canceled', 'abandoned', 'verification_failed'].includes(normalized)) return 'error';
  return 'pending';
};

const formatMoney = (amount?: string, currency = 'GHS') => {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  const value = parsed > 1000 ? parsed / 100 : parsed;
  return `${currency} ${value.toFixed(2)}`;
};

const getFirstItem = (source: OrderPayload): OrderPayload | undefined => {
  const items = source.items;
  if (!Array.isArray(items) || items.length === 0) return undefined;
  const first = items[0];
  return first && typeof first === 'object' ? (first as OrderPayload) : undefined;
};

const normalizeOrder = (payload: OrderPayload, fallbackReference: string): OrderView => {
  const source = pickNestedObject(payload);
  const firstItem = getFirstItem(source);
  const currency = pickString(source, ['currency'], 'GHS');
  const amount = pickString(source, ['amountPaid', 'finalTotal', 'final_total', 'amount', 'total']);
  const merchantIds = Array.isArray(source.merchantIds) ? source.merchantIds.map((id) => String(id)).filter(Boolean) : [];
  const childReferences = Array.isArray(source.childReferences) ? source.childReferences.map((id) => String(id)).filter(Boolean) : [];
  const merchantOrders = Array.isArray(source.merchantOrders)
    ? source.merchantOrders
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => {
          const value = entry as OrderPayload;
          return {
            merchantId: pickString(value, ['merchantId', 'storeId']),
            storeId: pickString(value, ['storeId', 'merchantId']),
            amount: formatMoney(pickString(value, ['amount', 'amountPaid', 'amountMinor']), currency),
            orderStatus: pickString(value, ['settlementStatus', 'orderStatus', 'order_status', 'paymentStatus'], 'pending'),
          };
        })
    : [];

  return {
    recordType: pickString(source, ['recordType']),
    reference: pickString(source, ['reference', 'paymentReference', 'payment_reference', 'clientOrderId', 'client_order_id'], fallbackReference),
    paymentStatus: pickString(source, ['paymentStatus', 'payment_status', 'paystackStatus'], 'pending'),
    orderStatus: pickString(source, ['orderStatus', 'order_status', 'status'], 'processing'),
    storeId: pickString(source, ['storeId', 'store_id', 'merchantId', 'merchant_id']) || undefined,
    storeName: pickString(source, ['storeName', 'store_name', 'merchantName']) || undefined,
    amount: formatMoney(amount, currency) || undefined,
    currency,
    customerEmail: pickString(source, ['customerEmail', 'email']) || undefined,
    customerPhone: pickString(source, ['customerPhone', 'phone']) || undefined,
    productName: pickString(firstItem, ['name', 'productName', 'item_name', 'serviceName']) || pickString(source, ['productName', 'serviceName']) || undefined,
    productUrl: pickString(source, ['productUrl']) || undefined,
    storeUrl: pickString(source, ['storeUrl']) || undefined,
    quantity: pickString(firstItem, ['qty', 'quantity']) || undefined,
    merchantIds,
    childReferences,
    merchantOrders,
  };
};

export default function AccountOrderDetailPage() {
  const params = useParams<{ reference: string }>();
  const reference = decodeURIComponent(params.reference ?? '').trim();
  const [payload, setPayload] = useState<OrderPayload | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadOrder = async () => {
      try {
        setIsLoading(true);
        setError('');
        const response = await fetch(`/api/integration/orders/${encodeURIComponent(reference)}`, { cache: 'no-store' });
        const data = (await response.json().catch(() => ({}))) as OrderPayload;
        if (!active) return;
        if (!response.ok) {
          setError(typeof data.error === 'string' ? data.error : `Order lookup failed with ${response.status}`);
          setPayload(data);
          return;
        }
        setPayload(data);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load order.');
      } finally {
        if (active) setIsLoading(false);
      }
    };

    if (reference) void loadOrder();
    return () => {
      active = false;
    };
  }, [reference]);

  const order = useMemo(() => normalizeOrder(payload ?? {}, reference), [payload, reference]);
  const isMarketplaceMasterOrder = order.recordType === 'marketplace_master_order';

  return (
    <main className="container accountPage">
      <section className="accountCard">
        <p className="eyebrow">Order details</p>
        <h1>Order confirmed</h1>
        <p>{order.productName || 'Product order'}</p>
        <p>Use this page to check payment confirmation, order status, and support information.</p>

        {isLoading ? <p>Loading order...</p> : null}
        {error ? <p className="requestFeedback error">{error}</p> : null}

        <div className="historyList">
          <p><strong>Reference:</strong> {order.reference || 'N/A'} <button onClick={() => navigator.clipboard.writeText(order.reference || '')}>Copy</button></p>
          <p><strong>Short reference:</strong> {shortRef(order.reference || reference)}</p>
          {isMarketplaceMasterOrder ? <p><strong>Type:</strong> Marketplace order</p> : null}
          <p><strong>Payment:</strong> <span className={`statusBadge ${statusClass(order.paymentStatus)}`}>{order.paymentStatus}</span></p>
          <p><strong>Order:</strong> <span className={`statusBadge ${statusClass(order.orderStatus)}`}>{order.orderStatus}</span></p>
          {order.amount ? <p><strong>Amount:</strong> {order.amount}</p> : null}
          {!isMarketplaceMasterOrder && order.productName ? <p><strong>Item:</strong> {order.productName}{order.quantity ? ` × ${order.quantity}` : ''}</p> : null}
          {!isMarketplaceMasterOrder && order.storeName ? <p><strong>Store:</strong> {order.storeName}</p> : null}
          {!isMarketplaceMasterOrder && order.productUrl ? <p><strong>Item link:</strong> <Link href={order.productUrl}>View item/service</Link></p> : null}
          {!isMarketplaceMasterOrder && order.storeUrl ? <p><strong>Store link:</strong> <Link href={order.storeUrl}>View store</Link></p> : null}
          {isMarketplaceMasterOrder ? <p><strong>Stores:</strong> {order.merchantIds.length}</p> : null}
          {isMarketplaceMasterOrder && order.childReferences.length > 0 ? <p><strong>Child references:</strong> {order.childReferences.join(', ')}</p> : null}
          {isMarketplaceMasterOrder && order.merchantOrders.length > 0 ? (
            <div>
              <p><strong>Merchant orders:</strong></p>
              <ul>
                {order.merchantOrders.map((merchantOrder) => (
                  <li key={`${merchantOrder.merchantId}:${merchantOrder.storeId}`}>
                    {(merchantOrder.merchantId || merchantOrder.storeId || 'Unknown store')} — {merchantOrder.amount || 'Amount unavailable'} — {merchantOrder.orderStatus}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {order.customerEmail ? <p><strong>Email:</strong> {order.customerEmail}</p> : null}
          {order.customerPhone ? <p><strong>Phone:</strong> {order.customerPhone}</p> : null}
        </div>

        <div className="productStoreActions">
          <Link href="/">Continue shopping</Link>
          <Link href="/account">Back to account</Link>
          <Link href="/contact">Contact support</Link>
        </div>
      </section>
    </main>
  );
}
