'use client';

import { useCart } from './cart-provider';

const WHATSAPP_PHONE_NUMBER = '233595054266';
const WHATSAPP_MESSAGE = 'Hello Sedifex Market, I need help.';

function whatsappChatUrl() {
  return `https://wa.me/${WHATSAPP_PHONE_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
}

const rootBaseStyle = {
  position: 'fixed',
  right: '16px',
  zIndex: 2147483647,
  display: 'grid',
  justifyItems: 'end',
  pointerEvents: 'none',
} as const;

const buttonStyle = {
  pointerEvents: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '10px',
  border: 0,
  cursor: 'pointer',
  borderRadius: '999px',
  padding: '14px 18px',
  background: '#25D366',
  color: '#fff',
  fontWeight: 900,
  fontSize: '15px',
  lineHeight: 1,
  textDecoration: 'none',
  boxShadow: '0 22px 45px -22px rgba(15,23,42,0.9)',
} as const;

const iconStyle = {
  width: 22,
  height: 22,
  flex: '0 0 auto',
  display: 'block',
} as const;

export function LiveChatWidget() {
  const { itemCount } = useCart();
  const rootStyle = {
    ...rootBaseStyle,
    bottom: itemCount > 0 ? 'calc(86px + env(safe-area-inset-bottom, 0px))' : 'calc(16px + env(safe-area-inset-bottom, 0px))',
  } as const;

  return (
    <div className="marketLiveChat" style={rootStyle} aria-live="polite">
      <a
        className="marketLiveChatButton"
        style={buttonStyle}
        href={whatsappChatUrl()}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with Sedifex Market on WhatsApp"
        title="Chat with Sedifex Market on WhatsApp"
      >
        <svg style={iconStyle} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M16.04 3C9.4 3 4 8.32 4 14.86c0 2.24.65 4.42 1.87 6.3L4 29l8.02-1.83a12.3 12.3 0 0 0 4.02.67C22.68 27.84 28 22.52 28 15.98 28 9.42 22.68 3 16.04 3Zm0 22.7c-1.28 0-2.53-.22-3.72-.67l-.43-.16-4.75 1.08 1.12-4.6-.28-.47a9.88 9.88 0 0 1-1.6-5.4c0-5.35 4.36-9.7 9.72-9.7 5.35 0 9.7 4.35 9.7 9.7 0 5.36-4.36 9.72-9.76 9.72Zm5.34-7.27c-.3-.15-1.74-.86-2-.95-.27-.1-.47-.15-.67.15-.2.29-.77.95-.95 1.15-.17.2-.35.22-.65.07-.29-.14-1.23-.45-2.34-1.43a8.73 8.73 0 0 1-1.62-2c-.17-.3-.02-.46.13-.6.13-.13.3-.35.44-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.1 4.49.71.3 1.27.49 1.7.62.72.23 1.37.2 1.88.12.57-.08 1.74-.71 1.99-1.4.24-.68.24-1.27.17-1.4-.07-.13-.27-.2-.57-.35Z"
          />
        </svg>
        WhatsApp us
      </a>
    </div>
  );
}
