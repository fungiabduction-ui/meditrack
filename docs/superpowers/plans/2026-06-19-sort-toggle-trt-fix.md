# Sort Toggle + Brand Display + TRT Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add chronological/grouped sort toggle to "Tomados" and History timeline, show brand in TodayView, and fix TRT cycle detection that uses a hardcoded UUID never matching real supplements.

**Architecture:** Three independent changes: (1) `analysis.ts` utility fix + test update, (2) `TodayView.tsx` UI additions, (3) `DayTimeline.tsx` UI additions. No new files or shared components — each component manages its own `useState` sort mode. Grouped rendering uses `useMemo` to bucket entries by `supplementId`, ordered by first timestamp.

**Tech Stack:** React 19, TypeScript strict, Vite 8, Zustand 5, Tailwind v4, Vitest 4

---

## File Map

| File | Change |
|------|--------|
| `src/utils/analysis.ts` | Remove hardcoded UUID; add `isEnanthateEntry()` helper |
| `src/__tests__/analysis.test.ts` | Update TRT test to use ingredient-based snapshot |
| `src/components/today/TodayView.tsx` | Add `sortMode` state, toggle UI, grouped rendering, brand display |
| `src/components/history/DayTimeline.tsx` | Add `sortMode` state, toggle UI, grouped rendering |

---

## Task 1: Fix TRT Detection — Update Test First

**Files:**
- Modify: `src/__tests__/analysis.test.ts`

- [ ] **Step 1: Update the test to use ingredient-based detection**

The test currently creates a snapshot with `activeIngredients: []` and detects injection by `supplementId === ENANTHATE_ID`. Change it to use a real ingredient that the new detection logic will match.

In `src/__tests__/analysis.test.ts`, replace:

```ts
const ENANTHATE_ID = 'a0000000-0000-4000-8000-000000000011'
```

Delete that line entirely. Then update the `it('returns 14 items when enanthate found'` test's entry object. Find this entry object:

```ts
entries: [{ id: 'e1', supplementId: ENANTHATE_ID, supplementSnapshot: { name: 'T', brand: undefined, doseUnit: 'ml', category: 'medication', activeIngredients: [], version: 0 }, quantity: 0.4, doseUnit: 'ml', timestamp: `${injectDate}T20:00:00Z`, recordedAt: `${injectDate}T20:00:00Z` }],
```

Replace with:

```ts
entries: [{
  id: 'e1',
  supplementId: 'some-random-uuid',
  supplementSnapshot: {
    name: 'Testenat Depot Enantato 250mg',
    brand: 'Landerlan Gold',
    doseUnit: 'ml',
    category: 'medication' as const,
    activeIngredients: [{
      name: 'Enantato de testosterona',
      form: 'éster de acción prolongada',
      amount: 250,
      unit: 'mg' as const,
    }],
    version: 0,
  },
  quantity: 0.4,
  doseUnit: 'ml',
  timestamp: `${injectDate}T20:00:00Z`,
  recordedAt: `${injectDate}T20:00:00Z`,
}],
```

- [ ] **Step 2: Run tests — expect TRT test to FAIL (detection not fixed yet)**

```bash
npx vitest run src/__tests__/analysis.test.ts
```

Expected: `computeTRTCycleData › returns 14 items when enanthate found` FAIL — returns `[]` because the old detection still looks for hardcoded UUID.

---

## Task 2: Fix TRT Detection — Update analysis.ts

**Files:**
- Modify: `src/utils/analysis.ts`

- [ ] **Step 1: Add the import and replace the hardcoded ID**

At the top of `src/utils/analysis.ts`, add `LogEntry` to the import:

```ts
import type { DailyLog, LogEntry, Supplement } from '../schema/types'
```

Then delete line 4:
```ts
const ENANTHATE_ID = 'a0000000-0000-4000-8000-000000000011'
```

Add this helper function after the imports (before `addDaysStr`):

```ts
function isEnanthateEntry(e: LogEntry): boolean {
  const ingMatch = e.supplementSnapshot.activeIngredients.some(
    i =>
      i.name.toLowerCase().includes('testosterona') &&
      i.form.toLowerCase().includes('enantato')
  )
  return ingMatch || e.supplementSnapshot.name.toLowerCase().includes('enantato')
}
```

- [ ] **Step 2: Replace detection call in `computeTRTCycleData`**

Find this line in `computeTRTCycleData` (inside the first `for` loop):

```ts
    if (log.entries.some(e => e.supplementId === ENANTHATE_ID)) {
```

Replace with:

```ts
    if (log.entries.some(isEnanthateEntry)) {
```

- [ ] **Step 3: Run tests — expect all to pass**

```bash
npx vitest run src/__tests__/analysis.test.ts
```

