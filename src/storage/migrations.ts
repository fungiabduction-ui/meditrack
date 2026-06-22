import type { StorageSchema } from '../schema/types'
import { computeChecksum } from './checksum'

export const CURRENT_VERSION = 4

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
    bpReadings: [],
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
    return migrate(3, migrated)  // Continue to v3→v4 if not at CURRENT_VERSION yet
  }

  if (version === 3) {
    const raw = data as StorageSchema
    const migrated: StorageSchema = {
      ...raw,
      _version: 4,
      bpReadings: [],
      migrations: [
        ...(raw.migrations ?? []),
        { from: 3, to: 4, appliedAt: new Date().toISOString() },
      ],
    }
    return migrated
  }

  throw new Error(`Unknown schema version: ${version}`)
}
