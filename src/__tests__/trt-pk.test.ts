import { describe, it, expect } from 'vitest'
import { computePKCurve, generateSteadyState, findReinjectionWindows } from '../utils/trt-pk'

describe('computePKCurve', () => {
  it('returns empty array for no injections', () => {
    expect(computePKCurve([], 14)).toEqual([])
  })

  it('starts at 0 (no concentration at t=0)', () => {
    const curve = computePKCurve([{ date: '2026-01-01', mgDose: 100 }], 30)
    expect(curve[0].level).toBe(0)
  })

  it('peak occurs between day 2 and day 4', () => {
    const curve = computePKCurve([{ date: '2026-01-01', mgDose: 100 }], 30)
    const peak = curve.reduce((a, b) => a.level > b.level ? a : b)
    expect(peak.t).toBeGreaterThan(2)
    expect(peak.t).toBeLessThan(4)
  })

  it('normalizes peak to 100', () => {
    const curve = computePKCurve([{ date: '2026-01-01', mgDose: 100 }], 30)
    const max = Math.max(...curve.map(p => p.level))
    expect(max).toBeCloseTo(100, 0)
  })

  it('level at t=25 is below 10% (mostly eliminated after 5 half-lives)', () => {
    const curve = computePKCurve([{ date: '2026-01-01', mgDose: 100 }], 30)
    const at25 = curve.find(p => Math.abs(p.t - 25) < 0.5)
    if (at25) expect(at25.level).toBeLessThan(10)
  })

  it('two injections produce same length curve as one', () => {
    const one = computePKCurve([{ date: '2026-01-01', mgDose: 100 }], 30)
    const two = computePKCurve([
      { date: '2026-01-01', mgDose: 100 },
      { date: '2026-01-15', mgDose: 100 },
    ], 30)
    expect(two.length).toBe(one.length)
  })

  it('all levels are between 0 and 100', () => {
    const curve = computePKCurve([{ date: '2026-01-01', mgDose: 100 }], 30)
    expect(curve.every(p => p.level >= 0 && p.level <= 100)).toBe(true)
  })
})

describe('generateSteadyState', () => {
  it('returns points', () => {
    const curve = generateSteadyState(7, 100)
    expect(curve.length).toBeGreaterThan(0)
  })

  it('all levels >= 0', () => {
    expect(generateSteadyState(14, 100).every(p => p.level >= 0)).toBe(true)
  })

  it('2x/week (3.5d) has higher trough than 1x/14d at steady state', () => {
    const q2 = generateSteadyState(3.5, 100, 10)
    const q14 = generateSteadyState(14, 100, 10)
    const lastCycleMin = (curve: Array<{ t: number; level: number }>, interval: number) => {
      const last = curve.filter(p => p.t >= interval * 8)
      return Math.min(...last.map(p => p.level))
    }
    expect(lastCycleMin(q2, 3.5)).toBeGreaterThan(lastCycleMin(q14, 14))
  })
})

describe('findReinjectionWindows', () => {
  it('finds window when level drops below threshold', () => {
    const curve = [
      { t: 0, level: 100 },
      { t: 5, level: 50 },
      { t: 10, level: 20 },
      { t: 15, level: 10 },
    ]
    const windows = findReinjectionWindows(curve, 30)
    expect(windows.length).toBeGreaterThan(0)
    expect(windows[0].tStart).toBe(10)
  })

  it('returns empty when level never drops below threshold', () => {
    const curve = [
      { t: 0, level: 80 },
      { t: 5, level: 60 },
      { t: 10, level: 50 },
    ]
    expect(findReinjectionWindows(curve, 30)).toEqual([])
  })

  it('tail stays open if still below threshold at end', () => {
    const curve = [
      { t: 0, level: 100 },
      { t: 10, level: 20 },
      { t: 20, level: 5 },
    ]
    const windows = findReinjectionWindows(curve, 30)
    expect(windows[0].tEnd).toBe(20)
  })
})
