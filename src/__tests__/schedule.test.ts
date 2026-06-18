import { describe, it, expect } from 'vitest'
import { isScheduledToday, calcNextDue, isAlertActive } from '../utils/schedule'
import { Supplement } from '../schema/types'

const base: Supplement = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Test', brand: undefined, category: 'supplement',
  description: '', form: '', activeIngredients: [], instructions: '',
  certifications: [], defaultDose: 1, doseUnit: 'caps', doseStep: 1,
  timing: 'morning', active: true, version: 0,
  createdAt: '', updatedAt: '',
  schedule: { kind: 'as_needed' },
}

describe('isScheduledToday', () => {
  it('as_needed returns false', () => {
    expect(isScheduledToday({ ...base, schedule: { kind: 'as_needed' } }, '2026-06-17')).toBe(false)
  })

  it('weekdays matches correct days', () => {
    // 2026-06-17 is Wednesday = index 2 (0=Lun)
    const s = { ...base, schedule: { kind: 'weekdays' as const, days: [0, 1, 2, 3, 4] } }
    expect(isScheduledToday(s, '2026-06-17')).toBe(true)
    // 2026-06-20 is Saturday = index 5
    expect(isScheduledToday(s, '2026-06-20')).toBe(false)
  })

  it('fixed_interval matches nextDue date', () => {
    const s = {
      ...base,
      schedule: { kind: 'fixed_interval' as const, intervalDays: 7, alertDaysBefore: 2 },
      nextDue: '2026-06-17T20:00:00.000Z',
    }
    expect(isScheduledToday(s, '2026-06-17')).toBe(true)
    expect(isScheduledToday(s, '2026-06-18')).toBe(false)
  })
})

describe('calcNextDue', () => {
  it('adds intervalDays milliseconds', () => {
    const ts = '2026-06-17T20:00:00.000Z'
    const next = calcNextDue(ts, 7)
    expect(next).toBe('2026-06-24T20:00:00.000Z')
  })
})

describe('isAlertActive', () => {
  it('returns true when within alertDaysBefore window', () => {
    const twoDaysFromNow = new Date(Date.now() + 2 * 86_400_000 - 3_600_000).toISOString()
    const s = {
      ...base,
      schedule: { kind: 'fixed_interval' as const, intervalDays: 7, alertDaysBefore: 2 },
      nextDue: twoDaysFromNow,
    }
    expect(isAlertActive(s)).toBe(true)
  })

  it('returns false for as_needed', () => {
    expect(isAlertActive(base)).toBe(false)
  })
})
