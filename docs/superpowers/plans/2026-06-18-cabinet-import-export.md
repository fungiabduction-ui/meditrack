# Cabinet Import/Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Import/Export JSON buttons to CabinetView so the user can load 18 supplements from a seed file and export/share their cabinet as a versioned JSON envelope.

**Architecture:** Extend the type system with `CabinetExport` and its Zod validator; pure function `importCabinet` handles dedup logic; static seed JSON with all 18 products; CabinetView gets two new buttons wired to file input (import) and blob download (export), with a 4-second auto-dismissing toast.

**Tech Stack:** React 19, TypeScript strict, Zustand 5, Zod 4, Vitest 4, Tailwind v4

---

## File Map

| Action  | File                                          | Responsibility                                      |
|---------|-----------------------------------------------|-----------------------------------------------------|
| Modify  | `src/schema/types.ts`                         | Add `CabinetExport` type                            |
| Modify  | `src/schema/zod-schemas.ts`                   | Add `CabinetExportSchema`                           |
| Create  | `src/utils/importCabinet.ts`                  | Pure dedup function, no side effects                |
| Create  | `src/__tests__/importCabinet.test.ts`         | Vitest unit tests for importCabinet                 |
| Create  | `src/data/seed-supplements.json`              | All 18 supplements as valid `CabinetExport`         |
| Modify  | `src/components/cabinet/CabinetView.tsx`      | Import/Export buttons + toast                       |
| Modify  | `package.json`                                | Add `"test": "vitest run"` script                   |

---

## Task 1: Add `CabinetExport` type and Zod schema

**Files:**
- Modify: `src/schema/types.ts`
- Modify: `src/schema/zod-schemas.ts`
- Modify: `package.json`

- [ ] **Step 1.1: Add test script to package.json**

In `package.json`, add `"test": "vitest run"` to `scripts`:

```json
"scripts": {
  "dev": "vite --open",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run"
},
```

- [ ] **Step 1.2: Add `CabinetExport` to `src/schema/types.ts`**

Append after the last type in the file:

```ts
export type CabinetExport = {
  version: 1
  exportedAt: string
  supplements: Supplement[]
}
```

- [ ] **Step 1.3: Add `CabinetExportSchema` to `src/schema/zod-schemas.ts`**

Append after `StorageSchemaSchema`:

```ts
export const CabinetExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  supplements: z.array(SupplementSchema),
})
```

- [ ] **Step 1.4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 1.5: Commit**

```bash
git add src/schema/types.ts src/schema/zod-schemas.ts package.json
git commit -m "feat: add CabinetExport type and Zod schema"
```

---

## Task 2: Implement `importCabinet` with TDD

**Files:**
- Create: `src/utils/importCabinet.ts`
- Create: `src/__tests__/importCabinet.test.ts`

- [ ] **Step 2.1: Write failing tests**

Create `src/__tests__/importCabinet.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { importCabinet } from '../utils/importCabinet'
import type { Supplement, CabinetExport } from '../schema/types'

function makeSupplement(overrides: Partial<Supplement> = {}): Supplement {
  return {
    id: crypto.randomUUID(),
    name: 'Test Supplement',
    brand: undefined,
    category: 'supplement',
    description: '',
    form: 'cápsulas',
    activeIngredients: [],
    instructions: '1 cáp/día',
    certifications: [],
    schedule: { kind: 'weekdays', days: [0, 1, 2, 3, 4, 5, 6] },
    defaultDose: 1,
    doseUnit: 'cáps',
    doseStep: 1,
    timing: null,
    active: true,
    createdAt: '2026-06-18T00:00:00.000Z',
    updatedAt: '2026-06-18T00:00:00.000Z',
    version: 0,
    ...overrides,
  }
}

function makeExport(supplements: Supplement[]): CabinetExport {
  return { version: 1, exportedAt: '2026-06-18T00:00:00.000Z', supplements }
}

describe('importCabinet', () => {
  it('returns all supplements as toAdd when store is empty', () => {
    const parsed = makeExport([makeSupplement({ name: 'Omega-3', brand: 'Viva' })])
    const { toAdd, skipped } = importCabinet(parsed, {})
    expect(toAdd).toHaveLength(1)
    expect(skipped).toHaveLength(0)
  })

  it('skips a supplement that already exists (case-insensitive name+brand match)', () => {
    const existing = makeSupplement({ name: 'Omega-3', brand: 'Viva Naturals' })
    const parsed = makeExport([makeSupplement({ name: 'OMEGA-3', brand: 'viva naturals' })])
    const { toAdd, skipped } = importCabinet(parsed, { [existing.id]: existing })
    expect(toAdd).toHaveLength(0)
    expect(skipped).toHaveLength(1)
    expect(skipped[0]).toBe('OMEGA-3')
  })

  it('adds new and skips existing in the same batch', () => {
    const existing = makeSupplement({ name: 'Omega-3', brand: 'Viva' })
    const parsed = makeExport([
      makeSupplement({ name: 'Omega-3', brand: 'Viva' }),
      makeSupplement({ name: 'Ashwagandha', brand: 'Nootropics Depot' }),
    ])
    const { toAdd, skipped } = importCabinet(parsed, { [existing.id]: existing })
    expect(toAdd).toHaveLength(1)
    expect(toAdd[0].name).toBe('Ashwagandha')
    expect(skipped).toHaveLength(1)
  })

  it('treats same name with different brand as a different supplement', () => {
    const existing = makeSupplement({ name: 'Tongkat Ali', brand: 'Brand A' })
    const parsed = makeExport([makeSupplement({ name: 'Tongkat Ali', brand: 'Brand B' })])
    const { toAdd } = importCabinet(parsed, { [existing.id]: existing })
    expect(toAdd).toHaveLength(1)
  })

  it('deduplicates within the same import batch (same name+brand appears twice)', () => {
    const parsed = makeExport([
      makeSupplement({ name: 'PQQ', brand: 'Nutricost' }),
      makeSupplement({ name: 'PQQ', brand: 'Nutricost' }),
    ])
    const { toAdd, skipped } = importCabinet(parsed, {})
    expect(toAdd).toHaveLength(1)
    expect(skipped).toHaveLength(1)
  })

  it('strips id, createdAt, updatedAt, version, active from toAdd items', () => {
    const parsed = makeExport([makeSupplement({ name: 'PQQ', brand: 'Nutricost' })])
    const { toAdd } = importCabinet(parsed, {})
    const item = toAdd[0] as Record<string, unknown>
    expect(item).not.toHaveProperty('id')
    expect(item).not.toHaveProperty('createdAt')
    expect(item).not.toHaveProperty('updatedAt')
    expect(item).not.toHaveProperty('version')
    expect(item).not.toHaveProperty('active')
  })

  it('handles supplement with no brand (matches on name alone)', () => {
    const existing = makeSupplement({ name: 'Shilajit', brand: undefined })
    const parsed = makeExport([makeSupplement({ name: 'Shilajit', brand: undefined })])
    const { toAdd, skipped } = importCabinet(parsed, { [existing.id]: existing })
    expect(toAdd).toHaveLength(0)
    expect(skipped).toHaveLength(1)
  })
})
```

