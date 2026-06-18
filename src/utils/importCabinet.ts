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
