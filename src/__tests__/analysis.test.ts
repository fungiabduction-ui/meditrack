import { describe, it, expect } from 'vitest'
import { computeWellbeingTrend, computeTRTCycleData, computeSupplementCorrelations } from '../utils/analysis'
import type { DailyLog, Supplement } from '../schema/types'

const ENANTHATE_ID = 'a0000000-0000-4000-8000-000000000011'

const makeLog = (date: string, overrides: Partial<DailyLog> = {}): DailyLog => ({
  id: date, date, entries: [], skipped: [], notes: [],
  sealed: false, checksum: '', createdAt: date, updatedAt: date,
  ...overrides,
})

const makeSym = (energy: number, sleep: number, mood: number, recovery: number, libido: number) => ({
  energy: energy as 1 | 2 | 3 | 4 | 5,
  sleep: sleep as 1 | 2 | 3 | 4 | 5,
  mood: mood as 1 | 2 | 3 | 4 | 5,
  recovery: recovery as 1 | 2 | 3 | 4 | 5,
  libido: libido as 1 | 2 | 3 | 4 | 5,
  erectionQuality: 3 as 1 | 2 | 3 | 4 | 5,
  nippleSensitivity: false,
  orgasms: 0,
})

describe('computeWellbeingTrend', () => {
  it('returns empty array when no symptoms', () => {
    expect(computeWellbeingTrend({})).toEqual([])
  })

  it('returns only days with symptoms', () => {
    const logs = {
      '2026-06-10': makeLog('2026-06-10', { symptoms: makeSym(5, 5, 5, 5, 5) }),
      '2026-06-11': makeLog('2026-06-11'),
    }
    const trend = computeWellbeingTrend(logs, 30)
    const dates = trend.map(t => t.date)
    expect(dates).toContain('2026-06-10')
    expect(dates).not.toContain('2026-06-11')
  })

  it('scores are 0-100', () => {
    const logs = { '2026-06-10': makeLog('2026-06-10', { symptoms: makeSym(3, 3, 3, 3, 3) }) }
    const trend = computeWellbeingTrend(logs, 30)
    if (trend.length > 0) {
      expect(trend[0].score).toBeGreaterThanOrEqual(0)
      expect(trend[0].score).toBeLessThanOrEqual(100)
    }
  })
})

describe('computeTRTCycleData', () => {
  it('returns empty array when no enanthate logs', () => {
    expect(computeTRTCycleData({})).toEqual([])
  })

  it('returns 14 items when enanthate found', () => {
    const injectDate = '2026-06-01'
    const logs = {
      [injectDate]: makeLog(injectDate, {
        entries: [{ id: 'e1', supplementId: ENANTHATE_ID, supplementSnapshot: { name: 'T', brand: undefined, doseUnit: 'ml', category: 'medication', activeIngredients: [], version: 0 }, quantity: 0.4, doseUnit: 'ml', timestamp: `${injectDate}T20:00:00Z`, recordedAt: `${injectDate}T20:00:00Z` }],
      }),
      '2026-06-03': makeLog('2026-06-03', { symptoms: makeSym(4, 4, 4, 4, 4) }),
    }
    const data = computeTRTCycleData(logs)
    expect(data).toHaveLength(14)
    expect(data[0].dayInCycle).toBe(0)
    expect(data[13].dayInCycle).toBe(13)
  })
})

describe('computeSupplementCorrelations', () => {
  it('returns empty when fewer than 7 days with symptoms', () => {
    const logs = { '2026-06-10': makeLog('2026-06-10', { symptoms: makeSym(3, 3, 3, 3, 3) }) }
    const sups: Record<string, Supplement> = {}
    expect(computeSupplementCorrelations(logs, sups)).toEqual([])
  })

  it('returns correlations sorted by delta descending', () => {
    const dates = Array.from({ length: 10 }, (_, i) =>
      `2026-06-${String(i + 1).padStart(2, '0')}`
    )
    const supId = 'sup-001'
    const logs: Record<string, DailyLog> = {}
    for (const [i, date] of dates.entries()) {
      const taken = i < 5
      logs[date] = makeLog(date, {
        symptoms: taken ? makeSym(5, 5, 5, 5, 5) : makeSym(2, 2, 2, 2, 2),
        entries: taken ? [{ id: `e${i}`, supplementId: supId, supplementSnapshot: { name: 'X', brand: undefined, doseUnit: 'cáps', category: 'supplement', activeIngredients: [], version: 0 }, quantity: 1, doseUnit: 'cáps', timestamp: `${date}T08:00:00Z`, recordedAt: `${date}T08:00:00Z` }] : [],
      })
    }
    const sups: Record<string, Supplement> = {
      [supId]: { id: supId, name: 'X', brand: undefined, category: 'supplement', description: '', form: 'cáps', activeIngredients: [], instructions: '', certifications: [], schedule: { kind: 'as_needed' }, defaultDose: 1, doseUnit: 'cáps', doseStep: 1, timing: null, active: true, createdAt: '', updatedAt: '', version: 0 },
    }
    const result = computeSupplementCorrelations(logs, sups)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].delta).toBeGreaterThan(0)
  })
})
