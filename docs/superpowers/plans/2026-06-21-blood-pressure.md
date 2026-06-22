# Blood Pressure Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add blood pressure recording (SYS/DIA/PULSE) to the Hoy view with auto-notes, and a monthly SVG chart with 3 EMAs in Análisis → sub-tab Presión.

**Architecture:** New `BPReading` type stored as a top-level `bpReadings: BPReading[]` in `StorageSchema` (mirrors `bloodWork` pattern). Recording widget in TodayView writes atomically to both `bpReadings` and `DailyLog.notes`. Chart is pure SVG, no external deps. Schema bumps from v3 → v4.

**Tech Stack:** React 19, TypeScript strict, Zustand 5, Zod 4, Tailwind v4, Vite 8, Vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/schema/types.ts` | Add `BPReading` type, add `bpReadings` to `StorageSchema` |
| Modify | `src/schema/zod-schemas.ts` | Add `BPReadingSchema`, update `StorageSchemaSchema` |
| Modify | `src/storage/migrations.ts` | Bump `CURRENT_VERSION` 3→4, add v3→v4 migration |
| Create | `src/utils/bp.ts` | `classifyBP()`, `computeEMA()` pure functions |
| Modify | `src/store/index.ts` | Add `addBPReading`, `removeBPReading` actions + `bpReadings` to Store type |
| Create | `src/components/today/BloodPressureWidget.tsx` | Day widget: list readings + inline form |
| Modify | `src/components/today/TodayView.tsx` | Mount `<BloodPressureWidget>` below DailySymptoms |
| Create | `src/components/analysis/BPChart.tsx` | Monthly SVG chart with EMA7/14/30 |
| Modify | `src/components/analysis/AnalysisView.tsx` | Add `'bp'` sub-tab, render `<BPChart>` |
| Modify | `src/__tests__/migrations.test.ts` | Tests for v3→v4 migration |
| Create | `src/__tests__/bp.test.ts` | Tests for `classifyBP` and `computeEMA` |
| Modify | `src/__tests__/store.test.ts` | Tests for `addBPReading`, `removeBPReading` |

---

### Task 1: Add `BPReading` type and Zod schema

**Files:**
- Modify: `src/schema/types.ts`
- Modify: `src/schema/zod-schemas.ts`

- [ ] **Step 1: Add `BPReading` type and `bpReadings` field to `StorageSchema` in `types.ts`**

In `src/schema/types.ts`, after the `BloodWorkEntry` type (line ~143), add:

```ts
export type BPReading = {
  id: string
  date: string        // YYYY-MM-DD
  timestamp: string   // ISO8601 — time of actual measurement, editable
  sys: number         // mmHg, 60–250
  dia: number         // mmHg, 30–150
  pulse: number       // bpm, 30–220
  recordedAt: string  // ISO8601 — when button pressed, never editable
}
```

In `StorageSchema` (line ~145), add `bpReadings: BPReading[]` after `bloodWork`:

```ts
export type StorageSchema = {
  _version: number
  _createdAt: string
  _updatedAt: string
  _checksum: string
  supplements: Record<string, Supplement>
  dailyLogs: Record<string, DailyLog>
  migrations: MigrationRecord[]
  bloodWork: BloodWorkEntry[]
  bpReadings: BPReading[]
}
```

- [ ] **Step 2: Add `BPReadingSchema` to `zod-schemas.ts`**

In `src/schema/zod-schemas.ts`, after `zBloodWorkEntry` (before line 15 `export const UnitTypeSchema`), add:

```ts
const zBPReading = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timestamp: z.string(),
  sys: z.number().int().min(60).max(250),
  dia: z.number().int().min(30).max(150),
  pulse: z.number().int().min(30).max(220),
  recordedAt: z.string(),
})

export const BPReadingSchema = zBPReading
```

In `StorageSchemaSchema` (the last export), add `bpReadings` after `bloodWork`:

```ts
bpReadings: z.array(zBPReading).default([]),
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/schema/types.ts src/schema/zod-schemas.ts
git commit -m "feat: add BPReading type and Zod schema"
```

---

### Task 2: Pure utility functions — `classifyBP` and `computeEMA`

**Files:**
- Create: `src/utils/bp.ts`
- Create: `src/__tests__/bp.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/bp.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { classifyBP, computeEMA } from '../utils/bp'

