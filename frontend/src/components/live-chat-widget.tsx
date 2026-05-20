'use client';

import { FormEvent, useState } from 'react';

type ChatState = 'idle' | 'open' | 'sent';

function marketChatEndpoint() {
  return process.env.NEXT_PUBLIC_SEDIFEX_ADMIN_LIVE_CHAT_URL || 'https://sedifexadmin.vercel.app/api/admin/live-chat';
}

const rootStyle = {
  position: 'fixed',
  right: '16px',
  bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
  zIndex: 2147483647,
  display: 'grid',
  justifyItems: 'end',
  gap: '12px',
  pointerEvents: 'none',
} as const;

const buttonStyle = {
  pointerEvents: 'auto',
  border: 0,
  cursor: 'pointer',
  borderRadius: '999px',
  padding: '14px 18px',
  background: 'linear-gradient(120deg, #4338ca 0%, #6366f1 52%, #10b981 100%)',
  color: '#fff',
  fontWeight: 800,
  boxShadow: '0 22px 45px -22px rgba(15,23,42,0.9)',
} as const;

const panelStyle = {
  pointerEvents: 'auto',
  width: 'min(360px, calc(100vw - 32px))',
  overflow: 'hidden',
  border: '1px solid #dbe4f0',
  borderRadius: '22px',
  background: '#fff',
  boxShadow: '0 24px 80px -34px rgba(15,23,42,0.9)',
} as const;

const headerStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
  background: '#0f172a',
  color: '#fff',
  padding: '16px',
} as const;

const bodyStyle = {
  display: 'grid',
  gap: '12px',
  padding: '16px',
} as const;

const inputStyle = {
  width: '100%',
  border: '1px solid #dbe4f0',
  borderRadius: '14px',
  padding: '12px 13px',
  color: '#0f172a',
  outline: 'none',
} as const;

const labelStyle = {
  display: 'grid',
  gap: '6px',
  fontSize: '13px',
  fontWeight: 700,
  color: '#334155',
} as const;

const submitStyle = {
  border: 0,
  cursor: 'pointer',
  borderRadius: '999px',
  padding: '13px 16px',
  background: '#4f46e5',
  color: '#fff',
  fontWeight: 800,
} as const;

export function LiveChatWidget() {
  const [state, setState] = useState<ChatState>('idle');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!message.trim()) {
      setError('Please type your message first.');
      return;
    }

    try {
      setSending(true);
      const response = await fetch(marketChatEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: 'customer',
          source: 'sedifex_market',
          customerName: name.trim() || 'Website visitor',
          customerPhone: phone.trim(),
          customerEmail: email.trim(),
          text: message.trim(),
          pageUrl: window.location.href,
          storeId: 'sedifex-market',
          storeName: 'Sedifex Market',
        }),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Unable to send message.');
      setState('sent');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="marketLiveChat" style={rootStyle} aria-live="polite">
      {state === 'open' || state === 'sent' ? (
        <div className="marketLiveChatPanel" style={panelStyle} role="dialog" aria-label="Sedifex Market live chat">
          <div className="marketLiveChatHeader" style={headerStyle}>
            <div>
              <p style={{ margin: 0, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#c7d2fe' }}>Sedifex Market</p>
              <h2 style={{ margin: 0, marginTop: 4, fontSize: 20 }}>Need help?</h2>
            </div>
            <button type="button" onClick={() => setState('idle')} aria-label="Close chat" style={{ width: 32, height: 32, borderRadius: 999, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', fontSize: 20 }}>×</button>
          </div>

          {state === 'sent' ? (
            <div className="marketLiveChatBody" style={bodyStyle}>
              <p style={{ margin: 0, color: '#047857', fontWeight: 800 }}>Thanks. Your message has been sent to Sedifex support.</p>
              <button type="button" style={{ ...submitStyle, background: '#eef2ff', color: '#3730a3' }} onClick={() => setState('open')}>Send another message</button>
            </div>
          ) : (
            <form onSubmit={submit} className="marketLiveChatBody" style={bodyStyle}>
              <label style={labelStyle}>
                <span>Name</span>
                <input style={inputStyle} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
              </label>
              <label style={labelStyle}>
                <span>Phone / WhatsApp</span>
                <input style={inputStyle} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="020 000 0000" />
              </label>
              <label style={labelStyle}>
                <span>Email</span>
                <input style={inputStyle} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              </label>
              <label style={labelStyle}>
                <span>Message</span>
                <textarea style={{ ...inputStyle, resize: 'vertical' }} value={message} onChange={(event) => setMessage(event.target.value)} rows={4} placeholder="How can we help you?" />
              </label>
              {error ? <p style={{ margin: 0, color: '#be123c', fontSize: 13 }}>{error}</p> : null}
              <button type="submit" style={{ ...submitStyle, opacity: sending ? 0.6 : 1 }} disabled={sending}>{sending ? 'Sending...' : 'Send message'}</button>
            </form>
          )}
        </div>
      ) : null}

      <button type="button" className="marketLiveChatButton" style={buttonStyle} onClick={() => setState(state === 'idle' ? 'open' : 'idle')}>
        Chat with us
      </button>
    </div>
  );
}
