# MediTrack v2 — Analytics & Mejoras — Spec de Diseño

**Fecha:** 2026-06-18  
**Estado:** Aprobado por usuario  
**Contexto previo:** [2026-06-18-meditrack-v2-design.md](2026-06-18-meditrack-v2-design.md) (sprint anterior ya implementado)

---

## Contexto

MediTrack es una SPA local (React 19 + Zustand + Zod + Tailwind v4) de registro farmacológico personal. El usuario está en protocolo TRT (enantato cada 14 días) y sigue suplementación activa. Un endocrinólogo recomendó:

1. Registrar síntomas diarios → ya existe (`DailySymptoms.tsx`, integrado en `TodayView`)
2. Ver historial con calendario visual para exportar rangos personalizados
3. Mostrar marca/laboratorio en el historial de tomas
4. Análisis de correlaciones y laboratorio de sangre

Este spec cubre todo lo que falta implementar.

---

## Scope

**Sprint 1 (mejoras a vistas existentes):**
- Brand/lab en historial de tomas
- Calendario de rangos para export
- Score de bienestar diario compuesto

**Sprint 2 (nueva pestaña Análisis):**
- Tab Análisis con dos sub-secciones: Síntomas & Protocolo + Laboratorio
- Motor de correlación suplementos ↔ síntomas
- Heatmap ciclo TRT 14 días
- Registro de analíticas de sangre

Los dos sprints son independientes. Sprint 2 usa `utils/wellbeing.ts` creado en Sprint 1.

---

## Sprint 1: Mejoras a vistas existentes

### 1.1 Brand/lab en Historial

**Problema:** `DayTimeline` muestra solo `supplementSnapshot.name`. La marca no está capturada en el snapshot.

**Cambio en `schema/types.ts`:**
```ts
export type SupplementSnapshot = {
  name: string
  brand?: string          // NUEVO
  doseUnit: string
  category: SupplementCategory
  activeIngredients: ActiveIngredient[]
  version: number
}
```

**Cambio en `store/index.ts` — `addLogEntry`:**
```ts
supplementSnapshot: {
  name: s.name,
  brand: s.brand,         // NUEVO
  doseUnit: s.doseUnit,
  category: s.category,
  activeIngredients: s.activeIngredients,
  version: s.version,
},
```

**Cambio en `components/history/DayTimeline.tsx`:**
Debajo del nombre del suplemento, mostrar la marca si existe:
```tsx
<p className="text-white text-sm font-medium">{e.supplementSnapshot.name}</p>
{e.supplementSnapshot.brand && (
  <p className="text-slate-500 text-xs">{e.supplementSnapshot.brand}</p>
)}
```

**Backward compat:** Entradas históricas sin `brand` en el snapshot simplemente no muestran segunda línea. Campo opcional, sin migración necesaria.

---

### 1.2 Calendario de rangos para export

**Problema:** Los botones "Hoy / 7 días / 30 días" son rangos fijos y arbitrarios. El usuario quiere ver qué días tienen datos y elegir el rango a exportar.

**Nuevo componente:** `src/components/history/CalendarRangePicker.tsx`

```ts
type Props = {
  dailyLogs: Record<string, DailyLog>
  rangeFrom: string | null
  rangeTo: string | null
  onRangeChange: (from: string, to: string) => void
  onRangeClear: () => void
}
```

Comportamiento:
- Muestra mes actual, navegable con ‹ ›
- Días con `dailyLogs[date]?.entries.length > 0`: punto azul cielo bajo el número del día
- Días con `dailyLogs[date]?.symptoms`: punto violeta bajo el número
- Primer click: `rangeFrom = date` (se resalta en violeta sólido)
- Segundo click en fecha ≥ rangeFrom: `rangeTo = date`, rango confirmado (fondo violeta translúcido entre los dos extremos)
- Click en día con rango ya activo: resetea la selección
- No permite seleccionar fechas futuras

**Cambio en `utils/export.ts`:**

Modificar `buildAnalysisExport` para aceptar `from`/`to` directamente:
```ts
export function buildAnalysisExport(
  schema: StorageSchema,
  from: string,
  to: string
): AnalysisExport
```
Eliminar: parámetros `range: ExportRange` y `referenceDate`, función `getRangeDates`, tipo exportado `ExportRange`. No hay otros callers fuera de `HistoryView.tsx` que se modifica en este mismo sprint.

