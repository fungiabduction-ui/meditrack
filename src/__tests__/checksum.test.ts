import { describe, it, expect } from 'vitest'
import { computeChecksum } from '../storage/checksum'

describe('computeChecksum', () => {
  it('is deterministic', () => {
    const data = { a: 1, b: 'x' }
    expect(computeChecksum(data)).toBe(computeChecksum(data))
  })

  it('changes when data changes', () => {
    expect(computeChecksum({ a: 1 })).not.toBe(computeChecksum({ a: 2 }))
  })

  it('returns 8-char hex string', () => {
    expect(computeChecksum({})).toMatch(/^[0-9a-f]{8}$/)
  })
})
