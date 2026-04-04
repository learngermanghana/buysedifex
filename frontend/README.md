# buy-sedifex frontend

Next.js storefront for `publicProducts` in Firestore.

## Run locally

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example` and set Firebase web SDK values.

## Deploy to Vercel

1. Import this repository in Vercel.
2. Set the **Root Directory** to `frontend`.
3. Add all `NEXT_PUBLIC_FIREBASE_*` variables.
4. Deploy.

Build settings are included in `vercel.json` for Next.js deployment.
