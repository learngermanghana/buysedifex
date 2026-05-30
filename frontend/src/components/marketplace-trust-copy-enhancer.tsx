'use client';

import { useEffect } from 'react';

const copyReplacements = new Map([
  ['Buy on Sedifex', 'Buy now'],
  ['Checkout with Paystack', 'Buy now - Checkout with Paystack'],
  ['Details will be confirmed by the seller during checkout.', 'Open the product page to review full details, seller information, and checkout options.'],
  ['Price unavailable', 'Price shown on product page'],
]);

function replaceNodeText(node: Element) {
  const text = node.textContent?.trim();
  if (!text) return;
  const replacement = copyReplacements.get(text);
  if (replacement) node.textContent = replacement;
}

export function MarketplaceTrustCopyEnhancer() {
  useEffect(() => {
    const selector = '.buyNowButton, .requestButton, .cartCheckoutForm button, .productShortDescription, .priceUnavailable, .productPriceLine';

    const updateCopy = () => {
      document.querySelectorAll(selector).forEach(replaceNodeText);
    };

    updateCopy();

    const observer = new MutationObserver(updateCopy);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
