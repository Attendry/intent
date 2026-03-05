# Document Intel & Meeting AI: UX/UI & Sales Coach Review

**Reviewer perspective:** UI/UX Designer + Sales Coach  
**Date:** March 2025  
**Scope:** Document Intel → Signals and Meeting AI Triggers

---

## Executive Summary

**Verdict: Good to ship with minor recommendations.**

Both features are well-implemented and align with sales workflow. The Meeting AI flow has strong UX; Document Intel has one notable feedback gap. A few polish items would improve clarity and rep confidence.

---

## Feature 1: Document Intel → Prospect Signals

### What Works Well

- **Invisible automation:** No extra steps for the rep. Processing a document automatically creates queue items—exactly what busy reps need.
- **Urgency threshold (≥4):** Correctly filters noise. Low-urgency intel stays at company level; only high-value items surface in the queue.
- **Outreach angle templates:** Actionable, coach-style guidance (e.g., "Recent funding — great time to reach out about growth initiatives") gives reps a clear angle.
- **Deduplication:** Prevents duplicate signals when the same intel appears across documents.

### Gaps & Recommendations

| Issue | Severity | Recommendation | Justification |
|-------|----------|----------------|---------------|
| **No feedback when signals are created** | Medium | When document processing completes, surface a toast or inline message: "X intel items extracted. Y signals added to your queue." | Document processing runs async. Reps never see `signalsCreated`. They discover new queue items only by navigating to the queue. Explicit feedback reinforces value and builds trust. |
| **Where to surface feedback** | — | Document processing completes via background fetch. The company page polls `fetchCompany`. When a doc transitions from `processing` → `completed`, check if the doc was just processed (e.g., compare `processedAt` or status change) and show a toast. Alternatively: add a small "Processing complete" banner on the Documents section when status flips, with "X intel, Y signals" if available. | The process API returns `signalsCreated` but the caller (documents route) fires-and-forgets. The company page doesn't receive this. Options: (a) WebSocket/push, (b) store `lastProcessResult` on the document and show on next fetch, (c) toast when user is on company page and a doc finishes (requires polling or refetch). Simplest: when `fetchCompany` returns and a doc has `status: completed` and `processedAt` within last 30s, show toast. Requires storing `signalsCreated` on the document or in a cache—add `signalsCreated` to the document model or return it in the company API when docs were recently processed. |
| **Company with 0 prospects** | Low | No change needed. Silent skip is correct. | Reps may upload a doc before adding prospects. That's fine; intel is still stored. When they add prospects later, they can re-process or the next doc will create signals. |

### Sales Coach Perspective

- **Relevance:** High-urgency intel (funding, leadership change, competitor mention) is exactly when reps should reach out. The outreach angles are coach-quality.
- **Risk:** Reps might not realize signals were created and miss timely outreach. The feedback gap is the main concern.
- **Suggestion:** In onboarding or help, mention: "When you process company documents, high-priority intel automatically creates follow-up items in your queue."

---

## Feature 2: Meeting AI Triggers

### What Works Well

- **Checkbox placement:** "Extract follow-up signals from notes" is visible and understandable. Default-on is correct—most reps want this.
- **Toast messaging:** "Meeting logged. 3 follow-up signals added to your queue." is clear and reinforces value.
- **Signal types:** buying_signal, objection, next_step, competitor_mention, timing—all map to real sales concepts. Reps will recognize them.
- **50-character minimum:** Avoids running AI on "Thanks for the call" and similar low-value notes.
- **Urgency ≥ 3 filter:** Keeps the queue focused on actionable items.
- **7-day deduplication:** Prevents duplicate signals from similar notes.

### Gaps & Recommendations

| Issue | Severity | Recommendation | Justification |
|-------|----------|----------------|---------------|
| **Checkbox lacks context** | Low | Add a tooltip or helper text: "AI will identify buying signals, objections, and next steps to surface in your queue." | Some reps may not understand what "follow-up signals" means. A brief explanation reduces confusion. |
| **No link to queue in toast** | Low | When `signalsCreated > 0`, make the toast clickable or add a "View queue" action that navigates to `/?filter=signal` or the prospect's queue item. | Reps may want to act immediately. A direct path from "signals added" to the queue reduces friction. |
| **competitor vs competitor_mention** | Informational | Both display as "Competitor" in the UI. Acceptable. | `competitor` = company intel (doc mentions competitor). `competitor_mention` = meeting (prospect mentioned competitor). Context from the summary differentiates. No change needed. |
| **Empty notes edge case** | Handled | Extraction is skipped when notes are empty or &lt; 50 chars. Correct. | No change. |

### Sales Coach Perspective

- **Action items vs signals:** The distinction (checklist vs. queue + context) is correct. Action items = "what I need to do." Signals = "why they're in my queue and what to say." Reps benefit from both.
- **Objection handling:** Extracting objections as signals is valuable. Reps can prepare responses and use them in follow-up.
- **Timing signals:** Budget cycles, decision dates—these are high-value. Good that they get urgency 4.
- **Risk:** If AI extracts poorly (e.g., generic or wrong signals), reps may dismiss or lose trust. Monitor feedback. Consider a "Was this helpful?" on meeting-derived signals (future).

---

## Queue & Timeline Display

### What Works Well

- **Icons:** Target (buying_signal), AlertCircle (objection), ChevronRight (next_step), Clock (timing)—all intuitive.
- **Signal summary in queue card:** The summary is shown; reps get context at a glance.
- **Urgency bar:** 1–5 scale is clear.

### Minor Recommendations

| Issue | Severity | Recommendation |
|-------|----------|----------------|
| **Meeting signals in timeline** | Low | Consider a subtle "From meeting" badge or icon on signals with `sourceMeetingLogId` (when that's added). Helps reps trace back to the conversation. For v1, omit—schema doesn't have it yet. |
| **Long summaries** | Handled | Queue card truncates. Good. |

---

## Implementation Quality

- **Error handling:** Meeting-log and intel-signals both catch errors and log. Failures don't block the main flow.
- **Type safety:** Signal types are properly extended in validation and constants.
- **Fragment sync:** Signals correctly create knowledge fragments for chat/brief context.

---

## Recommended Changes Before Ship

### Must-have (blocks ship)

None. The implementation is solid.

### Should-have (ship with or shortly after) — IMPLEMENTED

1. **Document Intel feedback:** Implemented. Added `lastIntelCreated` and `lastSignalsCreated` to CompanyDocument. When polling detects a doc transitioning from processing → completed, a toast shows: "Document processed: X intel items, Y signals added to queue."
2. **Meeting toast link:** Implemented. When signals are created, the toast includes a "View queue" action that navigates to `/?filter=signal`.

### Nice-to-have — IMPLEMENTED

1. **Checkbox tooltip:** Implemented. Added `title` attribute: "AI will identify buying signals, objections, and next steps to surface in your queue."
2. **Document processing result in API:** Implemented via schema. `lastIntelCreated` and `lastSignalsCreated` are stored on the document and returned in the company API.

---

## Summary

| Feature | Ready to ship? | Key follow-up |
|---------|----------------|---------------|
| Document Intel → Signals | Yes | Add feedback when signals are created (toast or inline) |
| Meeting AI Triggers | Yes | Optional: toast link to queue, checkbox tooltip |

Both features deliver clear value to reps and fit the signal-driven queue model. The main improvement is making Document Intel's impact visible to the user.
