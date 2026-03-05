# UX & Polish Plan

Plan to address UX bugs, polish items, and minor inconsistencies identified in the Sales Master review.

---

## 1. Fix Dismiss Undo Flow (Home Page)

**Problem:** Toast says "Click here to undo" but the message is not clickable. `window.__undoDismiss` is set but never invoked. Users cannot undo a signal dismiss.

**Approach:**
- Extend the Toast component to support an optional `action` callback (e.g. `{ label: "Undo", onClick: () => void }`).
- When `action` is provided, render a clickable button/link in the toast instead of (or in addition to) the dismiss X.
- Update the Home page `handleDismiss` to pass an undo action into the toast, e.g.:
  ```ts
  toast("Signal dismissed.", "info", {
    action: { label: "Undo", onClick: () => { clearTimeout(timer); /* restore item */ } }
  });
  ```
- Remove the `window.__undoDismiss` workaround.

**Files:** `src/components/ui/toast.tsx`, `src/app/page.tsx`

---

## 2. Pipeline Kanban — Add Drag-and-Drop

**Problem:** Pipeline uses Select dropdowns per card, not drag-and-drop. "Kanban-style" in docs is misleading.

**Approach:**
- Introduce a drag-and-drop library (e.g. `@dnd-kit/core` or `react-beautiful-dnd`) for pipeline cards.
- Allow moving cards between stage columns via drag.
- Keep the Select as a fallback for accessibility and narrow viewports.

**Files:** `src/app/pipeline/page.tsx`, any docs mentioning Kanban

---

## 3. Content Usage Label Accuracy

**Problem:** Content cards show "Used Xx this month" but `timesUsed` in the schema has no monthly reset. The value is all-time, not monthly.

**Approach:**
- Change the label to "Used Xx" or "Used Xx total" to reflect the actual data.
- If monthly stats are desired later, add a `timesUsedThisMonth` (or similar) field and a job to reset/aggregate; that belongs in backlog.

**Files:** `src/app/content/page.tsx` (ContentCard component)

---

## 4. Meeting Outcome Options — Reduce Overlap

**Problem:** Meeting outcome options "negative" (Needs follow-up), "next_steps" (No progress) may overlap in meaning. Labels could be clearer.

**Approach:**
- Review the three options: `positive`, `negative`, `next_steps`.
- Propose clearer labels. For Select dropdowns, keep primary labels short; use `title` for full descriptions:
  - `positive` → "Positive" (title: "Moving forward")
  - `negative` → "Needs follow-up" (title: "Stalled or blocked")
  - `next_steps` → "No progress" (title: "No clear next steps")
- Ensure the Select options in the Log Meeting form use these labels.
- Verify the API and AI meeting analysis handle these consistently.

**Files:** `src/app/prospects/[id]/page.tsx`, `src/app/api/meeting-log/route.ts` (if outcome affects logic)

---

## 5. Outreach Outcome Mapping (Minor)

**Status:** API already maps UI values (`sent`, `replied`, etc.) to internal outcomes (`no_response`, `positive`, etc.). No user-facing bug.

**Action:** No change required. Optional: add a brief comment in the outreach API route documenting the mapping for future maintainers.

---

## Implementation Order

| Step | Item | Effort |
|------|------|--------|
| 1 | Fix dismiss undo flow | ~1–2 hrs |
| 2 | Content usage label | ~15 min |
| 3 | Meeting outcome labels | ~30 min |
| 4 | Pipeline drag-and-drop (Kanban) | ~2–4 hrs |
| 5 | (Optional) Toast action API for future use | Included in step 1 |

---

## Design Alignment Summary

The plan aligns with the overall design system:

- **Toast:** Extending with an optional `action` prop fits the existing variant-based API (`success`, `error`, `info`) and styling (`rounded-xl`, `shadow-elevated`, variant colors). The action button should use `Button` or a link styled with `text-primary hover:underline` to match the design language.
- **Pipeline:** Uses `rounded-xl`, `border-border`, `bg-card`, `Badge`, `Select` — consistent with `globals.css` tokens and component patterns.
- **Content:** Cards use `Card`, `Badge` variants, and semantic colors. Label change is copy-only.
- **Meeting outcomes:** Ensure labels align with `relationship-timeline.tsx` `OUTCOME_CONFIG` (e.g. `negative` → "Needs follow-up" in form vs "Negative" in timeline). Prefer one canonical label set and reuse via a shared constant.

**Minor alignment note:** Meeting outcome labels in the plan ("Positive — moving forward", etc.) may be long for Select dropdowns. Consider shorter primary labels with tooltips, or: `positive` → "Positive", `negative` → "Needs follow-up", `next_steps` → "No progress" (current), and add `title` attributes for the longer descriptions.

---

## Enterprise Usability Improvements

Recommendations for B2B sales teams and enterprise adoption:

### Accessibility & Compliance

| Improvement | Rationale |
|-------------|-----------|
| **Keyboard navigation** | Pipeline stage changes, queue actions (dismiss/snooze), and batch selection should be keyboard-accessible. Add `tabIndex`, `onKeyDown` (Enter/Space) for interactive cards. |
| **Focus management** | After modal/dialog close, return focus to trigger element. After toast action (e.g. Undo), ensure focus is predictable. |
| **Color contrast** | Verify `muted-foreground` and badge text meet WCAG AA. Stale/At-risk badges use amber — ensure sufficient contrast in dark mode. |

### Data Integrity & Recovery

| Improvement | Rationale |
|-------------|-----------|
| **Confirm destructive actions** | Batch "Dismiss All" already exists; ensure single-item dismiss has optional confirmation for high-value prospects. Consider a Settings toggle: "Confirm before dismissing signals". |
| **Optimistic undo window** | Extend the 5s undo window for dismiss — or make it configurable (e.g. 5s / 10s / 30s) in Settings for users who need more time. |
| **Audit trail (backlog)** | Log key actions (dismiss, snooze, stage change) for compliance and team visibility. Defer to backlog; document as enterprise requirement. |

### Efficiency & Scale

| Improvement | Rationale |
|-------------|-----------|
| **Bulk stage change** | Allow changing pipeline stage for multiple selected prospects at once (similar to batch snooze/dismiss on Home). |
| **Persistent sort/filter** | Remember user's pipeline column order, queue sort preference, and content filter in `localStorage` or user settings. |
| **Quick actions** | Add keyboard shortcut (e.g. `Ctrl+K` / `Cmd+K`) for global search — topbar search exists; ensure it's discoverable and shortcut-documented. |
| **Export** | Add "Export queue" or "Export pipeline" (CSV) for reporting and handoffs. Backlog item; link from Settings or Review page. |

### Onboarding & Support

| Improvement | Rationale |
|-------------|-----------|
| **In-app help** | Per BACKLOG: contextual tooltips on Queue, Prospect, Company, Capture. Add `?` icon with brief explanations for meeting outcomes, pipeline stages, and signal types. |
| **Empty state CTAs** | Empty states (Queue, Pipeline, Content) already have CTAs. Ensure they point to Import, Capture, or first prospect creation. |
| **Error recovery** | Capture enrich and API errors (per BACKLOG) — surface clear messages and retry actions. |

### Consistency & Terminology

| Improvement | Rationale |
|-------------|-----------|
| **Outcome label constants** | Create `MEETING_OUTCOME_LABELS` in `lib/constants.ts` and use in prospect page, meeting-log API, relationship-timeline, and any AI prompts. Single source of truth. |
| **Pipeline stage labels** | `STAGE_LABELS` in pipeline page — consider moving to `lib/constants.ts` for reuse in prospect detail, review, and API responses. |

---

## Out of Scope (Moved to Backlog)

- CRM import, email sync, document formats, etc.