Agregar función de conveniencia:
```ts
export function downloadAnalysisJsonRange(
  schema: StorageSchema,
  from: string,
  to: string
): void
```

**Cambio en `HistoryView.tsx`:**
- Eliminar estado `exportRange: ExportRange` y los tres botones
- Agregar estado `rangeFrom: string | null` y `rangeTo: string | null`
- Integrar `CalendarRangePicker` debajo del nav de fechas del día
- Botón "Exportar JSON" visible solo cuando `rangeFrom && rangeTo`, llama `downloadAnalysisJsonRange(read(), rangeFrom, rangeTo)`
- El nav ‹ › de día sigue funcionando independientemente del rango de export

---

### 1.3 Score de bienestar diario compuesto

**Nuevo archivo:** `src/utils/wellbeing.ts`

```ts
import type { DailySymptoms } from '../schema/types'

const WEIGHTS = { energy: 25, sleep: 25, mood: 20, recovery: 15, libido: 15 } as const

// Retorna entero 0-100.
// all 5s → 100 | all 3s → 60 | all 1s → 20
export function computeWellbeingScore(s: DailySymptoms): number {
  return Math.round(
    (s.energy * 25 + s.sleep * 25 + s.mood * 20 + s.recovery * 15 + s.libido * 15) / 5
  )
}
```

`erectionQuality`, `nippleSensitivity`, `orgasms` se excluyen del score: son KPIs de monitoring TRT, no de bienestar general.

**Display en `DailySymptoms.tsx`:**
Cuando `saved !== null`, mostrar el score como badge en el header del widget:
```tsx
<div className="flex items-center justify-between">
  <p className="text-slate-500 text-xs uppercase tracking-widest">Síntomas del día</p>
  {saved && (
    <span className="text-xs font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
      {computeWellbeingScore(saved)}/100
    </span>
  )}
</div>
```
Badge visible tanto en modo edición (hoy) como en modo lectura (días pasados).

**Display en `DayTimeline.tsx`:**
Si `log.symptoms` existe, agregar el score a la fila de stats:
```tsx
{log.symptoms && (
  <span className="bg-violet-500/20 text-violet-400 text-xs px-2 py-1 rounded-full">
    ⚡ {computeWellbeingScore(log.symptoms)}/100
  </span>
)}
```

---

## Sprint 2: Tab "Análisis" (5ta pestaña)

### 2.1 Navegación

**`App.tsx`:** Agregar tab `'analysis'` entre `'history'` y `'settings'`. Ícono: SVG de gráfico de barras (inline, sin emoji). Importar `AnalysisView` con import normal (no lazy — la app es pequeña).

### 2.2 Schema — BloodWork

**Nuevos tipos en `schema/types.ts`:**

```ts
export type BloodMarker =
  | 'tTotal'        // Testosterona Total — ng/dL
  | 'tLibre'        // Testosterona Libre — pg/mL
  | 'e2'            // Estradiol E2 — pg/mL
  | 'shbg'          // SHBG — nmol/L
  | 'lh'            // LH — mIU/mL
  | 'fsh'           // FSH — mIU/mL
  | 'hematocrito'   // Hematocrito — %
  | 'psa'           // PSA — ng/mL
  | 'prolactina'    // Prolactina — ng/mL

export const BLOOD_MARKER_META: Record<BloodMarker, { label: string; unit: string; refMin?: number; refMax?: number }> = {
  tTotal:      { label: 'Testosterona Total', unit: 'ng/dL',  refMin: 300, refMax: 1000 },
  tLibre:      { label: 'Testosterona Libre', unit: 'pg/mL' },
  e2:          { label: 'Estradiol (E2)',      unit: 'pg/mL', refMin: 10,  refMax: 40 },
  shbg:        { label: 'SHBG',               unit: 'nmol/L' },
  lh:          { label: 'LH',                 unit: 'mIU/mL' },
  fsh:         { label: 'FSH',                unit: 'mIU/mL' },
  hematocrito: { label: 'Hematocrito',        unit: '%',     refMin: 38,  refMax: 50 },
  psa:         { label: 'PSA',                unit: 'ng/mL', refMax: 4 },
  prolactina:  { label: 'Prolactina',         unit: 'ng/mL', refMax: 20 },
}

export type BloodWorkEntry = {
  id: string
  date: string                                    // YYYY-MM-DD (fecha de extracción)
  values: Partial<Record<BloodMarker, number>>    // solo marcadores ingresados
  notes?: string
  createdAt: string
}
```

