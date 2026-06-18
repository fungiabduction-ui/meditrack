import { describe, it, expect } from 'vitest'
import { getLocalDateStr, parseLocalDate, getLocalHHMM } from '../utils/date'

describe('getLocalDateStr', () => {
  it('formats date without UTC drift', () => {
    const d = new Date(2026, 5, 17) // June 17, 2026 local
    expect(getLocalDateStr(d)).toBe('2026-06-17')
  })

  it('uses today when no arg', () => {
    const result = getLocalDateStr()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('parseLocalDate', () => {
  it('parses without UTC offset', () => {
    const d = parseLocalDate('2026-06-17')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5) // 0-indexed
    expect(d.getDate()).toBe(17)
  })
})

describe('getLocalHHMM', () => {
  it('formats time as HH:MM', () => {
    const d = new Date(2026, 5, 17, 20, 5)
    expect(getLocalHHMM(d)).toBe('20:05')
  })
})
