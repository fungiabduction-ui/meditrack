import { describe, it, expect } from 'vitest'
import { computeWellbeingScore } from '../utils/wellbeing'
import type { DailySymptoms } from '../schema/types'

const sym = (overrides: Partial<DailySymptoms> = {}): DailySymptoms => ({
  energy: 3, sleep: 3, mood: 3, recovery: 3, libido: 3,
  erectionQuality: 3, nippleSensitivity: false, orgasms: 0,
  ...overrides,
})

describe('computeWellbeingScore', () => {
  it('all 5s → 100', () => {
    expect(computeWellbeingScore(sym({ energy: 5, sleep: 5, mood: 5, recovery: 5, libido: 5 }))).toBe(100)
  })

  it('all 3s → 60', () => {
    expect(computeWellbeingScore(sym())).toBe(60)
  })

  it('all 1s → 20', () => {
    expect(computeWellbeingScore(sym({ energy: 1, sleep: 1, mood: 1, recovery: 1, libido: 1 }))).toBe(20)
  })

  it('erectionQuality, nippleSensitivity, orgasms do not affect score', () => {
    const base = computeWellbeingScore(sym())
    expect(computeWellbeingScore(sym({ erectionQuality: 5, nippleSensitivity: true, orgasms: 10 }))).toBe(base)
  })

  it('energy and sleep have highest weight', () => {
    const highEnergySleep = computeWellbeingScore(sym({ energy: 5, sleep: 5, mood: 1, recovery: 1, libido: 1 }))
    const highMoodOnly = computeWellbeingScore(sym({ energy: 1, sleep: 1, mood: 5, recovery: 1, libido: 1 }))
    expect(highEnergySleep).toBeGreaterThan(highMoodOnly)
  })
})
