import { type StoreDoc } from './types';

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'approved', 'verified', 'active'].includes(normalized)) return true;
    if (['false', '0', 'no', 'rejected', 'blocked', 'disabled', 'inactive'].includes(normalized)) return false;
  }
  return null;
}

function normalizeStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, '_') : '';
}

export function isStoreApprovedForMarketplace(store: StoreDoc): boolean {
  const explicitApproval =
    normalizeBoolean(store.marketplaceApproved) ??
    normalizeBoolean(store.approvedForMarketplace) ??
    normalizeBoolean(store.isMarketplaceApproved) ??
    normalizeBoolean(store.googleMerchantApproved);

  if (explicitApproval !== null) return explicitApproval;

  const approvalStatuses = [
    store.marketplaceApprovalStatus,
    store.googleMerchantApprovalStatus,
    store.approvalStatus,
    store.verificationStatus,
  ].map(normalizeStatus).filter(Boolean);

  if (approvalStatuses.some((status) => ['approved', 'verified', 'active', 'accepted'].includes(status))) return true;
  if (approvalStatuses.some((status) => ['pending', 'review', 'manual_review', 'rejected', 'blocked', 'suspended'].includes(status))) return false;

  return store.verified === true || normalizeStatus(store.verified) === 'true' || normalizeStatus(store.verified) === 'verified';
}
