import { describe, it, expect, beforeEach } from 'vitest'
import { read, write } from '../storage/persistence'
import { createFreshSchema } from '../storage/migrations'

beforeEach(() => localStorage.clear())

describe('read', () => {
  it('returns fresh schema when storage is empty', () => {
    const s = read()
    expect(s._version).toBe(2)
    expect(s.supplements).toEqual({})
  })
})

describe('write + read roundtrip', () => {
  it('persists and retrieves schema', () => {
    const schema = createFreshSchema()
    write(schema)
    const retrieved = read()
    expect(retrieved.supplements).toEqual({})
    expect(retrieved._checksum).toMatch(/^[0-9a-f]{8}$/)
  })

  it('updates _updatedAt on write', () => {
    const schema = createFreshSchema()
    const before = new Date().toISOString()
    write(schema)
    const retrieved = read()
    expect(retrieved._updatedAt >= before).toBe(true)
  })
})
