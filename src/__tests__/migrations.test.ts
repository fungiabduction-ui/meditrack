import { describe, it, expect } from 'vitest'
import { createFreshSchema, migrate, CURRENT_VERSION } from '../storage/migrations'

describe('createFreshSchema', () => {
  it('returns valid v1 schema', () => {
    const s = createFreshSchema()
    expect(s._version).toBe(CURRENT_VERSION)
    expect(s.supplements).toEqual({})
    expect(s.dailyLogs).toEqual({})
    expect(s._checksum).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('migrate', () => {
  it('v0 → v1 creates valid schema', () => {
    const result = migrate(0, {})
    expect(result._version).toBe(1)
    expect(result.migrations[0].from).toBe(0)
  })

  it('v1 → v1 returns data as-is', () => {
    const schema = createFreshSchema()
    expect(migrate(1, schema)).toBe(schema)
  })

  it('unknown version throws', () => {
    expect(() => migrate(99, {})).toThrow('Unknown schema version: 99')
  })
})
