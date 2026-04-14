'use client';

type ShareButtonProps = {
  url: string;
  title: string;
  text: string;
  className?: string;
  label?: string;
};

export function ShareButton({ url, title, text, className, label = 'Share' }: ShareButtonProps) {
  const handleShare = async () => {
    const absoluteUrl = typeof window === 'undefined' ? url : new URL(url, window.location.origin).toString();
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
    <button type="button" className={className} onClick={() => void handleShare()} aria-label={label}>
      {label}
    </button>
  );
}
