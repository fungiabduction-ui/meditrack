# TRT PK Curve Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar sub-tab "TRT" en AnalysisView con curva farmacocinética del enantato de testosterona basada en inyecciones reales, overlay de bienestar, y comparador de protocolos; más soporte de múltiples entradas de síntomas por día.

**Architecture:** `trt-pk.ts` implementa la matemática PK pura (Bateman + superposición). `TRTCurveChart` lee las inyecciones de enantato del store y renderiza el SVG. `ProtocolComparator` muestra steady-state genérico de 3 protocolos. El schema migra v4→v5 para agregar `symptomLog[]` a `DailyLog`, permitiendo múltiples registros de síntomas por día cuyo promedio se usa como overlay de bienestar en la curva.

**Tech Stack:** React 19, TypeScript strict, Vitest, Tailwind v4, Zustand 5, SVG inline (sin librerías de charting)

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `src/utils/trt-pk.ts` | Crear | Matemática PK: Bateman, superposición, steady-state |
| `src/utils/wellbeing.ts` | Modificar | Agregar `computeAvgSymptoms` |
| `src/schema/types.ts` | Modificar | Agregar `SymptomLogEntry`, `symptomLog` en `DailyLog` |
| `src/schema/zod-schemas.ts` | Modificar | Agregar `SymptomLogEntrySchema` en `DailyLogSchema` |
| `src/storage/migrations.ts` | Modificar | Migración v4→v5 |
| `src/store/index.ts` | Modificar | Acción `addSymptomEntry` |
| `src/components/today/DailySymptoms.tsx` | Modificar | Multi-entry UI con lista de registros |
| `src/components/analysis/TRTCurveChart.tsx` | Crear | SVG con curva PK real + dots de bienestar |
| `src/components/analysis/ProtocolComparator.tsx` | Crear | 3 mini-charts de steady-state |
| `src/components/analysis/AnalysisView.tsx` | Modificar | Agregar sub-tab `'trt'` |
| `src/__tests__/trt-pk.test.ts` | Crear | Tests para trt-pk.ts |
| `src/__tests__/wellbeing.test.ts` | Modificar | Tests para computeAvgSymptoms |
| `src/__tests__/migrations.test.ts` | Modificar | Test migración v4→v5 |
| `src/__tests__/store.test.ts` | Modificar | Test addSymptomEntry |

---

## Task 1: trt-pk.ts — Matemática PK pura

**Files:**
- Create: `src/utils/trt-pk.ts`
- Create: `src/__tests__/trt-pk.test.ts`

- [ ] **Step 1: Escribir tests**

Crear `src/__tests__/trt-pk.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computePKCurve, generateSteadyState, findReinjectionWindows } from '../utils/trt-pk'

describe('computePKCurve', () => {
  it('returns empty array for no injections', () => {
    expect(computePKCurve([], 14)).toEqual([])
  })

  it('starts at 0 (no concentration at t=0)', () => {
    const curve = computePKCurve([{ date: '2026-01-01', mgDose: 100 }], 30)
    expect(curve[0].level).toBe(0)
  })

  it('peak occurs between day 2 and day 4', () => {
    const curve = computePKCurve([{ date: '2026-01-01', mgDose: 100 }], 30)
    const peak = curve.reduce((a, b) => a.level > b.level ? a : b)
    expect(peak.t).toBeGreaterThan(2)
    expect(peak.t).toBeLessThan(4)
  })

  it('normalizes peak to 100', () => {
    const curve = computePKCurve([{ date: '2026-01-01', mgDose: 100 }], 30)
    const max = Math.max(...curve.map(p => p.level))
    expect(max).toBeCloseTo(100, 0)
  })

  it('level at t=25 is below 10% (mostly eliminated after 5 half-lives)', () => {
    const curve = computePKCurve([{ date: '2026-01-01', mgDose: 100 }], 30)
    const at25 = curve.find(p => Math.abs(p.t - 25) < 0.5)
    if (at25) expect(at25.level).toBeLessThan(10)
  })

  it('two injections produce same length curve as one', () => {
    const one = computePKCurve([{ date: '2026-01-01', mgDose: 100 }], 30)
    const two = computePKCurve([
      { date: '2026-01-01', mgDose: 100 },
      { date: '2026-01-15', mgDose: 100 },
    ], 30)
    expect(two.length).toBe(one.length)
  })

  it('all levels are between 0 and 100', () => {
    const curve = computePKCurve([{ date: '2026-01-01', mgDose: 100 }], 30)
    expect(curve.every(p => p.level >= 0 && p.level <= 100)).toBe(true)
  })
})

describe('generateSteadyState', () => {
  it('returns points', () => {
    const curve = generateSteadyState(7, 100)
    expect(curve.length).toBeGreaterThan(0)
  })

  it('all levels >= 0', () => {
    expect(generateSteadyState(14, 100).every(p => p.level >= 0)).toBe(true)
  })

  it('2x/week (3.5d) has higher trough than 1x/14d at steady state', () => {
    // Last cycle of each: trough = minimum in last interval
    const q2 = generateSteadyState(3.5, 100, 10)
    const q14 = generateSteadyState(14, 100, 10)
    // Take the last full cycle minimum
    const lastCycleMin = (curve: Array<{ t: number; level: number }>, interval: number) => {
      const last = curve.filter(p => p.t >= interval * 8)
      return Math.min(...last.map(p => p.level))
    }
    expect(lastCycleMin(q2, 3.5)).toBeGreaterThan(lastCycleMin(q14, 14))
  })
})

describe('findReinjectionWindows', () => {
  it('finds window when level drops below threshold', () => {
    const curve = [
      { t: 0, level: 100 },
      { t: 5, level: 50 },
      { t: 10, level: 20 },
      { t: 15, level: 10 },
    ]
    const windows = findReinjectionWindows(curve, 30)
    expect(windows.length).toBeGreaterThan(0)
    expect(windows[0].tStart).toBe(10)
  })

  it('returns empty when level never drops below threshold', () => {
    const curve = [
      { t: 0, level: 80 },
      { t: 5, level: 60 },
      { t: 10, level: 50 },
    ]
    expect(findReinjectionWindows(curve, 30)).toEqual([])
  })

  it('tail stays open if still below threshold at end', () => {
    const curve = [
      { t: 0, level: 100 },
      { t: 10, level: 20 },
      { t: 20, level: 5 },
    ]
    const windows = findReinjectionWindows(curve, 30)
    expect(windows[0].tEnd).toBe(20)
  })
})
```

