import { describe, it, expect } from 'vitest'
import { encToken, decToken } from '../utils/github'

describe('encToken / decToken', () => {
  it('round-trips a PAT correctly', () => {
    const token = 'ghp_abc123XYZ789'
    expect(decToken(encToken(token))).toBe(token)
  })

  it('returns empty string for empty input', () => {
    expect(encToken('')).toBe('')
    expect(decToken('')).toBe('')
  })

  it('handles tokens with special characters', () => {
    const token = 'ghp_abc+def/ghi='
    expect(decToken(encToken(token))).toBe(token)
  })
})
