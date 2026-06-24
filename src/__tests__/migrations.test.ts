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
    expect(result._version).toBe(CURRENT_VERSION)
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

describe('v4 → v5 (symptomLog)', () => {
  it('creates symptomLog from existing symptoms', () => {
    const v4: any = {
      _version: 4, _createdAt: '', _updatedAt: '', _checksum: '',
      supplements: {},
      dailyLogs: {
        '2026-06-20': {
          id: '2026-06-20', date: '2026-06-20',
          entries: [], skipped: [], notes: [],
          symptoms: { energy: 4, libido: 3, sleep: 5, recovery: 3, mood: 4, erectionQuality: 3, nippleSensitivity: false, orgasms: 1 },
          sealed: false, checksum: '', createdAt: '', updatedAt: '',
        },
      },
      migrations: [], bloodWork: [], bpReadings: [],
    }
    const result = migrate(4, v4)
    expect(result._version).toBe(5)
    const log = result.dailyLogs['2026-06-20']
    expect(log.symptomLog).toHaveLength(1)
    expect(log.symptomLog![0].symptoms.energy).toBe(4)
    expect(log.symptomLog![0].id).toBeTruthy()
    expect(log.symptoms).toBeDefined()
  })

  it('skips logs without symptoms', () => {
    const v4: any = {
      _version: 4, _createdAt: '', _updatedAt: '', _checksum: '',
      supplements: {},
      dailyLogs: {
        '2026-06-20': { id: '2026-06-20', date: '2026-06-20', entries: [], skipped: [], notes: [], sealed: false, checksum: '', createdAt: '', updatedAt: '' },
      },
      migrations: [], bloodWork: [], bpReadings: [],
    }
    const result = migrate(4, v4)
    expect(result.dailyLogs['2026-06-20'].symptomLog).toBeUndefined()
  })

  it('current → current returns same object', () => {
    const schema = createFreshSchema()
    expect(migrate(5, schema)).toBe(schema)
  })
})
