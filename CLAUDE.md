# MediTrack — Contexto del Proyecto

## Qué es

SPA personal de registro farmacológico diario. Local-only (localStorage). Sin backend.  
Dev server: `serve.bat` (doble click) → abre `http://localhost:5173`.

## Stack

React 19 + TypeScript strict + Vite 8 + Zustand 5 + Zod 4 + Tailwind v4

## Estructura de archivos

```
meditrack/
├── serve.bat                            ← arrancar dev server
├── melatol-import.json                  ← JSON importable para Melatol 3mg
├── ghkcu-import.json                    ← JSON importable para GHK-Cu
├── src/
│   ├── App.tsx                          ← shell + bottom nav (Hoy / Botiquín / Historial / Config)
│   ├── schema/
│   │   ├── types.ts                     ← TODOS los tipos TypeScript (solo export type)
│   │   └── zod-schemas.ts               ← validators Zod runtime
│   ├── storage/
│   │   ├── checksum.ts                  ← FNV-1a hash
│   │   ├── migrations.ts                ← createFreshSchema(), migrate()
│   │   └── persistence.ts               ← read() / write() canónico con Zod + checksum
│   ├── store/
│   │   └── index.ts                     ← Zustand store
│   ├── hooks/
│   │   ├── useToday.ts                  ← lógica de la vista Hoy, acepta fecha opcional
│   │   └── useStorageHealth.ts          ← monitoreo integridad storage
│   ├── utils/
│   │   ├── id.ts                        ← generateId() = crypto.randomUUID()
│   │   ├── date.ts                      ← getLocalDateStr(), getLocalHHMM(), formatTimestamp()
│   │   ├── schedule.ts                  ← isScheduledToday(), calcNextDue(), isAlertActive()
│   │   ├── github.ts                    ← push/pull/test GitHub, encToken/decToken
│   │   └── importCabinet.ts             ← dedup-import de suplementos desde JSON
│   └── components/
│       ├── shared/DoseInput.tsx         ← botones +/− + quickpicks ¼ ½ 1 2 3 4
│       ├── shared/Modal.tsx             ← overlay con Escape to close
│       ├── today/TodayView.tsx          ← píldoras pendientes + buscador + navegación de fechas
│       ├── cabinet/CabinetView.tsx      ← botiquín con dashboard KPI + búsqueda
│       ├── cabinet/SupplementCard.tsx   ← card expandible, soporta modo selección
│       ├── cabinet/SupplementForm.tsx   ← modal crear/editar suplemento
│       ├── cabinet/BulkScheduleModal.tsx ← programación bulk de múltiples suplementos
│       ├── history/HistoryView.tsx      ← navegación ← → por día
│       ├── history/DayTimeline.tsx      ← timeline cronológico, badge "eliminado" si el suplemento fue borrado
│       ├── history/MetabolicSummary.tsx ← suma de ingredientes activos del día
│       └── settings/SettingsView.tsx    ← backup local, GitHub sync, danger zone reset
```

## CRÍTICO: import type

**Todos los imports de `schema/types.ts` deben ser `import type`**, no `import`.  
Vite 8 sirve native ESM — los `export type` no existen en runtime.

```ts
// ✅ correcto
import type { Supplement, LogEntry } from '../schema/types'

// ❌ rompe la app en browser
import { Supplement, LogEntry } from '../schema/types'
```

Lo mismo para `TimingGroup` de `hooks/useToday.ts`.

## Modelo de datos — Supplement

```ts
type Supplement = {
  id: string                    // UUID, auto-generado
  name: string                  // "NOW Mega D3 & MK-7"
  brand?: string                // "NOW Foods"
  category: 'supplement' | 'medication' | 'vitamin' | 'mineral' | 'hormone' | 'adaptogen' | 'herb' | 'other'
  description: string
  form: string                  // "cápsulas vegetarianas", "ampolla"
  presentation?: string         // "frasco 60 cáps"
  activeIngredients: {
    name: string                // "Vitamina D3"
    form: string                // "Colecalciferol"
    amount: number              // CRÍTICO: cantidad por 1 unidad de doseUnit (ver nota abajo)
    unit: 'IU' | 'mcg' | 'mg' | 'ml' | 'g' | 'caps' | 'custom'
    source?: string             // "lanolina"
    brand?: string              // "MenaQ7®"
  }[]
  excipients?: string
  benefits?: string
  instructions: string
  warnings?: string
  certifications: string[]
  schedule:
    | { kind: 'fixed_interval'; intervalDays: number; alertDaysBefore: number }
    | { kind: 'weekdays'; days: number[] }   // 0=Lun, 6=Dom
    | { kind: 'as_needed' }
  defaultDose: number           // cantidad típica por toma (ej: 4 cáps, 0.1 ml)
  doseUnit: string              // "cáps", "ml", "comp."
  doseStep: number              // paso del +/− (1 para caps, 0.05 para ml)
  timing: 'morning' | 'midday' | 'afternoon' | 'evening' | 'night' | null
  nextDue?: string              // ISO8601, solo para fixed_interval
  active: boolean               // false = soft deleted (nunca se borra del store)
  inStock?: boolean             // undefined/true = con stock; false = se oculta en Hoy
  createdAt: string
  updatedAt: string
  version: number
}
```