- [ ] **Step 2: Correr tests para verificar que fallan**

```
npx vitest run src/__tests__/trt-pk.test.ts
```

Expected: FAIL (módulo no existe)

- [ ] **Step 3: Implementar trt-pk.ts**

Crear `src/utils/trt-pk.ts`:

```typescript
const KA = Math.LN2 / 1.5   // 0.462 día⁻¹ — absorción desde depósito IM (Tmax ~2.7d)
const KE = Math.LN2 / 4.5   // 0.154 día⁻¹ — eliminación (t½ = 4.5d, enantato)

export interface InjectionPoint {
  date: string    // 'YYYY-MM-DD'
  mgDose: number  // miligramos de testosterona base
}

function batemanAt(dt: number, dose: number): number {
  if (dt <= 0) return 0
  return dose * KA / (KA - KE) * (Math.exp(-KE * dt) - Math.exp(-KA * dt))
}

function buildNormalizedCurve(
  injPoints: Array<{ t: number; dose: number }>,
  totalDays: number,
  resolution: number,
): Array<{ t: number; level: number }> {
  const n = Math.ceil(totalDays * resolution) + 1
  const raw = Array.from({ length: n }, (_, i) => {
    const t = i / resolution
    return { t, level: injPoints.reduce((s, p) => s + batemanAt(t - p.t, p.dose), 0) }
  })
  const peak = Math.max(...raw.map(r => r.level), 0)
  if (peak === 0) return raw.map(r => ({ t: r.t, level: 0 }))
  return raw.map(r => ({ t: r.t, level: Math.round(r.level / peak * 1000) / 10 }))
}

function dateToOffsetDays(origin: string, date: string): number {
  return Math.round(
    (new Date(date + 'T00:00:00').getTime() - new Date(origin + 'T00:00:00').getTime()) / 86400000
  )
}

/**
 * Calcula la curva PK de T a partir de inyecciones reales.
 * El eje Y está normalizado al 100% en el pico global.
 * @param injections  Lista de inyecciones con fecha y dosis en mg.
 * @param totalDays   Días a calcular desde la primera inyección.
 * @param resolution  Puntos por día (default 4).
 */
export function computePKCurve(
  injections: InjectionPoint[],
  totalDays: number,
  resolution = 4,
): Array<{ t: number; level: number }> {
  if (injections.length === 0) return []
  const sorted = [...injections].sort((a, b) => a.date.localeCompare(b.date))
  const origin = sorted[0].date
  const injPoints = sorted.map(inj => ({
    t: dateToOffsetDays(origin, inj.date),
    dose: inj.mgDose,
  }))
  return buildNormalizedCurve(injPoints, totalDays, resolution)
}

/**
 * Genera una curva de steady-state hipotética para un protocolo.
 * Útil para el comparador de protocolos (no usa fechas reales).
 * @param intervalDays  Días entre inyecciones (3.5 = 2x/semana, 7 = semanal, 14 = quincenal).
 * @param mgDose        Dosis por inyección en mg.
 * @param cycles        Número de ciclos a simular (default 10 para alcanzar steady-state).
 */
export function generateSteadyState(
  intervalDays: number,
  mgDose: number,
  cycles = 10,
): Array<{ t: number; level: number }> {
  const injPoints = Array.from({ length: cycles }, (_, i) => ({
    t: i * intervalDays,
    dose: mgDose,
  }))
  return buildNormalizedCurve(injPoints, intervalDays * cycles, 4)
}

/**
 * Detecta los intervalos donde la curva cae por debajo del umbral.
 * Estos son los momentos sugeridos para reinjectar.
 * @param curve      Output de computePKCurve o generateSteadyState.
 * @param threshold  Nivel mínimo aceptable (default 30%). Configurable en el futuro.
 *
 * FUTURE (Opción C): Extender computePKCurve con forecastDays para proyectar la
 * curva hacia adelante desde hoy, y usar findReinjectionWindows para sugerir la
 * próxima fecha de inyección. Ver spec: docs/superpowers/specs/2026-06-24-trt-pk-curve-design.md
 */
export function findReinjectionWindows(
  curve: Array<{ t: number; level: number }>,
  threshold = 30,
): Array<{ tStart: number; tEnd: number }> {
  const windows: Array<{ tStart: number; tEnd: number }> = []
  let inWindow = false
  let tStart = 0
  for (const pt of curve) {
    if (!inWindow && pt.level <= threshold) { inWindow = true; tStart = pt.t }
    else if (inWindow && pt.level > threshold) { windows.push({ tStart, tEnd: pt.t }); inWindow = false }
  }
  if (inWindow) windows.push({ tStart, tEnd: curve[curve.length - 1].t })
  return windows
}
```

- [ ] **Step 4: Correr tests**

```
npx vitest run src/__tests__/trt-pk.test.ts
```

Expected: todos PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/trt-pk.ts src/__tests__/trt-pk.test.ts
git commit -m "feat: add trt-pk.ts with Bateman PK model, superposition and protocol utils"
```

---

## Task 2: computeAvgSymptoms en wellbeing.ts

**Files:**
- Modify: `src/utils/wellbeing.ts`
- Modify: `src/__tests__/wellbeing.test.ts`

- [ ] **Step 1: Agregar tests para computeAvgSymptoms**

Abrir `src/__tests__/wellbeing.test.ts` y agregar al final:

```typescript
import { computeWellbeingScore, computeAvgSymptoms } from '../utils/wellbeing'
// (el import de computeWellbeingScore ya debería estar — agregar computeAvgSymptoms)

