'use client';

import { FormEvent, useEffect, useState } from 'react';
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
  const [password, setPassword] = useState('');
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setError('Full name is required.');
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

  return (
    <main className="container accountPage">
      <section className="accountCard">
        <p className="eyebrow">Customer account</p>
        <h1>Sign up or sign in</h1>
        <p>Create an account to stay logged in and track your purchase history with Firebase.</p>

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
            <form className="requestForm" onSubmit={submit}>
              {mode === 'signup' ? (
                <>
                  <label htmlFor="full-name">Full name</label>
                  <input id="full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
                </>
              ) : null}
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <label htmlFor="password">Password</label>
              <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
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
                <small>{new Date(item.createdAt).toLocaleString()}</small>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