### CRÍTICO: `activeIngredients.amount` es por 1 unidad de `doseUnit`

`MetabolicSummary` calcula `ing.amount × entry.quantity`. Por lo tanto:

- Si `doseUnit = "cáps"` → `ing.amount` = mg/IU/etc. por 1 cápsula
- Si `doseUnit = "ml"` → `ing.amount` = mg/etc. por 1 ml

**Ejemplo GHK-Cu**: vial 50 mg en 3 ml → `ing.amount = 16.667` (mg/ml), no 50.  
Si se pone 50 y el usuario loguea 0.1 ml → 50 × 0.1 = 5 mg (INCORRECTO).  
Correcto: 16.667 × 0.1 = 1.67 mg.

## Store API

```ts
import { useStore } from './store'

// Agregar suplemento (omite id, createdAt, updatedAt, version, active — se generan solos)
useStore.getState().addSupplement({ name, brand, category, ... })

// Actualizar (cualquier campo parcial)
useStore.getState().updateSupplement(id, { schedule, timing, ... })

// Soft delete — NO borra del store, solo active: false. Historial queda intacto.
useStore.getState().deactivateSupplement(id)

// Toggle stock (inStock: false oculta el suplemento en Hoy)
useStore.getState().setInStock(id, false)

// Registrar toma (timestamp = ahora si no se pasa)
useStore.getState().addLogEntry(supplementId, quantity, optionalISOTimestamp)

// Editar timestamp de una entrada (no funciona en días sellados)
useStore.getState().editLogTimestamp(dateStr, entryId, newISOTimestamp)

// Eliminar una entrada de log
useStore.getState().removeLogEntry(dateStr, entryId)

// Sellar días pasados + detectar omisiones (se llama en init)
useStore.getState().sealPastDays()
```

## Persistencia y checksums

`write()` en `persistence.ts` corre el schema por Zod antes de computar el checksum,
garantizando orden canónico de claves. `init()` en el store siempre reescribe al arrancar
para reparar datos viejos con orden no-canónico.

El token de GitHub se guarda en `localStorage['meditrack_gh']` (separado del store, con btoa obfuscado).
**Nunca** incluir `meditrack_gh` en backups ni en el store principal.

## GitHub Sync

`src/utils/github.ts` — sube/baja `meditrack-full.json` a un repo privado GitHub.
- `ghPush(cfg, data)` → GET sha + PUT con base64
- `ghPull(cfg)` → GET + decode base64
- `ghTest(cfg)` → GET /repos/{owner}/{repo}
- Si el repo no existe en el primer push → `ensureRepo()` lo crea como privado

**CRÍTICO**: `ghFetch` llama directo a `api.github.com`. No usar proxies de terceros (ej: allorigins.win) ya que el PAT se enviaría a un servidor externo.

## Cómo agregar suplementos

### Opción A — UI
Botiquín → "+ Nuevo" → completar formulario.

### Opción B — Import JSON
Crear un JSON con formato `CabinetExport` (ver `src/schema/zod-schemas.ts`):
```json
{
  "version": 1,
  "exportedAt": "2026-06-18T00:00:00.000Z",
  "supplements": [{ ...campos completos del Supplement... }]
}
```
Botiquín → Editar → Importar → seleccionar archivo.  
La dedup es por `name|brand` considerando solo suplementos activos (los soft-deleted no bloquean reimport).

## Historial — invariantes de integridad

- Cada `LogEntry` guarda `supplementSnapshot` con nombre, doseUnit, categoría e ingredientes activos al momento del registro.
- `DayTimeline` y `MetabolicSummary` leen **solo el snapshot**, nunca hacen lookup al store.
- Eliminar un suplemento del Botiquín **no afecta** los `dailyLogs`. Las entradas históricas muestran badge "eliminado" en gris si el suplemento fue soft-deleted.
- `sealPastDays` detecta omisiones (weekday supplements no logueados) y los agrega a `DailyLog.skipped[]`.

## Notas clínicas del usuario

Ver `C:\Users\JET\Desktop\SALUD\CLAUDE.md` para contexto médico completo.