const sym = (energy: number, sleep: number, mood: number, recovery: number, libido: number) => ({
  energy: energy as 1|2|3|4|5,
  sleep: sleep as 1|2|3|4|5,
  mood: mood as 1|2|3|4|5,
  recovery: recovery as 1|2|3|4|5,
  libido: libido as 1|2|3|4|5,
  erectionQuality: 3 as 1|2|3|4|5,
  nippleSensitivity: false,
  orgasms: 0,
})

describe('computeAvgSymptoms', () => {
  it('returns same entry for single-element array', () => {
    const s = sym(4, 4, 4, 4, 4)
    expect(computeAvgSymptoms([s])).toEqual(s)
  })

  it('averages numeric fields rounded', () => {
    const avg = computeAvgSymptoms([sym(2, 2, 2, 2, 2), sym(4, 4, 4, 4, 4)])
    expect(avg.energy).toBe(3)
    expect(avg.sleep).toBe(3)
    expect(avg.mood).toBe(3)
  })

  it('clamps result to 1-5', () => {
    const avg = computeAvgSymptoms([sym(1, 1, 1, 1, 1), sym(2, 2, 2, 2, 2)])
    expect(avg.energy).toBeGreaterThanOrEqual(1)
    expect(avg.energy).toBeLessThanOrEqual(5)
  })

  it('nippleSensitivity true when majority true', () => {
    const a = { ...sym(3,3,3,3,3), nippleSensitivity: true }
    const b = { ...sym(3,3,3,3,3), nippleSensitivity: true }
    const c = { ...sym(3,3,3,3,3), nippleSensitivity: false }
    expect(computeAvgSymptoms([a, b, c]).nippleSensitivity).toBe(true)
  })

  it('nippleSensitivity false when minority true', () => {
    const a = { ...sym(3,3,3,3,3), nippleSensitivity: true }
    const b = { ...sym(3,3,3,3,3), nippleSensitivity: false }
    const c = { ...sym(3,3,3,3,3), nippleSensitivity: false }
    expect(computeAvgSymptoms([a, b, c]).nippleSensitivity).toBe(false)
  })

  it('orgasms is summed across entries', () => {
    const a = { ...sym(3,3,3,3,3), orgasms: 2 }
    const b = { ...sym(3,3,3,3,3), orgasms: 1 }
    expect(computeAvgSymptoms([a, b]).orgasms).toBe(3)
  })
})
```

- [ ] **Step 2: Correr tests para verificar que fallan**

```
npx vitest run src/__tests__/wellbeing.test.ts
```

Expected: FAIL (`computeAvgSymptoms is not a function`)

- [ ] **Step 3: Implementar computeAvgSymptoms**

Abrir `src/utils/wellbeing.ts` y agregar al final:

```typescript
export function computeAvgSymptoms(entries: DailySymptoms[]): DailySymptoms {
  if (entries.length === 1) return entries[0]
  const n = entries.length
  const clamp = (v: number): 1 | 2 | 3 | 4 | 5 =>
    Math.max(1, Math.min(5, Math.round(v))) as 1 | 2 | 3 | 4 | 5
  const numAvg = (key: keyof Pick<DailySymptoms, 'energy' | 'libido' | 'sleep' | 'recovery' | 'mood' | 'erectionQuality'>) =>
    clamp(entries.reduce((s, e) => s + e[key], 0) / n)
  return {
    energy: numAvg('energy'),
    libido: numAvg('libido'),
    sleep: numAvg('sleep'),
    recovery: numAvg('recovery'),
    mood: numAvg('mood'),
    erectionQuality: numAvg('erectionQuality'),
    nippleSensitivity: entries.filter(e => e.nippleSensitivity).length >= n / 2,
    orgasms: entries.reduce((s, e) => s + e.orgasms, 0),
  }
}
```

- [ ] **Step 4: Correr tests**

```
npx vitest run src/__tests__/wellbeing.test.ts
```

Expected: todos PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/wellbeing.ts src/__tests__/wellbeing.test.ts
git commit -m "feat: add computeAvgSymptoms to wellbeing utils"
```

---

## Task 3: Schema — SymptomLogEntry en types.ts y zod-schemas.ts

**Files:**
- Modify: `src/schema/types.ts`
- Modify: `src/schema/zod-schemas.ts`

No hay tests nuevos — la validación Zod es testeada en Task 4 (la migración que genera los datos).

- [ ] **Step 1: Agregar SymptomLogEntry en types.ts**

En `src/schema/types.ts`, ANTES de `export type DailyLog`, agregar:

```typescript
export type SymptomLogEntry = {
  id: string
  timestamp: string  // ISO8601 — momento del registro individual
  symptoms: DailySymptoms
}
```

Y dentro de `export type DailyLog`, agregar el campo opcional después de `symptoms`:

```typescript
  symptoms?: DailySymptoms
  symptomLog?: SymptomLogEntry[]  // múltiples registros del día; symptoms = promedio calculado
```

- [ ] **Step 2: Agregar SymptomLogEntrySchema en zod-schemas.ts**

En `src/schema/zod-schemas.ts`, DESPUÉS de `export const DailySymptomsSchema`, agregar:

```typescript
export const SymptomLogEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string(),
  symptoms: DailySymptomsSchema,
})
```

Y dentro de `DailyLogSchema`, agregar después de `symptoms: DailySymptomsSchema.optional()`:

```typescript
  symptomLog: z.array(SymptomLogEntrySchema).optional(),
```

- [ ] **Step 3: Verificar que el proyecto compila**

```
npx tsc --noEmit
```

Expected: 0 errores

- [ ] **Step 4: Commit**

```bash
git add src/schema/types.ts src/schema/zod-schemas.ts
git commit -m "feat: add SymptomLogEntry type and schema for multi-entry symptoms"
```

---

## Task 4: Migración v4→v5

**Files:**
- Modify: `src/storage/migrations.ts`
- Modify: `src/__tests__/migrations.test.ts`

