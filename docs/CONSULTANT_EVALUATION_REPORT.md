# Intent — Sales Intelligence Platform: Consultant Evaluation Report

**Prepared for:** Product/Engineering Leadership  
**Date:** March 5, 2025  
**Scope:** End-to-end evaluation of capabilities, usefulness, and readiness

---

## Executive Summary

**Intent** is a signal-driven sales intelligence platform that helps reps prioritize outreach, manage prospects and companies, and leverage AI for briefs, drafts, and meeting insights. The product demonstrates **strong architectural foundations**, **rich feature depth**, and **production-ready deployment**. It is well-suited for individual reps and small sales teams seeking to move from reactive to proactive selling.

**Overall assessment:** The platform is **ready for production use** with a clear path to enterprise adoption. Key strengths include the signal-driven queue model, AI-powered intelligence layer, and thoughtful document/meeting automation. The main gaps are adoption enablers (CRM import, email sync), documentation, and some UX polish items already documented in the backlog.

---

## 1. Capability Assessment

### 1.1 Core Sales Workflow

| Capability | Status | Notes |
|------------|--------|------|
| **Signal-driven queue** | ✅ Strong | LinkedIn, news, events, documents, meetings, cadence. Urgency scoring (1–5), deduplication, snooze/dismiss. |
| **Prospect management** | ✅ Strong | CRUD, persona summaries, role archetypes, pipeline stages, outreach logging, meeting logs. |
| **Company intelligence** | ✅ Strong | Fit scoring (0–100), fit buckets (quick_win, strategic_bet, nurture, park), document intel, synthesis. |
| **Content & outreach** | ✅ Good | Content library with persona/stage fit, AI drafts, voice examples, social post generation. |
| **Capture & enrichment** | ✅ Good | URL capture, bookmarklet, AI persona generation for new prospects. |

### 1.2 AI & Intelligence

| Capability | Status | Notes |
|------------|--------|------|
| **Brain briefs** | ✅ Strong | Next-best actions, CTAs, context from intel/findings/signals. |
| **Meeting AI** | ✅ Strong | Summaries, action items, follow-up signals (buying_signal, objection, next_step, competitor_mention, timing). |
| **Document intel** | ✅ Strong | PDF extraction, intel types (funding, hiring, leadership, etc.), auto-signals for high-urgency items. |
| **Draft generation** | ✅ Good | Context-aware email drafts with voice tuning. |
| **Chat assistant** | ✅ Good | @mentions for prospects, companies, content; RAG-style knowledge fragments. |

### 1.3 Integrations & Automation

| Capability | Status | Notes |
|------------|--------|------|
| **Cron jobs** | ✅ Implemented | Cadence (06:00), events (07:00), news (08:00), LinkedIn (09:00), RSS (10:00) UTC. |
| **External APIs** | ✅ Good | Gemini (AI), RapidAPI (LinkedIn), GNews, PredictHQ. Optional keys for non-critical jobs. |
| **CRM import** | ⚠️ Backlog | CSV import exists for prospects; HubSpot OAuth not implemented. Major adoption barrier. |
| **Email/calendar sync** | ⚠️ Backlog | Not implemented. Auto-logging would save significant time. |

---

## 2. Technical Evaluation

### 2.1 Architecture

| Dimension | Rating | Notes |
|-----------|--------|------|
| **Stack** | Strong | Next.js 16 (App Router), React 19, Prisma 7, Supabase (auth + DB + storage), Tailwind 4. |
| **Data model** | Strong | Normalized schema, appropriate indexes, clear relations. KnowledgeFragment for RAG. |
| **API design** | Good | RESTful routes, Zod validation. No OpenAPI/Swagger. |
| **Auth** | Good | Supabase Auth (email/password, OAuth). Capture token for bookmarklet. |

### 2.2 Code Quality

| Dimension | Rating | Notes |
|-----------|--------|------|
| **Type safety** | Strong | TypeScript throughout, Prisma types, Zod schemas. |
| **Validation** | Good | Centralized in `src/lib/validation.ts` with unit tests. |
| **Testing** | Limited | 1 unit test file (validation), 1 E2E spec (auth). No integration tests for API. |
| **Error handling** | Mixed | Some routes return generic errors; Capture enrich fails silently (per backlog). |

### 2.3 Deployment & Operations

| Dimension | Rating | Notes |
|-----------|--------|------|
| **Deployment** | Production-ready | Vercel build script, env checklist, Supabase config. |
| **Cron** | Configured | 5 jobs in `vercel.json`. CRON_SECRET required. |
| **Storage** | Configured | `company-documents`, `event-attendees` buckets; RLS policies. |
| **Documentation** | Mixed | Strong DEPLOY.md, MIGRATION_SUPABASE.md; weak README, no CRON_SETUP.md. |

---

## 3. User Experience Assessment

### 3.1 Strengths

- **Signal-driven workflow:** Reps see *why* to reach out, not just *who*. Urgency and outreach angles reduce cognitive load.
- **Meeting AI:** Checkbox for signal extraction, toast with "View queue" link. Clear value communication.
- **Document intel feedback:** Toast on processing complete with intel/signal counts (per SIGNAL_FEATURES_UX_REVIEW).
- **Design system:** Consistent tokens (OKLCH), light/dark themes, semantic components.
- **Empty states:** CTAs for Import, Capture, first prospect creation.

### 3.2 Documented Gaps (from UX_POLISH_PLAN)

