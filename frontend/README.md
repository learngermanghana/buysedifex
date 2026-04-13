# buy-sedifex frontend

Next.js storefront that reads catalog data through Sedifex Integration API.

## Run locally

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example` and configure:

- `SEDIFEX_INTEGRATION_API_BASE_URL`
- `SEDIFEX_INTEGRATION_API_VERSION`
- `SEDIFEX_INTEGRATION_API_KEY`

## Integration routes

The frontend proxies integration reads through:

- `/api/integration/products`
- `/api/integration/categories`
- `/api/integration/promos`

This keeps API keys server-side and gives a stable path for client components.

## Caching notes

- Server-side library uses `revalidate: 300` for ISR-style freshness.
- Client components currently do explicit fetches; SWR/React Query can be layered on top later.
