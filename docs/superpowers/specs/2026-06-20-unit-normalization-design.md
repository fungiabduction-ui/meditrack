---
title: Unit Normalization System
date: 2026-06-20
status: approved
---

# Unit Normalization System

## Problema

Dos invariantes violadas que se combinan para romper el registro de dosis y el resumen metabólico.

### Invariante A — Data incorrecta en `activeIngredients.amount`

El modelo establece: `amount` = ingrediente por **1 unidad de `doseUnit``.

Para `doseUnit="mg"` eso implica `amount=1` (1 mg de ingrediente por 1 mg de dosis — ratio trivial para sustancias puras). Sin embargo, algunos suplementos tienen el total de la porción guardado en `amount`:

| Suplemento | doseUnit | ing.unit | amount (actual) | amount (correcto) | Error con defaultDose |
|---|---|---|---|---|---|
| HMB | mg | mg | 1000 | 1 | 1000 × 1000 = 1,000,000 mg |
| Magnesio citrato | mg | mg | 1000 | 1 | 1000 × 1000 = 1,000,000 mg |
| Ácido Hialurónico | mg | mg | 399 | 1 | 399 × 400 = 159,600 mg |
| Colágeno hidrolizado | g | g | 10 | 1 | 10 × 10 = 100 g |

Los datos correctos (NMN `amount=1`, Shilajit `amount=1`, GHK-Cu `amount=16.667 mg/ml`) ya siguen la invariante y no se tocan.

### Invariante B — Quickpicks absolutos ignoran la escala de la dosis

`DoseInput` tiene quickpicks hardcodeados en `[0.25, 0.5, 1, 2, 3, 4]`. Son valores absolutos que solo funcionan para unidades de conteo (cáps, comp.). Para dosis en mg/g con defaultDose grande, el resultado es catastrófico:

- NMN (defaultDose=500, min=250): click en "1" registra **1 mg** en vez de 500 mg
- GHK-Cu (defaultDose=0.1, min=0.05): click en "2" registra **2 ml** en vez de 0.1 ml

Bug adicional: los quickpicks no respetan `min`, pueden setear valores por debajo del mínimo permitido.

---

## Diseño

### Capa 1 — `src/utils/units.ts` (nuevo archivo)

Fuente de verdad para constantes de unidades y lógica de cálculo.

```ts
export const MASS_UNITS = new Set<string>(['mg', 'g', 'mcg'])

/**
 * Calcula la cantidad total de un ingrediente activo para una entrada de log.
 *
 * Regla: si el ingrediente se mide en la misma unidad de masa que el doseUnit,
 * entonces el ingrediente ES la dosis — no hay ratio que aplicar.
 * En todos los otros casos (cáps, ml, unidades custom), se aplica amount × quantity.
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

**Por qué funciona para datos existentes incorrectos:**
- HMB (amount=1000, ing.unit="mg", doseUnit="mg"): `MASS_UNITS.has("mg") && "mg"==="mg"` → retorna `quantity` directamente (1000 mg) ✓
- NMN (amount=1, ing.unit="mg", doseUnit="mg"): misma rama → retorna `quantity` (500 mg) ✓
- GHK-Cu (amount=16.667, ing.unit="mg", doseUnit="ml"): `"mg" !== "ml"` → `16.667 × quantity` ✓
- Creatina (amount=5000, ing.unit="mg", doseUnit="medida (5g)"): `"mg" !== "medida (5g)"` → `5000 × quantity` ✓

### Capa 2 — `DoseInput.tsx` (quickpicks dinámicos)

Se agrega la prop `defaultDose: number`. Los quickpicks se generan como:

```ts
const quickpicks = [0.25, 0.5, 1, 2, 3, 4]
  .map(m => parseFloat((defaultDose * m).toFixed(6)))
  .filter(v => v >= min)
  // deduplicar manteniendo orden
  .filter((v, i, a) => a.indexOf(v) === i)
```

Resultado por caso:

| Suplemento | min | Quickpicks generados |
|---|---|---|
| NMN (default=500, min=250) | 250 | [250, 500, 1000, 1500, 2000] |
| HMB (default=1000, min=1) | 1 | [250, 500, 1000, 2000, 3000, 4000] |
| GHK-Cu (default=0.1, min=0.05) | 0.05 | [0.05, 0.1, 0.2, 0.3, 0.4] |
| Cabergolina (default=1, min=0.5) | 0.5 | [0.5, 1, 2, 3, 4] |
| Ashwagandha (default=1, min=1) | 1 | [1, 2, 3, 4] |
| Omega-3 (default=2, min=1) | 1 | [1, 2, 4, 6, 8] |
| Testenat (default=0.4, min=0.05) | 0.05 | [0.1, 0.2, 0.4, 0.8, 1.2, 1.6] |
| Whey (default=1, step=0.5, min=0.5) | 0.5 | [0.5, 1, 2, 3, 4] |

Las labels ¼ y ½ se conservan solo cuando el valor numérico es exactamente 0.25 o 0.5 (coincide con los casos donde son conceptualmente útiles).

### Capa 3 — Migración de datos en `migrations.ts`

Migration one-shot que corrige `activeIngredients.amount` en los suplementos del store donde la invariante está violada.

**Criterio de detección:** `ing.unit === supp.doseUnit && MASS_UNITS.has(ing.unit) && ing.amount !== 1`
**Acción:** `ing.amount = 1`

Los suplementos afectados: HMB, Magnesio citrato, Ácido Hialurónico, Colágeno hidrolizado.

**Los snapshots históricos en `dailyLogs` NO se modifican** — son inmutables por diseño. La Capa 1 (`calcIngAmount`) maneja correctamente tanto `amount=1000` como `amount=1` cuando `ing.unit === doseUnit`, por lo que el Resumen Metabólico muestra valores correctos independientemente del valor en el snapshot.

---

## Archivos a modificar

| Archivo | Tipo de cambio |
|---|---|
| `src/utils/units.ts` | Nuevo — `MASS_UNITS`, `calcIngAmount` |
| `src/components/history/MetabolicSummary.tsx` | Reemplaza `ing.amount * entry.quantity` por `calcIngAmount(...)` |
| `src/components/shared/DoseInput.tsx` | Prop `defaultDose`, quickpicks dinámicos con filtro de min |
| `src/components/today/TodayView.tsx` | Pasa `defaultDose={logModal.supplement.defaultDose}` a DoseInput |
| `src/storage/migrations.ts` | Nueva migration para normalizar `amount=1` en mass-unit supplements |

---

## Invariantes post-implementación

1. `calcIngAmount` es la única función que calcula totales de ingredientes — no hay cálculo ad-hoc en componentes.
2. Cuando `ing.unit === doseUnit && MASS_UNITS.has(ing.unit)`, el resultado es siempre `quantity` sin importar el valor de `ing.amount` en el snapshot.
3. Los quickpicks de DoseInput son siempre un subconjunto de `defaultDose × [0.25, 0.5, 1, 2, 3, 4]` filtrado por `min` — nunca valores absolutos hardcodeados.
4. Los datos en el store tienen `ing.amount = 1` para todos los suplementos donde `doseUnit ∈ MASS_UNITS && ing.unit === doseUnit` (garantizado por la migration + validación futura en SupplementForm).

---

## Fuera de scope (v2)

- Normalización cross-unit (g → mg) para agregación en MetabolicSummary
- Validación en SupplementForm que prevenga ingreso de `amount ≠ 1` para mass-unit supplements
- Conversión de display (mostrar "10 g" vs "10,000 mg" según preferencia)