**CRÍTICO:** `BLOOD_MARKER_META` es una constante de valor (no solo tipo), así que se importa con `import` normal, NO con `import type`. Todos los tipos sí usan `import type`.

**`StorageSchema` en `schema/types.ts`:**
```ts
export type StorageSchema = {
  _version: number
  _createdAt: string
  _updatedAt: string
  _checksum: string
  supplements: Record<string, Supplement>
  dailyLogs: Record<string, DailyLog>
  migrations: MigrationRecord[]
  bloodWork: BloodWorkEntry[]    // NUEVO — default []
}
```

### 2.3 Zod schemas (`schema/zod-schemas.ts`)

Agregar validators:
```ts
const zBloodMarker = z.enum([
  'tTotal', 'tLibre', 'e2', 'shbg', 'lh', 'fsh', 'hematocrito', 'psa', 'prolactina'
])

const zBloodWorkEntry = z.object({
  id: z.string(),
  date: z.string(),
  values: z.record(zBloodMarker, z.number()).partial(),
  notes: z.string().optional(),
  createdAt: z.string(),
})
```

Actualizar `zStorageSchema` para incluir:
```ts
bloodWork: z.array(zBloodWorkEntry).default([]),
```

### 2.4 Migración (`storage/migrations.ts`)

En `createFreshSchema()`, incluir `bloodWork: []`.

En `migrate()`, agregar migración que agrega `bloodWork: []` a schemas existentes sin ese campo. Incrementar `CURRENT_VERSION` en 1.

### 2.5 Store (`store/index.ts`)

Tipo `Store` — nuevas acciones:
```ts
addBloodWork: (data: Omit<BloodWorkEntry, 'id' | 'createdAt'>) => void
updateBloodWork: (id: string, partial: Partial<Omit<BloodWorkEntry, 'id' | 'createdAt'>>) => void
removeBloodWork: (id: string) => void
```

El `init()` ya lee desde `read()` que incluye `bloodWork` via Zod. Exponer `bloodWork` en el estado del store:
```ts
type Store = {
  // ... existente ...
  bloodWork: BloodWorkEntry[]
  // ... nuevas acciones ...
}
```

`commitWrite` actualiza `bloodWork` junto con `supplements` y `dailyLogs`.

### 2.6 Utils de análisis (`src/utils/analysis.ts`)

```ts
import type { DailyLog, Supplement } from '../schema/types'
import { computeWellbeingScore } from './wellbeing'

// Tendencia del score en los últimos N días (solo días con síntomas)
export function computeWellbeingTrend(
  dailyLogs: Record<string, DailyLog>,
  days = 30
): Array<{ date: string; score: number }>

// Score promedio por día del ciclo (0-13)
// Usa la última inyección de enantato (supplementId hardcodeado igual que export.ts)
export function computeTRTCycleData(
  dailyLogs: Record<string, DailyLog>
): Array<{ dayInCycle: number; avgScore: number; count: number }>

// Top suplementos por diferencia de score
// Requisito mínimo: 7 días con síntomas en total, 3 días por suplemento
// Si datos insuficientes, devuelve []
export function computeSupplementCorrelations(
  dailyLogs: Record<string, DailyLog>,
  supplements: Record<string, Supplement>
): Array<{
  supplementId: string
  name: string
  brand?: string
  avgScoreWith: number
  avgScoreWithout: number
  delta: number          // avgScoreWith - avgScoreWithout
  daysLogged: number
}>
```

`computeTRTCycleData` reutiliza la constante `ENANTHATE_ID` de `export.ts` — moverla a un módulo compartido o duplicarla localmente (preferir duplicar para evitar acoplar utils).

### 2.7 Componentes de Análisis

**Estructura:**
```
src/components/analysis/
  AnalysisView.tsx         — shell con sub-tabs "Síntomas" | "Laboratorio"
  WellbeingTrend.tsx       — gráfico SVG inline de tendencia 30 días
  TRTCycleHeatmap.tsx      — grid 14 celdas con intensidad de color
  SupplementCorrelation.tsx — lista top 5 sups por delta
  LaboratorioView.tsx      — lista de análisis de sangre + botón nuevo
  BloodWorkForm.tsx        — modal de entrada de resultados
```

