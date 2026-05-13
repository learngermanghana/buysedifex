import { logger } from 'firebase-functions';

export type PublicProductOperation = 'upsert' | 'delete' | 'failure' | 'replay';

export function logPublicProductOperation(input: {
  operation: PublicProductOperation;
  storeId?: string;
  productId?: string;
  reason?: string;
  error?: unknown;
  count?: number;
  source?: string;
}): void {
  const payload = {
    event: 'public_products_sync',
    operation: input.operation,
    storeId: input.storeId ?? null,
    productId: input.productId ?? null,
    reason: input.reason ?? null,
    source: input.source ?? 'functions',
    counter: {
      upserts: input.operation === 'upsert' ? input.count ?? 1 : 0,
      deletes: input.operation === 'delete' ? input.count ?? 1 : 0,
      failures: input.operation === 'failure' ? input.count ?? 1 : 0,
      replays: input.operation === 'replay' ? input.count ?? 1 : 0,
    },
  };

  if (input.operation === 'failure') {
    logger.error('Public products sync failure', { ...payload, error: input.error });
    return;
  }

  logger.info('Public products sync operation', payload);
}
