'use client';

import { useMemo, useState } from 'react';
import { getFulfillmentOptions } from '@/lib/fulfillment-options';
import { useCart } from './cart-provider';

type ProductPurchasePanelProps = {
  productId: string;
  merchantId: string;
  productName: string;
  storeName: string;
  itemType?: string;
  price?: number | null;
  currency?: string;
  imageUrl?: string;
};

const formatMoney = (value?: number | null, currency = 'GHS') => {
  if (typeof value !== 'number') return 'Price confirmed at checkout';
  const displayCurrency = currency.toUpperCase() === 'USD' ? 'GHS' : currency.toUpperCase();
  return `${displayCurrency === 'GHS' ? 'GH₵' : displayCurrency} ${value.toFixed(2)}`;
};

export function ProductPurchasePanel({ productId, merchantId, productName, storeName, itemType, price, currency = 'GHS', imageUrl }: ProductPurchasePanelProps) {
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const normalizedType = itemType?.trim().toLowerCase();
  const isServiceLike = normalizedType === 'service' || normalizedType === 'course' || normalizedType === 'event';
  const fulfillmentOptions = useMemo(() => getFulfillmentOptions(), []);
  const primaryDelivery = fulfillmentOptions[0];
  const deliveryPromiseTitle = primaryDelivery?.available
    ? '🚚 Delivery before 4:00 PM'
    : '🚚 Tomorrow delivery after 4:00 PM cutoff';
  const deliveryPromiseHelper =
    primaryDelivery?.helper ?? 'Choose delivery or store pickup at checkout after adding this product to cart.';

  const addItem = (openAfterAdd = false) => {
    cart.addItem({ productId, merchantId, productName, itemName: productName, quantity, type: 'PRODUCT', price: price ?? null, currency, imageUrl, storeName });
    setMessage('Product added. Choose delivery or pickup in the cart.');
    window.setTimeout(() => setMessage(''), 2200);
    if (openAfterAdd) cart.openCart();
  };

  return (
    <aside className="productCartPanel" aria-label={isServiceLike ? 'Service booking options' : 'Product cart options'}>
      <style>{`
        @media (max-width: 1040px) {
          .productDetailMainColumn { display: contents; }
          .productDetailMainColumn > * { order: 3; }
          .productDetailMainColumn > .productSummaryCard { order: 1; }
          .productCartPanel { order: 2; }
        }
      `}</style>
      <p className="eyebrow">Secure checkout</p>
      <h3>{isServiceLike ? 'Book this service or class' : 'Buy this product'}</h3>
      <p className="productCartPrice">{formatMoney(price, currency)}</p>
      <p className="checkoutHint">{isServiceLike ? 'Services and classes can be booked here with date, time, and registration details.' : 'Add this product to cart, choose same-day delivery, tomorrow delivery, or store pickup, then pay securely.'}</p>

      {!isServiceLike ? (
        <div className="fulfillmentPromise" style={{ border: '1px solid #dbeafe', background: '#eff6ff', borderRadius: 16, padding: 12, display: 'grid', gap: 8, margin: '12px 0' }}>
          <strong>{deliveryPromiseTitle}</strong>
          <span>{deliveryPromiseHelper}</span>
          <span>🏬 Store pickup is also available after Sedifex checkout.</span>
        </div>
      ) : null}

      {isServiceLike ? (
        <a className="requestButton" href="#service-booking-form">Book this service</a>
      ) : (
        <>
          <div className="productCartQty" aria-label="Quantity selector">
            <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))}>-</button><strong>{quantity}</strong><button type="button" onClick={() => setQuantity((current) => current + 1)}>+</button>
          </div>
          <div className="productCartActions">
            <button type="button" className="requestButton" onClick={() => addItem(true)}>Buy on Sedifex</button>
            <button type="button" className="secondaryButton" onClick={() => addItem(false)}>Add to cart</button>
          </div>
          <div className="mobileProductBar"><span>{formatMoney(price, currency)}</span><button type="button" onClick={() => addItem(true)}>Buy on Sedifex</button><button type="button" onClick={() => addItem(false)}>Add to cart</button></div>
        </>
      )}

      {message ? <p className="requestFeedback success">{message}</p> : null}
      <p className="checkoutHint">Payment is confirmed after Paystack verification.</p>
    </aside>
  );
}
