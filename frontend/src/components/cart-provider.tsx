'use client';

import {
  createContext,
  type FormEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCustomerAuth } from './customer-auth-provider';
import { saveMarketCustomerProfile } from './account-nav-button';
import { CHECKOUT_PHONE_PATTERN, validateCheckoutCustomer } from '@/lib/checkout-customer-validation';

export type CartItemType = 'PRODUCT' | 'SERVICE' | 'COURSE' | 'EVENT';
export type CartItem = {
  productId: string;
  merchantId: string;
  productName: string;
  itemName?: string;
  quantity: number;
  type: CartItemType;
  price?: number | null;
  currency?: string;
  imageUrl?: string;
  storeName?: string;
  deliveryOrigin?: string;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (item: CartItem) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
};

type CheckoutCard = { merchantId: string; reference: string; checkoutUrl?: string; recordType?: string; merchantCount?: number };

const STORAGE_KEY = 'sedifexmarket_cart_v1';
const CartContext = createContext<CartContextValue | null>(null);
const keyFor = (item: Pick<CartItem, 'merchantId' | 'productId' | 'type'>) => `${item.merchantId}:${item.productId}:${item.type}`;
const docIdForCartKey = (key: string) => encodeURIComponent(key).replace(/%/g, '_');
const money = (value: number, currency = 'GHS') => `${currency.toUpperCase() === 'GHS' ? 'GH₵' : currency.toUpperCase()} ${value.toFixed(2)}`;
const normalize = (item: CartItem): CartItem => ({
  ...item,
  quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
  type: ['SERVICE','COURSE','EVENT'].includes(String(item.type).toUpperCase()) ? String(item.type).toUpperCase() as CartItemType : 'PRODUCT',
  currency: item.currency || 'GHS',
});
const mergeCartItems = (current: CartItem[], incoming: CartItem[]) => {
  const map = new Map<string, CartItem>();
  for (const item of [...current, ...incoming].map(normalize)) {
    const key = keyFor(item);
    const existing = map.get(key);
    map.set(key, existing ? { ...existing, quantity: existing.quantity + item.quantity, deliveryOrigin: existing.deliveryOrigin || item.deliveryOrigin } : item);
  }
  return [...map.values()];
};

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, profile, updateCustomerProfile } = useCustomerAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryFeeAcknowledged, setDeliveryFeeAcknowledged] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [checkouts, setCheckouts] = useState<CheckoutCard[]>([]);
  const primaryCheckout = useMemo(() => checkouts.find((item) => item.checkoutUrl) ?? null, [checkouts]);
  const firestoreLoadedForUid = useRef<string | null>(null);
  const localLoadedItems = useRef<CartItem[]>([]);
  const suppressNextWrite = useRef(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CartItem[];
        if (Array.isArray(parsed)) {
          const normalized = parsed.map(normalize);
          localLoadedItems.current = normalized;
          setItems(normalized);
        }
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, ready]);

  useEffect(() => {
    if (!user?.uid || !db || !ready) return;
    const firestore = db;
    const cartRef = collection(firestore, 'marketCustomers', user.uid, 'cart');
    const unsubscribe = onSnapshot(cartRef, async (snapshot) => {
      const remoteItems = snapshot.docs.map((cartDoc) => normalize(cartDoc.data() as CartItem));
      const shouldMergeLocal = firestoreLoadedForUid.current !== user.uid && localLoadedItems.current.length > 0;
      const nextItems = shouldMergeLocal ? mergeCartItems(remoteItems, localLoadedItems.current) : remoteItems;
      firestoreLoadedForUid.current = user.uid;
      suppressNextWrite.current = true;
      setItems(nextItems);

      if (shouldMergeLocal) {
        const batch = writeBatch(firestore);
        nextItems.forEach((item) => {
          const key = keyFor(item);
          batch.set(doc(firestore, 'marketCustomers', user.uid, 'cart', docIdForCartKey(key)), {
            ...item,
            cartKey: key,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        });
        await batch.commit().catch(() => null);
        localLoadedItems.current = [];
      }
    });
    return unsubscribe;
  }, [ready, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !db || !ready || firestoreLoadedForUid.current !== user.uid) return;
    const firestore = db;
    if (suppressNextWrite.current) {
      suppressNextWrite.current = false;
      return;
    }
    const batch = writeBatch(firestore);
    items.forEach((item) => {
      const key = keyFor(item);
      batch.set(doc(firestore, 'marketCustomers', user.uid, 'cart', docIdForCartKey(key)), {
        ...item,
        cartKey: key,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
    void batch.commit().catch(() => null);
  }, [items, ready, user?.uid]);

  useEffect(() => {
    if (!user && !profile) return;
    if (!customerName) setCustomerName(profile?.displayName || user?.displayName || '');
    if (!email) setEmail(profile?.email || user?.email || '');
    if (!phone) setPhone(profile?.phone || '');
    if (!deliveryLocation) setDeliveryLocation(profile?.defaultDeliveryLocation || '');
  }, [customerName, deliveryLocation, email, phone, profile, user]);

  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0), [items]);
  const hasNonProductItems = useMemo(() => items.some((item) => item.type !== 'PRODUCT'), [items]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    itemCount,
    subtotal,
    addItem: (item) => {
      const next = normalize(item);
      setItems((current) => mergeCartItems(current, [next]));
      setStatus('idle');
      setCheckouts([]);
    },
    removeItem: (key) => {
      setItems((current) => current.filter((item) => keyFor(item) !== key));
      if (user?.uid && db) {
        const firestore = db;
        void deleteDoc(doc(firestore, 'marketCustomers', user.uid, 'cart', docIdForCartKey(key))).catch(() => null);
      }
    },
    updateQuantity: (key, quantity) => {
      setItems((current) => current.map((item) => keyFor(item) === key ? { ...item, quantity: Math.max(1, quantity) } : item));
    },
    clearCart: () => {
      if (user?.uid && db) {
        const firestore = db;
        const batch = writeBatch(firestore);
        items.forEach((item) => batch.delete(doc(firestore, 'marketCustomers', user.uid, 'cart', docIdForCartKey(keyFor(item)))));
        void batch.commit().catch(() => null);
      }
      setItems([]);
      setCheckouts([]);
      setStatus('idle');
    },
    openCart: () => setOpen(true),
  }), [itemCount, items, subtotal, user?.uid]);

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setError('');
    setCheckouts([]);
    try {
      if (hasNonProductItems) {
        throw new Error('Services and classes must be booked separately so you can choose date, time, and registration details.');
      }
      const customerValidation = validateCheckoutCustomer({ name: customerName, email, phone });
      if (!customerValidation.valid) {
        throw new Error(customerValidation.firstError);
      }
      if (!deliveryLocation.trim() || deliveryLocation.trim().length < 3) {
        throw new Error('Enter a useful delivery area, town, or landmark.');
      }
      if (!deliveryFeeAcknowledged) {
        throw new Error('Please confirm that you understand delivery fee may depend on your location and can be cancelled/refunded before dispatch if you do not accept the confirmed fee.');
      }
      const validatedCustomer = customerValidation.customer;
      saveMarketCustomerProfile(validatedCustomer);
      if (user) await updateCustomerProfile({ displayName: validatedCustomer.name, phone: validatedCustomer.phone, defaultDeliveryLocation: deliveryLocation.trim() });
      const response = await fetch('/api/integration/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerUid: user?.uid ?? null,
          cart: items.map((item) => ({ productId: item.productId, merchantId: item.merchantId, quantity: item.quantity, type: item.type, productName: item.productName, itemName: item.itemName || item.productName, imageUrl: item.imageUrl, deliveryOrigin: item.deliveryOrigin || null })),
          customer: { ...validatedCustomer, uid: user?.uid ?? null },
          delivery: { location: deliveryLocation.trim(), notes: notes.trim(), deliveryFeeAcknowledged },
        }),
      });
      const payload = (await response.json().catch(() => null)) as { merchantCheckouts?: CheckoutCard[]; masterCheckout?: CheckoutCard; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || 'Unable to create checkout.');
      setCheckouts(payload?.merchantCheckouts ?? []);
      setStatus('success');
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Unable to create checkout.');
      setStatus('error');
    }
  }

  return (
    <CartContext.Provider value={value}>
      <style jsx global>{`.siteHeaderActions{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}.accountNavButton{display:inline-flex;align-items:center;gap:.35rem;border-radius:999px;padding:.44rem .75rem;color:#111827;text-decoration:none;font-weight:850}.accountNavButton:hover{background:#f8fafc;color:#4338ca}.cartNavButton,.floatingCartButton{border:0;border-radius:999px;background:linear-gradient(135deg,#4338ca,#10b981);color:#fff;font-weight:900;cursor:pointer}.cartNavButton{padding:.44rem .85rem;font-size:.88rem}.floatingCartButton{position:fixed;right:16px;bottom:16px;z-index:80;padding:.86rem 1rem;box-shadow:0 22px 45px -25px rgba(15,23,42,.9)}.cartOverlay{position:fixed;inset:0;background:rgba(15,23,42,.42);z-index:90;display:flex;justify-content:flex-end}.cartDrawer{width:min(100%,440px);height:100%;background:#fff;box-shadow:-30px 0 70px -48px rgba(15,23,42,.9);padding:18px;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:14px;overflow:hidden}.cartDrawerHeader{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid #e2e8f0;padding-bottom:12px}.cartDrawerHeader h2,.cartDrawerHeader p{margin:0}.cartDrawerHeader p{color:#64748b;font-size:.88rem}.cartDrawerHeader button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;width:34px;height:34px;font-weight:900;cursor:pointer}.cartDrawerBody{overflow-y:auto;display:grid;gap:12px}.cartLine{border:1px solid #e2e8f0;border-radius:16px;padding:12px;background:#f8fafc;display:grid;gap:8px}.cartLine p{margin:.2rem 0 0;color:#64748b;font-size:.85rem}.cartQty{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.cartQty button{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:.35rem .55rem;font-weight:800;cursor:pointer}.cartCheckoutForm{display:grid;gap:8px;border-top:1px solid #e2e8f0;padding-top:12px}.cartCheckoutForm input,.cartCheckoutForm textarea{border:1px solid #cbd5e1;border-radius:12px;padding:.68rem .75rem;font:inherit;width:100%}.cartCheckoutForm>button{border:0;border-radius:14px;padding:.78rem 1rem;color:#fff;background:linear-gradient(135deg,#4338ca,#10b981);font-weight:900;cursor:pointer}.cartCheckoutForm>button:disabled{opacity:.65;cursor:not-allowed}.cartCheckoutLinks{display:grid;gap:8px}.cartCheckoutLinks a{display:block;text-align:center;border-radius:12px;padding:.65rem .8rem;color:#fff;background:#4338ca;text-decoration:none;font-weight:850}.deliveryNotice{border:1px solid #fed7aa;background:#fff7ed;border-radius:14px;padding:.75rem;color:#7c2d12;font-size:.82rem;line-height:1.45}.deliveryNotice strong{display:block;color:#9a3412;margin-bottom:.25rem}.deliveryAck{display:flex;align-items:flex-start;gap:.5rem;border:1px solid #bfdbfe;background:#eff6ff;border-radius:14px;padding:.75rem;color:#1e3a8a;font-size:.8rem;line-height:1.45;font-weight:700}.deliveryAck input{width:auto;margin-top:.15rem}@media(max-width:860px){.siteHeaderActions{width:100%;justify-content:center}.cartNavButton{width:100%}}`}</style>
      {children}
      {ready && itemCount > 0 ? <button type="button" className="floatingCartButton" onClick={() => setOpen(true)}>🛒 Cart {itemCount}{subtotal > 0 ? ` · ${money(subtotal, items[0]?.currency)}` : ''}</button> : null}
      {open ? <div className="cartOverlay" role="dialog" aria-modal="true" aria-label="Cart"><aside className="cartDrawer"><header className="cartDrawerHeader"><div><h2>Your cart</h2><p>{itemCount} item{itemCount === 1 ? '' : 's'} ready for checkout.</p></div><button type="button" onClick={() => setOpen(false)}>×</button></header><div className="cartDrawerBody">{items.length === 0 ? <p>Your cart is empty.</p> : null}{items.map((item) => { const key = keyFor(item); return <article key={key} className="cartLine"><div><strong>{item.productName}</strong><p>{item.storeName || item.merchantId}</p>{item.deliveryOrigin ? <p>📍 Ships from: <strong>{item.deliveryOrigin}</strong></p> : <p>📍 Delivery origin will be confirmed by Sedifex.</p>}{typeof item.price === 'number' ? <p>{money(item.price, item.currency)} each</p> : null}</div><div className="cartQty"><button type="button" onClick={() => value.updateQuantity(key, item.quantity - 1)}>-</button><span>{item.quantity}</span><button type="button" onClick={() => value.updateQuantity(key, item.quantity + 1)}>+</button><button type="button" onClick={() => value.removeItem(key)}>Remove</button></div></article>; })}</div><form className="cartCheckoutForm" onSubmit={checkout}><strong>Checkout details {user ? '· signed in' : ''}</strong>{hasNonProductItems ? <p className="requestFeedback error">Services and classes must be booked separately so you can choose date, time, and registration details.</p> : null}<div className="deliveryNotice"><strong>Delivery fee notice</strong>Delivery fee depends on the store origin, your location, product size, and courier option. If Sedifex must confirm the delivery fee manually, we will contact you before dispatch. You may cancel for a refund if the fee is not acceptable.</div><input required autoComplete="name" minLength={4} maxLength={100} value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Full name" aria-label="Full name" /><input required autoComplete="email" type="email" maxLength={220} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" aria-label="Email address" /><input required autoComplete="tel" type="tel" pattern={CHECKOUT_PHONE_PATTERN} title="Use a Ghana number such as 0241234567 or an international number beginning with +" maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number, e.g. 0241234567" aria-label="Phone number" /><input required minLength={3} maxLength={300} value={deliveryLocation} onChange={(event) => setDeliveryLocation(event.target.value)} placeholder="Delivery area / town / landmark" aria-label="Delivery area, town, or landmark" /><textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Order note" /><label className="deliveryAck"><input type="checkbox" checked={deliveryFeeAcknowledged} onChange={(event) => setDeliveryFeeAcknowledged(event.target.checked)} /> <span>I understand delivery fee depends on my location and may be confirmed before dispatch. If I do not accept the confirmed fee, I can cancel for a refund before dispatch.</span></label><button type="submit" disabled={status === 'submitting' || items.length === 0 || hasNonProductItems}>{status === 'submitting' ? 'Creating checkout…' : 'Checkout with Paystack'}</button>{status === 'error' ? <p className="requestFeedback error">{error}</p> : null}{status === 'success' ? <div className="cartCheckoutLinks"><p className="requestFeedback success">Checkout ready. Use the single payment link below.</p>{primaryCheckout?.checkoutUrl ? <a href={primaryCheckout.checkoutUrl}>{primaryCheckout.recordType === 'marketplace_master_order' || (primaryCheckout.merchantCount || 0) > 1 ? 'Pay one total for all stores' : `Pay ${primaryCheckout.merchantId}`}</a> : <p>Checkout URL unavailable. Please try again.</p>}</div> : null}</form></aside></div> : null}
    </CartContext.Provider>
  );
}

export function CartNavButton() { const { itemCount, subtotal, openCart } = useCart(); return <button type="button" className="cartNavButton" onClick={openCart}>🛒 Cart {itemCount ? `(${itemCount})` : ''}{subtotal > 0 ? ` · ${money(subtotal)}` : ''}</button>; }