# Vercel Deployment Checklist

Use this checklist when deploying to Vercel for testing.

## 1. Environment Variables (Vercel Project Settings → Environment Variables)

Set these for **Production** (and Preview if using a separate DB):

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Supabase **transaction pooler** (port **6543**, `?pgbouncer=true`). Use pooler URL for runtime. See [Troubleshooting](#8-troubleshooting-maxclientsinsessionmode) below. |
| `DIRECT_URL` | Yes | For migrations. Use **Session pooler** (port **5432** on `pooler.supabase.com`), not the true direct connection — the direct connection uses IPv6 (or IPv4 add-on) which Vercel may not support. Session pooler supports both IPv4 and IPv6. Get from Supabase → Connect → **Session** mode. Transaction pooler (6543) causes migrate to hang. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `GEMINI_API_KEY` | Yes | For AI features. Redeploy after adding. |
| `RAPID_API_KEY` | Optional | RapidAPI (LinkedIn). Or set in Settings. |
| `GNEWS_API_KEY` | Optional | GNews. Or set in Settings. |
| `PREDICTHQ_API_KEY` | Optional | PredictHQ (Events). Or set in Settings. |
| `CRON_SECRET` | Yes | Min 16 chars; secures `/api/cron/*` endpoints |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | For document uploads (company annual reports). From Supabase → Settings → API |
| `NEXT_PUBLIC_BASE_URL` | Optional | Your Vercel URL (e.g. `https://your-app.vercel.app`) |

## 2. Supabase Configuration

- **Auth → URL Configuration**: Add your Vercel URL and `https://your-app.vercel.app/auth/callback` to Redirect URLs
- **Database**: Run `npx prisma migrate deploy` once (or let `vercel-build` do it on first deploy)
- **Storage**: Create buckets in Supabase (Storage → New bucket):
  - `company-documents` — for annual reports. Set to **Public** so uploaded PDFs can be viewed.
  - `event-attendees` — for event attendee imports (PDF/TXT up to 10MB). Can be Private (admin client downloads).
  - Add RLS policies: run `prisma/migrations/storage_rls_policy.sql` in Supabase SQL Editor.

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

## 7. Troubleshooting: Migration Stuck / Build Hangs at Datasource

If the build hangs at `Datasource "db": PostgreSQL database "postgres" at ...`:

**Cause:** Prisma migrations need a connection that supports advisory locks. The transaction pooler (port 6543) does not, and causes migrate to hang. The true direct connection uses IPv6 (or IPv4 add-on) which Vercel may not support.

**Fix:** Set `DIRECT_URL` to the **Session pooler** (port **5432** on the pooler host):
- Supabase Dashboard → Connect → **Session** mode
- Example: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`
- Same host as the transaction pooler (6543), different port — supports both IPv4 and IPv6, and works for migrations
- Do **not** use the true direct connection (`db.[ref].supabase.co`) if Vercel reports IPv4 not supported

## 8. Troubleshooting: MaxClientsInSessionMode

If you see `MaxClientsInSessionMode: max clients reached` in Vercel logs:

1. **Use the transaction pooler for `DATABASE_URL`** — In Supabase Dashboard → Project Settings → Database, use the **Connection pooling** URI (port **6543**), not the direct connection (5432). It must include `?pgbouncer=true`:
   ```
   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

2. **Do not use the direct connection** for runtime — The direct URI (port 5432) uses session mode and exhausts connections in serverless. Use it only for `DIRECT_URL` (migrations).

3. **Verify in Vercel** — Project Settings → Environment Variables. Ensure `DATABASE_URL` contains `pooler.supabase.com:6543` and `pgbouncer=true`.