- [ ] **Step 1: Escribir tests de migración v4→v5**

Abrir `src/__tests__/migrations.test.ts` y agregar al final:

```typescript
describe('v4 → v5 (symptomLog)', () => {
  it('creates symptomLog from existing symptoms', () => {
    const v4: any = {
      _version: 4, _createdAt: '', _updatedAt: '', _checksum: '',
      supplements: {},
      dailyLogs: {
        '2026-06-20': {
          id: '2026-06-20', date: '2026-06-20',
          entries: [], skipped: [], notes: [],
          symptoms: { energy: 4, libido: 3, sleep: 5, recovery: 3, mood: 4, erectionQuality: 3, nippleSensitivity: false, orgasms: 1 },
          sealed: false, checksum: '', createdAt: '', updatedAt: '',
        },
      },
      migrations: [], bloodWork: [], bpReadings: [],
    }
    const result = migrate(4, v4)
    expect(result._version).toBe(5)
    const log = result.dailyLogs['2026-06-20']
    expect(log.symptomLog).toHaveLength(1)
    expect(log.symptomLog![0].symptoms.energy).toBe(4)
    expect(log.symptomLog![0].id).toBeTruthy()
    expect(log.symptoms).toBeDefined()
  })

  it('skips logs without symptoms', () => {
    const v4: any = {
      _version: 4, _createdAt: '', _updatedAt: '', _checksum: '',
      supplements: {},
      dailyLogs: {
        '2026-06-20': { id: '2026-06-20', date: '2026-06-20', entries: [], skipped: [], notes: [], sealed: false, checksum: '', createdAt: '', updatedAt: '' },
      },
      migrations: [], bloodWork: [], bpReadings: [],
    }
    const result = migrate(4, v4)
    expect(result.dailyLogs['2026-06-20'].symptomLog).toBeUndefined()
  })

  it('current → current still returns same object', () => {
    const schema = createFreshSchema()
    expect(migrate(5, schema)).toBe(schema)
  })
})
```

También actualizar el test existente `'v0 → current creates valid schema'` para verificar `_version` 5:

```typescript
// Cambiar la línea:
//   expect(result._version).toBe(CURRENT_VERSION)
// — ya usa CURRENT_VERSION, no cambiar. Solo asegurarse que CURRENT_VERSION sea 5 después.
```

- [ ] **Step 2: Correr tests para verificar que fallan**

```
npx vitest run src/__tests__/migrations.test.ts
```

Expected: FAIL (`Unknown schema version: 4` si se pasa al migrate, y fallo en `CURRENT_VERSION`)

- [ ] **Step 3: Implementar migración v4→v5 en migrations.ts**

En `src/storage/migrations.ts`:

1. Agregar import al inicio del archivo:

```typescript
import { generateId } from '../utils/id'
```

2. Cambiar `export const CURRENT_VERSION = 4` a:

```typescript
export const CURRENT_VERSION = 5
```

3. Cambiar la línea `return migrated` al final del bloque `if (version === 3)` para continuar la cadena:

```typescript
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
    return migrate(4, migrated)  // continuar cadena
  }
```

4. Agregar el nuevo bloque v4→v5 ANTES del `throw`:

```typescript
  if (version === 4) {
    const raw = data as StorageSchema
    const now = new Date().toISOString()
    const dailyLogs = Object.fromEntries(
      Object.entries(raw.dailyLogs).map(([date, log]) => {
        if (!log.symptoms || log.symptomLog) return [date, log]
        return [date, {
          ...log,
          symptomLog: [{
            id: generateId(),
            timestamp: `${date}T12:00:00.000Z`,
            symptoms: log.symptoms,
          }],
        }]
      })
    )
    const migrated: StorageSchema = {
      ...raw,
      _version: 5,
      dailyLogs,
      migrations: [
        ...(raw.migrations ?? []),
        { from: 4, to: 5, appliedAt: now },
      ],
    }
    return migrated
  }

  throw new Error(`Unknown schema version: ${version}`)
```

- [ ] **Step 4: Correr tests**

```
npx vitest run src/__tests__/migrations.test.ts
```

Expected: todos PASS

- [ ] **Step 5: Correr suite completa**

```
npx vitest run
```

Expected: todos PASS (sin regresiones)

- [ ] **Step 6: Commit**

```bash
git add src/storage/migrations.ts src/__tests__/migrations.test.ts
git commit -m "feat: migration v4->v5 — wrap existing symptoms into symptomLog array"
```

---

## Task 5: Store — acción addSymptomEntry

**Files:**
- Modify: `src/store/index.ts`
- Modify: `src/__tests__/store.test.ts`

- [ ] **Step 1: Escribir test de addSymptomEntry**

Abrir `src/__tests__/store.test.ts` y agregar al final:

```typescript
describe('addSymptomEntry', () => {
  it('creates symptomLog and sets symptoms as first entry', () => {
    const today = getLocalDateStr()
    const sym = {
      energy: 4 as const, libido: 4 as const, sleep: 4 as const,
      recovery: 4 as const, mood: 4 as const, erectionQuality: 4 as const,
      nippleSensitivity: false, orgasms: 0,
    }
    useStore.getState().addSymptomEntry(today, sym)
    const log = useStore.getState().dailyLogs[today]
    expect(log.symptomLog).toHaveLength(1)
    expect(log.symptomLog![0].symptoms.energy).toBe(4)
    expect(log.symptoms?.energy).toBe(4)
  })

  it('second entry updates symptoms to average', () => {
    const today = getLocalDateStr()
    const low = { energy: 2 as const, libido: 2 as const, sleep: 2 as const, recovery: 2 as const, mood: 2 as const, erectionQuality: 2 as const, nippleSensitivity: false, orgasms: 0 }
    const high = { energy: 4 as const, libido: 4 as const, sleep: 4 as const, recovery: 4 as const, mood: 4 as const, erectionQuality: 4 as const, nippleSensitivity: false, orgasms: 0 }
    useStore.getState().addSymptomEntry(today, low)
    useStore.getState().addSymptomEntry(today, high)
    const log = useStore.getState().dailyLogs[today]
    expect(log.symptomLog).toHaveLength(2)
    expect(log.symptoms?.energy).toBe(3)  // avg(2,4) = 3
  })

  it('persists across init', () => {
    const today = getLocalDateStr()
    const sym = { energy: 5 as const, libido: 5 as const, sleep: 5 as const, recovery: 5 as const, mood: 5 as const, erectionQuality: 5 as const, nippleSensitivity: false, orgasms: 0 }
    useStore.getState().addSymptomEntry(today, sym)
    useStore.getState().init()
    const log = useStore.getState().dailyLogs[today]
    expect(log.symptomLog).toHaveLength(1)
    expect(log.symptoms?.energy).toBe(5)
  })
})
```

