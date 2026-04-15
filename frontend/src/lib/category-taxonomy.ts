const CATEGORY_CONFIG = [
  { key: 'Supplements', keywords: ['supplement', 'vitamin', 'protein', 'wellness'] },
  { key: 'Skin care', keywords: ['skin', 'skincare', 'face', 'facial', 'soap', 'cleanser', 'lotion', 'cream'] },
  { key: 'Hair care', keywords: ['hair', 'shampoo', 'conditioner', 'wig', 'braid', 'barber'] },
  {
    key: 'Food & beverages',
    keywords: ['food', 'drink', 'beverage', 'snack', 'juice', 'tea', 'coffee', 'restaurant'],
  },
  { key: 'Groceries', keywords: ['grocery', 'rice', 'oil', 'flour', 'pantry', 'spice', 'household'] },
  { key: 'Baby care', keywords: ['baby', 'infant', 'newborn', 'diaper', 'nappy', 'formula'] },
  { key: 'Fashion', keywords: ['fashion', 'cloth', 'clothing', 'dress', 'shoe', 'bag', 'wear'] },
  { key: 'Beauty', keywords: ['beauty', 'makeup', 'cosmetic', 'lipstick', 'perfume', 'fragrance', 'nail'] },
] as const;

export const CANONICAL_CATEGORY_KEYS = CATEGORY_CONFIG.map((entry) => entry.key);

const normalizeText = (value?: string | null) => (value ?? '').trim().toLowerCase();

const normalizedCategoryLookup = new Map<string, string>(
  CATEGORY_CONFIG.flatMap<readonly [string, string]>(({ key, keywords }) => {
    const normalizedKey = normalizeText(key);
    return [
      [normalizedKey, key],
      [normalizedKey.replace(/\s*&\s*/g, ' and '), key],
      ...keywords.map((keyword): readonly [string, string] => [normalizeText(keyword), key]),
    ];
  }),
);

const scoreCategoryFromText = (text: string) => {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  const direct = normalizedCategoryLookup.get(normalized);
  if (direct) return direct;

  const compact = normalized.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const compactDirect = normalizedCategoryLookup.get(compact);
  if (compactDirect) return compactDirect;

  let bestKey: string | null = null;
  let bestScore = 0;

  CATEGORY_CONFIG.forEach(({ key, keywords }) => {
    let score = 0;
    keywords.forEach((keyword) => {
      if (compact.includes(keyword)) score += 1;
    });
    if (compact.includes(normalizeText(key))) score += 3;

    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  });

  return bestScore > 0 ? bestKey : null;
};

export const normalizeCategoryKey = (value?: string | null): string | null => scoreCategoryFromText(value ?? '');

export const resolveClosestCategoryKey = (input: {
  category?: string | null;
  productName?: string | null;
  description?: string | null;
  itemType?: string | null;
}): string => {
  return (
    normalizeCategoryKey(input.category) ??
    scoreCategoryFromText([input.productName, input.description, input.itemType].filter(Boolean).join(' ')) ??
    'Beauty'
  );
};
