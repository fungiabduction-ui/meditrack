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