Expected: all 6 tests PASS including `returns 14 items when enanthate found`.

- [ ] **Step 4: Commit**

```bash
git add src/utils/analysis.ts src/__tests__/analysis.test.ts
git commit -m "fix: TRT detection uses ingredient/name match instead of hardcoded UUID"
```

---

## Task 3: Brand Display + Sort Toggle in TodayView

**Files:**
- Modify: `src/components/today/TodayView.tsx`

- [ ] **Step 1: Add `sortMode` state**

In `TodayView.tsx`, after the existing `useState` declarations (around line 29, after `const [search, setSearch] = useState('')`), add:

```tsx
const [sortMode, setSortMode] = useState<'chronological' | 'grouped'>('chronological')
```

- [ ] **Step 2: Add `groupedEntries` memoized computation**

After the `pendingSupplements` useMemo (around line 61), add:

```tsx
const groupedEntries = useMemo(() => {
  const order: string[] = []
  const groups: Record<string, typeof takenEntries> = {}
  for (const e of [...takenEntries].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    if (!groups[e.supplementId]) {
      groups[e.supplementId] = []
      order.push(e.supplementId)
    }
    groups[e.supplementId].push(e)
  }
  return order.map(id => ({ supplementId: id, entries: groups[id] }))
}, [takenEntries])
```

- [ ] **Step 3: Replace the "Tomados" section header and rendering**

Find the entire "tomados hoy" block (lines 208–255):

```tsx
      {/* tomados hoy */}
      {takenEntries.length > 0 && (
        <div className="px-4">
          <p className="text-slate-500 text-xs uppercase tracking-widest mb-2 px-1">Tomados</p>
          <div className="space-y-2">
            {[...takenEntries]
              .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
              .map(e => (
                <div key={e.id} className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
                  <div className="w-5 h-5 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-green-400 text-xs">✓</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{e.supplementSnapshot.name}</p>
                    <p className="text-slate-500 text-xs">{e.quantity} {e.doseUnit}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {e.timestampEditedFrom && (
                      <span className="text-slate-600 text-xs line-through">{formatTimestamp(e.timestampEditedFrom)}</span>
                    )}
                    {isToday ? (
                      <button onClick={() => openEdit(e.id, e.timestamp)} className="text-sky-400 text-xs underline">
                        {formatTimestamp(e.timestamp)}
                      </button>
                    ) : (
                      <span className="text-slate-500 text-xs">{formatTimestamp(e.timestamp)}</span>
                    )}
                    {confirmDelete === e.id ? (
                      <>
                        <button
                          onClick={() => { removeEntry(e.id); setConfirmDelete(null) }}
                          className="text-red-400 text-xs font-semibold"
                        >
                          ¿Borrar?
                        </button>
                        <button onClick={() => setConfirmDelete(null)} className="text-slate-500 text-xs">✕</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDelete(e.id)} className="text-slate-600 hover:text-red-400 text-xs transition-colors">
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
```

Replace the entire block with:

