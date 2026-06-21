# Quick Log v2 — Spec

**Fecha:** 2026-06-21  
**Estado:** Aprobado

## Problema

Registrar una toma requiere: buscar el suplemento (o tocar la píldora), ajustar dosis manualmente con +/−, confirmar la hora, y presionar Confirmar. Para suplementos de rutina diaria con dosis fija, esto es fricción innecesaria.

## Objetivo

Reducir el registro de una toma habitual a **2 toques**: tap en la píldora → tap en "Registrar".

## Alcance

Tres cambios coordinados en la vista Hoy:

1. **QuickLogSheet** — bottom-sheet de confirmación rápida
2. **getHistoricalDose** — detección de dosis habitual por historial
3. **Regulares sugeridos** — sección automática para as_needed diarios

---

## 1. `QuickLogSheet` — `src/components/today/QuickLogSheet.tsx`

### Trigger

Reemplaza el `setLogModal(...)` actual en las píldoras de "Pendientes hoy". También lo usará la nueva sección "Regulares sugeridos".

El modal existente (`LogModal` con `DoseInput`) queda disponible solo para:
- Flujo `···` desde el sheet
- Búsqueda manual (barra de búsqueda superior)

### Comportamiento

- Overlay semitransparente oscurece la pantalla detrás
- Panel sube desde abajo con animación (`translate-y`) con handle bar decorativo
- Cierra con: tap en overlay, botón ✕ en el sheet, o tras confirmar (sin swipe — complejidad innecesaria para v1)
- **Hora capturada al montar** (`getLocalHHMM()` en el `useState` inicial), no al confirmar

### Contenido del sheet

```
[handle bar]
[Nombre suplemento]          [Ahora]
[Brand · doseUnit]           [HH:MM]

[badge historial — solo si ≥3 registros en 30 días]
"Tomás X unidad el Y% de las veces"

[chips de cantidad]
  ½  |  1 ★HABITUAL  |  2  |  ···

[Registrar — X unidad · HH:MM]
```

### Chips de cantidad

Los mismos valores proporcionales que genera `DoseInput` (¼·defaultDose, ½·defaultDose, 1·defaultDose, 2·defaultDose, etc.), filtrados para que sean ≥ `doseStep` y tengan sentido para el suplemento.

La cantidad habitual detectada por `getHistoricalDose` lleva badge `★ HABITUAL` y viene pre-seleccionada.

El chip `···` cierra el sheet y abre el modal completo (`LogModal`) con `time` pre-cargado con la hora capturada al montar el sheet. Esto requiere que `TodayView` exponga `setLogModal` para poder llamarlo desde el sheet, o que `QuickLogSheet` acepte un callback `onOpenFull(capturedTime: string)`.

### Confirmar

Llama `logItem(supplementId, qty, time)` → cierra sheet → la píldora en Pendientes se vuelve verde (comportamiento ya existente via re-render del store).

---

## 2. `getHistoricalDose` — `src/utils/dose-history.ts`

```ts
function getHistoricalDose(
  supplementId: string,
  dailyLogs: Record<string, DailyLog>,
  defaultDose: number
): { dose: number; percent: number | null }
```

### Lógica

1. Recopilar entradas de los últimos 30 días para `supplementId`
2. Si hay < 3 entradas → devuelve `{ dose: defaultDose, percent: null }` (sin badge)
3. Contar frecuencia por `quantity`
4. Si la más frecuente tiene ≥60% → es el habitual, devuelve `{ dose, percent }`
5. Si ninguna cantidad supera 60% → devuelve `{ dose: defaultDose, percent: null }`

---

## 3. Sección "Regulares sugeridos"

### Utilidad `getSuggestedRegulars` — `src/utils/regulars.ts`

```ts
function getSuggestedRegulars(
  supplements: Record<string, Supplement>,
  dailyLogs: Record<string, DailyLog>,
  today: string
): Supplement[]
```

**Criterios para incluir un suplemento:**
- `schedule.kind === 'as_needed'`
- `active === true` y `inStock !== false`
- Aparece en logs ≥5 de los últimos 7 días
- No fue tomado hoy aún (no está en `dailyLogs[today].entries`)

### UI en TodayView

Posición: entre "Pendientes hoy" y "Tomados".

```
REGULARES SUGERIDOS
[píldora]  [píldora]  [píldora]
```

- Misma UI de píldoras que Pendientes
- Tap → `QuickLogSheet`
- Sección oculta si no hay sugeridos (`suggestedRegulars.length === 0`)

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/components/today/QuickLogSheet.tsx` | Nuevo componente |
| `src/utils/dose-history.ts` | Nueva utilidad |
| `src/utils/regulars.ts` | Nueva utilidad |
| `src/components/today/TodayView.tsx` | Píldoras Pendientes → QuickLogSheet; nueva sección Regulares |

## Archivos NO modificados

- `src/store/index.ts` — no se tocan datos ni acciones
- `src/hooks/useToday.ts` — no cambia la lógica de scheduling
- `src/components/shared/DoseInput.tsx` — sigue usándose en LogModal
- `src/schema/types.ts` — sin cambios de tipos
- `src/storage/` — sin cambios de persistencia

---

## Invariantes

- El timestamp en el log siempre refleja cuándo el usuario abrió el sheet, no cuándo presionó Registrar
- `getSuggestedRegulars` nunca devuelve suplementos ya tomados hoy
- `getHistoricalDose` nunca muestra badge si hay < 3 registros (evita sugerir con muestras insignificantes)
- El modal completo (`LogModal`) sigue accesible vía `···` y búsqueda; no se elimina
