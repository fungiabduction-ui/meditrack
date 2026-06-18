# Cabinet Import/Export — Design Spec
_Date: 2026-06-18_

## Objetivo

Cargar 18 suplementos y medicamentos al botiquín mediante un mecanismo reutilizable de Import/Export JSON. Reemplaza el seed script temporal por una feature permanente y portable.

---

## Formato de intercambio

**Tipo:** `CabinetExport` (versioned envelope)

```ts
type CabinetExport = {
  version: 1
  exportedAt: string   // ISO8601
  supplements: Supplement[]
}
```

El campo `version` permite agregar lógica de migración de archivos en el futuro sin romper exports viejos. Hoy soportamos `version: 1` únicamente.

---

## Validación en runtime

Se agrega `CabinetExportSchema` a `src/schema/zod-schemas.ts`. Valida:
- Envelope: `version === 1`, `exportedAt` string, `supplements` array
- Cada suplemento: shape completo de `Supplement` usando `SupplementSchema` ya existente en `zod-schemas.ts`

Si la validación falla, el import se aborta con un mensaje claro. No se escribe nada al store.

---

## Lógica de import

**Archivo:** `src/utils/importCabinet.ts`

```ts
function importCabinet(
  parsed: CabinetExport,
  existing: Record<string, Supplement>
): { toAdd: SupplementInput[], skipped: string[] }
```

- Función pura, sin side effects.
- **Deduplicación:** skip si `name.toLowerCase().trim() + (brand ?? '').toLowerCase().trim()` ya existe en `existing`.
- Devuelve `toAdd` (array de objetos listos para `addSupplement`) y `skipped` (nombres omitidos).
- El caller (CabinetView) itera `toAdd` y llama `store.addSupplement()` por cada uno.

`SupplementInput` = `Omit<Supplement, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'active'>` (exactamente lo que acepta `addSupplement`).

---

## Lógica de export

Función inline en `CabinetView.tsx`:

1. Construye `CabinetExport` con `version: 1`, `exportedAt: new Date().toISOString()`, y `supplements: Object.values(store.supplements).filter(s => s.active)`.
2. `JSON.stringify(payload, null, 2)` → `Blob` → URL object → `<a download="meditrack-cabinet-YYYY-MM-DD.json">` programático → `.click()` → revoke URL.

Sin utilidad extra. El export solo exporta suplementos activos.

---

## UI — CabinetView

Header row (de izquierda a derecha):
```
[ Importar ]  [ Exportar ]  [ + Agregar ]
```

### Importar
- `<input type="file" accept=".json" style="display:none">` con ref.
- El botón "Importar" hace `inputRef.current.click()`.
- `onChange`: FileReader → `JSON.parse` → Zod validate → `importCabinet` → loop `addSupplement` → mostrar toast.

### Exportar
- Click → construye payload → dispara descarga → listo.

### Toast de resultado
- Estado local: `{ message: string, type: 'success' | 'error' } | null`.
- Se muestra superpuesto en CabinetView, desaparece a los 4 segundos (`setTimeout` + cleanup en unmount).
- Sin librería externa.
- Mensajes:
  - Éxito: `"X suplementos agregados, Y omitidos (ya existían)"`
  - Error de validación: `"Archivo inválido: <detalle del error Zod>"`
  - Error de parse: `"El archivo no es JSON válido"`

---

## Seed file

**Archivo:** `src/data/seed-supplements.json`

JSON estático con los 18 productos (suplementos y medicamentos) ya formateados como `CabinetExport` válido. El usuario lo importa desde la UI. No requiere código extra, no tiene botón especial — es simplemente un archivo importable como cualquier otro export.

Productos a incluir:
1. KSM-66 Ashwagandha (Nootropics Depot) — adaptogen
2. PrimaVie Shilajit (Nootropics Depot) — supplement
3. Tongkat Ali 2% Eurycomanone (Nootropics Depot) — herb
4. Tongkat Ali 10% Eurycomanone (Nootropics Depot) — herb
5. Cistanche tubulosa 700mg (Nootropics Depot) — herb
6. Probiotics 200B CFU (NatureBell) — supplement
7. Fadogia Agrestis + Tongkat Ali (NatureBell) — supplement
8. Omega-3 Fish Oil Triple Strength (Viva Naturals) — supplement
9. Ubiquinol 100mg Kaneka (Nutricost) — supplement
10. PQQ 20mg (Nutricost) — supplement
11. Mega D3 & MK-7 (NOW Foods) — vitamin
12. Methylated B Complex (NatureBell) — vitamin
13. Omega-3 TG (Innovanaturals) — supplement
14. DHEA 100mg (NatureBell) — hormone
15. Clomifeno Citrato 50mg (Genozym) — medication
16. Cabergolina 0.5mg (Lactamax) — medication
17. Testenat Depot Enantato 250mg (Landerlan Gold) — medication
18. GHK-Cu Péptido de Cobre (Revolution Pharma) — other

---

## Archivos a crear/modificar

| Acción | Archivo |
|--------|---------|
| Modificar | `src/schema/types.ts` — agregar `CabinetExport`, `SupplementInput` |
| Modificar | `src/schema/zod-schemas.ts` — agregar `CabinetExportSchema` |
| Crear | `src/utils/importCabinet.ts` — función pura de import |
| Crear | `src/data/seed-supplements.json` — 18 productos |
| Modificar | `src/components/cabinet/CabinetView.tsx` — botones + toast |

---

## Out of scope

- Importar `dailyLogs` (solo suplementos)
- Merge/overwrite de suplementos existentes (solo skip)
- Suplementos inactivos en el export
- Validación clínica / advertencias del sistema
