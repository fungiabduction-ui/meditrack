import type { DailyLog } from '../schema/types'

export function getHistoricalDose(
  supplementId: string,
  dailyLogs: Record<string, DailyLog>,
  defaultDose: number
): { dose: number; percent: number | null } {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const entries = Object.entries(dailyLogs)
    .filter(([date]) => date >= cutoffStr)
    .flatMap(([, log]) => log.entries)
    .filter(e => e.supplementId === supplementId)

  if (entries.length < 3) return { dose: defaultDose, percent: null }

  const freq: Record<number, number> = {}
  for (const e of entries) {
    freq[e.quantity] = (freq[e.quantity] ?? 0) + 1
  }

  const sorted = Object.entries(freq).sort(([, a], [, b]) => b - a)
  const topQty = Number(sorted[0][0])
  const topCount = sorted[0][1]
  const percent = Math.round((topCount / entries.length) * 100)

  if (percent >= 60) return { dose: topQty, percent }
  return { dose: defaultDose, percent: null }
}