- [ ] **Step 2.2: Run tests — verify they fail**

```bash
npm test -- src/__tests__/importCabinet.test.ts
```

Expected: FAIL — `Cannot find module '../utils/importCabinet'`

- [ ] **Step 2.3: Implement `src/utils/importCabinet.ts`**

```ts
import type { CabinetExport, Supplement } from '../schema/types'

type SupplementInput = Omit<Supplement, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'active'>

export function importCabinet(
  parsed: CabinetExport,
  existing: Record<string, Supplement>,
): { toAdd: SupplementInput[]; skipped: string[] } {
  const seen = new Set(
    Object.values(existing).map(s => dedupeKey(s.name, s.brand))
  )

  const toAdd: SupplementInput[] = []
  const skipped: string[] = []

  for (const s of parsed.supplements) {
    const k = dedupeKey(s.name, s.brand)
    if (seen.has(k)) {
      skipped.push(s.name)
    } else {
      seen.add(k)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, createdAt: _c, updatedAt: _u, version: _v, active: _a, ...input } = s
      toAdd.push(input)
    }
  }

  return { toAdd, skipped }
}

function dedupeKey(name: string, brand?: string): string {
  return `${name.toLowerCase().trim()}|${(brand ?? '').toLowerCase().trim()}`
}
```

- [ ] **Step 2.4: Run tests — verify they pass**

```bash
npm test -- src/__tests__/importCabinet.test.ts
```

Expected: 7 tests PASS.

- [ ] **Step 2.5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2.6: Commit**

```bash
git add src/utils/importCabinet.ts src/__tests__/importCabinet.test.ts
git commit -m "feat: importCabinet pure function with dedup + tests"
```

---

## Task 3: Create seed JSON with all 18 products

**Files:**
- Create: `src/data/seed-supplements.json`

The seed is a valid `CabinetExport`. The `id`, `createdAt`, `updatedAt`, `version`, `active` fields are required by the schema but stripped during import — they serve as stable references in the seed file only.

- [ ] **Step 3.1: Create `src/data/seed-supplements.json`**

