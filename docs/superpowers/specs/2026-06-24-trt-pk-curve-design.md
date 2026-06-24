# TRT PK Curve — Design Spec

**Date:** 2026-06-24  
**Status:** Approved  
**Approach chosen:** A — Curva histórica + comparador de protocolos (Opción C como evolución futura)

---

## Objetivo

Visualizar la curva farmacocinética real del enantato de testosterona basada en las inyecciones registradas, permitiendo al usuario:
1. Entender en qué días está en pico y en qué días está cayendo
2. Identificar el momento óptimo para reinjectarse
3. Comparar cómo distintos protocolos de frecuencia afectan la estabilidad de los niveles

---

## Alcance

### Incluido
- Sub-tab "TRT" en AnalysisView
- `TRTCurveChart`: curva PK real con inyecciones históricas + overlay de bienestar
- `ProtocolComparator`: 3 mini-charts de steady-state para 1x/14d, 1x/7d, 2x/7d
- `trt-pk.ts`: matemática PK (Bateman, superposición, normalización)
- Síntomas múltiples por día con promedio diario
- Migración de schema v4→v5

### Excluido (futuro)
- Eje Y calibrado en ng/dL (requiere lab de referencia — Opción B)
- Proyección futura + sugerencia de próxima inyección (Opción C — evolución natural)
- Soporte para otros ésteres (cipionato, propionato)

---

## Farmacología — Parámetros PK

Modelo **Bateman** para inyección IM de éster de testosterona de liberación prolongada:

```
C(t) = D × Ka/(Ka−Ke) × (e^(−Ke·t) − e^(−Ka·t))   para t ≥ 0
```

| Parámetro | Valor | Fuente |
|-----------|-------|--------|
| Ka (absorción) | ln(2)/1.5 = 0.462 día⁻¹ | Tmax ~2.7 días, literatura clínica |
| Ke (eliminación) | ln(2)/4.5 = 0.154 día⁻¹ | t½ = 4.5 días, enantato estándar |
| Tmax teórico | ~2.7 días post-inyección | Calculado de Ka/Ke |

**Superposición para múltiples inyecciones:**
```
C_total(t) = Σ C_i(t − t_i)   para cada inyección i en tiempo t_i
```

**Normalización:** dividir por el pico de la primera inyección → escala 0–100%.

**Umbral de reinyección:** 30% del pico (línea roja punteada). Cuando la curva cruza este umbral, aparece marcador visual "momento sugerido para reinjectar". Configurable en el futuro.

**Nota para Opción C (futuro):** La curva puede extenderse hacia adelante desde hoy (`t > today`) usando el protocolo actual del usuario como input, marcando la próxima fecha sugerida de inyección. `trt-pk.ts` debe diseñarse con `generateCurve(injections, daysAhead)` extensible.

---

## Arquitectura

### Archivos nuevos
- `src/utils/trt-pk.ts` — matemática PK pura (sin dependencias React)
- `src/components/analysis/TRTCurveChart.tsx` — chart SVG principal
- `src/components/analysis/ProtocolComparator.tsx` — 3 mini-charts steady-state

### Archivos modificados
- `src/components/analysis/AnalysisView.tsx` — agregar sub-tab `'trt'`
- `src/schema/types.ts` — `symptomLog` en `DailyLog`
- `src/storage/migrations.ts` — migración v4→v5
- `src/store/index.ts` — acción `addSymptomEntry(dateStr, symptoms)`
- `src/components/today/DailySymptoms.tsx` — UI para múltiples entradas + promedio

---

## trt-pk.ts

```ts
export interface InjectionPoint {
  date: string   // 'YYYY-MM-DD'
  mgDose: number // mg de testosterona (no ml — convertir antes de llamar)
}

// Retorna array de { t: number (días desde origen), level: number (0–100) }
// origen = fecha de la primera inyección
export function computePKCurve(
  injections: InjectionPoint[],
  totalDays: number,
  resolution?: number  // puntos por día, default 4
): Array<{ t: number; level: number }>

// Genera inyecciones hipotéticas en steady-state para el comparador
// intervalDays: 7 = semanal, 3.5 = 2x/semana, 14 = quincenal
export function generateSteadyState(
  intervalDays: number,
  mgDose: number,
  cycles?: number  // default 10
): Array<{ t: number; level: number }>

// Detecta cruce del umbral de reinyección (default threshold = 30)
export function findReinjectionWindows(
  curve: Array<{ t: number; level: number }>,
  threshold?: number
): Array<{ tStart: number; tEnd: number }>
```

**Conversión ml → mg:** el suplemento Testenat es 250mg/ml. La conversión se hace en el componente antes de llamar a `computePKCurve`, leyendo `quantity × 250` (o el amount del activeIngredient).

---

## TRTCurveChart

SVG siguiendo el patrón de `BPChart` (mismo W/H/PAD, misma lógica de polyline).

