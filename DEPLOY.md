# Vercel Deployment Checklist

Use this checklist when deploying to Vercel for testing.

## 1. Environment Variables (Vercel Project Settings → Environment Variables)

Set these for **Production** (and Preview if using a separate DB):

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Supabase PostgreSQL connection string (Transaction pooler) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `GEMINI_API_KEY` | Yes | For AI features |
| `CRON_SECRET` | Yes | Min 16 chars; secures `/api/cron/*` endpoints |
| `NEXT_PUBLIC_BASE_URL` | Optional | Your Vercel URL (e.g. `https://your-app.vercel.app`) |

## 2. Supabase Configuration

- **Auth → URL Configuration**: Add your Vercel URL and `https://your-app.vercel.app/auth/callback` to Redirect URLs
- **Database**: Run `npx prisma migrate deploy` once (or let `vercel-build` do it on first deploy)

## 3. Build

The project uses a custom `vercel-build` script that:

1. Runs `prisma generate`
2. Runs `prisma migrate deploy` (applies migrations)
3. Runs `next build`

Ensure `DATABASE_URL` is set before the first deploy so migrations can run.

## 4. What Gets Pushed to Git

**Committed:**
- Source code (`src/`)
- `prisma/schema.prisma`, `prisma/migrations/`
- `package.json`, `package-lock.json`
- `vercel.json` (cron config)
- `.env.example` (template, no secrets)
- `next.config.ts`, `tsconfig.json`, etc.

**Not committed** (via `.gitignore`):
- `.env`, `.env.local`
- `node_modules/`, `.next/`
- `uploads/`, `*.db`
- `tsconfig.tsbuildinfo`, `playwright-report/`, `test-results/`

## 5. First Deploy

```bash
git add .
git commit -m "Add Supabase migration, auth, cron, and deployment config"
git push origin main
```

Connect the repo to Vercel, add env vars, then deploy. Cron jobs will run on the schedules in `vercel.json` once `CRON_SECRET` is set.

## 6. Troubleshooting: Empty Build / Build Completes in ~150ms

If the build completes in ~150ms with "no files prepared", the install and build steps are being skipped.

**Check Vercel Project Settings → Build & Development Settings:**

1. **Build Command**
   - If "Override" is enabled and the field is **empty**, the build is skipped. Set it to: `npm run build` or `sh scripts/vercel-build.sh`
   - Or disable Override to use `vercel.json`'s `buildCommand`

2. **Install Command**
   - Ensure it's not empty. Set to `npm install` or disable Override to use `vercel.json`

3. **Framework Preset**
   - Should be **Next.js**

4. **Root Directory**
   - Leave **empty** (repo root)

5. **Skip deployment when there are no changes**
   - If present under Root Directory, set to **Disabled**

**Alternative: Deploy via CLI**

```bash
npx vercel link          # Link to your Vercel project (first time)
npx vercel deploy --prod # Deploy with full build
```

CLI deployments may use a different code path and can work when Git deployments fail.
