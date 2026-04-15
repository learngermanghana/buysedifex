export function normalizeText(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function toTitleCase(value?: string | null): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  return text
    .split(/\s+/)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ');
}

export function normalizeCategory(value?: string | null): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  const normalized = text.toLowerCase();
  const categoryMatchers: Array<{ key: string; tokens: string[] }> = [
    { key: 'Supplements', tokens: ['supplement', 'vitamin', 'protein', 'wellness'] },
    { key: 'Skin care', tokens: ['skin', 'skincare', 'face', 'soap', 'cleanser', 'lotion', 'cream'] },
    { key: 'Hair care', tokens: ['hair', 'shampoo', 'conditioner', 'wig', 'braid'] },
    { key: 'Food & beverages', tokens: ['food', 'drink', 'beverage', 'snack', 'juice', 'tea', 'coffee'] },
    { key: 'Groceries', tokens: ['grocery', 'rice', 'oil', 'flour', 'spice', 'pantry'] },
    { key: 'Baby care', tokens: ['baby', 'infant', 'newborn', 'diaper', 'formula'] },
    { key: 'Fashion', tokens: ['fashion', 'cloth', 'clothing', 'dress', 'shoe', 'bag'] },
    { key: 'Beauty', tokens: ['beauty', 'makeup', 'cosmetic', 'lipstick', 'perfume', 'nail'] },
  ];

  let bestMatch: string | null = null;
  let bestScore = 0;

  categoryMatchers.forEach(({ key, tokens }) => {
    let score = 0;
    tokens.forEach((token) => {
      if (normalized.includes(token)) score += 1;
    });
    if (normalized === key.toLowerCase()) score += 3;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = key;
    }
  });

  return bestMatch ?? 'Beauty';
}

export function normalizeWhatsAppNumber(raw?: string | null): string | null {
  const normalized = (raw ?? '').replace(/[^\d]/g, '');
  return normalized || null;
}

export function readFirstString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

export function readFirstNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

export function readFirstStringArray(source: Record<string, unknown>, keys: string[]): string[] | undefined {
  for (const key of keys) {
    const value = source[key];
    if (!Array.isArray(value)) continue;
    const normalized = value
      .map((entry) => normalizeText(typeof entry === 'string' ? entry : null))
      .filter((entry): entry is string => Boolean(entry));
    if (normalized.length > 0) return normalized;
  }
  return undefined;
}

export function readFirstBoolean(source: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
      if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
    }
  }
  return undefined;
}
