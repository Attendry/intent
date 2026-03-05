# Supabase Migration Guide

This guide walks you through completing the transition to Supabase (PostgreSQL + Auth).

## 1. Environment Variables

Add these to your `.env` file (create from this template if needed):

```env
# Database (Supabase PostgreSQL)
# Get from: Supabase Dashboard → Project Settings → Database → Connection string (URI)
# Transaction pooler (6543) - for runtime / serverless
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
# Session/direct (5432) - for migrations (faster, avoids pooler timeouts during Vercel build)
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# Supabase Auth
# Get from: Supabase Dashboard → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# Optional: for server-side admin operations
# SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# AI (existing)
GEMINI_API_KEY="your-gemini-api-key"

# Cron (for Vercel Cron or external scheduler)
CRON_SECRET="random-secret-for-cron-endpoints"
```

## 1b. P1000 Authentication Failed — Password Encoding

If you get `P1000: Authentication failed` even with the correct password, **URL-encode special characters** in the password:

| Character | Encoded |
|-----------|---------|
| `!` | `%21` |
| `@` | `%40` |
| `#` | `%23` |
| `$` | `%24` |
| `%` | `%25` |
| `&` | `%26` |
| `+` | `%2B` |
| `=` | `%3D` |
| `[` | `%5B` |
| `]` | `%5D` |

Example: password `Th1s1smy1nt3nt!` → use `Th1s1smy1nt3nt%21` in the URL.

Also ensure the connection string ends with `?pgbouncer=true` for the pooler.

## 2. Run Database Migration

```bash
npx prisma migrate deploy
```

Or for development (creates migration if needed):

```bash
npx prisma migrate dev --name init_postgres
```

## 2b. Fix P3009 (Failed Migrations)

If Vercel build fails with **P3009** ("migrate found failed migrations in the target database"):

1. **Preferred:** Run locally with production DB URL:
   ```bash
   DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres" npx prisma migrate resolve --applied "20250305000000_add_meeting_log"
   ```

2. **Alternative:** Run `prisma/migrations/fix_meeting_log_migration.sql` in Supabase SQL Editor. This removes failed rows and inserts the correct migration record.

## 3. Supabase Auth Configuration

In your Supabase project dashboard:

1. **Authentication → URL Configuration**
   - Site URL: `https://your-app.vercel.app` (or `http://localhost:3000` for dev)
   - Redirect URLs: Add
     - `https://your-app.vercel.app/auth/callback`
     - `http://localhost:3000/auth/callback`

2. **Authentication → Providers**
   - Enable Email (for password + magic link)
   - Optionally enable Google, GitHub, etc.

## 4. Vercel Deployment

1. Add all environment variables in Vercel Project Settings (including `DIRECT_URL` for faster migrations during build)
2. Deploy. The app will:
   - Redirect unauthenticated users to `/auth/login`
   - Create a User record on first sign-in
   - Create default UserSettings for new users

## 5. First-Time Setup

1. Visit your app
2. You'll be redirected to `/auth/login`
3. Click "Sign up" to create an account
4. Confirm email (if email confirmation is enabled)
5. Sign in and configure Settings (Gemini API key, etc.)

## 6. API Route Auth Status

**Done:** All API routes now use `requireAuth()` and `userId` for multi-tenancy:

- settings, prospects, queue, capture, capture/enrich, chat, companies, companies/[id], companies/[id]/fit, companies/[id]/synthesize, companies/[id]/intel, companies/[id]/documents/*, companies/merge
- content, content/[id], findings, findings/[id], company-profile, company-profile/refresh
- fit-overview, fit-overview/refresh
- voice-examples, voice-examples/[id]
- signals, signals/[id]
- suggestions, suggestions/[id]
- search, outreach, review
- intelligence/draft, intelligence/redraft, intelligence/prep, intelligence/enrich

**Cron routes** (`/api/cron/*`) use `verifyCronAuth` and iterate over all users — no session auth.

## 7. Capture Token (Phase 4)

User-specific capture token for the bookmarklet is implemented. Users can generate a token at `/api/capture-token`, store it in `localStorage`, and use it for bookmarklet/capture flows without session cookies.

## 8. Cron Jobs

Cron endpoints (`/api/cron/*`) are protected by `CRON_SECRET`. See **Cron Setup** below for configuration.

---

## Cron Setup and Configuration

### Overview

The app has five cron endpoints that run background tasks across all users:

| Endpoint | Purpose |
|----------|---------|
| `/api/cron/cadence` | Escalate overdue prospects, create re-engagement and new-prospect signals |
| `/api/cron/events` | Fetch PredictHQ conferences, create signals and prospect suggestions |
| `/api/cron/news` | Company news scanning |
| `/api/cron/linkedin` | LinkedIn activity scanning |
| `/api/cron/rss` | RSS feed scanning |

Each route calls `verifyCronAuth(request)`, which expects `Authorization: Bearer <CRON_SECRET>`. If `CRON_SECRET` is not set, routes still run but log a warning (not recommended for production).

### Vercel Cron (Recommended)

1. **Add `CRON_SECRET` to Vercel**
   - Project Settings → Environment Variables
   - Add `CRON_SECRET` with a random string (e.g. `openssl rand -hex 24`)
   - Apply to Production (and Preview if you want cron in preview deploys)

2. **Create `vercel.json`** in the project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/cadence",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/events",
      "schedule": "0 7 * * *"
    },
    {
      "path": "/api/cron/news",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/linkedin",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/rss",
      "schedule": "0 10 * * *"
    }
  ]
}
```

3. **How Vercel sends the secret**
   - When `CRON_SECRET` is set in Vercel env, Vercel automatically sends it as `Authorization: Bearer <CRON_SECRET>` when invoking cron paths. No extra config needed.

4. **Cron expression format** (5 fields: minute, hour, day-of-month, month, day-of-week)
   - `0 6 * * *` = daily at 06:00 UTC
   - `*/15 * * * *` = every 15 minutes
   - `0 */6 * * *` = every 6 hours

5. **Notes**
   - Cron jobs run only on **production** deployments by default
   - View active crons in Vercel → Project → Settings → Cron Jobs
   - Adjust schedules to your needs (e.g. stagger to avoid rate limits)

### External Scheduler (e.g. cron.org, GitHub Actions)

If not using Vercel Cron, call the endpoints with the secret:

```bash
curl -X GET "https://your-app.vercel.app/api/cron/cadence" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Set up similar requests for each cron path on your desired schedule.
