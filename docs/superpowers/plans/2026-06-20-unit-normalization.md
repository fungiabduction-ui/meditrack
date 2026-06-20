# Unit Normalization System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir dos bugs críticos: (1) quickpicks de DoseInput que ignoran la escala de la dosis, y (2) MetabolicSummary que muestra valores absurdos para suplementos con doseUnit en unidades de masa.

**Architecture:** Nueva utilidad `calcIngAmount` centraliza la lógica de cálculo de ingredientes activos. DoseInput recibe `defaultDose` y genera quickpicks proporcionales. Una migration v2→v3 limpia los datos incorrectos en el store. Los snapshots históricos no se tocan — `calcIngAmount` maneja tanto datos viejos como nuevos.

**Tech Stack:** React 19, TypeScript strict, Zustand 5, Vite 8. Sin test framework — la verificación es TypeScript (`npx tsc --noEmit`) + inspección visual del dev server.

---

## Archivos

| Archivo | Acción |
|---|---|
| `src/utils/units.ts` | CREAR |
| `src/storage/migrations.ts` | MODIFICAR — bump a v3, agregar migration |
| `src/components/history/MetabolicSummary.tsx` | MODIFICAR — usar `calcIngAmount` |
| `src/components/shared/DoseInput.tsx` | MODIFICAR — prop `defaultDose`, quickpicks dinámicos |
| `src/components/today/TodayView.tsx` | MODIFICAR — pasar `defaultDose` a DoseInput |

---

## Task 1: Crear `src/utils/units.ts`

**Files:**
- Create: `src/utils/units.ts`

- [ ] **Step 1: Crear el archivo**

```ts
export const MASS_UNITS = new Set<string>(['mg', 'g', 'mcg'])

/**
 * Calcula la cantidad total de un ingrediente activo para un log entry.
 *
 * Si el ingrediente se mide en la misma unidad de masa que el doseUnit,
 * el ingrediente ES la dosis — quantity es el total directo.
 * En todos los demás casos se aplica amount × quantity.
 */
export function calcIngAmount(
  ingAmount: number,
  ingUnit: string,
  doseUnit: string,
  quantity: number
): number {
  if (MASS_UNITS.has(ingUnit) && ingUnit === doseUnit) return quantity
  return ingAmount * quantity
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/utils/units.ts
git commit -m "feat: add calcIngAmount and MASS_UNITS to utils/units"
```

---

## Task 2: Migration v2 → v3 en `migrations.ts`

Corrige `activeIngredients.amount` en el store de suplementos para los casos donde `doseUnit` es una unidad de masa y `ing.unit === doseUnit` — esos valores deben ser `1`.

**Files:**
- Modify: `src/storage/migrations.ts`

- [ ] **Step 1: Leer el archivo actual**

Abrir `src/storage/migrations.ts`. La constante actual es `CURRENT_VERSION = 2`.

- [ ] **Step 2: Agregar la migration**

Reemplazar el contenido completo del archivo:

