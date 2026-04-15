'use client';

import { useMemo } from 'react';

type ShareButtonProps = {
  url: string;
  title: string;
  text: string;
  className?: string;
  label?: string;
};

export function ShareButton({ url, title, text, className, label = 'Share' }: ShareButtonProps) {
  const absoluteUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return url;
    }

    return new URL(url, window.location.origin).toString();
  }, [url]);

  const socialLinks = useMemo(
    () => [
      {
        name: 'Facebook',
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(absoluteUrl)}`,
      },
      {
        name: 'X',
        href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(absoluteUrl)}&text=${encodeURIComponent(text)}`,
      },
      {
        name: 'WhatsApp',
        href: `https://wa.me/?text=${encodeURIComponent(`${text} ${absoluteUrl}`)}`,
      },
      {
        name: 'Telegram',
        href: `https://t.me/share/url?url=${encodeURIComponent(absoluteUrl)}&text=${encodeURIComponent(text)}`,
      },
      {
        name: 'Email',
        href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n\n${absoluteUrl}`)}`,
      },
    ],
    [absoluteUrl, text, title],
  );

  const handleShare = async () => {
    const shareData = { url: absoluteUrl, title, text };

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share(shareData);
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(absoluteUrl);
      return;
    }

    window.prompt('Copy this link', absoluteUrl);
  };

  return (
    <details className="shareMenu">
      <summary className={className} aria-label={label}>
        {label}
      </summary>
      <div className="shareMenuPanel" role="menu" aria-label={`${label} options`}>
        {socialLinks.map((link) => (
          <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer" role="menuitem">
            {link.name}
          </a>
        ))}
        <button type="button" onClick={() => void handleShare()} role="menuitem">
          Copy / device share
        </button>
      </div>
    </details>
  );
}
