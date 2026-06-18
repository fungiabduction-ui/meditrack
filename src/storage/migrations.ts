import type { StorageSchema } from '../schema/types'
import { computeChecksum } from './checksum'

export const CURRENT_VERSION = 1

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
    return migrated
  }
  throw new Error(`Unknown schema version: ${version}`)
}