**AnalysisView:** Sub-tabs en la parte superior. Estado local `activeSubTab: 'symptoms' | 'lab'`. Sin persistencia de sub-tab — siempre inicia en 'symptoms'.

**WellbeingTrend:**
- SVG 100% ancho, 80px alto
- Eje X implícito: 30 días. Eje Y implícito: 0-100.
- Polilínea violeta conectando puntos de días con síntomas
- Puntos circulares (r=3) en cada día con datos
- Sin ejes formales. Texto del score mín y máx al costado izquierdo.
- Si menos de 3 días con datos: mensaje "Necesitás más datos para ver tendencias"

**TRTCycleHeatmap:**
- Grid 7+7 celdas (dos filas de 7, días 0-6 y 7-13)
- Cada celda: número del día, color de fondo según `avgScore`:
  - Sin datos: `bg-slate-800` sin color
  - Datos: escala violeta por intensidad (score < 40: opacidad 20%, score 40-60: 40%, score 60-80: 60%, score > 80: 80%)
- Tooltip on hover: "Día N del ciclo · avg X · Y registros"
- Si no hay datos de enantato: mensaje "No se detectó inyección de enantato en el historial"

**SupplementCorrelation:**
- Ordenada por `delta` descendente, máximo 5 ítems
- Cada fila: nombre + marca, barras de "con" vs "sin", delta en verde si positivo / rojo si negativo
- Si `delta === 0` o datos insuficientes: no mostrar ese suplemento
- Si array vacío: "Necesitás al menos 7 días con síntomas y 3 tomas de cada suplemento para ver correlaciones"

**LaboratorioView:**
- Lista de `bloodWork` ordenada por `date` desc
- Cada entry: card con fecha, luego los valores ingresados con su unidad y semáforo de color (verde/amarillo/rojo según refMin/refMax)
- Si el marcador no tiene refMin/refMax: no mostrar semáforo
- Trend arrow (↑ ↓ →) comparando con la entry anterior más reciente
- Botón "+ Nuevo análisis" (abre BloodWorkForm modal)
- Botón de editar / eliminar por entry
- Si lista vacía: placeholder "Agregá tus análisis de sangre para trackear tu evolución"

**BloodWorkForm:**
- Usa el componente `Modal` existente
- Campo de fecha (input type="date", default a hoy)
- Para cada `BloodMarker` en orden del objeto `BLOOD_MARKER_META`: label, input number opcional, unidad fija
- Campos en dos columnas en pantallas anchas, una columna en mobile
- Textarea para notas (opcional)
- Validación: al menos un valor debe estar ingresado para habilitar "Guardar"
- En modo edición: pre-rellena valores existentes

### 2.8 Integración en export (`utils/export.ts`)

`AnalysisExport` type — agregar campo:
```ts
bloodWork: BloodWorkEntry[]
```

En `buildAnalysisExport`, incluir:
```ts
bloodWork: schema.bloodWork
  .filter(e => e.date >= from && e.date <= to)
  .sort((a, b) => a.date.localeCompare(b.date)),
```

---

## Invariantes críticas (del proyecto)

- **`import type` obligatorio** para todos los imports de `schema/types.ts` en todos los archivos nuevos y modificados. `BLOOD_MARKER_META` es la única excepción — es un valor const que se usa en runtime, se importa con `import` normal.
- Los nuevos `utils/` y `components/analysis/` deben seguir el patrón del proyecto: `import type { Foo } from '../../schema/types'`.
- El store (`write()`) nunca incluye `meditrack_gh` — el token GitHub queda en localStorage separado.
- `bloodWork` en el store se persiste igual que `supplements` y `dailyLogs`: via `commitWrite` con Zod + checksum.

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|----------|----------|-------|
| Gráficos | SVG inline puro, sin librerías | Cero dependencias. Suficiente para tendencias simples. |
| Unidades de sangre | Fijas por marcador en `BLOOD_MARKER_META` | Simplifica UI, evita errores de input del usuario. |
| Score compuesto | 5 métricas (excluye erección) | Erección es KPI TRT, no bienestar general. |
| Nav | 5ta pestaña | Suficiente contenido para justificarlo como ciudadano de 1era clase. |
| Correlación mínima | 7 días totales, 3 por sup | Evita correlaciones con n=1 que serían ruido. |
| BloodWork storage | `BloodWorkEntry[]` en StorageSchema | Consistente con patrones existentes. Array en memoria, nunca es grande. |
| Brand en snapshot | Opcional, sin migración | Backward compat automática con entradas históricas. |
| BLOOD_MARKER_META | Constante de valor (no type) | Necesaria en runtime para labels/units/refs. Import normal, no `import type`. |
| `ENANTHATE_ID` | Duplicar en analysis.ts | Evita acoplamiento entre utils. Valor estable, no cambia. |

