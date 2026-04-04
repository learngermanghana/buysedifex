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

## Firebase env values (important)

Use the **Firebase Web app config** values (Firebase Console → Project settings → General → Your apps → Web app config).

- `NEXT_PUBLIC_FIREBASE_API_KEY` → `apiKey`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` → `authDomain`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` → `projectId`
- `NEXT_PUBLIC_FIREBASE_APP_ID` → `appId`

`NEXT_PUBLIC_*` variables are inlined at build time by Next.js. If you add or change them in Vercel, trigger a **new deployment** so the storefront gets updated values.
