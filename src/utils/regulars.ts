import type { Supplement, DailyLog } from '../schema/types'

export function getSuggestedRegulars(
  supplements: Record<string, Supplement>,
  dailyLogs: Record<string, DailyLog>,
  today: string
): Supplement[] {
  const last7: string[] = []
  const base = new Date(`${today}T12:00:00`)
  for (let i = 1; i <= 7; i++) {
    const d = new Date(base)
    d.setDate(d.getDate() - i)
    last7.push(d.toISOString().slice(0, 10))
  }

  const takenToday = new Set(
    (dailyLogs[today]?.entries ?? []).map(e => e.supplementId)
  )

  return Object.values(supplements).filter(s => {
    if (!s.active || s.inStock === false) return false
    if (s.schedule.kind !== 'as_needed') return false
    if (takenToday.has(s.id)) return false

    const daysAppeared = last7.filter(date =>
      (dailyLogs[date]?.entries ?? []).some(e => e.supplementId === s.id)
    ).length

    return daysAppeared >= 2
  })
}
