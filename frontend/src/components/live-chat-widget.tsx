'use client';

import { FormEvent, useState } from 'react';

type ChatState = 'idle' | 'open' | 'sent';

function marketChatEndpoint() {
  return process.env.NEXT_PUBLIC_SEDIFEX_ADMIN_LIVE_CHAT_URL || 'https://sedifexadmin.vercel.app/api/admin/live-chat';
}

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
    <div className="marketLiveChat" aria-live="polite">
      {state === 'open' || state === 'sent' ? (
        <div className="marketLiveChatPanel" role="dialog" aria-label="Sedifex Market live chat">
          <div className="marketLiveChatHeader">
            <div>
              <p className="marketLiveChatEyebrow">Sedifex Market</p>
              <h2>Need help?</h2>
            </div>
            <button type="button" onClick={() => setState('idle')} aria-label="Close chat">×</button>
          </div>

          {state === 'sent' ? (
            <div className="marketLiveChatBody">
              <p className="marketLiveChatSuccess">Thanks. Your message has been sent to Sedifex support.</p>
              <button type="button" className="marketLiveChatSecondary" onClick={() => setState('open')}>Send another message</button>
            </div>
          ) : (
            <form onSubmit={submit} className="marketLiveChatBody">
              <label>
                <span>Name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
              </label>
              <label>
                <span>Phone / WhatsApp</span>
                <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="020 000 0000" />
              </label>
              <label>
                <span>Email</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              </label>
              <label>
                <span>Message</span>
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} placeholder="How can we help you?" />
              </label>
              {error ? <p className="marketLiveChatError">{error}</p> : null}
              <button type="submit" className="marketLiveChatSubmit" disabled={sending}>{sending ? 'Sending...' : 'Send message'}</button>
            </form>
          )}
        </div>
      ) : null}

      <button type="button" className="marketLiveChatButton" onClick={() => setState(state === 'idle' ? 'open' : 'idle')}>
        Chat with us
      </button>
    </div>
  );
}