```json
{
  "version": 1,
  "exportedAt": "2026-06-18T00:00:00.000Z",
  "supplements": [
    {
      "id": "a0000000-0000-4000-8000-000000000001",
      "name": "KSM-66 Ashwagandha Extract",
      "brand": "Nootropics Depot",
      "category": "adaptogen",
      "description": "Extracto de raíz de Ashwagandha (Withania somnifera), adaptógeno full-spectrum para manejo de estrés, relajación y rendimiento.",
      "form": "cápsulas vegetarianas",
      "presentation": "frasco 60 cápsulas",
      "activeIngredients": [
        {
          "name": "Extracto de raíz KSM-66 Ashwagandha",
          "form": "estandarizado 5% withanolides, full-spectrum, Green Chemistry",
          "amount": 300,
          "unit": "mg"
        }
      ],
      "benefits": "Reduce estrés y cortisol; promueve relajación y bienestar; mejora cognición, foco y memoria; soporta fuerza muscular, endurance y recuperación; efectos antiinflamatorios y antioxidantes. Efectos completos en 1-2 semanas.",
      "instructions": "1 cápsula por noche, con o sin comida",
      "certifications": ["Non-GMO", "USDA Organic", "Gluten-Free", "GMP"],
      "schedule": { "kind": "weekdays", "days": [0, 1, 2, 3, 4, 5, 6] },
      "defaultDose": 1,
      "doseUnit": "cáps",
      "doseStep": 1,
      "timing": "night",
      "active": true,
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "version": 0
    },
    {
      "id": "a0000000-0000-4000-8000-000000000002",
      "name": "PrimaVie Purified Shilajit",
      "brand": "Nootropics Depot",
      "category": "supplement",
      "description": "Resina purificada PrimaVie rica en ácidos fúlvicos y minerales del Himalaya. Mejora rendimiento físico, reduce fatiga, soporta función mitocondrial y producción de ATP.",
      "form": "cápsulas",
      "presentation": "frasco 60 cápsulas",
      "activeIngredients": [
        {
          "name": "PrimaVie Shilajit purificado",
          "form": "ácidos fúlvicos, minerales traza, dibenzo-alfa-pironas",
          "amount": 250,
          "unit": "mg",
          "brand": "PrimaVie®"
        }
      ],
      "benefits": "Aumenta energía física, endurance y recuperación; propiedades antioxidantes y antiinflamatorias; reduce fatiga y estrés; soporta salud celular y respuesta adrenal. Efectos completos en 1-2 semanas.",
      "instructions": "1 cápsula por la mañana, con o sin comida",
      "certifications": ["cGMP", "FDA registered", "ISO terceros"],
      "schedule": { "kind": "weekdays", "days": [0, 1, 2, 3, 4, 5, 6] },
      "defaultDose": 1,
      "doseUnit": "cáps",
      "doseStep": 1,
      "timing": "morning",
      "active": true,
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "version": 0
    },
    {
      "id": "a0000000-0000-4000-8000-000000000003",
      "name": "Tongkat Ali (2% Eurycomanone)",
      "brand": "Nootropics Depot",
      "category": "herb",
      "description": "Extracto de raíz de Tongkat Ali (Eurycoma longifolia) full-spectrum, estandarizado a 2% eurycomanone, para vitalidad y fuerza.",
      "form": "cápsulas",
      "presentation": "frasco 60 cápsulas",
      "activeIngredients": [
        {
          "name": "Extracto de raíz Tongkat Ali",
          "form": "full-spectrum, estandarizado 2% eurycomanone",
          "amount": 200,
          "unit": "mg"
        }
      ],
      "benefits": "Promueve testosterona, libido, masa muscular y endurance; reduce estrés y fatiga; mejora humor, energía y motivación. Efectos completos en 3-4 semanas.",
      "instructions": "1 cápsula diaria con comida",
      "certifications": ["cGMP", "ISO terceros"],
      "schedule": { "kind": "weekdays", "days": [0, 1, 2, 3, 4] },
      "defaultDose": 1,
      "doseUnit": "cáps",
      "doseStep": 1,
      "timing": "morning",
      "active": true,
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "version": 0
    },
    {
      "id": "a0000000-0000-4000-8000-000000000004",
      "name": "Tongkat Ali (10% Eurycomanone)",
      "brand": "Nootropics Depot",
      "category": "herb",
      "description": "Extracto de raíz de Tongkat Ali (Eurycoma longifolia) estandarizado a 10% eurycomanone, para vitalidad, testosterona y rendimiento físico.",
      "form": "tabletas",
      "presentation": "frasco 60 tabletas",
      "activeIngredients": [
        {
          "name": "Extracto de raíz Tongkat Ali",
          "form": "estandarizado 10% eurycomanone",
          "amount": 100,
          "unit": "mg"
        }
      ],
      "benefits": "Soporta testosterona, libido, masa muscular, endurance, energía y motivación; mejora rendimiento físico y bienestar. Efectos completos en 3-4 semanas.",
      "instructions": "1 tableta diaria, con o sin comida",
      "certifications": ["cGMP", "FDA registered", "ISO terceros"],
      "schedule": { "kind": "weekdays", "days": [0, 1, 2, 3, 4] },
      "defaultDose": 1,
      "doseUnit": "tabletas",
      "doseStep": 1,
      "timing": "morning",
      "active": true,
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "version": 0
    },
    {
      "id": "a0000000-0000-4000-8000-000000000005",
      "name": "Cistanche tubulosa 700mg",
      "brand": "Nootropics Depot",
      "category": "herb",
      "description": "Suplemento de espectro completo de Cistanche tubulosa (polvo de planta entera), estandarizado en glucósidos feniletanoides. Soporte a vitalidad, equilibrio hormonal y función cognitiva.",
      "form": "cápsulas vegetales (hipromelosa)",
      "presentation": "frasco 60 cápsulas",
      "activeIngredients": [
        {
          "name": "Cistanche tubulosa",
          "form": "polvo de planta entera, 5% Equinacósido (Echinacoside), 1% Acetósido (Verbascoside)",
          "amount": 700,
          "unit": "mg"
        }
      ],
      "benefits": "Apoyo a recuperación muscular y resistencia física; mejora de claridad mental y enfoque; soporte a vitalidad y equilibrio hormonal; acción antioxidante celular.",
      "instructions": "1 cápsula diaria con comida",
      "warnings": "Consultar con profesional de la salud antes de usar, especialmente en embarazo, lactancia o si se toman medicamentos.",
      "certifications": ["Non-GMO", "Gluten-Free", "cGMP"],
      "schedule": { "kind": "weekdays", "days": [0, 1, 2, 3, 4, 5, 6] },
      "defaultDose": 1,
      "doseUnit": "cáps",
      "doseStep": 1,
      "timing": "morning",
      "active": true,
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "version": 0
    },
    {
      "id": "a0000000-0000-4000-8000-000000000006",
      "name": "Probiotics 200 Billion CFU",
      "brand": "NatureBell",
      "category": "supplement",
      "description": "Fórmula digestiva 5-en-1: probióticos (40 cepas, 200 mil millones CFU), postbióticos, prebióticos, enzimas digestivas y fibra dietaria. Soporte completo al microbioma intestinal.",
      "form": "cápsulas vegetarianas",
      "presentation": "envase 240 cápsulas",
      "activeIngredients": [
        {
          "name": "Mezcla probiótica y postbiótica (200 mil millones CFU)",
          "form": "40 cepas: Bacillus spp., Bifidobacterium spp., Lactobacillus spp., Saccharomyces spp.",
          "amount": 450,
          "unit": "mg"
        },
        {
          "name": "Mezcla prebiótica",
          "form": "psyllium, fibra de acacia Senegal, inulina (raíz de achicoria)",
          "amount": 150,
          "unit": "mg"
        },
        {
          "name": "Enzimas digestivas",
          "form": "bromelina, papaína, amilasa, proteasa, lipasa",
          "amount": 50,
          "unit": "mg"
        }
      ],
      "excipients": "Harina de arroz, estearato de magnesio, dióxido de silicio, celulosa vegetal (cápsula)",
      "benefits": "Soporte a digestión y absorción de nutrientes; equilibrio de microbiota intestinal; reduce hinchazón; aporta fibra y enzimas complementarias.",
      "instructions": "2 cápsulas diarias con alimentos",
      "certifications": ["Non-GMO", "Gluten-Free", "Sin soja", "Sin lácteos", "GMP"],
      "schedule": { "kind": "weekdays", "days": [0, 1, 2, 3, 4, 5, 6] },
      "defaultDose": 2,
      "doseUnit": "cáps",
      "doseStep": 1,
      "timing": "morning",
      "active": true,
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "version": 0
    },
    {
      "id": "a0000000-0000-4000-8000-000000000007",
      "name": "Fadogia Agrestis + Tongkat Ali",
      "brand": "NatureBell",
      "category": "supplement",
      "description": "Fórmula 2-en-1 de alta concentración: 600mg Fadogia Agrestis (extracto tallo 20:1) + 400mg Tongkat Ali (extracto raíz 200:1). Soporte a rendimiento atlético, energía y salud masculina.",
      "form": "cápsulas vegetarianas",
      "presentation": "envase 240 cápsulas",
      "activeIngredients": [
        {
          "name": "Fadogia Agrestis",
          "form": "extracto de tallo 20:1",
          "amount": 600,
          "unit": "mg"
        },
        {
          "name": "Tongkat Ali (Eurycoma longifolia)",
          "form": "extracto de raíz 200:1, Indonesia",
          "amount": 400,
          "unit": "mg"
        }
      ],
      "benefits": "Soporte a rendimiento atlético, energía, resistencia y salud masculina; posible soporte a testosterona (uso tradicional).",
      "instructions": "2 cápsulas diarias (porción completa)",
      "certifications": ["Non-GMO", "Gluten-Free", "Sin soja", "Sin lácteos", "cGMP"],
      "schedule": { "kind": "weekdays", "days": [0, 1, 2, 3, 4] },
      "defaultDose": 2,
      "doseUnit": "cáps",
      "doseStep": 1,
      "timing": "morning",
      "active": true,
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "version": 0
    },
    {
      "id": "a0000000-0000-4000-8000-000000000008",
      "name": "Omega-3 Fish Oil Triple Strength",
      "brand": "Viva Naturals",
      "category": "supplement",
      "description": "Aceite de pescado Omega-3 de alta concentración en forma de triglicéridos re-esterificados (rTG) para máxima biodisponibilidad. Certificación IFOS por lote.",
      "form": "cápsulas blandas (softgels)",
      "presentation": "envase 90 softgels",
      "activeIngredients": [
        {
          "name": "EPA (ácido eicosapentaenoico)",
          "form": "triglicéridos re-esterificados (rTG), aceite de anchoa/sardina/caballa salvaje",
          "amount": 1500,
          "unit": "mg"
        },
        {
          "name": "DHA (ácido docosahexaenoico)",
          "form": "triglicéridos re-esterificados (rTG)",
          "amount": 568,
          "unit": "mg"
        },
        {
          "name": "DPA (ácido docosapentaenoico)",
          "form": "triglicéridos re-esterificados (rTG)",
          "amount": 50,
          "unit": "mg"
        }
      ],
      "excipients": "Gelatina de pescado (tilapia), glicerina, agua purificada, tocoferoles mixtos (antioxidantes)",
      "benefits": "Soporte cardiovascular; acción antiinflamatoria sistémica; apoyo a función cerebral y neurológica; salud visual; niveles saludables de triglicéridos; soporte articular.",
      "instructions": "2 cápsulas diarias con alimentos para optimizar absorción",
      "warnings": "Contiene pescado. Consultar profesional en embarazo, lactancia o uso de anticoagulantes.",
      "certifications": ["IFOS", "GMP", "Non-GMO", "Gluten-Free", "Sin lácteos"],
      "schedule": { "kind": "weekdays", "days": [0, 1, 2, 3, 4, 5, 6] },
      "defaultDose": 2,
      "doseUnit": "cáps",
      "doseStep": 1,
      "timing": "midday",
      "active": true,
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "version": 0
    },
    {
      "id": "a0000000-0000-4000-8000-000000000009",
      "name": "Ubiquinol 100mg",
      "brand": "Nutricost",
      "category": "supplement",
      "description": "Ubiquinol (forma reducida y activa de CoQ10) de alta biodisponibilidad con materia prima Kaneka Ubiquinol® japonesa. Soporte cardiovascular y producción de energía celular.",
      "form": "cápsulas blandas (softgels)",
      "presentation": "frasco 120 softgels",
      "activeIngredients": [
        {
          "name": "Ubiquinol",
          "form": "forma reducida activa de CoQ10",
          "amount": 100,
          "unit": "mg",
          "brand": "Kaneka Ubiquinol®"
        }
      ],
      "excipients": "Aceite MCT, gelatina, glicerina, palmitato de ascorbilo, agua purificada, cera de abejas, lecitina de girasol, suspensión de annato en aceite de girasol",
      "benefits": "Apoya salud cardiovascular; mejora producción de ATP; ayuda a reducir fatiga; soporte antioxidante; puede favorecer recuperación muscular.",
      "instructions": "1 softgel al día con comida que contenga grasa",
      "certifications": ["Non-GMO", "Gluten-Free", "NSF", "GMP"],
      "schedule": { "kind": "weekdays", "days": [0, 1, 2, 3, 4, 5, 6] },
      "defaultDose": 1,
      "doseUnit": "cáps",
      "doseStep": 1,
      "timing": "morning",
      "active": true,
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "version": 0
    },
    {
      "id": "a0000000-0000-4000-8000-00000000000a",
      "name": "PQQ 20mg",
      "brand": "Nutricost",
      "category": "supplement",
      "description": "Pirroloquinolina Quinona (PQQ) en dosis de 20mg — la dosis utilizada en estudios clínicos. Soporte mitocondrial, antioxidante celular y función cognitiva.",
      "form": "cápsulas vegetales (hipromelosa)",
      "presentation": "frasco 60 cápsulas",
      "activeIngredients": [
        {
          "name": "Pirroloquinolina Quinona (PQQ)",
          "form": "pura, alta pureza",
          "amount": 20,
          "unit": "mg"
        }
      ],
      "excipients": "Harina de arroz, hipromelosa (cápsula vegetal)",
      "benefits": "Favorece biogénesis mitocondrial; soporte antioxidante celular; apoyo a memoria, concentración y claridad mental; contribuye a producción de ATP; posible mejora de sensibilidad a la insulina.",
      "instructions": "1 cápsula diaria con 240–350 ml de agua, preferentemente con comida",
      "warnings": "Consultar profesional antes de usar en embarazo, lactancia o si se toman medicamentos.",
      "certifications": ["Vegano", "Gluten-Free", "Non-GMO", "GMP", "FDA registered", "ISO terceros"],
      "schedule": { "kind": "weekdays", "days": [0, 1, 2, 3, 4, 5, 6] },
      "defaultDose": 1,
      "doseUnit": "cáps",
      "doseStep": 1,
      "timing": "morning",
      "active": true,
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "version": 0
    },
    {
      "id": "a0000000-0000-4000-8000-00000000000b",
      "name": "Mega D3 & MK-7",
      "brand": "NOW Foods",
      "category": "vitamin",
      "description": "Combinación de Vitamina D3 (5.000 IU) y Vitamina K2 como MK-7 (MenaQ7® 180 mcg) para soporte óseo, cardiovascular y metabolismo del calcio.",
      "form": "cápsulas vegetarianas",
      "presentation": "frasco 60 cápsulas",
      "activeIngredients": [
        {
          "name": "Vitamina D3",
          "form": "Colecalciferol",
          "amount": 5000,
          "unit": "IU",
          "source": "lanolina"
        },
        {
          "name": "Vitamina K2 (MK-7)",
          "form": "Menaquinona-7",
          "amount": 180,
          "unit": "mcg",
          "brand": "MenaQ7®"
        }
      ],
      "excipients": "Celulosa microcristalina, hipromelosa, almidón modificado, maltodextrina, dióxido de silicio",
      "benefits": "Soporte óseo y dental; salud cardiovascular; metabolismo adecuado del calcio; apoyo inmune (D3); formación de huesos fuertes. MK-7 dirige el calcio a los huesos evitando acumulación en arterias.",
      "instructions": "1 cápsula diaria con comida que contenga grasa",
      "warnings": "Consultar profesional si se toman anticoagulantes o se tiene alguna condición médica.",
      "certifications": ["Non-GMO", "Kosher", "GMP", "Sin soja"],
      "schedule": { "kind": "weekdays", "days": [0, 1, 2, 3, 4, 5, 6] },
      "defaultDose": 1,
      "doseUnit": "cáps",
      "doseStep": 1,
      "timing": "morning",
      "active": true,
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "version": 0
    },
    {
      "id": "a0000000-0000-4000-8000-00000000000c",
      "name": "Methylated B Complex",
      "brand": "NatureBell",
      "category": "vitamin",
      "description": "Complejo vitamínico B 12-en-1 con formas bioactivas y metiladas (metilfolato + metilcobalamina) más vitaminas C, E, inositol y colina. Alta biodisponibilidad.",
      "form": "cápsulas vegetarianas",
      "presentation": "envase 240 cápsulas",
      "activeIngredients": [
        { "name": "Vitamina C (Acerola)", "form": "ácido ascórbico natural", "amount": 45, "unit": "mg" },
        { "name": "Vitamina E", "form": "tocoferol mixto", "amount": 18, "unit": "mg" },
        { "name": "Tiamina (B1)", "form": "tiamina HCl", "amount": 100, "unit": "mg" },
        { "name": "Riboflavina (B2)", "form": "Riboflavina-5-fosfato (R5'P)", "amount": 30, "unit": "mg" },
        { "name": "Niacina (B3)", "form": "niacinamida", "amount": 50, "unit": "mg" },
        { "name": "Ácido pantoténico (B5)", "form": "pantotenato de calcio", "amount": 50, "unit": "mg" },
        { "name": "Vitamina B6", "form": "Piridoxal-5-fosfato (P5P)", "amount": 20, "unit": "mg" },
        { "name": "Biotina (B7)", "form": "D-Biotina", "amount": 2000, "unit": "mcg" },
        { "name": "Folato (B9)", "form": "L-Metilfolato (Methyl Folate)", "amount": 1000, "unit": "mcg" },
        { "name": "Vitamina B12", "form": "Metilcobalamina", "amount": 1000, "unit": "mcg" },
        { "name": "Colina", "form": "bitartrato de colina", "amount": 30, "unit": "mg" },
        { "name": "Inositol", "form": "mio-inositol", "amount": 20, "unit": "mg" }
      ],
      "excipients": "Harina de arroz, celulosa vegetal (cápsula). Libre de soja, lácteos, gluten, trigo, huevos, pescado.",
      "benefits": "Soporte energético y metabólico; apoyo al sistema inmune; formas metiladas para alta absorción; reduce homocisteína; soporte prenatal y postnatal.",
      "instructions": "2 cápsulas al día con alimentos",
      "certifications": ["Non-GMO", "Gluten-Free", "Sin soja", "GMP"],
      "schedule": { "kind": "weekdays", "days": [0, 1, 2, 3, 4, 5, 6] },
      "defaultDose": 2,
      "doseUnit": "cáps",
      "doseStep": 1,
      "timing": "morning",
      "active": true,
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "version": 0
    },
    {
      "id": "a0000000-0000-4000-8000-00000000000d",
      "name": "Omega-3 TG",
      "brand": "Innovanaturals",
      "category": "supplement",
      "description": "Omega-3 en forma de triglicéridos (TG) con certificaciones IFOS y GOED 5 estrellas. Alta concentración EPA+DHA, libre de contaminantes y metales pesados.",
      "form": "cápsulas",
      "activeIngredients": [
        {
          "name": "EPA (ácido eicosapentaenoico)",
          "form": "triglicéridos (TG)",
          "amount": 1440,
          "unit": "mg"
        },
        {
          "name": "DHA (ácido docosahexaenoico)",
          "form": "triglicéridos (TG)",
          "amount": 960,
          "unit": "mg"
        }
      ],
      "benefits": "Potente efecto antiinflamatorio; mejora salud cardiovascular; contribuye a salud cerebral y del sistema nervioso; soporte inmunológico; reduce triglicéridos; alivia dolores articulares; mejora memoria y visión.",
      "instructions": "4 cápsulas diarias con las comidas principales (o 2+2)",
      "certifications": ["IFOS 5 estrellas", "GOED 5 estrellas", "Gluten-Free"],
      "schedule": { "kind": "weekdays", "days": [0, 1, 2, 3, 4, 5, 6] },
      "defaultDose": 4,
      "doseUnit": "cáps",
      "doseStep": 1,
      "timing": "midday",
      "active": true,
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "version": 0
    },
    {
      "id": "a0000000-0000-4000-8000-00000000000e",
      "name": "DHEA 100mg",
      "brand": "NatureBell",
      "category": "hormone",
      "description": "DHEA (dehidroepiandrosterona) micronizado de alta potencia y absorción. Fuente vegetal pura. Soporte a energía, metabolismo, envejecimiento saludable y función cerebral.",
      "form": "cápsulas vegetarianas",
      "presentation": "envase 240 cápsulas",
      "activeIngredients": [
        {
          "name": "DHEA (Dehidroepiandrosterona)",
          "form": "micronizado, fuente vegetal",
          "amount": 100,
          "unit": "mg"
        }
      ],
      "excipients": "Harina de arroz, celulosa vegetal (cápsula). Non-GMO, libre de soja, lácteos, gluten.",
      "benefits": "Soporte energético, metabólico y antioxidante; promueve envejecimiento saludable; soporte hormonal general.",
      "instructions": "2 cápsulas al día con alimentos",
      "warnings": "Consultar profesional antes de usar, especialmente si se tienen condiciones médicas preexistentes o se utilizan medicamentos. No exceder la dosis recomendada.",
      "certifications": ["Non-GMO", "Gluten-Free", "GMP"],
      "schedule": { "kind": "weekdays", "days": [0, 1, 2, 3, 4, 5, 6] },
      "defaultDose": 2,
      "doseUnit": "cáps",
      "doseStep": 1,
      "timing": "morning",
      "active": true,
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "version": 0
    },
    {
      "id": "a0000000-0000-4000-8000-00000000000f",
      "name": "Clomifeno Citrato 50mg",
      "brand": "Genozym",
      "category": "medication",
      "description": "SERM (modulador selectivo de receptores de estrógeno). Uso off-label en hombres con hipogonadismo secundario para estimular producción endógena de testosterona (vía LH/FSH) preservando fertilidad.",
      "form": "comprimidos recubiertos",
      "presentation": "envase 20-60 comprimidos",
      "activeIngredients": [
        {
          "name": "Clomifeno citrato",
          "form": "SERM — estimulante del eje hipotálamo-hipófisis-gónadas",
          "amount": 50,
          "unit": "mg"
        }
      ],
      "excipients": "Croscarmelosa sódica, estearato de magnesio y excipientes farmacéuticos estándar.",
      "benefits": "Aumenta LH y FSH endógenas; eleva testosterona sin suprimir eje hormonal; preserva espermatogénesis y fertilidad.",
      "instructions": "Según prescripción médica. Uso off-label en hombres: generalmente 25-50mg diarios o en días alternos bajo supervisión.",
      "warnings": "Medicamento de venta bajo receta. Requiere monitoreo periódico de testosterona, estradiol y hematocrito. Posibles efectos: visión borrosa, cambios de humor, cefaleas, ginecomastia. No usar sin indicación profesional.",
      "certifications": [],
      "schedule": { "kind": "weekdays", "days": [0, 1, 2, 3, 4, 5, 6] },
      "defaultDose": 1,
      "doseUnit": "comprimidos",
      "doseStep": 1,
      "timing": "morning",
      "active": true,
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "version": 0
    },
    {
      "id": "a0000000-0000-4000-8000-000000000010",
      "name": "Cabergolina 0.5mg",
      "brand": "Lactamax",
      "category": "medication",
      "description": "Agonista dopaminérgico D2 de acción prolongada. Reduce eficazmente los niveles de prolactina sérica. Indicado para hiperprolactinemia y prolactinomas.",
      "form": "comprimidos",
      "presentation": "envase 2-8 comprimidos",
      "activeIngredients": [
        {
          "name": "Cabergolina",
          "form": "agonista selectivo de receptores dopaminérgicos D2",
          "amount": 0.5,
          "unit": "mg"
        }
      ],
      "excipients": "Lactosa, celulosa microcristalina, estearato de magnesio.",
      "benefits": "Reducción efectiva y sostenida de prolactina sérica; acción prolongada permite dosificación semanal.",
      "instructions": "Hiperprolactinemia: 0.5mg/semana en 1-2 tomas, ajustando según respuesta clínica y niveles de prolactina.",
      "warnings": "Solo bajo supervisión médica. Puede causar náuseas, mareos, hipotensión ortostática, cefalea y somnolencia. Uso prolongado puede asociarse a fibrosis valvular cardíaca. Requiere seguimiento clínico periódico.",
      "certifications": [],
      "schedule": { "kind": "fixed_interval", "intervalDays": 7, "alertDaysBefore": 1 },
      "defaultDose": 1,
      "doseUnit": "comprimidos",
      "doseStep": 0.5,
      "timing": "evening",
      "active": true,
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "version": 0
    },
    {
      "id": "a0000000-0000-4000-8000-000000000011",
      "name": "Testenat Depot Enantato 250mg",
      "brand": "Landerlan Gold",
      "category": "medication",
      "description": "Enantato de testosterona inyectable (éster de acción prolongada). Terapia de reemplazo hormonal (TRT) para hombres con hipogonadismo diagnosticado. 250mg/ml, vial 10ml.",
      "form": "solución inyectable intramuscular (vial)",
      "presentation": "vial 10ml / 250mg por ml",
      "activeIngredients": [
        {
          "name": "Enantato de testosterona",
          "form": "éster de acción prolongada, liberación sostenida",
          "amount": 250,
          "unit": "mg"
        }
      ],
      "excipients": "Aceite vehicular (aceite de semilla de uva o similar) y excipientes farmacéuticos.",
      "benefits": "Mantiene niveles séricos de testosterona durante varios días; restaura vitalidad, masa muscular, libido y bienestar en hombres con hipogonadismo.",
      "instructions": "Dosis y frecuencia según indicación médica y controles de laboratorio. Administración intramuscular.",
      "warnings": "Medicamento controlado — solo bajo prescripción médica. Requiere monitoreo de testosterona, hematocrito, perfil lipídico y función prostática. Puede causar supresión del eje hormonal, acné, ginecomastia, retención de líquidos y eventos cardiovasculares.",
      "certifications": [],
      "schedule": { "kind": "fixed_interval", "intervalDays": 7, "alertDaysBefore": 2 },
      "defaultDose": 0.4,
      "doseUnit": "ml",
      "doseStep": 0.05,
      "timing": "evening",
      "active": true,
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "version": 0
    },
    {
      "id": "a0000000-0000-4000-8000-000000000012",
      "name": "GHK-Cu (Péptido de Cobre)",
      "brand": "Revolution Pharma",
      "category": "other",
      "description": "Péptido GHK-Cu (Glicil-L-Histidil-L-Lisina-Cobre) liofilizado para uso subcutáneo. Regeneración tisular, estimulación de colágeno y elastina, anti-envejecimiento y cicatrización. Polvo liofilizado 50mg/vial.",
      "form": "polvo liofilizado para inyección subcutánea (vial)",
      "presentation": "vial 50mg",
      "activeIngredients": [
        {
          "name": "GHK-Cu",
          "form": "Glicil-L-Histidil-L-Lisina-Cobre, péptido de cobre tripeptídico",
          "amount": 50,
          "unit": "mg"
        }
      ],
      "benefits": "Regeneración tisular; estimulación de síntesis de colágeno y elastina; efecto antiaging; mejora de calidad capilar y textura de piel; cicatrización.",
      "instructions": "1-2mg/día vía subcutánea, reconstituido con agua bacteriostática. Rotar sitios de inyección.",
      "warnings": "Uso bajo supervisión médica. No aprobado por FDA para inyección. Evidencia clínica limitada en humanos para uso inyectable. Incertidumbre sobre pureza y esterilidad del producto.",
      "certifications": [],
      "schedule": { "kind": "weekdays", "days": [0, 1, 2, 3, 4, 5, 6] },
      "defaultDose": 1,
      "doseUnit": "mg",
      "doseStep": 0.5,
      "timing": "morning",
      "active": true,
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "version": 0
    }
  ]
}
```

