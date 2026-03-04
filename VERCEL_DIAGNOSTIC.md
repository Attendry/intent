# Vercel Build Diagnostic Report

## a) GitHub Repo Status: ✅ POPULATED

Verified via GitHub API. All files present at `github.com/Attendry/intent`:

- `package.json`, `package-lock.json`
- `vercel.json`, `next.config.ts`, `tsconfig.json`
- `prisma/` (schema, migrations, seed)
- `src/` (app, components, lib)
- `scripts/vercel-build.sh`

Repo structure is correct. Root = project root.

---

## b) Local `npm run dev`: ✅ WORKS

```
> next dev
▲ Next.js 16.1.6 (Turbopack)
- Local: http://localhost:3000
✓ Starting...
```

---

## c) Local `npm run build`: ⚠️ FAILS (env-related)

```
Error: P1013 - The provided database string is invalid.
`datasource.url` must start with `postgresql://` or `postgres://`
```

**Cause:** Local `.env` has `DATABASE_URL="file:./dev.db"` (SQLite) but Prisma schema expects PostgreSQL. This is a **local env** issue only. On Vercel, `DATABASE_URL` would be the Supabase URL.

**Note:** Vercel never reaches the build step—install and build are skipped entirely. So this local failure doesn't explain the empty Vercel deployment.

---

## d) Project Structure: ✅ CORRECT

Standard Next.js App Router layout:

```
intent/
├── src/
│   ├── app/          # Routes, pages, API
│   ├── components/
│   └── lib/          # db.ts, auth.ts, etc.
├── prisma/
├── scripts/
├── package.json
├── next.config.ts
├── vercel.json
└── ...
```

No rewiring needed. `src/` is the correct entry.

---

## e) Configuration Mismatch Warning

> "Configuration Settings in the current Production deployment differ from your current Project Settings."

**Meaning:** Project settings (env vars, build command, framework, etc.) were changed but the last deployment used old settings.

**Fix:** Create a **new deployment** so it picks up current settings. Use **Redeploy** and ensure "Use existing Build Cache" is **unchecked** so it does a full rebuild.

---

## Root Cause: Build Step Never Runs

Vercel logs show:
1. `Running "exit 1"` (ignoreCommand)
2. `Running "vercel build"` → completes in ~150ms
3. **No** `Running "install"` or `Running "build"` steps

The install and build commands are **never executed**. This points to a Vercel-side configuration or platform issue, not the repo.

---

## Recommended Actions

### 1. Create a Fresh Vercel Project (clean slate)

1. Vercel Dashboard → Add New → Project
2. Import `github.com/Attendry/intent`
3. **Do not** change Framework Preset (leave as Next.js)
4. **Do not** override Build Command or Install Command
5. Add env vars (DATABASE_URL, etc.)
6. Deploy

A new project avoids any stale or conflicting settings.

### 2. Deploy via Vercel CLI

```bash
cd c:\Users\olive\.cursor\Intent
npx vercel login         # Authenticate (browser opens)
npx vercel link          # Link to existing project or create new
npx vercel deploy --prod # Full deploy
```

CLI deployments can use a different path and may succeed when Git deploys fail.

### 3. Contact Vercel Support

If a fresh project and CLI deploy both show the same behavior (no install/build steps), it may be a platform bug. Share:

- Project name/ID
- Build logs (showing "Running vercel build" → 150ms, no install/build)
- Note that `vercel.json` has `installCommand` and `buildCommand` but they are never run

### 4. Ensure DATABASE_URL for Build

Before deploy, set `DATABASE_URL` (and optionally `DIRECT_URL`) in Vercel env vars. The build runs `prisma migrate deploy`, which needs a valid PostgreSQL URL.
