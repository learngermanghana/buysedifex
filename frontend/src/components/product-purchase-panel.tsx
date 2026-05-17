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
  const isService = itemType?.trim().toLowerCase() === 'service';

  const addItem = (openAfterAdd = false) => {
    cart.addItem({ productId, merchantId, productName, quantity, type: isService ? 'SERVICE' : 'PRODUCT', price: price ?? null, currency, imageUrl, storeName });
    setMessage(isService ? 'Service added.' : 'Product added.');
    window.setTimeout(() => setMessage(''), 1800);
    if (openAfterAdd) cart.openCart();
  };

  return (
    <aside className="productCartPanel" aria-label={isService ? 'Service booking options' : 'Product cart options'}>
      <style jsx global>{`
        .productCartPanel{position:sticky;top:5.5rem;align-self:start;display:grid;gap:.7rem;background:#fffffff2;border:1px solid #e2e8f0;border-radius:1rem;padding:1rem;box-shadow:0 18px 38px -34px #0f172a;z-index:1}.productCartPanel h3,.productCartPanel p{margin:0}.productCartPrice{font-size:1.35rem;font-weight:900;color:#0f172a}.productCartQty{display:flex;align-items:center;gap:.65rem}.productCartQty button{border:1px solid #cbd5e1;background:#fff;border-radius:12px;width:38px;height:38px;font-weight:900;cursor:pointer}.productCartActions{display:grid;grid-template-columns:1fr 1fr;gap:.55rem}.productCartActions .secondaryButton{text-align:center;border-radius:.7rem}.mobileProductBar{display:none}@media(max-width:979px){.productCartPanel{position:static}.mobileProductBar{position:fixed;left:0;right:0;bottom:0;z-index:85;display:grid;grid-template-columns:1fr 1fr 1fr;gap:.45rem;align-items:center;background:#fff;padding:.65rem .75rem;border-top:1px solid #e2e8f0;box-shadow:0 -18px 42px -34px #0f172a}.mobileProductBar span{font-weight:900;color:#0f172a;font-size:.9rem}.mobileProductBar button{border:0;border-radius:.65rem;padding:.68rem .5rem;color:#fff;background:linear-gradient(135deg,#4338ca,#10b981);font-weight:900}}@media(max-width:520px){body{padding-bottom:74px}.productCartActions{grid-template-columns:1fr}.mobileProductBar{grid-template-columns:1fr 1fr}.mobileProductBar span{display:none}}
      `}</style>
      <p className="eyebrow">Secure checkout</p>
      <h3>{isService ? 'Book this service' : 'Buy this product'}</h3>
      <p className="productCartPrice">{formatMoney(price, currency)}</p>
      <p className="checkoutHint">{isService ? 'Add this service to cart, then complete checkout or continue browsing.' : 'Add this product to cart, continue shopping, or checkout when ready.'}</p>
      <div className="productCartQty" aria-label="Quantity selector">
        <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))}>-</button><strong>{quantity}</strong><button type="button" onClick={() => setQuantity((current) => current + 1)}>+</button>
      </div>
      <div className="productCartActions">
        <button type="button" className="requestButton" onClick={() => addItem(false)}>{isService ? 'Add service' : 'Add to cart'}</button>
        <button type="button" className="secondaryButton" onClick={() => addItem(true)}>Checkout now</button>
      </div>
      {message ? <p className="requestFeedback success">{message} Open the cart to complete checkout.</p> : null}
      <p className="checkoutHint">Payment is confirmed after Paystack verification.</p>
      <div className="mobileProductBar"><span>{formatMoney(price, currency)}</span><button type="button" onClick={() => addItem(false)}>{isService ? 'Add service' : 'Add to cart'}</button><button type="button" onClick={() => addItem(true)}>Checkout</button></div>
    </aside>
  );
}