```ts
import type { StorageSchema } from '../schema/types'
import { computeChecksum } from './checksum'

export const CURRENT_VERSION = 3

const MASS_UNITS = new Set(['mg', 'g', 'mcg'])

export function createFreshSchema(): StorageSchema {
  const now = new Date().toISOString()
  const schema: StorageSchema = {
    _version: CURRENT_VERSION,
    _createdAt: now,
    _updatedAt: now,
    _checksum: '',
    supplements: {},
    dailyLogs: {},
    migrations: [],
    bloodWork: [],
  }
  schema._checksum = computeChecksum({ supplements: schema.supplements, dailyLogs: schema.dailyLogs })
  return schema
}

export function migrate(version: number, data: unknown): StorageSchema {
  if (version === CURRENT_VERSION) return data as StorageSchema

  if (version === 0) {
    const raw = data as Record<string, unknown>
    const migrated = createFreshSchema()
    migrated.migrations = [{ from: 0, to: 1, appliedAt: new Date().toISOString() }]
    if (raw.supplements && typeof raw.supplements === 'object') {
      migrated.supplements = raw.supplements as StorageSchema['supplements']
    }
    migrated._checksum = computeChecksum({ supplements: migrated.supplements, dailyLogs: migrated.dailyLogs })
    return migrate(1, migrated)
  }

  if (version === 1) {
    const raw = data as Omit<StorageSchema, 'bloodWork'>
    const migrated: StorageSchema = {
      ...raw,
      _version: 2,
      bloodWork: [],
      migrations: [
        ...(raw.migrations ?? []),
        { from: 1, to: 2, appliedAt: new Date().toISOString() },
      ],
    }
    return migrate(2, migrated)
  }

  if (version === 2) {
    const raw = data as StorageSchema
    const now = new Date().toISOString()

    // Corregir activeIngredients.amount donde doseUnit es unidad de masa
    // y el ingrediente se mide en la misma unidad. En ese caso amount debe ser 1.
    const supplements = Object.fromEntries(
      Object.entries(raw.supplements).map(([id, supp]) => {
        const needsFix = supp.activeIngredients.some(
          ing => MASS_UNITS.has(ing.unit) && ing.unit === supp.doseUnit && ing.amount !== 1
        )
        if (!needsFix) return [id, supp]

        return [id, {
          ...supp,
          activeIngredients: supp.activeIngredients.map(ing => {
            if (MASS_UNITS.has(ing.unit) && ing.unit === supp.doseUnit && ing.amount !== 1) {
              return { ...ing, amount: 1 }
            }
            return ing
          }),
          updatedAt: now,
          version: supp.version + 1,
        }]
      })
    )

    const migrated: StorageSchema = {
      ...raw,
      supplements,
      _version: 3,
      migrations: [
        ...(raw.migrations ?? []),
        { from: 2, to: 3, appliedAt: now },
      ],
    }
    migrated._checksum = computeChecksum({ supplements: migrated.supplements, dailyLogs: migrated.dailyLogs })
    return migrated
  }

  throw new Error(`Unknown schema version: ${version}`)
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 4: Verificar en el browser que la migración corre**

Arrancar el dev server (`serve.bat`), abrir DevTools → Application → Local Storage → `meditrack`.
El campo `_version` debe mostrar `3`.
En el Botiquín, abrir HMB: `activeIngredients[0].amount` debe ser `1` (era `1000`).

- [ ] **Step 5: Commit**

```bash
git add src/storage/migrations.ts
git commit -m "feat: migration v2->v3 normalizes activeIngredients.amount for mass-unit supplements"
```

---

## Task 3: Actualizar `MetabolicSummary.tsx`

**Files:**
- Modify: `src/components/history/MetabolicSummary.tsx`

- [ ] **Step 1: Reemplazar el cálculo de totales**

El archivo actual tiene este loop:

```ts
for (const entry of entries) {
  for (const ing of entry.supplementSnapshot.activeIngredients) {
    const key = `${ing.name}__${ing.unit}`
    const prev = totals.get(key)
    totals.set(key, {
      amount: (prev?.amount ?? 0) + ing.amount * entry.quantity,
      unit: ing.unit,
    })
  }
}
```

Reemplazarlo por:

```ts
import { calcIngAmount } from '../../utils/units'

// ... dentro del componente:
for (const entry of entries) {
  for (const ing of entry.supplementSnapshot.activeIngredients) {
    const key = `${ing.name}__${ing.unit}`
    const prev = totals.get(key)
    totals.set(key, {
      amount: (prev?.amount ?? 0) + calcIngAmount(ing.amount, ing.unit, entry.doseUnit, entry.quantity),
      unit: ing.unit,
    })
  }
}
```

El archivo completo resultante debe ser:

```tsx
import type { LogEntry } from '../../schema/types'
import { calcIngAmount } from '../../utils/units'

type Props = { entries: LogEntry[] }

