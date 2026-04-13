# buy-sedifex frontend

Next.js storefront that reads catalog data through Sedifex Integration API.

## Run locally

```bash
npm install
npm run dev
```

Configure the backend integration credentials in `functions/.env.sedifex-web`:

- `SEDIFEX_INTEGRATION_API_BASE_URL` (Cloud Functions host, e.g. `https://us-central1-sedifex-web.cloudfunctions.net`)
- `SEDIFEX_INTEGRATION_API_VERSION`
- `SEDIFEX_INTEGRATION_API_KEY`

Use the Cloud Functions host only (no `/integration` suffix in the base URL).

The Next.js server loaders and `/api/integration/*` routes read this backend env file and attach `x-api-key` on outbound requests so the key is not read from frontend runtime code.

## Integration routes

The frontend proxies integration reads through:

- `/api/integration/products`
- `/api/integration/categories`
- `/api/integration/promos`

This keeps API keys server-side and gives a stable path for client components.

## Caching notes

- Server-side library uses `revalidate: 300` for ISR-style freshness.
- Client components currently do explicit fetches; SWR/React Query can be layered on top later.
