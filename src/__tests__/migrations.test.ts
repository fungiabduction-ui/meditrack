import { describe, it, expect } from 'vitest'
import { createFreshSchema, migrate, CURRENT_VERSION } from '../storage/migrations'

describe('createFreshSchema', () => {
  it('returns valid current-version schema', () => {
    const s = createFreshSchema()
    expect(s._version).toBe(CURRENT_VERSION)
    expect(s.supplements).toEqual({})
    expect(s.dailyLogs).toEqual({})
    expect(s.bloodWork).toEqual([])
    expect(s.bpReadings).toEqual([])
    expect(s._checksum).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('migrate', () => {
  it('v0 → current creates valid schema', () => {
    const result = migrate(0, {})
    expect(result._version).toBe(CURRENT_VERSION)
    expect(result.bloodWork).toEqual([])
    expect(result.bpReadings).toEqual([])
    expect(result.migrations.some((m: { from: number }) => m.from === 0)).toBe(true)
  })

  it('v1 → v2 adds bloodWork array', () => {
    const v1Schema = {
      _version: 1, _createdAt: '', _updatedAt: '', _checksum: '',
      supplements: {}, dailyLogs: {}, migrations: [],
    }
    const result = migrate(1, v1Schema)
    expect(result._version).toBe(CURRENT_VERSION)
    expect(result.bloodWork).toEqual([])
    expect(result.migrations.some((m: { from: number }) => m.from === 1)).toBe(true)
  })

  it('v3 → v4 adds bpReadings array', () => {
    const v3Schema = {
      _version: 3, _createdAt: '', _updatedAt: '', _checksum: '',
      supplements: {}, dailyLogs: {}, migrations: [], bloodWork: [],
    }
    const result = migrate(3, v3Schema)
    expect(result._version).toBe(4)
    expect(result.bpReadings).toEqual([])
    expect(result.migrations.some((m: { from: number }) => m.from === 3)).toBe(true)
  })

  it('v0 → current includes bpReadings', () => {
    const result = migrate(0, {})
    expect(result.bpReadings).toEqual([])
  })

  it('current → current returns data as-is', () => {
    const schema = createFreshSchema()
    expect(migrate(CURRENT_VERSION, schema)).toBe(schema)
  })

  it('unknown version throws', () => {
    expect(() => migrate(99, {})).toThrow('Unknown schema version: 99')
  })
})
