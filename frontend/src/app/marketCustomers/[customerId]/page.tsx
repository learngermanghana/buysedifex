'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { db, firebaseConfigError } from '@/lib/firebase';

type UnknownRecord = Record<string, unknown>;

type CustomerOrder = {
  id: string;
  reference: string;
  paymentStatus: string;
  orderStatus: string;
  amount: string;
  createdAt: string;
  storeId: string;
};

const pickString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
};

const formatAmount = (amount: unknown, currency: unknown): string => {
  const amountValue = Number(pickString(amount));
  if (!Number.isFinite(amountValue) || amountValue <= 0) return 'N/A';
  const resolvedCurrency = pickString(currency, 'GHS');
  const normalized = amountValue > 1000 ? amountValue / 100 : amountValue;
  return `${resolvedCurrency} ${normalized.toFixed(2)}`;
};

const mapOrder = (id: string, data: UnknownRecord): CustomerOrder => ({
  id,
  reference: pickString(data.reference || data.paymentReference || data.clientOrderId, id),
  paymentStatus: pickString(data.paymentStatus || data.paystackStatus, 'pending'),
  orderStatus: pickString(data.orderStatus || data.status, 'processing'),
  amount: formatAmount(data.amountPaid || data.finalTotal || data.amount, data.currency),
  createdAt: pickString(data.createdAt, 'N/A'),
  storeId: pickString(data.storeId || data.merchantId, 'N/A'),
});

export default function MarketCustomerPage() {
  const params = useParams<{ customerId: string }>();
  const customerId = decodeURIComponent(params.customerId ?? '').trim();

  const [customer, setCustomer] = useState<UnknownRecord | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;

    const loadCustomerData = async () => {
      if (!customerId) {
        setError('Customer id is required.');
        setIsLoading(false);
        return;
      }

      if (!db || firebaseConfigError) {
        setError(firebaseConfigError || 'Firebase is not configured.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError('');

        const customerRef = doc(db, 'marketCustomers', customerId);
        const ordersRef = query(collection(db, 'marketCustomers', customerId, 'orders'), orderBy('createdAt', 'desc'));

        const [customerSnap, ordersSnap] = await Promise.all([getDoc(customerRef), getDocs(ordersRef)]);

        if (!isActive) return;

        if (!customerSnap.exists()) {
          setError('Customer record was not found.');
          setCustomer(null);
          setOrders([]);
          return;
        }

        setCustomer(customerSnap.data() as UnknownRecord);
        setOrders(ordersSnap.docs.map((item) => mapOrder(item.id, item.data() as UnknownRecord)));
      } catch (loadError) {
        if (!isActive) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load market customer data.');
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    void loadCustomerData();

    return () => {
      isActive = false;
    };
  }, [customerId]);

  const customerName = useMemo(() => pickString(customer?.displayName || customer?.firstName, 'Unknown customer'), [customer]);

  return (
    <main className="container accountPage">
      <section className="accountCard">
        <p className="eyebrow">Market customer profile</p>
        <h1>{customerName}</h1>
        <p>Customer ID: {customerId || 'N/A'}</p>

        {isLoading ? <p>Loading customer and order data...</p> : null}
        {error ? <p className="requestFeedback error">{error}</p> : null}

        {!isLoading && !error && customer ? (
          <div className="historyList">
            <p><strong>Email:</strong> {pickString(customer.email, 'N/A')}</p>
            <p><strong>Phone:</strong> {pickString(customer.phone, 'N/A')}</p>
            <p><strong>Total online orders:</strong> {orders.length}</p>
          </div>
        ) : null}

        {!isLoading && !error ? (
          <div className="historyList">
            <h2>Online purchase records</h2>
            {orders.length === 0 ? <p>No online order records found for this customer yet.</p> : null}
            {orders.map((order) => (
              <article key={order.id} className="accountCard" style={{ marginBottom: 12 }}>
                <p><strong>Reference:</strong> {order.reference}</p>
                <p><strong>Store:</strong> {order.storeId}</p>
                <p><strong>Amount:</strong> {order.amount}</p>
                <p><strong>Payment:</strong> {order.paymentStatus}</p>
                <p><strong>Order status:</strong> {order.orderStatus}</p>
                <p><strong>Created at:</strong> {order.createdAt}</p>
              </article>
            ))}
          </div>
        ) : null}

        <div className="productStoreActions">
          <Link href="/">Back to home</Link>
          <Link href="/account">Back to account</Link>
        </div>
      </section>
    </main>
  );
}