| Issue | Severity | Status |
|-------|----------|--------|
| Dismiss undo not clickable | Medium | Not fixed; toast action API planned |
| Content "Used Xx this month" misleading | Low | Label is all-time; should say "Used Xx total" |
| Pipeline uses Select, not Kanban | Low | @dnd-kit in package.json; Kanban may be partial |
| Meeting outcome label overlap | Low | Labels could be clearer |

### 3.3 Enterprise Usability (from UX_POLISH_PLAN)

- **Accessibility:** Keyboard nav, focus management, color contrast need verification.
- **Data integrity:** Confirm destructive actions, configurable undo window.
- **Efficiency:** Bulk stage change, persistent sort/filter, global search shortcut.
- **Onboarding:** In-app help, contextual tooltips.

---

## 4. Team Collaboration (Planned)

The **TEAM_COLLABORATION_ARCHITECTURE** document outlines a phased approach:

- **Phase 1:** Account collaborators (invite peers to accounts).
- **Phase 2:** Share findings, shared feed.
- **Phase 3:** Export account summary.
- **Phase 4:** Team-owned accounts (optional).

**Status:** Architecture documented; implementation not started. Important for multi-rep teams.

---

## 5. Usefulness & Market Fit

### 5.1 Target User

- **Primary:** Individual sales reps and small teams (1–10 reps) who want to prioritize outreach based on signals rather than static lists.
- **Secondary:** Teams doing account-based selling with company intel, documents, and fit scoring.

### 5.2 Value Proposition

| Value | How Intent Delivers |
|-------|---------------------|
| **Prioritization** | Signal-driven queue with urgency scoring and outreach angles. |
| **Context** | AI briefs, meeting summaries, document intel, role briefings. |
| **Efficiency** | Capture, enrichment, AI drafts, content suggestions. |
| **Account intelligence** | Fit scoring, synthesis, battlecards, document extraction. |

### 5.3 Competitive Differentiation

- **Signal aggregation:** Multiple sources (LinkedIn, news, events, documents, meetings) in one queue.
- **AI-native:** Briefs, drafts, meeting extraction, synthesis—not bolted on.
- **Document intelligence:** PDF upload → intel → signals. Less common in lightweight tools.
- **Meeting AI:** Action items + follow-up signals. Strong for post-call workflow.

---

## 6. Recommendations

### 6.1 High Priority (Adoption & Onboarding)

| Recommendation | Effort | Impact | Rationale |
|-----------------|--------|--------|-----------|
| **CRM Import (CSV / HubSpot)** | Medium | High | Reps with existing CRM data need a path in. Manual entry is a major adoption barrier. |
| **Product README** | Low | High | Expand with product overview, features, setup, links to docs. Essential for first-time users and evaluation. |
| **Fix dismiss undo flow** | Low | Medium | Toast says "Click here to undo" but it's not clickable. Undermines trust. |

### 6.2 Medium Priority (Reliability & Clarity)

| Recommendation | Effort | Impact | Rationale |
|-----------------|--------|--------|-----------|
| **Capture enrich error handling** | Low | Medium | Enrich API fails silently; users get no feedback. Surface errors in Capture UI. |
| **Cron setup documentation** | Low | Medium | Cron is required for signals. Add CRON_SETUP.md or section in MIGRATION_SUPABASE. |
| **In-app help / tooltips** | Medium | Medium | Reduces support load, improves adoption. Queue, Prospect, Company, Capture. |
| **Content usage label** | Trivial | Low | Change "Used Xx this month" to "Used Xx total" to match data. |

### 6.3 Lower Priority (Polish & Scale)

| Recommendation | Effort | Impact | Rationale |
|-----------------|--------|--------|-----------|
| **Pipeline Kanban** | Medium | Low | Matches "Kanban-style" expectation; improves stage-change UX. |
| **API documentation** | Medium | Medium | OpenAPI/Swagger for integration partners and internal clarity. |
| **Test coverage** | High | Medium | Add integration tests for key API routes; expand E2E for core flows. |
| **Email / calendar sync** | High | High | Auto-logging outreach and meetings. Defer until CRM import is done. |

### 6.4 Strategic (Roadmap)

| Recommendation | Effort | Impact | Rationale |
|-----------------|--------|--------|-----------|
| **Implement team collaboration (Phase 1)** | Medium | High | Account collaborators enable multi-rep teams. Architecture is ready. |
| **Document format support** | Medium | Low | Add .docx, .xlsx for document intelligence. |
| **Audit trail** | Medium | Medium | Log key actions for compliance. Enterprise requirement. |

---

## 7. Summary Scorecard

| Dimension | Score (1–5) | Notes |
|-----------|--------------|-------|
| **Feature completeness** | 4.5 | Rich core; CRM import and email sync missing. |
| **Technical quality** | 4 | Strong stack and schema; test coverage limited. |
| **UX polish** | 4 | Good design; a few documented gaps. |
| **Documentation** | 3.5 | Strong deploy/collab docs; weak README and API docs. |
| **Deployment readiness** | 4.5 | Production-ready with clear checklist. |
| **Market fit** | 4.5 | Strong for signal-driven, AI-native sales workflow. |

**Overall:** 4.2 / 5 — **Ready for production** with recommended improvements.

---

## 8. Conclusion

Intent is a well-architected, feature-rich sales intelligence platform that delivers clear value through its signal-driven queue, AI briefs, document intel, and meeting AI. The product is production-ready and suitable for individual reps and small teams.

**Immediate actions:** Expand the README, fix the dismiss undo flow, and prioritize CRM import to remove the largest adoption barrier. Team collaboration (Phase 1) and email sync are strong candidates for the next major release.

---

*Report generated from codebase analysis, documentation review, and backlog assessment.*
