'use client';

import { createContext, type FormEvent, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type CartItemType = 'PRODUCT' | 'SERVICE';
export type CartItem = { productId: string; merchantId: string; productName: string; quantity: number; type: CartItemType; price?: number | null; currency?: string; imageUrl?: string; storeName?: string };

type CartContextValue = { items: CartItem[]; itemCount: number; subtotal: number; addItem: (item: CartItem) => void; removeItem: (key: string) => void; updateQuantity: (key: string, quantity: number) => void; clearCart: () => void; openCart: () => void };
type CheckoutCard = { merchantId: string; reference: string; checkoutUrl?: string };

const STORAGE_KEY = 'sedifexmarket_cart_v1';
const CartContext = createContext<CartContextValue | null>(null);
const keyFor = (item: Pick<CartItem, 'merchantId' | 'productId' | 'type'>) => `${item.merchantId}:${item.productId}:${item.type}`;
const money = (value: number, currency = 'GHS') => `${currency.toUpperCase() === 'GHS' ? 'GH₵' : currency.toUpperCase()} ${value.toFixed(2)}`;
const normalize = (item: CartItem): CartItem => ({ ...item, quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)), type: item.type === 'SERVICE' ? 'SERVICE' : 'PRODUCT', currency: item.currency || 'GHS' });