---

## Archivos a crear (nuevos)

| Archivo | Descripción |
|---------|-------------|
| `src/utils/wellbeing.ts` | `computeWellbeingScore(symptoms)` |
| `src/utils/analysis.ts` | Funciones de correlación, tendencia, ciclo TRT |
| `src/components/history/CalendarRangePicker.tsx` | Calendario de rangos para export |
| `src/components/analysis/AnalysisView.tsx` | Shell con sub-tabs |
| `src/components/analysis/WellbeingTrend.tsx` | Gráfico SVG tendencia |
| `src/components/analysis/TRTCycleHeatmap.tsx` | Heatmap ciclo 14 días |
| `src/components/analysis/SupplementCorrelation.tsx` | Top 5 correlaciones |
| `src/components/analysis/LaboratorioView.tsx` | Lista análisis de sangre |
| `src/components/analysis/BloodWorkForm.tsx` | Modal entrada de resultados |

## Archivos a modificar (existentes)

| Archivo | Cambio |
|---------|--------|
| `src/schema/types.ts` | `SupplementSnapshot.brand?`, `BloodMarker`, `BLOOD_MARKER_META`, `BloodWorkEntry`, `StorageSchema.bloodWork` |
| `src/schema/zod-schemas.ts` | `zBloodMarker`, `zBloodWorkEntry`, `zStorageSchema` actualizado |
| `src/storage/migrations.ts` | `createFreshSchema` incluye `bloodWork: []`, nueva migración |
| `src/store/index.ts` | Snapshot captura `brand`, `bloodWork` en estado, 3 nuevas acciones |
| `src/utils/export.ts` | `buildAnalysisExport` acepta `from`/`to` directos, incluye `bloodWork` |
| `src/components/today/DailySymptoms.tsx` | Badge de score en header |
| `src/components/history/HistoryView.tsx` | Integra `CalendarRangePicker`, elimina botones fijos |
| `src/components/history/DayTimeline.tsx` | Brand bajo nombre, badge de score |
| `src/App.tsx` | 5ta pestaña "Análisis" |

---

## Orden de implementación dentro de cada sprint

**Sprint 1 (sin dependencias entre ítems, orden sugerido):**
1. `utils/wellbeing.ts` (base, sin deps)
2. `schema/types.ts` (`SupplementSnapshot.brand`)
3. `store/index.ts` (snapshot captura brand)
4. `DayTimeline.tsx` (brand display + score badge)
5. `DailySymptoms.tsx` (score badge)
6. `CalendarRangePicker.tsx` + `export.ts` (calendar + range)
7. `HistoryView.tsx` (integra calendar, elimina botones)

**Sprint 2 (orden requerido por deps):**
1. `schema/types.ts` (`BloodWorkEntry`, `BLOOD_MARKER_META`, `StorageSchema.bloodWork`)
2. `schema/zod-schemas.ts`
3. `storage/migrations.ts`
4. `store/index.ts` (acciones bloodWork, estado)
5. `utils/analysis.ts` (depende de `wellbeing.ts` del Sprint 1)
6. `BloodWorkForm.tsx` (sin deps de los otros analysis/)
7. `LaboratorioView.tsx` (usa BloodWorkForm)
8. `WellbeingTrend.tsx`, `TRTCycleHeatmap.tsx`, `SupplementCorrelation.tsx` (independientes entre sí)
9. `AnalysisView.tsx` (depende de todos los anteriores)
10. `utils/export.ts` (agrega bloodWork al export)
11. `App.tsx` (5ta pestaña)
