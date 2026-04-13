# Buy Sedifex Monorepo

Buy Sedifex contains a marketplace frontend and optional Firebase support utilities.

## Architecture at a glance

- Canonical catalog, promo, gallery, and customer data is read from Sedifex Integration API (`/v1/*`).
- Next.js frontend uses server-side integration clients (`frontend/src/lib/sedifex-integration-api.ts`).
- Legacy Firestore `publicProducts` is deprecated and no longer required for storefront rendering.
- Cloud Function triggers that synchronized `publicProducts` are retained as no-ops for safe rollout.

## Integration API configuration

Set these values in `functions/.env.sedifex-web` so they stay backend-side:

- `SEDIFEX_INTEGRATION_API_BASE_URL`
- `SEDIFEX_INTEGRATION_API_VERSION`
- `SEDIFEX_INTEGRATION_API_KEY`

Optional legacy Firebase variables remain only for non-catalog APIs (for example leads and analytics).

## Migration from `publicProducts`

1. Deploy frontend with Integration API environment variables.
2. Verify category/product/store/promo pages load through `/api/integration/*` routes.
3. Run cleanup in dry-run mode:
   - `ts-node scripts/cleanup-public-products.ts`
4. Run cleanup apply mode when ready:
   - `ts-node scripts/cleanup-public-products.ts --apply`

Backfill script still exists for emergency rollback:
- `ts-node scripts/backfill-public-products.ts --dry-run`

## Caching strategy

- Server fetches use `next: { revalidate: 300 }` for ISR-like cache reuse.
- Client marketplace widgets call internal `/api/integration/*` routes and can be upgraded to SWR/React Query if real-time cache invalidation is needed.

## Local development

```bash
npm --prefix frontend install
npm --prefix frontend run dev
npm --prefix functions install
npm --prefix functions run test
```
