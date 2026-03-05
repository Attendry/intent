# Intent — Product Backlog

Items deferred from the Sales Master review. Prioritized by impact and effort.

---

## Integration & Data

### CRM Import (CSV / HubSpot)
**Priority:** High  
**Effort:** Medium  
**Justification:** Reps with existing CRM data need a path in. Manual entry is a major adoption barrier.  
**Scope:** CSV import (extend existing prospects import), optional HubSpot OAuth + sync.

### Email / Calendar Sync
**Priority:** Medium  
**Effort:** High  
**Justification:** Auto-logging outreach and meetings would save significant time.  
**Scope:** Gmail/Outlook OAuth, calendar event detection, optional email threading.

---

## Features

### Document Format Support
**Priority:** Low  
**Effort:** Medium  
**Justification:** PDF-only limits document intelligence. Word/Excel are common.  
**Scope:** Add support for `.docx`, `.xlsx` (or similar) in document upload and processing.

### Pipeline Drag-and-Drop (Kanban)
**Priority:** Low  
**Effort:** Medium  
**Justification:** Matches “Kanban-style” expectation; improves stage-change UX.  
**Scope:** Add `@dnd-kit` (or similar) for drag-and-drop between pipeline columns.

---

## Documentation & Help

### In-App Help / Tooltips
**Priority:** Medium  
**Effort:** Medium  
**Justification:** Reduces support load and improves adoption.  
**Scope:** Contextual tooltips, optional “?” help modals on key pages (Queue, Prospect, Company, Capture).

### Cron Setup Documentation
**Priority:** Medium  
**Effort:** Low  
**Justification:** Cron is required for signals (events, news, LinkedIn, cadence). Setup must be clear.  
**Scope:** Add a `CRON_SETUP.md` or section in `MIGRATION_SUPABASE.md` with Vercel cron config and env vars.

### Product README
**Priority:** High  
**Effort:** Low  
**Justification:** Needed for setup, value proposition, and first-time users.  
**Scope:** Expand `README.md` with product overview, features, setup, and links to other docs.

---

## Error Handling & Reliability

### Capture Enrich Error Handling
**Priority:** Medium  
**Effort:** Low  
**Justification:** Enrich API fails silently; users get no feedback when it fails.  
**Scope:** Surface errors in the Capture UI (toast or inline message) and log server-side.

### API Error Messages
**Priority:** Low  
**Effort:** Low  
**Justification:** Some API errors are generic; actionable messages improve debugging.  
**Scope:** Audit key routes and return clearer error payloads.

---

## Data & Schema

### Content `timesUsed` Monthly Reset (Optional)
**Priority:** Low  
**Effort:** Low–Medium  
**Justification:** If “Used Xx this month” is desired, schema and aggregation are needed.  
**Scope:** Add monthly aggregation or a `timesUsedThisMonth` field plus reset job.