export function useCart() { const context = useContext(CartContext); if (!context) throw new Error('useCart must be used inside CartProvider'); return context; }

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]); const [ready, setReady] = useState(false); const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [deliveryLocation, setDeliveryLocation] = useState(''); const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle'); const [error, setError] = useState(''); const [checkouts, setCheckouts] = useState<CheckoutCard[]>([]);

  useEffect(() => { try { const saved = window.localStorage.getItem(STORAGE_KEY); if (saved) { const parsed = JSON.parse(saved) as CartItem[]; if (Array.isArray(parsed)) setItems(parsed.map(normalize)); } } catch {} setReady(true); }, []);
  useEffect(() => { if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }, [items, ready]);

  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0), [items]);

  const value = useMemo<CartContextValue>(() => ({
    items, itemCount, subtotal,
    addItem: (item) => { const next = normalize(item); setItems((current) => { const key = keyFor(next); const exists = current.find((entry) => keyFor(entry) === key); return exists ? current.map((entry) => keyFor(entry) === key ? { ...entry, quantity: entry.quantity + next.quantity } : entry) : [...current, next]; }); setStatus('idle'); setCheckouts([]); },
    removeItem: (key) => setItems((current) => current.filter((item) => keyFor(item) !== key)),
    updateQuantity: (key, quantity) => setItems((current) => current.map((item) => keyFor(item) === key ? { ...item, quantity: Math.max(1, quantity) } : item)),
    clearCart: () => { setItems([]); setCheckouts([]); setStatus('idle'); },
    openCart: () => setOpen(true),
  }), [itemCount, items, subtotal]);

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus('submitting'); setError(''); setCheckouts([]);
    try {
      const response = await fetch('/api/integration/checkout/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart: items.map((item) => ({ productId: item.productId, merchantId: item.merchantId, quantity: item.quantity, type: item.type })), customer: { name: customerName.trim(), email: email.trim(), phone: phone.trim() }, delivery: { location: deliveryLocation.trim(), notes: notes.trim() } }) });
      const payload = (await response.json().catch(() => null)) as { merchantCheckouts?: CheckoutCard[]; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || 'Unable to create checkout.'); setCheckouts(payload?.merchantCheckouts ?? []); setStatus('success');
    } catch (checkoutError) { setError(checkoutError instanceof Error ? checkoutError.message : 'Unable to create checkout.'); setStatus('error'); }
  }

  return (
    <CartContext.Provider value={value}>
      <style jsx global>{`.siteHeaderActions{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}.cartNavButton,.floatingCartButton{border:0;border-radius:999px;background:linear-gradient(135deg,#4338ca,#10b981);color:#fff;font-weight:900;cursor:pointer}.cartNavButton{padding:.44rem .85rem;font-size:.88rem}.floatingCartButton{position:fixed;right:16px;bottom:16px;z-index:80;padding:.86rem 1rem;box-shadow:0 22px 45px -25px rgba(15,23,42,.9)}.cartOverlay{position:fixed;inset:0;background:rgba(15,23,42,.42);z-index:90;display:flex;justify-content:flex-end}.cartDrawer{width:min(100%,440px);height:100%;background:#fff;box-shadow:-30px 0 70px -48px rgba(15,23,42,.9);padding:18px;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:14px;overflow:hidden}.cartDrawerHeader{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid #e2e8f0;padding-bottom:12px}.cartDrawerHeader h2,.cartDrawerHeader p{margin:0}.cartDrawerHeader p{color:#64748b;font-size:.88rem}.cartDrawerHeader button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;width:34px;height:34px;font-weight:900;cursor:pointer}.cartDrawerBody{overflow-y:auto;display:grid;gap:12px}.cartLine{border:1px solid #e2e8f0;border-radius:16px;padding:12px;background:#f8fafc;display:grid;gap:8px}.cartLine p{margin:.2rem 0 0;color:#64748b;font-size:.85rem}.cartQty{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.cartQty button{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:.35rem .55rem;font-weight:800;cursor:pointer}.cartCheckoutForm{display:grid;gap:8px;border-top:1px solid #e2e8f0;padding-top:12px}.cartCheckoutForm input,.cartCheckoutForm textarea{border:1px solid #cbd5e1;border-radius:12px;padding:.68rem .75rem;font:inherit;width:100%}.cartCheckoutForm>button{border:0;border-radius:14px;padding:.78rem 1rem;color:#fff;background:linear-gradient(135deg,#4338ca,#10b981);font-weight:900;cursor:pointer}.cartCheckoutForm>button:disabled{opacity:.65;cursor:not-allowed}.cartCheckoutLinks{display:grid;gap:8px}.cartCheckoutLinks a{display:block;text-align:center;border-radius:12px;padding:.65rem .8rem;color:#fff;background:#4338ca;text-decoration:none;font-weight:850}@media(max-width:860px){.siteHeaderActions{width:100%;justify-content:center}.cartNavButton{width:100%}}`}</style>
      {children}
      {ready && itemCount > 0 ? <button type="button" className="floatingCartButton" onClick={() => setOpen(true)}>🛒 Cart {itemCount}{subtotal > 0 ? ` · ${money(subtotal, items[0]?.currency)}` : ''}</button> : null}
      {open ? <div className="cartOverlay" role="dialog" aria-modal="true" aria-label="Cart"><aside className="cartDrawer"><header className="cartDrawerHeader"><div><h2>Your cart</h2><p>{itemCount} item{itemCount === 1 ? '' : 's'} ready for checkout.</p></div><button type="button" onClick={() => setOpen(false)}>×</button></header><div className="cartDrawerBody">{items.length === 0 ? <p>Your cart is empty.</p> : null}{items.map((item) => { const key = keyFor(item); return <article key={key} className="cartLine"><div><strong>{item.productName}</strong><p>{item.storeName || item.merchantId}</p>{typeof item.price === 'number' ? <p>{money(item.price, item.currency)} each</p> : null}</div><div className="cartQty"><button type="button" onClick={() => value.updateQuantity(key, item.quantity - 1)}>-</button><span>{item.quantity}</span><button type="button" onClick={() => value.updateQuantity(key, item.quantity + 1)}>+</button><button type="button" onClick={() => value.removeItem(key)}>Remove</button></div></article>; })}</div><form className="cartCheckoutForm" onSubmit={checkout}><strong>Checkout details</strong><input required value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Full name" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" /><input required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number" /><input value={deliveryLocation} onChange={(event) => setDeliveryLocation(event.target.value)} placeholder="Delivery location / landmark" /><textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Order note" /><button type="submit" disabled={status === 'submitting' || items.length === 0}>{status === 'submitting' ? 'Creating checkout…' : 'Checkout with Paystack'}</button>{status === 'error' ? <p className="requestFeedback error">{error}</p> : null}{status === 'success' ? <div className="cartCheckoutLinks"><p className="requestFeedback success">Checkout ready. Pay below.</p>{checkouts.map((checkoutItem) => checkoutItem.checkoutUrl ? <a key={checkoutItem.reference} href={checkoutItem.checkoutUrl}>Pay {checkoutItem.merchantId}</a> : <p key={checkoutItem.reference}>Checkout URL unavailable for {checkoutItem.reference}</p>)}</div> : null}</form></aside></div> : null}
    </CartContext.Provider>
  );
}

export function CartNavButton() { const { itemCount, subtotal, openCart } = useCart(); return <button type="button" className="cartNavButton" onClick={openCart}>🛒 Cart {itemCount ? `(${itemCount})` : ''}{subtotal > 0 ? ` · ${money(subtotal)}` : ''}</button>; }
