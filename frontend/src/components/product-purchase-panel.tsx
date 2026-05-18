'use client';

import { useState } from 'react';
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

  const addItem = (openAfterAdd = false) => {
    cart.addItem({ productId, merchantId, productName, quantity, type: 'PRODUCT', price: price ?? null, currency, imageUrl, storeName });
    setMessage('Product added.');
    window.setTimeout(() => setMessage(''), 1800);
    if (openAfterAdd) cart.openCart();
  };

  return (
    <aside className="productCartPanel" aria-label={isServiceLike ? 'Service booking options' : 'Product cart options'}>
      <p className="eyebrow">Secure checkout</p>
      <h3>{isServiceLike ? 'Book this service or class' : 'Buy this product'}</h3>
      <p className="productCartPrice">{formatMoney(price, currency)}</p>
      <p className="checkoutHint">{isServiceLike ? 'Services and classes can be booked here with date, time, and registration details.' : 'Add this product to cart, continue shopping, or checkout when ready.'}</p>

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

      {message ? <p className="requestFeedback success">{message} Open the cart to complete checkout.</p> : null}
      <p className="checkoutHint">Payment is confirmed after Paystack verification.</p>
    </aside>
  );
}