```tsx
      {/* tomados hoy */}
      {takenEntries.length > 0 && (
        <div className="px-4">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-slate-500 text-xs uppercase tracking-widest">Tomados</p>
            <div className="flex gap-1">
              <button
                onClick={() => setSortMode('chronological')}
                className={`text-sm px-1 rounded transition-colors ${sortMode === 'chronological' ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}
                title="Orden cronológico"
              >🕐</button>
              <button
                onClick={() => setSortMode('grouped')}
                className={`text-sm px-1 rounded transition-colors ${sortMode === 'grouped' ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}
                title="Agrupar por suplemento"
              >📦</button>
            </div>
          </div>

          {sortMode === 'chronological' && (
            <div className="space-y-2">
              {[...takenEntries]
                .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
                .map(e => (
                  <div key={e.id} className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
                    <div className="w-5 h-5 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-green-400 text-xs">✓</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{e.supplementSnapshot.name}</p>
                      {e.supplementSnapshot.brand && (
                        <p className="text-slate-500 text-xs">{e.supplementSnapshot.brand}</p>
                      )}
                      <p className="text-slate-400 text-xs">{e.quantity} {e.doseUnit}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {e.timestampEditedFrom && (
                        <span className="text-slate-600 text-xs line-through">{formatTimestamp(e.timestampEditedFrom)}</span>
                      )}
                      {isToday ? (
                        <button onClick={() => openEdit(e.id, e.timestamp)} className="text-sky-400 text-xs underline">
                          {formatTimestamp(e.timestamp)}
                        </button>
                      ) : (
                        <span className="text-slate-500 text-xs">{formatTimestamp(e.timestamp)}</span>
                      )}
                      {confirmDelete === e.id ? (
                        <>
                          <button
                            onClick={() => { removeEntry(e.id); setConfirmDelete(null) }}
                            className="text-red-400 text-xs font-semibold"
                          >
                            ¿Borrar?
                          </button>
                          <button onClick={() => setConfirmDelete(null)} className="text-slate-500 text-xs">✕</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDelete(e.id)} className="text-slate-600 hover:text-red-400 text-xs transition-colors">
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {sortMode === 'grouped' && (
            <div className="space-y-3">
              {groupedEntries.map(({ supplementId, entries }) => (
                <div key={supplementId} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-3 pt-2.5 pb-2 border-b border-slate-700">
                    <p className="text-white text-sm font-medium">{entries[0].supplementSnapshot.name}</p>
                    {entries[0].supplementSnapshot.brand && (
                      <p className="text-slate-500 text-xs">{entries[0].supplementSnapshot.brand}</p>
                    )}
                    <p className="text-slate-600 text-xs mt-0.5">{entries.length} {entries.length === 1 ? 'toma' : 'tomas'}</p>
                  </div>
                  <div className="divide-y divide-slate-700/50">
                    {entries.map(e => (
                      <div key={e.id} className="flex items-center gap-2 px-3 py-2">
                        <span className="text-green-400 text-xs flex-shrink-0">✓</span>
                        <span className="text-slate-300 text-xs flex-1">{e.quantity} {e.doseUnit}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isToday ? (
                            <button onClick={() => openEdit(e.id, e.timestamp)} className="text-sky-400 text-xs underline">
                              {formatTimestamp(e.timestamp)}
                            </button>
                          ) : (
                            <span className="text-slate-500 text-xs">{formatTimestamp(e.timestamp)}</span>
                          )}
                          {confirmDelete === e.id ? (
                            <>
                              <button
                                onClick={() => { removeEntry(e.id); setConfirmDelete(null) }}
                                className="text-red-400 text-xs font-semibold"
                              >
                                ¿Borrar?
                              </button>
                              <button onClick={() => setConfirmDelete(null)} className="text-slate-500 text-xs">✕</button>
                            </>
                          ) : (
                            <button onClick={() => setConfirmDelete(e.id)} className="text-slate-600 hover:text-red-400 text-xs transition-colors">
                              🗑
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 4: Build check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/today/TodayView.tsx
git commit -m "feat: sort toggle + brand display in Tomados (TodayView)"
```

---

## Task 4: Sort Toggle in DayTimeline (History)

**Files:**
- Modify: `src/components/history/DayTimeline.tsx`

- [ ] **Step 1: Add `useState` import and `sortMode` state**

At the top of `DayTimeline.tsx`, the import is:
```ts
import type { DailyLog } from '../../schema/types'
```

Change to:
```ts
import { useState, useMemo } from 'react'
import type { DailyLog } from '../../schema/types'
```

Then inside the `DayTimeline` component, after the existing `const supplements = useStore(...)` line, add:

```tsx
const [sortMode, setSortMode] = useState<'chronological' | 'grouped'>('chronological')
```

- [ ] **Step 2: Memoize `sorted` and add `groupedEntries`**

Currently `sorted` is:
```ts
const sorted = [...log.entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
```

Replace that line with:
```tsx
const sorted = useMemo(
  () => [...log.entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
  [log.entries]
)

const groupedEntries = useMemo(() => {
  const order: string[] = []
  const groups: Record<string, typeof sorted> = {}
  for (const e of sorted) {
    if (!groups[e.supplementId]) {
      groups[e.supplementId] = []
      order.push(e.supplementId)
    }
    groups[e.supplementId].push(e)
  }
  return order.map(id => ({ supplementId: id, entries: groups[id] }))
}, [sorted])
```

- [ ] **Step 3: Replace the timeline section with toggle + dual rendering**

Find the entire `{/* timeline */}` block (lines 32–68):

```tsx
      {/* timeline */}
      {sorted.length > 0 && (
        <div className="relative pl-5">
          <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-slate-700" />
          <div className="space-y-3">
            {sorted.map(e => (
              <div key={e.id} className="relative">
                <div className="absolute -left-3 top-2 w-2 h-2 rounded-full bg-green-500 border-2 border-slate-900" />
                <div className="bg-slate-800 rounded-xl px-3 py-2.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium">{e.supplementSnapshot.name}</p>
                        {!supplements[e.supplementId]?.active && (
                          <span className="text-slate-500 text-xs bg-slate-700 px-1.5 py-0.5 rounded">eliminado</span>
                        )}
                      </div>
                      {e.supplementSnapshot.brand && (
                        <p className="text-slate-500 text-xs">{e.supplementSnapshot.brand}</p>
                      )}
                      <p className="text-slate-400 text-xs mt-0.5">
                        {e.quantity} {e.doseUnit}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 text-sm font-medium">{formatTimestamp(e.timestamp)}</p>
                      {e.timestampEditedFrom && (
                        <p className="text-slate-600 text-xs line-through">{formatTimestamp(e.timestampEditedFrom)}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-slate-700 text-xs mt-1 font-mono">id: {e.id.slice(0,8)}…</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
```

Replace with:

```tsx
      {/* timeline */}
      {sorted.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-slate-500 text-xs uppercase tracking-wide">Entradas</p>
            <div className="flex gap-1">
              <button
                onClick={() => setSortMode('chronological')}
                className={`text-sm px-1 rounded transition-colors ${sortMode === 'chronological' ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}
                title="Orden cronológico"
              >🕐</button>
              <button
                onClick={() => setSortMode('grouped')}
                className={`text-sm px-1 rounded transition-colors ${sortMode === 'grouped' ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}
                title="Agrupar por suplemento"
              >📦</button>
            </div>
          </div>

          {sortMode === 'chronological' && (
            <div className="relative pl-5">
              <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-slate-700" />
              <div className="space-y-3">
                {sorted.map(e => (
                  <div key={e.id} className="relative">
                    <div className="absolute -left-3 top-2 w-2 h-2 rounded-full bg-green-500 border-2 border-slate-900" />
                    <div className="bg-slate-800 rounded-xl px-3 py-2.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm font-medium">{e.supplementSnapshot.name}</p>
                            {!supplements[e.supplementId]?.active && (
                              <span className="text-slate-500 text-xs bg-slate-700 px-1.5 py-0.5 rounded">eliminado</span>
                            )}
                          </div>
                          {e.supplementSnapshot.brand && (
                            <p className="text-slate-500 text-xs">{e.supplementSnapshot.brand}</p>
                          )}
                          <p className="text-slate-400 text-xs mt-0.5">
                            {e.quantity} {e.doseUnit}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-green-400 text-sm font-medium">{formatTimestamp(e.timestamp)}</p>
                          {e.timestampEditedFrom && (
                            <p className="text-slate-600 text-xs line-through">{formatTimestamp(e.timestampEditedFrom)}</p>
                          )}
                        </div>
                      </div>
                      <p className="text-slate-700 text-xs mt-1 font-mono">id: {e.id.slice(0,8)}…</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sortMode === 'grouped' && (
            <div className="space-y-3">
              {groupedEntries.map(({ supplementId, entries }) => (
                <div key={supplementId} className="bg-slate-800 rounded-xl overflow-hidden">
                  <div className="px-3 pt-2.5 pb-2 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-medium">{entries[0].supplementSnapshot.name}</p>
                      {!supplements[supplementId]?.active && (
                        <span className="text-slate-500 text-xs bg-slate-700 px-1.5 py-0.5 rounded">eliminado</span>
                      )}
                    </div>
                    {entries[0].supplementSnapshot.brand && (
                      <p className="text-slate-500 text-xs">{entries[0].supplementSnapshot.brand}</p>
                    )}
                    <p className="text-slate-600 text-xs mt-0.5">{entries.length} {entries.length === 1 ? 'toma' : 'tomas'}</p>
                  </div>
                  <div className="divide-y divide-slate-700/50">
                    {entries.map(e => (
                      <div key={e.id} className="flex items-center justify-between px-3 py-2">
                        <span className="text-slate-400 text-xs">{e.quantity} {e.doseUnit}</span>
                        <div className="text-right">
                          <p className="text-green-400 text-xs font-medium">{formatTimestamp(e.timestamp)}</p>
                          {e.timestampEditedFrom && (
                            <p className="text-slate-600 text-xs line-through">{formatTimestamp(e.timestampEditedFrom)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 4: Build check + all tests**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 0 TypeScript errors, all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/history/DayTimeline.tsx
git commit -m "feat: sort toggle in DayTimeline (History view)"
```

---

## Verification

After all tasks complete, open the app (`serve.bat` or `npm run dev` → `http://localhost:5173`) and verify:

1. **Hoy tab** → navegar al 17 de junio → "Tomados" muestra 🕐/📦 toggle
2. **Cronológico** → Premium Whey Protein aparece dos veces (14:00 y 23:00) con brand debajo del nombre
3. **Agrupado** → Premium Whey Protein aparece una vez con header "2 tomas" y las dos entradas abajo con timestamps
4. **Historial** → mismo día → "Entradas" muestra 🕐/📦 toggle con mismo comportamiento
5. **Análisis** → "Ciclo TRT 14 días" ya NO muestra "No se detectó registro de inyección de enantato" — muestra el heatmap de 14 días
