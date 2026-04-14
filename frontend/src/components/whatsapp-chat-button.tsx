import { ReactNode } from 'react';

type WhatsappChatButtonProps = {
  phone?: string;
  message: string;
  className?: string;
  fallbackLabel?: ReactNode;
  label?: ReactNode;
};

const normalizePhone = (value?: string) => (value ?? '').replace(/[^\d]/g, '');

export function WhatsAppChatButton({
  phone,
  message,
  className = 'waButton',
  fallbackLabel = 'WhatsApp unavailable',
  label = 'Chat now on WhatsApp',
}: WhatsappChatButtonProps) {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    return (
      <span className={className} aria-disabled="true" title="WhatsApp contact unavailable">
        {fallbackLabel}
      </span>
    );
  }

  const href = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;

  return (
    <a className={className} href={href} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}
