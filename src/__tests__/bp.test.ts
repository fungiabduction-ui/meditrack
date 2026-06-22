import { describe, it, expect } from 'vitest'
import { classifyBP, computeEMA } from '../utils/bp'

describe('classifyBP', () => {
  it('Normal — SYS < 120 AND DIA < 80', () => {
    expect(classifyBP(115, 75).label).toBe('Normal')
    expect(classifyBP(115, 75).color).toBe('#22c55e')
  })

  it('Elevada — SYS 120–129 AND DIA < 80', () => {
    expect(classifyBP(125, 75).label).toBe('Elevada')
    expect(classifyBP(129, 79).label).toBe('Elevada')
  })

  it('Alta I — SYS 130–139 OR DIA 80–89', () => {
    expect(classifyBP(135, 75).label).toBe('Alta I')
    expect(classifyBP(115, 85).label).toBe('Alta I')
    expect(classifyBP(134, 89).label).toBe('Alta I')
  })

  it('Alta II — SYS >= 140 OR DIA >= 90', () => {
    expect(classifyBP(140, 70).label).toBe('Alta II')
    expect(classifyBP(110, 90).label).toBe('Alta II')
    expect(classifyBP(160, 100).label).toBe('Alta II')
  })

  it('Alta II takes priority when both SYS and DIA qualify for lower category', () => {
    expect(classifyBP(145, 95).label).toBe('Alta II')
  })
})

describe('computeEMA', () => {
  it('returns empty array for empty input', () => {
    expect(computeEMA([], 7)).toEqual([])
  })

  it('returns same value for single-element input', () => {
    expect(computeEMA([120], 7)).toEqual([120])
  })

  it('first value equals first input', () => {
    const result = computeEMA([120, 130, 110], 2)
    expect(result[0]).toBe(120)
  })

  it('EMA smooths values — result length matches input', () => {
    const input = [120, 130, 125, 140, 110, 130, 120]
    const result = computeEMA(input, 3)
    expect(result).toHaveLength(7)
    expect(Math.min(...result)).toBeGreaterThanOrEqual(110)
    expect(Math.max(...result)).toBeLessThanOrEqual(140)
  })

  it('higher period produces smoother (less reactive) EMA', () => {
    const input = [100, 200, 100, 200, 100]
    const ema3 = computeEMA(input, 3)
    const ema7 = computeEMA(input, 7)
    expect(Math.abs(ema7[1] - ema7[0])).toBeLessThan(Math.abs(ema3[1] - ema3[0]))
  })
})
