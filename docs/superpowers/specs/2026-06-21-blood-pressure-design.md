# Blood Pressure Tracking — Spec

## Overview

Add blood pressure recording to the "Hoy" view and a monthly chart with EMAs to the "Análisis" tab. Local-only, no backend. Multiple readings per day supported. Each reading auto-generates a DayNote.

---

## 1. Data Model

### New type: `BPReading`

```ts
type BPReading = {
  id: string          // UUID, auto-generated
  date: string        // YYYY-MM-DD, local date of the reading
  timestamp: string   // ISO8601 — the time of the actual measurement (editable by user)
  sys: number         // systolic, mmHg — range 60–250
  dia: number         // diastolic, mmHg — range 30–150
  pulse: number       // heart rate, bpm — range 30–220
  recordedAt: string  // ISO8601 — when the button was pressed, never editable
}
```

### Schema change

`StorageSchema` gains a new top-level field:

```ts
bpReadings: BPReading[]
```

Placed alongside `bloodWork` — a flat array, not nested inside `DailyLog`. This allows cross-day aggregation for the monthly chart without iterating all `dailyLogs` keys.

### Migration v3 → v4

`migrations.ts`: bump `CURRENT_VERSION` to 4. Migration adds `bpReadings: []` to existing schemas.

---

## 2. Zod Validation

New schema in `zod-schemas.ts`:

```ts
const BPReadingSchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timestamp: z.string(),
  sys: z.number().int().min(60).max(250),
  dia: z.number().int().min(30).max(150),
  pulse: z.number().int().min(30).max(220),
  recordedAt: z.string(),
})
```

`StorageSchemaSchema` gains: `bpReadings: z.array(BPReadingSchema).default([])`

---

## 3. Store Actions

Two new actions in `store/index.ts`:

```ts
addBPReading(data: { date: string; timestamp: string; sys: number; dia: number; pulse: number }): BPReading
removeBPReading(id: string): void
```

`addBPReading` constructs the `DayNote` directly and commits both the new reading and the note in a single `commitWrite` call (atomic — no cross-action dependency). The auto-note format:

```
🩺 PA: 120/80 mmHg · Pulso: 72 bpm · 09:15 [Normal]
```

The `[label]` suffix uses WHO classification (see section 4).

`bpReadings` is committed through the same `commitWrite` pattern as every other action.

---

## 4. WHO BP Classification

```
Normal    — SYS < 120 AND DIA < 80           → green  (#22c55e)
Elevada   — SYS 120–129 AND DIA < 80         → yellow (#eab308)
Alta I    — SYS 130–139 OR DIA 80–89         → orange (#f97316)
Alta II   — SYS ≥ 140 OR DIA ≥ 90            → red    (#ef4444)
```

Implemented in `utils/bp.ts` as a pure function `classifyBP(sys, dia): { label, color }`.

---

## 5. BloodPressureWidget — `components/today/BloodPressureWidget.tsx`

Props: `{ dateStr: string; isToday: boolean }`

**States:**
- `showForm: boolean` — toggles inline form visibility
- `draft: { sys, dia, pulse, time }` — local form state, initialized to sensible defaults (120/80/72, current time)

**Behavior:**
- Reads `bpReadings` from store, filters by `date === dateStr`
- Shows a list of readings for the day, each with: `SYS/DIA · PULSE bpm · HH:MM [Label]` + delete button
- Delete button has a confirm-before-delete pattern (same as TodayView's `confirmDelete`)
- Pressing "+ Registrar" toggles `showForm`
- Form has three +/− spinners (step 1) for SYS, DIA, PULSE and a time input
- On save: calls `addBPReading`, collapses form, resets draft
- `isToday === false` and no readings → hides widget entirely (same pattern as DailySymptoms)

**Mounted in TodayView** below `<DailySymptoms>`.

---

## 6. BPChart — `components/analysis/BPChart.tsx`

No external charting library. Pure SVG.

**State:**
- `month: string` — `YYYY-MM` format, default = current month
- `visible: Record<'sys'|'dia'|'pulse'|'ema7'|'ema14'|'ema30', boolean>` — toggle per series

**Data pipeline:**
1. Filter `bpReadings` by `date.startsWith(month)`
2. Group by date → average sys/dia/pulse per day (multiple readings per day → single point)
3. Sort by date ascending
4. Compute EMA7, EMA14, EMA30 for SYS (primary metric for trend). Formula: `EMA = value × k + prev × (1-k)` where `k = 2/(n+1)`
5. Map to SVG coordinates: Y-axis range 50–200 mmHg (covers all three series), X-axis = day of month

**Visual elements:**
- Grid lines at 80, 120, 140 mmHg (horizontal reference: Normal/Elevada/Alta II thresholds)
- Colored zone: green fill between 0 and 120 (Normal zone, subtle)
- Lines: SYS red, DIA blue, PULSE green; EMA7/14/30 as dashed lines, same hue as SYS but decreasing opacity
- Dot per data point, highlighted on hover (SVG `onMouseEnter`)
- Tooltip: day, SYS, DIA, PULSE values
- Month navigator: `‹ prev` / `Jun 2026` / `next ›`, future months disabled
- Stats bar below chart: avg SYS, avg DIA, avg PULSE, total readings count for the month

**Leyenda:** row of toggleable chips. Click chip → toggle `visible[series]`. Grayed when off.

---

## 7. AnalysisView change

Add `'bp'` to `SubTab` union. Add third button "❤ Presión" in the sub-tab row. Render `<BPChart />` when `subTab === 'bp'`.

---

## 8. Files touched

| Action | File |
|--------|------|
| Modify | `src/schema/types.ts` |
| Modify | `src/schema/zod-schemas.ts` |
| Modify | `src/storage/migrations.ts` |
| Modify | `src/store/index.ts` |
| Create | `src/utils/bp.ts` |
| Create | `src/components/today/BloodPressureWidget.tsx` |
| Modify | `src/components/today/TodayView.tsx` |
| Create | `src/components/analysis/BPChart.tsx` |
| Modify | `src/components/analysis/AnalysisView.tsx` |

---

## 9. Constraints & invariants

- `recordedAt` is set once at creation, never exposed to editing
- `timestamp` can be any time on the same `date` (no server validation — local app)
- Deleting a BP reading does NOT delete the auto-generated DayNote (notes are the user's audit trail)
- Sealed days: BP readings can still be added to sealed days (same as DayNotes — sealing only tracks supplement adherence)
- Storage integrity: `bpReadings` goes through `commitWrite` → Zod → checksum on every mutation
- No migration back: v4 is forward-only
