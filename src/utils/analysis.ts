import type { DailyLog, LogEntry, Supplement } from '../schema/types'
import { computeWellbeingScore } from './wellbeing'

function isEnanthateEntry(e: LogEntry): boolean {
  const ingMatch = e.supplementSnapshot.activeIngredients.some(
    i =>
      i.name.toLowerCase().includes('testosterona') &&
      i.form.toLowerCase().includes('enantato')
  )
  return ingMatch || e.supplementSnapshot.name.toLowerCase().includes('enantato')
}

function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + n)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function diffDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round(
    (new Date(ty, tm - 1, td).getTime() - new Date(fy, fm - 1, fd).getTime()) / 86400000
  )
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function computeWellbeingTrend(
  dailyLogs: Record<string, DailyLog>,
  days = 30
): Array<{ date: string; score: number }> {
  const today = todayStr()
  const result: Array<{ date: string; score: number }> = []
  let cur = addDaysStr(today, -(days - 1))
  while (cur <= today) {
    const log = dailyLogs[cur]
    if (log?.symptoms) {
      result.push({ date: cur, score: computeWellbeingScore(log.symptoms) })
    }
    cur = addDaysStr(cur, 1)
  }
  return result
}

export function computeTRTCycleData(
  dailyLogs: Record<string, DailyLog>
): Array<{ dayInCycle: number; avgScore: number; count: number }> {
  let lastInj: string | null = null
  for (const log of Object.values(dailyLogs)) {
    if (log.entries.some(isEnanthateEntry)) {
      if (!lastInj || log.date > lastInj) lastInj = log.date
    }
  }
  if (!lastInj) return []

  const buckets: Record<number, { total: number; count: number }> = {}
  for (const log of Object.values(dailyLogs)) {
    if (!log.symptoms) continue
    const raw = diffDays(lastInj, log.date)
    const day = ((raw % 14) + 14) % 14
    if (!buckets[day]) buckets[day] = { total: 0, count: 0 }
    buckets[day].total += computeWellbeingScore(log.symptoms)
    buckets[day].count++
  }

  return Array.from({ length: 14 }, (_, i) => ({
    dayInCycle: i,
    avgScore: buckets[i] ? Math.round(buckets[i].total / buckets[i].count) : 0,
    count: buckets[i]?.count ?? 0,
  }))
}

export type SupplementCorrelation = {
  supplementId: string
  name: string
  brand?: string
  avgScoreWith: number
  avgScoreWithout: number
  delta: number
  daysLogged: number
}

export function computeSupplementCorrelations(
  dailyLogs: Record<string, DailyLog>,
  supplements: Record<string, Supplement>
): SupplementCorrelation[] {
  const daysWithSymptoms = Object.values(dailyLogs).filter(log => log.symptoms != null)
  if (daysWithSymptoms.length < 7) return []

  const result: SupplementCorrelation[] = []

  for (const sup of Object.values(supplements)) {
    if (!sup.active) continue

    const scoresWith: number[] = []
    const scoresWithout: number[] = []

    for (const log of daysWithSymptoms) {
      const score = computeWellbeingScore(log.symptoms!)
      if (log.entries.some(e => e.supplementId === sup.id)) {
        scoresWith.push(score)
      } else {
        scoresWithout.push(score)
      }
    }

    if (scoresWith.length < 3) continue

    const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
    const avgWith = avg(scoresWith)
    const avgWithout = scoresWithout.length > 0 ? avg(scoresWithout) : avgWith

    result.push({
      supplementId: sup.id,
      name: sup.name,
      brand: sup.brand,
      avgScoreWith: avgWith,
      avgScoreWithout: avgWithout,
      delta: avgWith - avgWithout,
      daysLogged: scoresWith.length,
    })
  }

  return result.sort((a, b) => b.delta - a.delta).slice(0, 5)
}