describe('classifyBP', () => {
  it('Normal — SYS < 120 AND DIA < 80', () => {
    expect(classifyBP(115, 75).label).toBe('Normal')
    expect(classifyBP(115, 75).color).toBe('#22c55e')
  })

  it('Elevada — SYS 120–129 AND DIA < 80', () => {
    expect(classifyBP(125, 75).label).toBe('Elevada')
    expect(classifyBP(129, 79).label).toBe('Elevada')
  })

  it('Alta I — SYS 130–139 OR DIA 80–89', () => {
    expect(classifyBP(135, 75).label).toBe('Alta I')
    expect(classifyBP(115, 85).label).toBe('Alta I')
    expect(classifyBP(134, 89).label).toBe('Alta I')
  })

  it('Alta II — SYS >= 140 OR DIA >= 90', () => {
    expect(classifyBP(140, 70).label).toBe('Alta II')
    expect(classifyBP(110, 90).label).toBe('Alta II')
    expect(classifyBP(160, 100).label).toBe('Alta II')
  })

  it('Alta II takes priority when both SYS and DIA qualify for lower category', () => {
    expect(classifyBP(145, 95).label).toBe('Alta II')
  })
})

describe('computeEMA', () => {
  it('returns empty array for empty input', () => {
    expect(computeEMA([], 7)).toEqual([])
  })

  it('returns same value for single-element input', () => {
    expect(computeEMA([120], 7)).toEqual([120])
  })

  it('first value equals first input', () => {
    const result = computeEMA([120, 130, 110], 2)
    expect(result[0]).toBe(120)
  })

  it('EMA smooths values — result length matches input', () => {
    const input = [120, 130, 125, 140, 110, 130, 120]
    const result = computeEMA(input, 3)
    expect(result).toHaveLength(7)
    // EMA should be between min and max of input
    expect(Math.min(...result)).toBeGreaterThanOrEqual(110)
    expect(Math.max(...result)).toBeLessThanOrEqual(140)
  })

  it('higher period produces smoother (less reactive) EMA', () => {
    const input = [100, 200, 100, 200, 100]
    const ema3 = computeEMA(input, 3)
    const ema7 = computeEMA(input, 7)
    // EMA7 reacts less to the spike at index 1
    expect(Math.abs(ema7[1] - ema7[0])).toBeLessThan(Math.abs(ema3[1] - ema3[0]))
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/__tests__/bp.test.ts
```

Expected: FAIL — `Cannot find module '../utils/bp'`

- [ ] **Step 3: Create `src/utils/bp.ts`**

```ts
export type BPCategory = {
  label: 'Normal' | 'Elevada' | 'Alta I' | 'Alta II'
  color: string
}

export function classifyBP(sys: number, dia: number): BPCategory {
  if (sys >= 140 || dia >= 90) return { label: 'Alta II', color: '#ef4444' }
  if (sys >= 130 || dia >= 80) return { label: 'Alta I', color: '#f97316' }
  if (sys >= 120 && dia < 80)  return { label: 'Elevada', color: '#eab308' }
  return { label: 'Normal', color: '#22c55e' }
}

// Exponential Moving Average: k = 2/(period+1), seed = first value
export function computeEMA(values: number[], period: number): number[] {
  if (values.length === 0) return []
  const k = 2 / (period + 1)
  const result: number[] = [values[0]]
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k))
  }
  return result
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/__tests__/bp.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/bp.ts src/__tests__/bp.test.ts
git commit -m "feat: add classifyBP and computeEMA utilities"
```

---

### Task 3: Migration v3 → v4

**Files:**
- Modify: `src/storage/migrations.ts`
- Modify: `src/__tests__/migrations.test.ts`

- [ ] **Step 1: Write failing migration tests**

In `src/__tests__/migrations.test.ts`, add inside the `describe('migrate')` block:

```ts
it('v3 → v4 adds bpReadings array', () => {
  const v3Schema = {
    _version: 3, _createdAt: '', _updatedAt: '', _checksum: '',
    supplements: {}, dailyLogs: {}, migrations: [], bloodWork: [],
  }
  const result = migrate(3, v3Schema)
  expect(result._version).toBe(4)
  expect(result.bpReadings).toEqual([])
  expect(result.migrations.some((m: { from: number }) => m.from === 3)).toBe(true)
})

it('v0 → current includes bpReadings', () => {
  const result = migrate(0, {})
  expect(result.bpReadings).toEqual([])
})
```

Also update the existing `createFreshSchema` test to assert `bpReadings`:

```ts
it('returns valid current-version schema', () => {
  const s = createFreshSchema()
  expect(s._version).toBe(CURRENT_VERSION)
  expect(s.supplements).toEqual({})
  expect(s.dailyLogs).toEqual({})
  expect(s.bloodWork).toEqual([])
  expect(s.bpReadings).toEqual([])
  expect(s._checksum).toMatch(/^[0-9a-f]{8}$/)
})
```

- [ ] **Step 2: Run — verify they fail**

```bash
npx vitest run src/__tests__/migrations.test.ts
```

Expected: FAIL — `bpReadings` is `undefined`.

- [ ] **Step 3: Update `migrations.ts`**

Bump `CURRENT_VERSION` from `3` to `4`.

In `createFreshSchema()`, add `bpReadings: []` to the schema object:

```ts
const schema: StorageSchema = {
  _version: CURRENT_VERSION,
  _createdAt: now,
  _updatedAt: now,
  _checksum: '',
  supplements: {},
  dailyLogs: {},
  migrations: [],
  bloodWork: [],
  bpReadings: [],
}
```

Add migration case for version 3 (before the `throw` at the end):

```ts
if (version === 3) {
  const raw = data as StorageSchema
  const migrated: StorageSchema = {
    ...raw,
    _version: 4,
    bpReadings: [],
    migrations: [
      ...(raw.migrations ?? []),
      { from: 3, to: 4, appliedAt: new Date().toISOString() },
    ],
  }
  return migrated
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run src/__tests__/migrations.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage/migrations.ts src/__tests__/migrations.test.ts
git commit -m "feat: migration v3→v4 adds bpReadings array"
```

---

### Task 4: Store actions — `addBPReading` and `removeBPReading`

**Files:**
- Modify: `src/store/index.ts`
- Modify: `src/__tests__/store.test.ts`

- [ ] **Step 1: Write failing store tests**

In `src/__tests__/store.test.ts`, add at the end:

```ts
describe('addBPReading', () => {
  it('adds reading to bpReadings and persists', () => {
    const dateStr = getLocalDateStr()
    const ts = new Date().toISOString()
    const reading = useStore.getState().addBPReading({
      date: dateStr,
      timestamp: ts,
      sys: 120,
      dia: 80,
      pulse: 72,
    })
    expect(reading.id).toBeDefined()
    expect(reading.sys).toBe(120)
    expect(reading.dia).toBe(80)
    expect(reading.pulse).toBe(72)
    expect(reading.recordedAt).toBeDefined()
    const state = useStore.getState()
    expect(state.bpReadings.some(r => r.id === reading.id)).toBe(true)
    // persisted
    useStore.getState().init()
    expect(useStore.getState().bpReadings.some(r => r.id === reading.id)).toBe(true)
  })

  it('auto-generates a DayNote with the reading details', () => {
    const dateStr = getLocalDateStr()
    const ts = new Date().toISOString()
    useStore.getState().addBPReading({ date: dateStr, timestamp: ts, sys: 130, dia: 85, pulse: 68 })
    const log = useStore.getState().dailyLogs[dateStr]
    expect(log).toBeDefined()
    const note = log.notes.find(n => n.text.includes('130/85'))
    expect(note).toBeDefined()
    expect(note?.text).toContain('68 bpm')
    expect(note?.text).toContain('Alta I')
  })
})

describe('removeBPReading', () => {
  it('removes reading from bpReadings', () => {
    const dateStr = getLocalDateStr()
    const ts = new Date().toISOString()
    const reading = useStore.getState().addBPReading({ date: dateStr, timestamp: ts, sys: 115, dia: 75, pulse: 65 })
    useStore.getState().removeBPReading(reading.id)
    expect(useStore.getState().bpReadings.some(r => r.id === reading.id)).toBe(false)
  })

  it('removing a reading does not remove the auto-note', () => {
    const dateStr = getLocalDateStr()
    const ts = new Date().toISOString()
    const reading = useStore.getState().addBPReading({ date: dateStr, timestamp: ts, sys: 115, dia: 75, pulse: 65 })
    const notesBefore = useStore.getState().dailyLogs[dateStr]?.notes.length ?? 0
    useStore.getState().removeBPReading(reading.id)
    const notesAfter = useStore.getState().dailyLogs[dateStr]?.notes.length ?? 0
    expect(notesAfter).toBe(notesBefore) // note survives
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run src/__tests__/store.test.ts
```

Expected: FAIL — `addBPReading is not a function`.

- [ ] **Step 3: Update `src/store/index.ts`**

Add imports at the top:

```ts
import type { Supplement, LogEntry, DailyLog, StorageSchema, SkippedItem, DayNote, DailySymptoms, BloodWorkEntry, BPReading } from '../schema/types'
import { classifyBP } from '../utils/bp'
```

Add to `Store` type:

```ts
bpReadings: BPReading[]
addBPReading: (data: { date: string; timestamp: string; sys: number; dia: number; pulse: number }) => BPReading
removeBPReading: (id: string) => void
```

Add initial state in `create<Store>`:

```ts
bpReadings: [],
```

Update `init` to load `bpReadings`:

```ts
set({ supplements: schema.supplements, dailyLogs: schema.dailyLogs, bloodWork: schema.bloodWork ?? [], bpReadings: schema.bpReadings ?? [] })
```

Update `commitWrite`:

```ts
function commitWrite(set: (s: Partial<Store>) => void, schema: StorageSchema) {
  write(schema)
  set({ supplements: schema.supplements, dailyLogs: schema.dailyLogs, bloodWork: schema.bloodWork, bpReadings: schema.bpReadings })
}
```

Add the two new actions before the closing `}))`:

```ts
addBPReading: (data) => {
  const { date, timestamp, sys, dia, pulse } = data
  const now = new Date().toISOString()
  const reading: BPReading = {
    id: generateId(),
    date,
    timestamp,
    sys,
    dia,
    pulse,
    recordedAt: now,
  }

  // build auto-note atomically with the reading
  const { label } = classifyBP(sys, dia)
  const hhmm = new Date(timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  const noteText = `🩺 PA: ${sys}/${dia} mmHg · Pulso: ${pulse} bpm · ${hhmm} [${label}]`
  const note: DayNote = { id: generateId(), text: noteText, timestamp: now }

  const existing = get().dailyLogs[date]
  const log: DailyLog = existing
    ? { ...existing, notes: [...(existing.notes ?? []), note], updatedAt: now }
    : { id: generateId(), date, entries: [], skipped: [], notes: [note], sealed: false, checksum: '', createdAt: now, updatedAt: now }

  const bpReadings = [...get().bpReadings, reading]
  const dailyLogs = { ...get().dailyLogs, [date]: log }

  commitWrite(set, { ...read(), bpReadings, dailyLogs })
  return reading
},

removeBPReading: (id) => {
  const bpReadings = get().bpReadings.filter(r => r.id !== id)
  commitWrite(set, { ...read(), bpReadings })
},
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run src/__tests__/store.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Full test suite**

```bash
npx vitest run
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store/index.ts src/__tests__/store.test.ts
git commit -m "feat: addBPReading and removeBPReading store actions with atomic auto-note"
```

---

### Task 5: `BloodPressureWidget` component

**Files:**
- Create: `src/components/today/BloodPressureWidget.tsx`

- [ ] **Step 1: Create `src/components/today/BloodPressureWidget.tsx`**

```tsx
import { useState } from 'react'
import { useStore } from '../../store'
import { classifyBP } from '../../utils/bp'
import { getLocalHHMM } from '../../utils/date'

type Props = { dateStr: string; isToday: boolean }
type Draft = { sys: number; dia: number; pulse: number; time: string }

const FIELDS = [
  { key: 'sys',   label: 'SYS (mmHg)',  min: 60,  max: 250 },
  { key: 'dia',   label: 'DIA (mmHg)',  min: 30,  max: 150 },
  { key: 'pulse', label: 'PULSO (bpm)', min: 30,  max: 220 },
] as const

export function BloodPressureWidget({ dateStr, isToday }: Props) {
  const bpReadings = useStore(s => s.bpReadings)
  const addBPReading = useStore(s => s.addBPReading)
  const removeBPReading = useStore(s => s.removeBPReading)

  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<Draft>({ sys: 120, dia: 80, pulse: 72, time: getLocalHHMM() })
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const dayReadings = bpReadings
    .filter(r => r.date === dateStr)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  if (!isToday && dayReadings.length === 0) return null

  const save = () => {
    const [h, m] = draft.time.split(':').map(Number)
    const base = new Date(`${dateStr}T12:00:00`)
    base.setHours(h, m, 0, 0)
    addBPReading({ date: dateStr, timestamp: base.toISOString(), sys: draft.sys, dia: draft.dia, pulse: draft.pulse })
    setShowForm(false)
    setDraft({ sys: 120, dia: 80, pulse: 72, time: getLocalHHMM() })
    setConfirmDelete(null)
  }

  return (
    <div className="px-4 mt-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-slate-500 text-xs uppercase tracking-widest">Presión Arterial</p>
          {isToday && !showForm && (
            <button
              onClick={() => { setShowForm(true); setDraft(d => ({ ...d, time: getLocalHHMM() })) }}
              className="text-xs bg-sky-600 hover:bg-sky-500 text-white rounded-lg px-3 py-1 transition-colors"
            >
              + Registrar
            </button>
          )}
        </div>

        {/* readings list */}
        {dayReadings.length > 0 && (
          <div className="space-y-2 mb-3">
            {dayReadings.map(r => {
              const cat = classifyBP(r.sys, r.dia)
              const hhmm = new Date(r.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={r.id} className="flex items-center gap-3 bg-slate-900 rounded-xl px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold">{r.sys} / {r.dia}</p>
                    <p className="text-slate-500 text-xs">{r.pulse} bpm · {hhmm}</p>
                  </div>
                  <span className="text-xs font-semibold flex-shrink-0" style={{ color: cat.color }}>
                    {cat.label}
                  </span>
                  {confirmDelete === r.id ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => { removeBPReading(r.id); setConfirmDelete(null) }}
                        className="text-red-400 text-xs font-semibold"
                      >¿Borrar?</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-slate-500 text-xs">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(r.id)}
                      className="text-slate-600 hover:text-red-400 text-xs transition-colors flex-shrink-0"
                    >🗑</button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* empty state */}
        {dayReadings.length === 0 && !showForm && (
          <p className="text-slate-600 text-xs text-center py-2">Sin registros</p>
        )}

        {/* inline form */}
        {showForm && (
          <div className="space-y-3 pt-1">
            <div className="flex gap-2">
              {FIELDS.map(({ key, label, min, max }) => (
                <div key={key} className="flex-1 bg-slate-900 rounded-xl p-2 text-center">
                  <p className="text-slate-500 text-xs mb-1.5 leading-tight">{label}</p>
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => setDraft(d => ({ ...d, [key]: Math.max(min, d[key] - 1) }))}
                      className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center hover:bg-slate-600 text-sm"
                    >−</button>
                    <span className="text-white text-base font-bold w-8 text-center tabular-nums">{draft[key]}</span>
                    <button
                      onClick={() => setDraft(d => ({ ...d, [key]: Math.min(max, d[key] + 1) }))}
                      className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center hover:bg-slate-600 text-sm"
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
            <input
              type="time"
              value={draft.time}
              onChange={e => setDraft(d => ({ ...d, time: e.target.value }))}
              className="w-full bg-slate-900 text-white rounded-xl px-4 py-2.5 text-center text-base outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl py-2.5 text-sm font-semibold transition-colors"
              >Cancelar</button>
              <button
                onClick={save}
                className="flex-[2] bg-green-600 hover:bg-green-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
              >Guardar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/today/BloodPressureWidget.tsx
git commit -m "feat: BloodPressureWidget component — inline form + WHO classification"
```

---

### Task 6: Mount `BloodPressureWidget` in `TodayView`

**Files:**
- Modify: `src/components/today/TodayView.tsx`

- [ ] **Step 1: Add import and mount widget**

In `src/components/today/TodayView.tsx`, add import after the `DailySymptoms` import:

```ts
import { BloodPressureWidget } from './BloodPressureWidget'
```

In the JSX, after the `<div className="px-4 mt-4">` block that contains `<DailySymptoms>`, add:

```tsx
<BloodPressureWidget dateStr={selectedDate} isToday={isToday} />
```

The final order at the bottom of the return should be:
```
<DailyNotes ... />
<div className="px-4 mt-4"><DailySymptoms ... /></div>
<BloodPressureWidget dateStr={selectedDate} isToday={isToday} />
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run app and test manually**

Start dev server (`serve.bat` or `npm run dev`). Navigate to Hoy tab.
Verify:
- Widget appears below Síntomas section
- Pressing "+ Registrar" shows inline form with three +/− spinners (SYS/DIA/PULSE) and time input
- Saving a reading shows it in the list with correct classification color
- The DayNotes section shows the auto-generated note
- Delete with confirm works
- Navigating to a past day hides the widget if no readings exist

- [ ] **Step 4: Commit**

```bash
git add src/components/today/TodayView.tsx
git commit -m "feat: mount BloodPressureWidget in TodayView"
```

---

### Task 7: `BPChart` — monthly SVG chart with EMAs

**Files:**
- Create: `src/components/analysis/BPChart.tsx`

- [ ] **Step 1: Create `src/components/analysis/BPChart.tsx`**

```tsx
import { useState, useMemo } from 'react'
import { useStore } from '../../store'
import { computeEMA } from '../../utils/bp'

type SeriesKey = 'sys' | 'dia' | 'pulse' | 'ema7' | 'ema14' | 'ema30'

const SERIES: { key: SeriesKey; label: string; color: string; dashed: boolean; opacity: number }[] = [
  { key: 'sys',   label: 'SYS',   color: '#ef4444', dashed: false, opacity: 1 },
  { key: 'dia',   label: 'DIA',   color: '#3b82f6', dashed: false, opacity: 1 },
  { key: 'pulse', label: 'PULSO', color: '#22c55e', dashed: false, opacity: 1 },
  { key: 'ema7',  label: 'EMA7',  color: '#ef4444', dashed: true,  opacity: 0.7 },
  { key: 'ema14', label: 'EMA14', color: '#ef4444', dashed: true,  opacity: 0.5 },
  { key: 'ema30', label: 'EMA30', color: '#ef4444', dashed: true,  opacity: 0.35 },
]

const Y_MIN = 50
const Y_MAX = 200
const W = 300
const H = 120
const PAD = { top: 8, right: 12, bottom: 18, left: 26 }

function toY(val: number): number {
  const clamped = Math.max(Y_MIN, Math.min(Y_MAX, val))
  return PAD.top + (1 - (clamped - Y_MIN) / (Y_MAX - Y_MIN)) * (H - PAD.top - PAD.bottom)
}

function avg(arr: number[]): number {
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
}

function currentMonthStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function offsetMonthStr(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function BPChart() {
  const bpReadings = useStore(s => s.bpReadings)
  const [month, setMonth] = useState(currentMonthStr)
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    sys: true, dia: true, pulse: true, ema7: true, ema14: true, ema30: false,
  })
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const today = currentMonthStr()
  const monthLabel = new Date(`${month}-15`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5)), 0).getDate()

  const toX = (day: number) =>
    PAD.left + ((day - 1) / Math.max(daysInMonth - 1, 1)) * (W - PAD.left - PAD.right)

  const data = useMemo(() => {
    const filtered = bpReadings.filter(r => r.date.startsWith(month))
    const byDate = new Map<string, { sys: number[]; dia: number[]; pulse: number[] }>()
    for (const r of filtered) {
      if (!byDate.has(r.date)) byDate.set(r.date, { sys: [], dia: [], pulse: [] })
      const g = byDate.get(r.date)!
      g.sys.push(r.sys); g.dia.push(r.dia); g.pulse.push(r.pulse)
    }
    const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
    const days = sorted.map(([d]) => parseInt(d.slice(-2), 10))
    const sys = sorted.map(([, g]) => avg(g.sys))
    const dia = sorted.map(([, g]) => avg(g.dia))
    const pulse = sorted.map(([, g]) => avg(g.pulse))
    const ema7 = computeEMA(sys, 7).map(Math.round)
    const ema14 = computeEMA(sys, 14).map(Math.round)
    const ema30 = computeEMA(sys, 30).map(Math.round)

    const allSys = filtered.map(r => r.sys)
    const allDia = filtered.map(r => r.dia)
    const allPulse = filtered.map(r => r.pulse)
    const safeAvg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

    return {
      days, sys, dia, pulse, ema7, ema14, ema30,
      stats: { sys: safeAvg(allSys), dia: safeAvg(allDia), pulse: safeAvg(allPulse), count: filtered.length },
    }
  }, [bpReadings, month])

  const toggle = (key: SeriesKey) => setVisible(v => ({ ...v, [key]: !v[key] }))

  const pts = (series: number[]) =>
    data.days.map((d, i) => `${toX(d)},${toY(series[i])}`).join(' ')

  if (data.days.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setMonth(m => offsetMonthStr(m, -1))} className="text-slate-400 hover:text-white text-sm px-2">‹</button>
          <span className="text-white text-sm font-semibold capitalize">{monthLabel}</span>
          <button onClick={() => setMonth(m => offsetMonthStr(m, 1))} disabled={month >= today} className="text-slate-400 hover:text-white text-sm px-2 disabled:opacity-20 disabled:cursor-not-allowed">›</button>
        </div>
        <p className="text-slate-500 text-sm text-center py-4">Sin registros en {monthLabel}</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
      {/* month nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => setMonth(m => offsetMonthStr(m, -1))} className="text-slate-400 hover:text-white px-2 text-lg">‹</button>
        <span className="text-white text-sm font-semibold capitalize">{monthLabel}</span>
        <button onClick={() => setMonth(m => offsetMonthStr(m, 1))} disabled={month >= today} className="text-slate-400 hover:text-white px-2 text-lg disabled:opacity-20 disabled:cursor-not-allowed">›</button>
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-1.5">
        {SERIES.map(s => (
          <button
            key={s.key}
            onClick={() => toggle(s.key)}
            className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border transition-all ${
              visible[s.key] ? 'border-slate-600 text-slate-300' : 'border-slate-800 text-slate-600'
            }`}
          >
            <span style={{
              display: 'inline-block', width: 14,
              ...(s.dashed
                ? { borderTop: `1px dashed ${s.color}`, opacity: s.opacity }
                : { height: 2, background: s.color }),
            }} />
            {s.label}
          </button>
        ))}
      </div>

      {/* chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* grid + Y labels */}
        {[80, 120, 140].map(v => (
          <g key={v}>
            <line x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)} stroke="#1e293b" strokeWidth="1"/>
            <text x={PAD.left - 3} y={toY(v) + 3} fontSize="6" fill="#334155" textAnchor="end">{v}</text>
          </g>
        ))}
        {/* normal zone */}
        <rect x={PAD.left} y={toY(120)} width={W - PAD.left - PAD.right} height={toY(50) - toY(120)} fill="#22c55e08"/>

        {/* series */}
        {data.days.length > 1 && (
          <>
            {visible.pulse && <polyline points={pts(data.pulse)} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinejoin="round"/>}
            {visible.dia   && <polyline points={pts(data.dia)}   fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round"/>}
            {visible.sys   && <polyline points={pts(data.sys)}   fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinejoin="round"/>}
            {visible.ema7  && <polyline points={pts(data.ema7)}  fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="3,2" opacity="0.7"/>}
            {visible.ema14 && <polyline points={pts(data.ema14)} fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="5,3" opacity="0.5"/>}
            {visible.ema30 && <polyline points={pts(data.ema30)} fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="8,4" opacity="0.35"/>}
          </>
        )}

        {/* hover targets + dots */}
        {data.days.map((day, i) => (
          <g key={day}>
            <rect x={toX(day) - 7} y={PAD.top} width={14} height={H - PAD.top - PAD.bottom} fill="transparent" onMouseEnter={() => setHoveredIdx(i)}/>
            {visible.sys   && <circle cx={toX(day)} cy={toY(data.sys[i])}   r={hoveredIdx === i ? 3.5 : 2}   fill="#ef4444"/>}
            {visible.dia   && <circle cx={toX(day)} cy={toY(data.dia[i])}   r={hoveredIdx === i ? 3   : 1.5} fill="#3b82f6"/>}
            {visible.pulse && <circle cx={toX(day)} cy={toY(data.pulse[i])} r={hoveredIdx === i ? 3   : 1.5} fill="#22c55e"/>}
          </g>
        ))}

        {/* X labels — first, last, and every 7th day */}
        {data.days
          .filter((d, i) => i === 0 || i === data.days.length - 1 || d % 7 === 1)
          .map(day => (
            <text key={day} x={toX(day)} y={H - PAD.bottom + 10} fontSize="7" fill="#475569" textAnchor="middle">{day}</text>
          ))}
      </svg>

      {/* tooltip */}
      {hoveredIdx !== null && (
        <div className="bg-slate-900 rounded-xl px-3 py-2 text-xs flex gap-4 flex-wrap">
          <span className="text-slate-500">Día {data.days[hoveredIdx]}</span>
          <span><span className="text-red-400">SYS</span> {data.sys[hoveredIdx]}</span>
          <span><span className="text-blue-400">DIA</span> {data.dia[hoveredIdx]}</span>
          <span><span className="text-green-400">PULSO</span> {data.pulse[hoveredIdx]}</span>
        </div>
      )}

      {/* stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Prom SYS',   value: data.stats.sys,   color: 'text-red-400' },
          { label: 'Prom DIA',   value: data.stats.dia,   color: 'text-blue-400' },
          { label: 'Prom PULSO', value: data.stats.pulse, color: 'text-green-400' },
          { label: 'Registros',  value: data.stats.count, color: 'text-slate-300' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-900 rounded-xl p-2 text-center">
            <p className="text-slate-500 text-xs mb-0.5 leading-tight">{label}</p>
            <p className={`${color} text-sm font-bold tabular-nums`}>{value ?? '—'}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/analysis/BPChart.tsx
git commit -m "feat: BPChart SVG component with EMA7/14/30 and month navigator"
```

---

### Task 8: Wire `BPChart` into `AnalysisView`

**Files:**
- Modify: `src/components/analysis/AnalysisView.tsx`

- [ ] **Step 1: Update `AnalysisView.tsx`**

Replace the current content of `src/components/analysis/AnalysisView.tsx`:

```tsx
import { useState } from 'react'
import { WellbeingTrend } from './WellbeingTrend'
import { TRTCycleHeatmap } from './TRTCycleHeatmap'
import { SupplementCorrelation } from './SupplementCorrelation'
import { LaboratorioView } from './LaboratorioView'
import { BPChart } from './BPChart'

type SubTab = 'symptoms' | 'lab' | 'bp'

export function AnalysisView() {
  const [subTab, setSubTab] = useState<SubTab>('symptoms')

  return (
    <div className="pb-24 min-h-full">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-white mb-4">Análisis</h1>

        {/* sub-tabs */}
        <div className="flex bg-slate-800 rounded-xl p-1 mb-4">
          {([
            { id: 'symptoms', label: 'Síntomas' },
            { id: 'lab',      label: 'Laboratorio' },
            { id: 'bp',       label: '❤ Presión' },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                subTab === id
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {subTab === 'symptoms' && (
          <div className="space-y-4">
            <WellbeingTrend />
            <TRTCycleHeatmap />
            <SupplementCorrelation />
          </div>
        )}

        {subTab === 'lab' && <LaboratorioView />}

        {subTab === 'bp' && <BPChart />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check + full test suite**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: no TS errors, all tests PASS.

- [ ] **Step 3: Manual smoke test in browser**

Start dev server. Verify:
- Análisis tab shows 3 sub-tabs: Síntomas / Laboratorio / ❤ Presión
- Presión tab shows empty state when no readings exist
- After adding readings in Hoy, Presión tab shows the chart with correct data points
- Month navigation works (‹ / ›), future months disabled
- Legend chips toggle series on/off
- Hover shows tooltip with day + SYS/DIA/PULSE values
- Stats row shows averages and reading count
- EMA7/14/30 toggleable (EMA30 off by default)

- [ ] **Step 4: Final commit**

```bash
git add src/components/analysis/AnalysisView.tsx
git commit -m "feat: add Presión sub-tab to AnalysisView with BPChart"
```

---

## Self-Review

**Spec coverage:**
- ✅ `BPReading` type with all fields
- ✅ `bpReadings` in `StorageSchema`
- ✅ Zod validation with range guards
- ✅ Migration v3→v4
- ✅ `addBPReading` + `removeBPReading` store actions
- ✅ Atomic note generation in single `commitWrite`
- ✅ Auto-note format with WHO classification label
- ✅ WHO classification (`classifyBP`) in `utils/bp.ts`
- ✅ Widget in TodayView with +/− spinners, time input, list, confirm-delete
- ✅ Hidden on past days with no readings
- ✅ `computeEMA` in `utils/bp.ts`
- ✅ BPChart: SVG, selector de mes, SYS+DIA+PULSE+EMA7+14+30
- ✅ BPChart: toggleable legend, hover tooltip, stats bar, empty state
- ✅ AnalysisView: third sub-tab "❤ Presión"
- ✅ `recordedAt` never exposed to editing (no UI for it)
- ✅ Sealed days: not blocked (BP reads/writes work regardless of seal)

**Type consistency:** `BPReading` defined in Task 1, imported in Tasks 4, 5, 7. `classifyBP`/`computeEMA` defined in Task 2, imported in Tasks 4, 7. All consistent.

**No placeholders:** confirmed — every step has complete code.
