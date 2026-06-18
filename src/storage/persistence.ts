import { StorageSchema } from '../schema/types'
import { StorageSchemaSchema } from '../schema/zod-schemas'
import { computeChecksum } from './checksum'
import { migrate, createFreshSchema, CURRENT_VERSION } from './migrations'

export const STORAGE_KEY = 'meditrack_v1'

export function read(): StorageSchema {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createFreshSchema()
    const parsed: unknown = JSON.parse(raw)
    const version = typeof (parsed as Record<string, unknown>)._version === 'number'
      ? (parsed as Record<string, unknown>)._version as number
      : 0
    const data = version === CURRENT_VERSION ? parsed : migrate(version, parsed)
    const result = StorageSchemaSchema.safeParse(data)
    if (!result.success) {
      console.error('[persistence] validation failed', result.error.flatten())
      return createFreshSchema()
    }
    return result.data
  } catch (e) {
    console.error('[persistence] read error', e)
    return createFreshSchema()
  }
}

export function write(schema: StorageSchema): void {
  const updated: StorageSchema = {
    ...schema,
    _version: CURRENT_VERSION,
    _updatedAt: new Date().toISOString(),
    _checksum: computeChecksum({ supplements: schema.supplements, dailyLogs: schema.dailyLogs }),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (e) {
    throw new Error(`[persistence] write failed: ${e instanceof Error ? e.message : String(e)}`)
  }
}
