'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getPurchaseHistory,
  registerCustomer,
  signInCustomer,
  signOutCustomer,
  subscribeToAuth,
  type PurchaseHistoryItem,
} from '@/lib/customer-auth';
import { firebaseConfigError } from '@/lib/firebase';

export default function AccountPage() {
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [history, setHistory] = useState<PurchaseHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(firebaseConfigError);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (firebaseConfigError) return;
    const unsubscribe = subscribeToAuth((user) => {
      setSessionEmail(user?.email ?? null);
      setSessionUserId(user?.uid ?? null);
      setLoadingAccount(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!sessionUserId) {
      setHistory([]);
      setLoadingHistory(false);
      return;
    }

    setLoadingHistory(true);
    void getPurchaseHistory(sessionUserId)
      .then(setHistory)
      .catch((historyError) => setError(historyError instanceof Error ? historyError.message : 'Unable to load history.'))
      .finally(() => setLoadingHistory(false));
  }, [sessionUserId]);

  const passwordStrengthHint = useMemo(() => {
    if (!password) return '';
    if (password.length < 8) return 'Use at least 8 characters.';
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return 'Add one uppercase letter and one number.';
    return 'Strong password.';
  }, [password]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setError('Full name is required.');
        return;
      }
      if (!/^[+0-9\s()-]{7,}$/.test(phone.trim())) {
        setError('Enter a valid phone number.');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      try {
        await registerCustomer({ fullName: fullName.trim(), email: email.trim(), password });
      } catch (signupError) {
        setError(signupError instanceof Error ? signupError.message : 'Unable to create account.');
      }
      return;
    }

    if (!(await signInCustomer(email, password))) {
      setError('Invalid email or password.');
      return;
    }
  };

  const statusClass = (status?: string) => {
    const normalized = (status ?? 'pending').toLowerCase();
    if (normalized === 'confirmed' || normalized === 'completed') return 'success';
    if (normalized === 'failed' || normalized === 'rejected') return 'error';
    return 'pending';
  };

  return (
    <main className="container accountPage">
      <section className="accountCard">
        <p className="eyebrow">Customer account</p>
        <h1>Sign up or sign in</h1>
        <p>Create a richer account profile so checkout and support are faster, and track your purchase history with Firebase.</p>

        {sessionEmail ? (
          <div>
            <p className="requestFeedback success">Signed in as {sessionEmail}</p>
            <button className="secondaryButton" onClick={() => void signOutCustomer().catch(() => setError('Unable to sign out.'))}>
              Sign out
            </button>
          </div>
        ) : (
          <>
            <div className="accountModeSwitch">
              <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')} type="button">Sign up</button>
              <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')} type="button">Sign in</button>
            </div>
            <form className="requestForm authForm" onSubmit={submit}>
              {mode === 'signup' ? (
                <>
                  <label htmlFor="full-name">Full name</label>
                  <input id="full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={3} placeholder="First and last name" />
                  <label htmlFor="phone">Phone number</label>
                  <input id="phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required pattern="[+0-9\s()-]{7,}" placeholder="+233 20 000 0000" />
                </>
              ) : null}
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="name@example.com" autoComplete="email" />
              <label htmlFor="password">Password</label>
              <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
              {mode === 'signup' ? <p className={`requestFeedback ${passwordStrengthHint === 'Strong password.' ? 'success' : ''}`}>{passwordStrengthHint || 'Use at least 8 characters, including 1 uppercase letter and 1 number.'}</p> : null}
              {mode === 'signup' ? (
                <>
                  <label htmlFor="confirm-password">Confirm password</label>
                  <input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} autoComplete="new-password" />
                </>
              ) : null}
              <button className="requestButton" type="submit">{mode === 'signup' ? 'Create account' : 'Sign in'}</button>
              {error ? <p className="requestFeedback error">{error}</p> : null}
            </form>
          </>
        )}
      </section>

      <section className="accountCard">
        <h2>Purchase history</h2>
        {loadingAccount ? <p>Loading your account...</p> : null}
        {loadingHistory ? <p>Loading purchase history...</p> : null}
        {!sessionEmail ? <p>Sign in to view your purchase history.</p> : null}
        {sessionEmail && history.length === 0 ? <p>No purchases yet. Place an order request to start tracking.</p> : null}
        {sessionEmail && history.length > 0 ? (
          <ul className="historyList">
            {history.map((item) => (
              <li key={item.id}>
                <strong>{item.productName}</strong> × {item.quantity} · {item.paymentMethod} · {item.deliveryLocation}
                <br />
                <small>
                  Ref: {item.reference ?? 'N/A'} · Payment: <span className={`statusBadge ${statusClass(item.paymentStatus)}`}>{item.paymentStatus ?? 'pending'}</span> · Order:{' '}
                  <span className={`statusBadge ${statusClass(item.orderStatus)}`}>{item.orderStatus ?? 'pending'}</span>
                </small>
                <br />
                <small>{new Date(item.createdAt).toLocaleString()}</small>
                {item.paymentConfirmedAt ? <><br /><small>Payment confirmed: {new Date(item.paymentConfirmedAt).toLocaleString()}</small></> : null}
                {item.orderCompletedAt ? <><br /><small>Order completed: {new Date(item.orderCompletedAt).toLocaleString()}</small></> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
