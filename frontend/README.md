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
2. If you deploy from the repository root, keep **Root Directory** at `/` (the root `vercel.json` runs the frontend build automatically).
3. If you prefer deploying only `frontend`, set **Root Directory** to `frontend` and use the local `frontend/vercel.json`.
4. Add all `NEXT_PUBLIC_FIREBASE_*` variables.
5. Deploy.
