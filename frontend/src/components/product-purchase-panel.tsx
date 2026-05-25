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
  deliveryOrigin?: string;
  pickupAvailable?: boolean;
  deliveryAvailable?: boolean;
  sameDayDeliveryAvailable?: boolean;
  sameDayCutoffTime?: string;
};

const formatMoney = (value?: number | null, currency = 'GHS') => {
  if (typeof value !== 'number') return 'Price confirmed at checkout';
  const displayCurrency = currency.toUpperCase() === 'USD' ? 'GHS' : currency.toUpperCase();
  return `${displayCurrency === 'GHS' ? 'GH₵' : displayCurrency} ${value.toFixed(2)}`;
};

export function ProductPurchasePanel({
  productId,
  merchantId,
  productName,
  storeName,
  itemType,
  price,
  currency = 'GHS',
  imageUrl,
  deliveryOrigin,
  pickupAvailable,
  deliveryAvailable,
  sameDayDeliveryAvailable,
  sameDayCutoffTime,
}: ProductPurchasePanelProps) {
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const normalizedType = itemType?.trim().toLowerCase();
  const isServiceLike = normalizedType === 'service' || normalizedType === 'course' || normalizedType === 'event';
  const fulfillmentOptions = useMemo(() => getFulfillmentOptions(), []);
  const primaryDelivery = fulfillmentOptions[0];
  const cutoffLabel = sameDayCutoffTime || '4:00 PM';
  const deliveryPromiseTitle = sameDayDeliveryAvailable === false
    ? '🚚 Delivery fee confirmed before dispatch'
    : primaryDelivery?.available
      ? `🚚 Same-day delivery before ${cutoffLabel}`
      : `🚚 Tomorrow delivery after ${cutoffLabel} cutoff`;
  const deliveryPromiseHelper = deliveryOrigin
    ? `This item ships from ${deliveryOrigin}. Delivery fee depends on your area and will be shown or confirmed before dispatch.`
    : 'Delivery fee depends on your location. Sedifex support may confirm the fee before dispatch.';

  const addItem = (openAfterAdd = false) => {
    cart.addItem({ productId, merchantId, productName, itemName: productName, quantity, type: 'PRODUCT', price: price ?? null, currency, imageUrl, storeName, deliveryOrigin });
    setMessage('Product added. Review delivery origin and choose delivery or pickup in the cart.');
    window.setTimeout(() => setMessage(''), 2600);
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
      <p className="checkoutHint">{isServiceLike ? 'Services and classes can be booked here with date, time, and registration details.' : 'Add this product to cart, review where the store ships from, then choose delivery or pickup before paying.'}</p>

      {!isServiceLike ? (
        <div className="fulfillmentPromise" style={{ border: '1px solid #dbeafe', background: '#eff6ff', borderRadius: 16, padding: 12, display: 'grid', gap: 8, margin: '12px 0' }}>
          <strong>{deliveryPromiseTitle}</strong>
          {deliveryOrigin ? <span>📍 Ships from: <strong>{deliveryOrigin}</strong></span> : <span>📍 Store delivery origin will be confirmed by Sedifex support.</span>}
          <span>{deliveryPromiseHelper}</span>
          {pickupAvailable !== false ? <span>🏬 Store pickup is available after Sedifex checkout confirmation.</span> : null}
          {deliveryAvailable === false ? <span>⚠️ This seller may not support direct delivery. Sedifex will confirm pickup or courier options.</span> : null}
          <span style={{ color: '#475569', fontSize: 12 }}>If delivery fee is confirmed manually and you do not accept it, you may cancel for a refund before dispatch.</span>
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