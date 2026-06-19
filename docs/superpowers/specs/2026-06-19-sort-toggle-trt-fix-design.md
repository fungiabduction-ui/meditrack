# Sort Toggle + Brand Display + TRT Detection Fix

**Date:** 2026-06-19  
**Status:** Approved

## Scope

Three independent changes shipped together:

1. **Sort toggle** — Tomados (TodayView) and DayTimeline (HistoryView) toggle between chronological and grouped-by-supplement views.
2. **Brand display** — Show `supplementSnapshot.brand` in TodayView "Tomados" section (already shown in DayTimeline).
3. **TRT detection fix** — `computeTRTCycleData` uses a hardcoded UUID that never matches real supplements; replace with ingredient/name-based detection.

---

## 1. Sort Toggle

### State

Local `useState<'chronological' | 'grouped'>` initialized to `'chronological'`. No persistence — chronological is the natural default for the "what did I take today?" question; grouped is an occasional query.

### Toggle UI

Small segmented control rendered inline in the section label row:

```
Tomados          🕐  📦
```

Two icon-buttons (🕐 = chrono, 📦 = grouped). Active mode gets a highlighted style (e.g. `text-white`, inactive `text-slate-500`).

### Chronological mode (current behavior)

Entries sorted by `timestamp` ascending. No change from today.

### Grouped mode

- Group key: `supplementId`
- Group header: supplement name (bold) + brand (muted, same line or below)
- Under each header: list of entries with `quantity doseUnit — HH:MM 🗑`
- Groups ordered by each group's **earliest** timestamp in the day
- Delete button per entry (same confirm-delete pattern as current)
- Timeline vertical line (`absolute left-2`) hidden in grouped mode

### Affected files

- `src/components/today/TodayView.tsx` — "Tomados" section
- `src/components/history/DayTimeline.tsx` — timeline section

Both components implement the same logic independently (no shared component needed — the layouts differ enough).

---

## 2. Brand Display in TodayView

`supplementSnapshot.brand` is already stored on every `LogEntry` and already displayed in `DayTimeline`. 

In `TodayView`, in the "Tomados" card, add below the supplement name:

```tsx
{e.supplementSnapshot.brand && (
  <p className="text-slate-500 text-xs">{e.supplementSnapshot.brand}</p>
)}
```

This applies in both chronological and grouped mode.

---

## 3. TRT Detection Fix

### Root cause

`analysis.ts:4` hardcodes:
```ts
const ENANTHATE_ID = 'a0000000-0000-4000-8000-000000000011'
```

Supplements created via UI get random UUIDs from `crypto.randomUUID()`. The actual enantato ID in production data is `648692e9-2786-47a7-8658-55fc1168e599`. The hardcoded ID will never match.

### Fix

Delete `ENANTHATE_ID`. Replace the entry detection with a name/ingredient check on the snapshot:

```ts
function isEnanthateEntry(e: LogEntry): boolean {
  return e.supplementSnapshot.activeIngredients.some(
    i =>
      i.name.toLowerCase().includes('testosterona') &&
      i.form.toLowerCase().includes('enantato')
  )
}
```

Fallback chain (if ingredient check fails): also check `e.supplementSnapshot.name.toLowerCase().includes('enantato')`.

This is robust against reimports, supplement deletion + re-creation, or renaming the supplement in the future (as long as the ingredient stays the same).

### No data migration needed

The fix is purely in the detection logic. Existing `LogEntry` snapshots already contain `activeIngredients` with the right values.

---

## Data Constraints

- `LogEntry.supplementSnapshot.activeIngredients` is always present (required by Zod schema).
- `DayTimeline` already suppresses the timeline's vertical `<div>` in skipped-only views; grouped mode should do the same.
- The `confirmDelete` state in `TodayView` tracks by `entryId` — this works correctly in grouped mode since entry IDs are still unique.

---

## Out of Scope

- Persisting the sort preference across sessions
- Collapsible/expandable group headers (groups are always expanded)
- Any changes to `DailyNotes`, `DailySymptoms`, or the pending-pills section
