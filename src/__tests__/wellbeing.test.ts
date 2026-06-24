import { describe, it, expect } from 'vitest'
import { computeWellbeingScore, computeAvgSymptoms } from '../utils/wellbeing'
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

const sym2 = (energy: number, sleep: number, mood: number, recovery: number, libido: number) => ({
  energy: energy as 1|2|3|4|5,
  sleep: sleep as 1|2|3|4|5,
  mood: mood as 1|2|3|4|5,
  recovery: recovery as 1|2|3|4|5,
  libido: libido as 1|2|3|4|5,
  erectionQuality: 3 as 1|2|3|4|5,
  nippleSensitivity: false,
  orgasms: 0,
})

describe('computeAvgSymptoms', () => {
  it('returns same entry for single-element array', () => {
    const s = sym2(4, 4, 4, 4, 4)
    expect(computeAvgSymptoms([s])).toEqual(s)
  })

  it('averages numeric fields rounded', () => {
    const avg = computeAvgSymptoms([sym2(2, 2, 2, 2, 2), sym2(4, 4, 4, 4, 4)])
    expect(avg.energy).toBe(3)
    expect(avg.sleep).toBe(3)
    expect(avg.mood).toBe(3)
  })

  it('clamps result to 1-5', () => {
    const avg = computeAvgSymptoms([sym2(1, 1, 1, 1, 1), sym2(2, 2, 2, 2, 2)])
    expect(avg.energy).toBeGreaterThanOrEqual(1)
    expect(avg.energy).toBeLessThanOrEqual(5)
  })

  it('nippleSensitivity true when majority true', () => {
    const a = { ...sym2(3,3,3,3,3), nippleSensitivity: true }
    const b = { ...sym2(3,3,3,3,3), nippleSensitivity: true }
    const c = { ...sym2(3,3,3,3,3), nippleSensitivity: false }
    expect(computeAvgSymptoms([a, b, c]).nippleSensitivity).toBe(true)
  })

  it('nippleSensitivity false when minority true', () => {
    const a = { ...sym2(3,3,3,3,3), nippleSensitivity: true }
    const b = { ...sym2(3,3,3,3,3), nippleSensitivity: false }
    const c = { ...sym2(3,3,3,3,3), nippleSensitivity: false }
    expect(computeAvgSymptoms([a, b, c]).nippleSensitivity).toBe(false)
  })

  it('orgasms is summed across entries', () => {
    const a = { ...sym2(3,3,3,3,3), orgasms: 2 }
    const b = { ...sym2(3,3,3,3,3), orgasms: 1 }
    expect(computeAvgSymptoms([a, b]).orgasms).toBe(3)
  })
})