export function MetabolicSummary({ entries }: Props) {
  const totals = new Map<string, { amount: number; unit: string }>()

  for (const entry of entries) {
    for (const ing of entry.supplementSnapshot.activeIngredients) {
      const key = `${ing.name}__${ing.unit}`
      const prev = totals.get(key)
      totals.set(key, {
        amount: (prev?.amount ?? 0) + calcIngAmount(ing.amount, ing.unit, entry.doseUnit, entry.quantity),
        unit: ing.unit,
      })
    }
  }

  if (totals.size === 0) return null

  return (
    <div className="bg-slate-800 rounded-xl px-4 py-3 border-l-2 border-violet-500">
      <p className="text-violet-400 text-xs uppercase tracking-wide mb-3">Resumen metabólico del día</p>
      <div className="space-y-1.5">
        {[...totals.entries()].map(([key, { amount, unit }]) => {
          const name = key.split('__')[0]
          return (
            <div key={key} className="flex justify-between text-sm">
              <span className="text-slate-400">{name}</span>
              <span className="text-white font-medium">{parseFloat(amount.toFixed(3))} {unit}</span>
            </div>
          )
        })}
      </div>
      <p className="text-slate-600 text-xs mt-3">Base para sistema metabólico futuro</p>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/history/MetabolicSummary.tsx
git commit -m "fix: MetabolicSummary uses calcIngAmount — fixes 1000x overflow for mass-unit supplements"
```

---

## Task 4: Actualizar `DoseInput.tsx` — quickpicks dinámicos

**Files:**
- Modify: `src/components/shared/DoseInput.tsx`

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
const FRACTION_LABELS: Record<number, string> = { 0.25: '¼', 0.5: '½' }

type Props = {
  value: number
  unit: string
  step: number
  defaultDose: number
  min?: number
  onChange: (v: number) => void
}

function buildQuickpicks(defaultDose: number, min: number): number[] {
  return [0.25, 0.5, 1, 2, 3, 4]
    .map(m => parseFloat((defaultDose * m).toFixed(6)))
    .filter(v => v >= min)
    .filter((v, i, a) => a.indexOf(v) === i)
}

export function DoseInput({ value, unit, step, defaultDose, min = 0, onChange }: Props) {
  const dec = () => onChange(Math.max(min, parseFloat((value - step).toFixed(6))))
  const inc = () => onChange(parseFloat((value + step).toFixed(6)))

  const quickpicks = buildQuickpicks(defaultDose, min)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 bg-slate-700 rounded-xl p-2">
        <button
          onClick={dec}
          className="w-10 h-10 bg-slate-600 hover:bg-slate-500 rounded-lg text-white text-xl font-bold flex items-center justify-center transition-colors"
        >
          −
        </button>
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          onChange={e => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v) && v >= min) onChange(v)
          }}
          className="flex-1 bg-transparent text-center text-sky-400 text-2xl font-bold outline-none w-20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-slate-400 text-sm min-w-[2rem]">{unit}</span>
        <button
          onClick={inc}
          className="w-10 h-10 bg-slate-600 hover:bg-slate-500 rounded-lg text-white text-xl font-bold flex items-center justify-center transition-colors"
        >
          +
        </button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {quickpicks.map(qp => (
          <button
            key={qp}
            onClick={() => onChange(qp)}
            className={`flex-1 min-w-[2.5rem] py-1.5 rounded-lg text-sm font-semibold transition-colors border ${
              value === qp
                ? 'bg-sky-600 border-sky-500 text-white'
                : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-400'
            }`}
          >
            {FRACTION_LABELS[qp] ?? qp}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: error porque `TodayView.tsx` no pasa `defaultDose` todavía. El mensaje será algo como:
```
Property 'defaultDose' is missing in type '{ value: number; unit: string; step: number; ... }'
```
Esto es esperado — lo arreglamos en Task 5.

- [ ] **Step 3: Commit parcial del archivo**

```bash
git add src/components/shared/DoseInput.tsx
git commit -m "feat: DoseInput accepts defaultDose prop, quickpicks are proportional multiples"
```

---

## Task 5: Actualizar `TodayView.tsx` — pasar `defaultDose`

**Files:**
- Modify: `src/components/today/TodayView.tsx:359-365`

- [ ] **Step 1: Agregar la prop `defaultDose` al uso de DoseInput**

Buscar en `TodayView.tsx` el bloque:

```tsx
<DoseInput
  value={logModal.qty}
  unit={logModal.supplement.doseUnit}
  step={logModal.supplement.doseStep}
  min={logModal.supplement.doseStep}
  onChange={qty => setLogModal(m => m ? { ...m, qty } : null)}
/>
```

Reemplazarlo por:

```tsx
<DoseInput
  value={logModal.qty}
  unit={logModal.supplement.doseUnit}
  step={logModal.supplement.doseStep}
  defaultDose={logModal.supplement.defaultDose}
  min={logModal.supplement.doseStep}
  onChange={qty => setLogModal(m => m ? { ...m, qty } : null)}
/>
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 3: Verificar en el browser**

Arrancar dev server (`serve.bat`). Abrir Hoy → buscar "NMN" → click para loguear.
Los quickpicks deben mostrar: `125`, `500`, `1000`, `1500`, `2000` (los que pasen el filtro `>= min=250`).
Resultado esperado: `[250, 500, 1000, 1500, 2000]`.

Verificar también con GHK-Cu (default=0.1): quickpicks deben ser `[0.05, 0.1, 0.2, 0.3, 0.4]`.
Verificar con Ashwagandha (default=1, step=1): quickpicks deben ser `[1, 2, 3, 4]`.

- [ ] **Step 4: Commit**

```bash
git add src/components/today/TodayView.tsx
git commit -m "fix: pass defaultDose to DoseInput in TodayView log modal"
```

---

## Self-Review

### Spec coverage

| Requisito en spec | Task |
|---|---|
| `src/utils/units.ts` con `MASS_UNITS` y `calcIngAmount` | Task 1 |
| `calcIngAmount`: mass-unit case retorna `quantity` directo | Task 1 |
| `calcIngAmount`: caso normal retorna `amount × quantity` | Task 1 |
| Migration v2→v3 corrige `amount=1` para mass-unit supplements | Task 2 |
| `MetabolicSummary` usa `calcIngAmount` | Task 3 |
| `DoseInput` acepta `defaultDose`, quickpicks proporcionales | Task 4 |
| Quickpicks respetan `min` | Task 4 (`buildQuickpicks` filtra por `min`) |
| `TodayView` pasa `defaultDose` | Task 5 |

### Placeholder scan

Ningún TBD, TODO, ni paso sin código. ✓

### Type consistency

- `calcIngAmount(ingAmount, ingUnit, doseUnit, quantity)` — definido en Task 1, usado en Task 3 con los argumentos correctos: `(ing.amount, ing.unit, entry.doseUnit, entry.quantity)`. ✓
- `DoseInput` Props: `defaultDose: number` — definido en Task 4, pasado en Task 5 como `logModal.supplement.defaultDose` (tipo `number` en `Supplement`). ✓
- Migration: accede a `supp.doseUnit` y `ing.unit` que existen en `Supplement` y `ActiveIngredient`. ✓