- [ ] **Step 2: Correr test para verificar que falla**

```
npx vitest run src/__tests__/store.test.ts
```

Expected: FAIL (`addSymptomEntry is not a function`)

- [ ] **Step 3: Agregar addSymptomEntry al store**

En `src/store/index.ts`:

1. Agregar el import de tipos al inicio (junto a los demás imports de types):

```typescript
import type { Supplement, LogEntry, DailyLog, StorageSchema, SkippedItem, DayNote, DailySymptoms, BloodWorkEntry, BPReading, SymptomLogEntry } from '../schema/types'
```

2. Agregar `computeAvgSymptoms` al import de wellbeing:

```typescript
import { computeAvgSymptoms } from '../utils/wellbeing'
```

3. En el tipo `Store`, agregar después de `updateSymptoms`:

```typescript
  addSymptomEntry: (dateStr: string, symptoms: DailySymptoms) => void
```

4. En la implementación del store (después de `updateSymptoms: ...`), agregar:

```typescript
  addSymptomEntry: (dateStr, symptomsData) => {
    const now = new Date().toISOString()
    const existing = get().dailyLogs[dateStr]
    const entry: SymptomLogEntry = { id: generateId(), timestamp: now, symptoms: symptomsData }
    const prevLog: DailyLog = existing ?? {
      id: generateId(), date: dateStr, entries: [], skipped: [], notes: [],
      sealed: false, checksum: '', createdAt: now, updatedAt: now,
    }
    const symptomLog = [...(prevLog.symptomLog ?? []), entry]
    const symptoms = symptomLog.length === 1
      ? symptomsData
      : computeAvgSymptoms(symptomLog.map(e => e.symptoms))
    const log: DailyLog = { ...prevLog, symptomLog, symptoms, updatedAt: now }
    const dailyLogs = { ...get().dailyLogs, [dateStr]: log }
    commitWrite(set, { ...read(), dailyLogs })
  },
```

- [ ] **Step 4: Correr tests**

```
npx vitest run src/__tests__/store.test.ts
```

Expected: todos PASS

- [ ] **Step 5: Correr suite completa**

```
npx vitest run
```

Expected: todos PASS

- [ ] **Step 6: Commit**

```bash
git add src/store/index.ts src/__tests__/store.test.ts
git commit -m "feat: add addSymptomEntry store action for multi-entry daily symptoms"
```

---

## Task 6: DailySymptoms.tsx — multi-entry UI

**Files:**
- Modify: `src/components/today/DailySymptoms.tsx`

- [ ] **Step 1: Reemplazar el componente**

Reemplazar el contenido completo de `src/components/today/DailySymptoms.tsx`:

```typescript
import { useState } from 'react'
import { useStore } from '../../store'
import type { DailySymptoms } from '../../schema/types'
import { computeWellbeingScore } from '../../utils/wellbeing'

const DEFAULTS: DailySymptoms = {
  energy: 3, libido: 3, sleep: 3, recovery: 3, mood: 3,
  erectionQuality: 3, nippleSensitivity: false, orgasms: 0,
}

const LABELS: { key: keyof Pick<DailySymptoms, 'energy' | 'libido' | 'sleep' | 'recovery' | 'mood' | 'erectionQuality'>; label: string }[] = [
  { key: 'energy', label: 'Energía' },
  { key: 'libido', label: 'Libido' },
  { key: 'sleep', label: 'Sueño' },
  { key: 'recovery', label: 'Recuperación' },
  { key: 'mood', label: 'Ánimo' },
  { key: 'erectionQuality', label: 'Erección' },
]

type Props = { dateStr: string; isToday: boolean }

export function DailySymptoms({ dateStr, isToday }: Props) {
  const dailyLog = useStore(s => s.dailyLogs[dateStr])
  const addSymptomEntry = useStore(s => s.addSymptomEntry)

  const saved = dailyLog?.symptoms ?? null
  const symptomLog = dailyLog?.symptomLog ?? []
  const [local, setLocal] = useState<DailySymptoms>(DEFAULTS)

  if (!isToday && !saved) return null

  const readOnly = !isToday && !!saved

  const setNum = (key: keyof Pick<DailySymptoms, 'energy' | 'libido' | 'sleep' | 'recovery' | 'mood' | 'erectionQuality'>, val: 1 | 2 | 3 | 4 | 5) =>
    setLocal(p => ({ ...p, [key]: val }))

  const handleSave = () => {
    addSymptomEntry(dateStr, local)
    setLocal(DEFAULTS)
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-xs uppercase tracking-widest">Síntomas del día</p>
        {saved && (
          <span className="text-xs font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
            {computeWellbeingScore(saved)}/100
            {symptomLog.length > 1 && <span className="opacity-60 ml-1">·  {symptomLog.length} reg.</span>}
          </span>
        )}
      </div>

      {isToday && symptomLog.length > 0 && (
        <div className="space-y-1">
          {symptomLog.map(entry => (
            <div key={entry.id} className="flex justify-between items-center text-xs bg-slate-900 rounded-lg px-3 py-1.5">
              <span className="text-slate-500">
                {new Date(entry.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-violet-400 font-semibold">
                {computeWellbeingScore(entry.symptoms)}/100
              </span>
            </div>
          ))}
        </div>
      )}

      {LABELS.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between gap-2">
          <span className="text-slate-300 text-sm w-28 flex-shrink-0">{label}</span>
          <div className="flex gap-1">
            {([1, 2, 3, 4, 5] as const).map(n => (
              <button
                key={n}
                disabled={readOnly}
                onClick={() => setNum(key, n)}
                className={`w-7 h-7 rounded-full text-xs font-semibold transition-colors ${
                  local[key] === n
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                } ${readOnly ? 'cursor-default' : ''}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <span className="text-slate-300 text-sm">Sensibilidad pezón</span>
        <button
          disabled={readOnly}
          onClick={() => !readOnly && setLocal(p => ({ ...p, nippleSensitivity: !p.nippleSensitivity }))}
          className={`w-10 h-6 rounded-full transition-colors relative ${
            local.nippleSensitivity ? 'bg-violet-600' : 'bg-slate-700'
          } ${readOnly ? 'cursor-default' : ''}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${local.nippleSensitivity ? 'left-5' : 'left-1'}`} />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-slate-300 text-sm">Orgasmos</span>
        <div className="flex items-center gap-3">
          {!readOnly && (
            <button
              onClick={() => setLocal(p => ({ ...p, orgasms: Math.max(0, p.orgasms - 1) }))}
              className="w-7 h-7 rounded-full bg-slate-700 text-slate-300 text-lg flex items-center justify-center hover:bg-slate-600"
            >−</button>
          )}
          <span className="text-white text-sm w-4 text-center">{local.orgasms}</span>
          {!readOnly && (
            <button
              onClick={() => setLocal(p => ({ ...p, orgasms: p.orgasms + 1 }))}
              className="w-7 h-7 rounded-full bg-slate-700 text-slate-300 text-lg flex items-center justify-center hover:bg-slate-600"
            >+</button>
          )}
        </div>
      </div>

      {!readOnly && (
        <button
          onClick={handleSave}
          className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl py-2.5 w-full text-sm font-semibold transition-colors"
        >
          {symptomLog.length === 0 ? 'Guardar síntomas' : 'Agregar entrada'}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila**

```
npx tsc --noEmit
```

Expected: 0 errores

- [ ] **Step 3: Iniciar dev server y verificar manualmente**

```
cmd /c serve.bat
```

Verificar en `http://localhost:5173`:
1. Ir a la vista "Hoy"
2. Guardar síntomas → el formulario se resetea a DEFAULTS, aparece la entrada en la lista con la hora
3. Guardar segunda entrada → aparece segunda fila, el badge muestra avg y "2 reg."
4. Navegar a "Historial" → días anteriores muestran síntomas en modo readOnly sin cambios visibles

- [ ] **Step 4: Commit**

```bash
git add src/components/today/DailySymptoms.tsx
git commit -m "feat: support multiple symptom entries per day with daily average"
```

---

## Task 7: TRTCurveChart.tsx

**Files:**
- Create: `src/components/analysis/TRTCurveChart.tsx`

- [ ] **Step 1: Crear el componente**

Crear `src/components/analysis/TRTCurveChart.tsx`:

```typescript
import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import type { LogEntry } from '../../schema/types'
import { computePKCurve } from '../../utils/trt-pk'
import { computeWellbeingScore, computeAvgSymptoms } from '../../utils/wellbeing'
import type { InjectionPoint } from '../../utils/trt-pk'

const MG_PER_ML = 250  // Testenat Depot 250mg/ml

function isEnanthateEntry(e: LogEntry): boolean {
  return (
    e.supplementSnapshot.name.toLowerCase().includes('enantato') ||
    e.supplementSnapshot.activeIngredients.some(
      i => i.name.toLowerCase().includes('testosterona') &&
           (i.form?.toLowerCase() ?? '').includes('enantato')
    )
  )
}

const W = 300
const H = 150
const PAD = { top: 14, right: 12, bottom: 22, left: 30 }

function toY(val: number): number {
  return PAD.top + (1 - Math.max(0, Math.min(100, val)) / 100) * (H - PAD.top - PAD.bottom)
}

function currentMonthStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function offsetMonthStr(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function daysInMonthFor(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function diffDaysFromOrigin(origin: string, date: string): number {
  return Math.round(
    (new Date(date + 'T00:00:00').getTime() - new Date(origin + 'T00:00:00').getTime()) / 86400000
  )
}

export function TRTCurveChart() {
  const dailyLogs = useStore(s => s.dailyLogs)
  const [month, setMonth] = useState(currentMonthStr)

  const { injections, origin } = useMemo(() => {
    const map = new Map<string, number>()
    for (const log of Object.values(dailyLogs)) {
      for (const entry of log.entries) {
        if (isEnanthateEntry(entry)) {
          map.set(log.date, (map.get(log.date) ?? 0) + entry.quantity * MG_PER_ML)
        }
      }
    }
    const injs: InjectionPoint[] = [...map.entries()]
      .map(([date, mgDose]) => ({ date, mgDose }))
      .sort((a, b) => a.date.localeCompare(b.date))
    return { injections: injs, origin: injs[0]?.date ?? null }
  }, [dailyLogs])

  const today = currentMonthStr()
  const dim = daysInMonthFor(month)
  const monthLabel = new Date(`${month}-15`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const toX = (day: number) =>
    PAD.left + ((day - 1) / Math.max(dim - 1, 1)) * (W - PAD.left - PAD.right)

  // Window in days-from-origin
  const windowStart = origin ? diffDaysFromOrigin(origin, `${month}-01`) : 0
  const windowEnd = windowStart + dim

  // PK curve — only compute if we have injections that reach this month
  const curvePoints = useMemo(() => {
    if (!origin || injections.length === 0) return ''
    if (windowEnd <= 0) return ''
    const totalDays = Math.max(windowEnd + 5, 1)
    const curve = computePKCurve(injections, totalDays)
    return curve
      .filter(p => p.t >= windowStart && p.t <= windowEnd)
      .map(p => {
        const dayF = p.t - windowStart + 1
        const x = PAD.left + ((dayF - 1) / Math.max(dim - 1, 1)) * (W - PAD.left - PAD.right)
        return `${x.toFixed(1)},${toY(p.level).toFixed(1)}`
      })
      .join(' ')
  }, [injections, origin, windowStart, windowEnd, dim])

  // Injection markers within this month
  const injectionMarkers = useMemo(() => {
    if (!origin) return []
    return injections
      .filter(inj => inj.date.startsWith(month))
      .map(inj => ({ day: parseInt(inj.date.slice(-2), 10), label: `${Math.round(inj.mgDose)}mg` }))
  }, [injections, origin, month])

  // Wellbeing dots
  const wellbeingDots = useMemo(() => {
    return Object.entries(dailyLogs)
      .filter(([date]) => date.startsWith(month))
      .flatMap(([date, log]) => {
        const day = parseInt(date.slice(-2), 10)
        let score: number | null = null
        if (log.symptomLog && log.symptomLog.length > 0) {
          score = computeWellbeingScore(computeAvgSymptoms(log.symptomLog.map(e => e.symptoms)))
        } else if (log.symptoms) {
          score = computeWellbeingScore(log.symptoms)
        }
        return score !== null ? [{ day, score }] : []
      })
  }, [dailyLogs, month])

  if (injections.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
        <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Curva TRT</p>
        <p className="text-slate-600 text-sm">Sin inyecciones de enantato registradas</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setMonth(m => offsetMonthStr(m, -1))} className="text-slate-400 hover:text-white px-2 text-lg">‹</button>
        <span className="text-white text-sm font-semibold capitalize">{monthLabel}</span>
        <button onClick={() => setMonth(m => offsetMonthStr(m, 1))} disabled={month >= today} className="text-slate-400 hover:text-white px-2 text-lg disabled:opacity-20 disabled:cursor-not-allowed">›</button>
      </div>

      <div className="flex gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5 bg-violet-400 rounded-full" />Nivel T estimado</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-400" />Bienestar</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        {/* Y grid lines */}
        {[0, 30, 60, 100].map(v => (
          <g key={v}>
            <line x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)}
              stroke={v === 30 ? '#ef444430' : '#1e293b'} strokeWidth="1"
              strokeDasharray={v === 30 ? '4,3' : undefined} />
            <text x={PAD.left - 3} y={toY(v) + 3} fontSize="6" fill="#334155" textAnchor="end">{v}%</text>
          </g>
        ))}

        {/* Optimal zone 60–100% */}
        <rect x={PAD.left} y={toY(100)} width={W - PAD.left - PAD.right}
          height={toY(60) - toY(100)} fill="#22c55e07" />

        {/* Reinjection zone <30% */}
        <rect x={PAD.left} y={toY(30)} width={W - PAD.left - PAD.right}
          height={toY(0) - toY(30)} fill="#ef444407" />

        {/* PK curve */}
        {curvePoints && (
          <polyline points={curvePoints} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinejoin="round" />
        )}

        {/* Injection markers */}
        {injectionMarkers.map(({ day, label }) => (
          <g key={day}>
            <line x1={toX(day)} y1={PAD.top} x2={toX(day)} y2={H - PAD.bottom}
              stroke="#8b5cf6" strokeWidth="1" strokeDasharray="2,2" opacity="0.5" />
            <text x={toX(day)} y={PAD.top - 3} fontSize="7" fill="#a78bfa" textAnchor="middle">💉{label}</text>
          </g>
        ))}

        {/* Wellbeing dots */}
        {wellbeingDots.map(({ day, score }) => (
          <g key={day}>
            <circle cx={toX(day)} cy={toY(score)} r="3.5" fill="#fb923c" />
            <text x={toX(day)} y={toY(score) - 5} fontSize="6" fill="#fb923c" textAnchor="middle">{score}</text>
          </g>
        ))}

        {/* X axis labels */}
        {[1, 8, 15, 22, dim].filter(d => d <= dim).map(day => (
          <text key={day} x={toX(day)} y={H - PAD.bottom + 10} fontSize="6" fill="#475569" textAnchor="middle">{day}</text>
        ))}
      </svg>

      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-2 rounded-sm bg-green-500/10 border border-green-500/20" />zona óptima 60-100%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 border-t border-red-500/40 border-dashed" />reinjectar &lt;30%
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila**

```
npx tsc --noEmit
```

Expected: 0 errores

- [ ] **Step 3: Commit provisional (antes de conectar a AnalysisView)**

```bash
git add src/components/analysis/TRTCurveChart.tsx
git commit -m "feat: add TRTCurveChart SVG with PK curve and wellbeing overlay"
```

---

## Task 8: ProtocolComparator.tsx + sub-tab TRT en AnalysisView

**Files:**
- Create: `src/components/analysis/ProtocolComparator.tsx`
- Modify: `src/components/analysis/AnalysisView.tsx`

- [ ] **Step 1: Crear ProtocolComparator.tsx**

Crear `src/components/analysis/ProtocolComparator.tsx`:

```typescript
import { useMemo } from 'react'
import { generateSteadyState } from '../../utils/trt-pk'

const PROTOCOLS = [
  { label: '1x/14d', intervalDays: 14, description: 'Quincenal' },
  { label: '1x/7d',  intervalDays: 7,  description: 'Semanal' },
  { label: '2x/7d',  intervalDays: 3.5, description: 'Bisemanal' },
] as const

const MW = 80
const MH = 40
const MP = { top: 3, right: 3, bottom: 3, left: 3 }

type Props = { currentIntervalDays?: number }

export function ProtocolComparator({ currentIntervalDays }: Props) {
  const data = useMemo(() => {
    return PROTOCOLS.map(p => {
      const full = generateSteadyState(p.intervalDays, 100, 12)
      // Mostrar los últimos 3 ciclos (steady-state visible)
      const cyclesDays = p.intervalDays * 3
      const startT = p.intervalDays * 9
      const slice = full.filter(pt => pt.t >= startT && pt.t <= startT + cyclesDays)
      if (slice.length === 0) return { ...p, points: '', peak: 100, trough: 0, fluctuation: 100 }

      const peak = Math.max(...slice.map(s => s.level))
      const trough = Math.min(...slice.map(s => s.level))

      const points = slice.map(pt => {
        const x = MP.left + ((pt.t - startT) / cyclesDays) * (MW - MP.left - MP.right)
        const y = MP.top + (1 - pt.level / 100) * (MH - MP.top - MP.bottom)
        return `${x.toFixed(1)},${y.toFixed(1)}`
      }).join(' ')

      return { ...p, points, peak: Math.round(peak), trough: Math.round(trough), fluctuation: Math.round(peak - trough) }
    })
  }, [])

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
      <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Comparador de protocolos</p>
      <p className="text-slate-600 text-xs mb-3">Steady-state 100mg/dosis · menor fluctuación = niveles más estables</p>
      <div className="grid grid-cols-3 gap-2">
        {data.map(p => {
          const isCurrent = currentIntervalDays !== undefined &&
            Math.abs(currentIntervalDays - p.intervalDays) <= p.intervalDays * 0.4
          return (
            <div key={p.label} className={`rounded-xl p-2.5 border transition-colors ${isCurrent ? 'border-violet-500 bg-violet-500/10' : 'border-slate-700 bg-slate-900'}`}>
              <p className="text-white text-xs font-bold text-center">{p.label}</p>
              <p className="text-slate-500 text-xs text-center mb-1.5">{p.description}</p>
              <svg viewBox={`0 0 ${MW} ${MH}`} width="100%">
                <polyline points={p.points} fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <div className="mt-1.5 space-y-0.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Pico</span>
                  <span className="text-violet-400 font-semibold">{p.peak}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Valle</span>
                  <span className="text-slate-300">{p.trough}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fluctuac.</span>
                  <span className={p.fluctuation < 30 ? 'text-green-400' : p.fluctuation < 60 ? 'text-yellow-400' : 'text-red-400'}>
                    {p.fluctuation}%
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Agregar sub-tab TRT en AnalysisView.tsx**

En `src/components/analysis/AnalysisView.tsx`:

1. Agregar imports al inicio:

```typescript
import { TRTCurveChart } from './TRTCurveChart'
import { ProtocolComparator } from './ProtocolComparator'
```

2. Cambiar el tipo `SubTab`:

```typescript
type SubTab = 'symptoms' | 'lab' | 'bp' | 'trt'
```

3. En el contenedor de botones de sub-tabs, agregar después del botón "❤ Presión":

```typescript
          <button
            onClick={() => setSubTab('trt')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
              subTab === 'trt'
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            TRT
          </button>
```

4. Al final de las condiciones de renderizado, agregar:

```typescript
        {subTab === 'trt' && (
          <div className="space-y-4">
            <TRTCurveChart />
            <ProtocolComparator />
          </div>
        )}
```

- [ ] **Step 3: Verificar que compila**

```
npx tsc --noEmit
```

Expected: 0 errores

- [ ] **Step 4: Correr suite completa de tests**

```
npx vitest run
```

Expected: todos PASS

- [ ] **Step 5: Iniciar dev server y verificar manualmente**

```
cmd /c serve.bat
```

Verificar en `http://localhost:5173`:

1. **Sub-tab TRT visible** — ir a Análisis → tab TRT aparece junto a Síntomas / Laboratorio / Presión
2. **TRTCurveChart** — debe mostrar la curva PK de las inyecciones del usuario (Jun 17 + Jun 22). En el mes de Junio: dos marcadores 💉100mg y 💉50mg, curva violeta que sube ~día 20 (2-3 días post Jun 17) y cae, luego sube de nuevo ~día 25 post Jun 22.
3. **Wellbeing dots** — si hay síntomas registrados (Jun 21, 22, 23), aparecen como dots naranjas.
4. **Navegador de meses** — ‹ Junio 2026 › funciona, al ir a Mayo no hay curva (vacío/sin datos).
5. **ProtocolComparator** — 3 cards con mini-charts. 1x/14d debe tener fluctuación alta (>80%), 2x/7d debe ser baja (<20%).

- [ ] **Step 6: Commit final**

```bash
git add src/components/analysis/ProtocolComparator.tsx src/components/analysis/AnalysisView.tsx
git commit -m "feat: add TRT sub-tab with PK curve chart and protocol comparator"
```

---

## Self-Review

**Spec coverage:**

| Requisito spec | Task que lo implementa |
|---|---|
| `trt-pk.ts` con Bateman, superposición, normalización | Task 1 |
| `computeAvgSymptoms` | Task 2 |
| `SymptomLogEntry` type + Zod | Task 3 |
| Migración v4→v5 | Task 4 |
| `addSymptomEntry` store action | Task 5 |
| `DailySymptoms.tsx` multi-entry + lista de registros | Task 6 |
| `TRTCurveChart` SVG con curva PK + dots bienestar | Task 7 |
| `ProtocolComparator` 3 mini-charts steady-state | Task 8 |
| Sub-tab TRT en AnalysisView | Task 8 |
| Nota sobre Opción C futura | Comentario JSDoc en trt-pk.ts `findReinjectionWindows` |
| Conversión ml→mg (×250) | Task 7, línea `const MG_PER_ML = 250` |
| Fallback a `symptoms` legacy para el overlay | Task 7, `else if (log.symptoms)` |

**Type consistency:** `InjectionPoint` definido en Task 1, importado en Task 7 con `import type`. `SymptomLogEntry` definido en Task 3 types.ts, importado en Task 5 store y Task 6 componente. `computeAvgSymptoms` definido en Task 2, importado en Task 5 y Task 7. Consistente.

**No placeholders:** Ninguno. Todo el código de cada step está completo.
