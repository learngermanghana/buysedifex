'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { useCustomerAuth } from '@/components/customer-auth-provider';

export default function CustomerLoginPage() {
  const router = useRouter();
  const auth = useCustomerAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'register') {
        await auth.registerWithEmail(name, email, password, phone);
      } else {
        await auth.signInWithEmail(email, password);
      }
      router.push('/account');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to continue.');
    } finally {
      setBusy(false);
    }
  }

  async function googleLogin() {
    setBusy(true);
    setError('');
    try {
      await auth.signInWithGoogle();
      router.push('/account');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to sign in with Google.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      setError('Enter your email first, then click reset password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await auth.resetPassword(email);
      setMessage('Password reset email sent.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to send reset email.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container accountPage">
      <section className="storeInfoCard accountAuthCard">
        <p className="eyebrow">Sedifex Market account</p>
        <h1>{mode === 'register' ? 'Create your customer account' : 'Sign in to your account'}</h1>
        <p>Save your details, track orders, and checkout faster on Sedifex Market.</p>

        <button type="button" className="contactStoreButton" onClick={googleLogin} disabled={busy}>
          Continue with Google
        </button>

        <div className="authDivider">or</div>

        <form className="accountForm" onSubmit={submit}>
          {mode === 'register' ? <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" /> : null}
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" />
          {mode === 'register' ? <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number" /> : null}
          <input required type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
          <button type="submit" className="buyNowButton" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}</button>
        </form>

        {mode === 'login' ? <button type="button" className="plainButton" onClick={resetPassword} disabled={busy}>Reset password</button> : null}
        <button type="button" className="plainButton" onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>
          {mode === 'register' ? 'Already have an account? Sign in' : 'New customer? Create account'}
        </button>

        {message ? <p className="requestFeedback success">{message}</p> : null}
        {error || auth.error ? <p className="requestFeedback error">{error || auth.error}</p> : null}
        <p><Link href="/">Continue shopping</Link></p>
      </section>
    </main>
  );
}
