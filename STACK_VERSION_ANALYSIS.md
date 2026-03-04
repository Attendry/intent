# Stack Version Analysis

**Analysis date:** March 4, 2025  
**Project:** Intent (Next.js + Prisma + Supabase)

---

## Summary Table

| Package | Installed | Latest | Status | Update Opportunity |
|---------|-----------|--------|--------|---------------------|
| **Framework & Runtime** |
| Next.js | 16.1.6 | 16.1.6 | Current | No action needed. |
| React | 19.2.4 | 19.2.4 | Current | No action needed. |
| React DOM | 19.2.4 | 19.2.4 | Current | No action needed. |
| **Database & ORM** |
| Prisma | 7.4.2 | 7.4.2 | Current | No action needed. |
| @prisma/client | 7.4.2 | 7.4.2 | Current | No action needed. |
| **Styling** |
| Tailwind CSS | 4.2.1 | 4.2.1 | Current | No action needed. |
| @tailwindcss/postcss | 4.2.1 | 4.2.1 | Current | No action needed. |
| PostCSS | 8.5.8 | 8.5.8 | Current | No action needed. |
| **Language & Build** |
| TypeScript | 5.9.3 | 5.9.3 | Current | No action needed. |
| **Testing** |
| @playwright/test | 1.58.2 | 1.58.2 | Current | No action needed. |
| Vitest | 4.0.18 | 4.0.18 | Current | No action needed. |
| **Backend & Auth** |
| @supabase/supabase-js | 2.98.0 | 2.98.0 | Current | No action needed. |
| @supabase/ssr | 0.9.0 | 0.9.0 | Current | No action needed. |
| node-cron | 4.2.1 | 4.2.1 | Current | No action needed. |
| **AI & Utilities** |
| @google/genai | 1.43.0 | 1.43.0 | Current | No action needed. |
| Zod | 4.3.6 | 4.3.6 | Current | No action needed. |
| date-fns | 4.1.0 | 4.1.0 | Current | No action needed. |
| lucide-react | 0.577.0 | 0.577.0 | Current | No action needed. |
| **Dev Tools** |
| @types/node | 25.3.3 | 25.3.3 | Current | No action needed. |
| @vitejs/plugin-react | 5.1.4 | 5.1.4 | Current | No action needed. |
| tsx | 4.21.0 | 4.21.0 | Current | No action needed. |

---

## Runtime & Environment

| Component | Notes |
|-----------|-------|
| **Node.js** | No version pinned in project. Prisma 7 requires Node 20.19+ (22.x recommended). LTS options: Node 24 (Active), Node 22 (Maintenance), Node 20 (Maintenance until Apr 2026). |
| **PostgreSQL** | Via Supabase. Ensure Supabase project is on a supported Postgres version. |

---

## Recommended Update Priorities

### Low priority (optional)

1. **Node.js** — Pin version in `.nvmrc` or `package.json` engines for consistency (e.g. `"node": ">=20.19.0"`).

### Completed upgrades ✓

- **Next.js 16** — Turbopack stable, React 19.2 support.
- **Prisma 7** — AI Safety Guardrails, simplified runtime, Postgres Management API.
- **lucide-react** — Updated to 0.577.0.
- **node-cron** — Updated to 4.2.1.
- **@types/node** — Updated to 25.3.3.

---

## Quick Update Commands

```bash
# Safe minor/patch updates (low risk)
npm update
```

---

## Notes

- **Next.js 16** and **Prisma 7** are installed. Turbopack is default; Prisma 7 uses the new config system.
- All `^` ranges in `package.json` allow minor/patch updates; `npm update` will pull compatible newer versions.