### Layout
```
[ ‹  Junio 2026  › ]

 100% ┤              ╭─╮
      │             ╱   ╲
  60% ├─────────────────────────  ← banda verde tenue (zona óptima 60-100%)
      │            ╱     ╲
  30% ├──────────────────────────  ← línea roja punteada (umbral reinyección)
      │           ╱       ╲
   0% ┤──────────────────────────
      Jun17      Jun20    Jun24
      │ 100mg              │ 50mg
      ▼ (línea vertical)   ▼
                  ● 85  ● 71  ← dots de bienestar promedio del día
```

### Elementos SVG
| Elemento | Estilo |
|----------|--------|
| Curva PK | polyline violeta sólida, strokeWidth 2 |
| Marcador inyección | línea vertical violeta punteada + etiqueta "Xmg" |
| Banda óptima 60-100% | rect verde con opacity 0.05 |
| Umbral 30% | línea roja punteada opacity 0.4 |
| Dots bienestar | círculos naranjas, r=3, con tooltip día+score |

### Datos
- Detecta inyecciones de enantato (`isEnanthateEntry`) igual que `computeTRTCycleData`
- Convierte `quantity × 250 mg/ml` a mgDose
- Wellbeing = promedio de `symptomLog[]` del día, fallback a `symptoms` legacy
- Navegador mensual idéntico a BPChart

---

## ProtocolComparator

3 cards con mini-SVG de steady-state. Dosis = la misma que el usuario usa habitualmente (promedio de sus inyecciones, o 100mg default si no hay datos suficientes).

| Card | Intervalo | Descripción |
|------|-----------|-------------|
| 1x/14d | 14 días | Ciclo clásico quincenal |
| 1x/7d | 7 días | Semanal |
| 2x/7d | 3.5 días | Bisemanal — mayor estabilidad |

Cada card muestra:
- Mini SVG del ciclo en steady-state (últimos 3 ciclos del array generado)
- Pico % (máximo normalizado)
- Valle % (mínimo en steady-state)
- Fluctuación = pico − valle (menor = mejor para estabilidad)

El protocolo actualmente inferido del historial del usuario se marca con borde violeta. Sin protocolo detectado → ninguno destacado.

---

## Schema — Síntomas múltiples por día

### Cambio en types.ts

```ts
// Nuevo tipo
type SymptomLogEntry = {
  id: string
  timestamp: string   // ISO8601
  symptoms: SymptomData
}

// DailyLog existente — agregar campo
type DailyLog = {
  // ... campos existentes ...
  symptoms?: SymptomData          // calculado = promedio de symptomLog, o registro único legacy
  symptomLog?: SymptomLogEntry[]  // nuevo: entradas individuales del día
}
```

### Migración v4→v5

Para cada `DailyLog` que tenga `symptoms` y no tenga `symptomLog`:
```
symptomLog = [{ id: generateId(), timestamp: date + 'T12:00:00.000Z', symptoms: log.symptoms }]
```
El campo `symptoms` existente se mantiene para compatibilidad (es el average calculado).

### Store — nueva acción

```ts
addSymptomEntry(dateStr: string, symptomsData: SymptomData): void
// Agrega a symptomLog[], recalcula symptoms como promedio, persiste.
```

### DailySymptoms.tsx — cambios UI

- Si hay `symptomLog[]` con más de 1 entrada: mostrar lista con hora + score individual
- Botón "+" para agregar nueva entrada del día (abre el form de síntomas existente)
- Header del componente muestra "Bienestar · avg X/100 (N registros hoy)"
- Primer registro del día funciona igual que hoy (sin cambio visible para el usuario casual)

---

## isEnanthateEntry — fix menor

La función actual en `analysis.ts` busca `'testosterona'` en el nombre del ingrediente Y `'enantato'` en el form. El suplemento "Testenat Depot Enantato 250mg" no tiene `'testosterona'` en el nombre del ingrediente (tiene "Enantato de testosterona"), pero sí tiene `'enantato'` en el nombre del suplemento, así que el OR de respaldo funciona. Sin cambio necesario.

---

## Notas de implementación

- `trt-pk.ts` es matemática pura, sin imports de React ni del store — testeable en aislamiento
- La resolución de la curva es 4 puntos/día → para 60 días = 240 puntos, manejable en SVG
- El comparador de protocolos genera curvas estáticas (no dependen del store) → `useMemo` con deps vacío o constante
- `ProtocolComparator` puede recibir `currentIntervalDays?: number` como prop para destacar el protocolo activo
- Todos los imports de types deben ser `import type` (regla crítica del proyecto)

---

## Evolución futura (Opción C)

> Cuando el usuario tenga suficiente historial y quiera planificar, `TRTCurveChart` puede extenderse:
> 1. Agregar prop `forecastDays: number` a `computePKCurve`
> 2. Mostrar la proyección con línea punteada después de `today`
> 3. Marcar la fecha sugerida de próxima inyección cuando la curva cruza el umbral
> 4. Permitir al usuario definir su protocolo objetivo para la proyección
>
> Esto no requiere cambios de schema adicionales — solo lógica de UI y extensión de `trt-pk.ts`.
