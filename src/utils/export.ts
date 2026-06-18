import type { StorageSchema, DailyLog, DailySymptoms } from '../schema/types'

export type AnalysisExport = {
  exportedAt: string
  from: string
  to: string
  trtContext: {
    startDate: string
    lastInjectionDate: string | null
    dayInCycle: number | null
    cycleIntervalDays: number
  }
  days: DayExport[]
  compliance: {
    totalScheduled: number
    totalLogged: number
    rate: number
  }
  weeklyAverages: Partial<Record<keyof DailySymptoms, number>>
  bloodWork: unknown[]
}

type DayExport = {
  date: string
  sealed: boolean
  dayInEnanthateCycle: number | null
  metabolicTotals: Record<string, { amount: number; unit: string }>
  entriesCount: number
  skippedCount: number
  notes: string[]
  symptoms: DailySymptoms | null
}

const ENANTHATE_ID = 'a0000000-0000-4000-8000-000000000011'
const TRT_START_DATE = '2026-06-17'
const CYCLE_INTERVAL_DAYS = 14

function addDaysToStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + n)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function diffDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const a = new Date(fy, fm - 1, fd).getTime()
  const b = new Date(ty, tm - 1, td).getTime()
  return Math.round((b - a) / 86400000)
}

function getDatesInRange(from: string, to: string): string[] {
  const dates: string[] = []
  let cur = from
  while (cur <= to) {
    dates.push(cur)
    cur = addDaysToStr(cur, 1)
  }
  return dates
}

function findLastInjectionDate(dailyLogs: StorageSchema['dailyLogs']): string | null {
  let last: string | null = null
  for (const log of Object.values(dailyLogs)) {
    const hasEnanthate = log.entries.some(e => e.supplementId === ENANTHATE_ID)
    if (hasEnanthate) {
      if (!last || log.date > last) last = log.date
    }
  }
  return last
}

function buildMetabolicTotals(log: DailyLog): Record<string, { amount: number; unit: string }> {
  const totals: Record<string, { amount: number; unit: string }> = {}
  for (const entry of log.entries) {
    for (const ing of entry.supplementSnapshot.activeIngredients) {
      const key = `${ing.name}__${ing.unit}`
      if (!totals[key]) totals[key] = { amount: 0, unit: ing.unit }
      totals[key].amount += ing.amount * entry.quantity
    }
  }
  return totals
}

export function buildAnalysisExport(schema: StorageSchema, from: string, to: string): AnalysisExport {
  const dates = getDatesInRange(from, to)
  const lastInjectionDate = findLastInjectionDate(schema.dailyLogs)

  const days: DayExport[] = dates.map(date => {
    const log = schema.dailyLogs[date]
    const dayInEnanthateCycle = lastInjectionDate ? diffDays(lastInjectionDate, date) : null

    if (!log) {
      return { date, sealed: false, dayInEnanthateCycle, metabolicTotals: {}, entriesCount: 0, skippedCount: 0, notes: [], symptoms: null }
    }
    return {
      date,
      sealed: log.sealed,
      dayInEnanthateCycle,
      metabolicTotals: buildMetabolicTotals(log),
      entriesCount: log.entries.length,
      skippedCount: log.skipped.length,
      notes: log.notes.map(n => n.text),
      symptoms: log.symptoms ?? null,
    }
  })

  let totalLogged = 0, totalSkipped = 0
  for (const day of days) { totalLogged += day.entriesCount; totalSkipped += day.skippedCount }
  const totalScheduled = totalLogged + totalSkipped
  const rate = totalScheduled > 0 ? totalLogged / totalScheduled : 1

  const symptomsKeys: (keyof DailySymptoms)[] = ['energy', 'libido', 'sleep', 'recovery', 'mood', 'erectionQuality']
  const weeklyAverages: Partial<Record<keyof DailySymptoms, number>> = {}
  const daysWithSymptoms = days.filter(d => d.symptoms !== null)
  if (daysWithSymptoms.length > 0) {
    for (const key of symptomsKeys) {
      const sum = daysWithSymptoms.reduce((acc, d) => acc + (d.symptoms![key] as number), 0)
      weeklyAverages[key] = Math.round((sum / daysWithSymptoms.length) * 100) / 100
    }
  }

  const dayInCycle = lastInjectionDate ? diffDays(lastInjectionDate, to) : null

  return {
    exportedAt: new Date().toISOString(),
    from,
    to,
    trtContext: { startDate: TRT_START_DATE, lastInjectionDate, dayInCycle, cycleIntervalDays: CYCLE_INTERVAL_DAYS },
    days,
    compliance: { totalScheduled, totalLogged, rate },
    weeklyAverages,
    bloodWork: [],
  }
}

export function downloadAnalysisJsonRange(schema: StorageSchema, from: string, to: string): void {
  const data = buildAnalysisExport(schema, from, to)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `meditrack-export-${from}-to-${to}.json`
  a.click()
  URL.revokeObjectURL(url)
}