- [ ] **Step 3.2: Validate seed has correct count**

Open `src/data/seed-supplements.json` and confirm the `supplements` array contains exactly 18 objects. Count the `"id": "a0000000-...` lines — should be 18.

- [ ] **Step 3.3: Commit**

```bash
git add src/data/seed-supplements.json
git commit -m "feat: seed JSON with 18 supplements and medications"
```

---

## Task 4: Update CabinetView — Import/Export buttons + toast

**Files:**
- Modify: `src/components/cabinet/CabinetView.tsx`

- [ ] **Step 4.1: Rewrite `CabinetView.tsx` with import/export**

Replace the entire file content:

```tsx
import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store'
import { SupplementCard } from './SupplementCard'
import { SupplementForm } from './SupplementForm'
import { CabinetExportSchema } from '../../schema/zod-schemas'
import { importCabinet } from '../../utils/importCabinet'
import type { Supplement, CabinetExport } from '../../schema/types'

type Toast = { message: string; type: 'success' | 'error' }

export function CabinetView() {
  const supplements = useStore(s => s.supplements)
  const addSupplement = useStore(s => s.addSupplement)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Supplement | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const active = Object.values(supplements).filter(s => s.active)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target!.result as string)
        const result = CabinetExportSchema.safeParse(raw)
        if (!result.success) {
          const msg = result.error.issues[0]?.message ?? 'formato incorrecto'
          setToast({ message: `Archivo inválido: ${msg}`, type: 'error' })
          return
        }
        const { toAdd, skipped } = importCabinet(result.data, supplements)
        toAdd.forEach(s => addSupplement(s))
        const added = toAdd.length
        const p = (count: number, word: string) => `${count} ${word}${count !== 1 ? 's' : ''}`
        const msg = `${p(added, 'suplemento')} agregado${added !== 1 ? 's' : ''}` +
          (skipped.length > 0 ? `, ${p(skipped.length, 'omitido')} (ya existían)` : '')
        setToast({ message: msg, type: 'success' })
      } catch {
        setToast({ message: 'El archivo no es JSON válido', type: 'error' })
      }
    }
    reader.readAsText(file)
  }

  function handleExport() {
    const payload: CabinetExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      supplements: active,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meditrack-cabinet-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="pb-24 min-h-full">
      <div className="px-4 pt-6 pb-4 flex justify-between items-center gap-2">
        <h1 className="text-xl font-bold text-white">Botiquín</h1>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            Importar
          </button>
          <button
            onClick={handleExport}
            disabled={active.length === 0}
            className="bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Exportar
          </button>
          <button
            onClick={() => { setEditing(null); setFormOpen(true) }}
            className="bg-sky-600 hover:bg-sky-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            + Agregar
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImport}
      />

      {toast && (
        <div className={`mx-4 mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
          toast.type === 'success'
            ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
            : 'bg-red-900/60 text-red-300 border border-red-700'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="px-4 space-y-3">
        {active.length === 0 && (
          <p className="text-slate-500 text-center py-16 text-sm">
            No hay suplementos.<br />Tocá "+ Agregar" para empezar.
          </p>
        )}
        {active.map(s => (
          <SupplementCard
            key={s.id}
            supplement={s}
            onEdit={() => { setEditing(s); setFormOpen(true) }}
          />
        ))}
      </div>

      <SupplementForm
        open={formOpen}
        supplement={editing}
        onClose={() => { setFormOpen(false); setEditing(null) }}
      />
    </div>
  )
}
```

- [ ] **Step 4.2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4.3: Run all tests**

```bash
npm test
```

Expected: all tests PASS (existing + new importCabinet tests).

- [ ] **Step 4.4: Commit**

```bash
git add src/components/cabinet/CabinetView.tsx
git commit -m "feat: import/export JSON buttons + toast in CabinetView"
```

---

## Task 5: Manual smoke test

- [ ] **Step 5.1: Start dev server and open app**

Double-click `serve.bat` or run `npm run dev`. Open `http://localhost:5173`.

- [ ] **Step 5.2: Import the seed file**

Navigate to Botiquín → click "Importar" → select `src/data/seed-supplements.json`.

Expected toast: `"18 suplementos agregados"`

- [ ] **Step 5.3: Verify 18 cards appear in cabinet**

Scroll through the list. Confirm all 18 entries are visible.

- [ ] **Step 5.4: Test dedup — import same file again**

Click "Importar" again, select same seed file.

Expected toast: `"0 suplementos agregados, 18 omitidos (ya existían)"`

- [ ] **Step 5.5: Test export**

Click "Exportar". Confirm a JSON file downloads named `meditrack-cabinet-2026-06-18.json`. Open it and verify it has 18 entries and `"version": 1`.

- [ ] **Step 5.6: Test invalid file**

Create a file with `{ "bad": true }`. Import it.

Expected toast: `"Archivo inválido: ..."` (red).

- [ ] **Step 5.7: Final commit**

```bash
git add -A
git commit -m "feat: cabinet import/export complete — 18 products seeded"
```
