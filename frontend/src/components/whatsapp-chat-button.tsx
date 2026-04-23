import { ReactNode } from 'react';

type WhatsappChatButtonProps = {
  phone?: string;
  message: string;
  className?: string;
  fallbackLabel?: ReactNode;
  label?: ReactNode;
};

const normalizePhone = (value?: string) => (value ?? '').replace(/[^\d]/g, '');

const resolveWhatsAppHref = (value?: string, message?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const host = url.hostname.toLowerCase();
      if (host === 'wa.me' || host.endsWith('.wa.me') || host === 'api.whatsapp.com' || host.endsWith('.whatsapp.com')) {
        return trimmed;
      }
    } catch {
      // Fall through to phone normalization.
    }
  }

  const normalizedPhone = normalizePhone(trimmed);
  if (!normalizedPhone) {
    return '';
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message ?? '')}`;
};

export function WhatsAppChatButton({
  phone,
  message,
  className = 'waButton',
  fallbackLabel = 'WhatsApp unavailable',
  label = 'Buy now on WhatsApp',
}: WhatsappChatButtonProps) {
  const href = resolveWhatsAppHref(phone, message);

  if (!href) {
    return (
      <span className={className} aria-disabled="true" title="WhatsApp contact unavailable">
        {fallbackLabel}
      </span>
    );
  }

  return (
    <a className={className} href={href} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}
