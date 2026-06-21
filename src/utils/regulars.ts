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

  // Conteo de tomas hoy por suplemento
  const takenTodayCount: Record<string, number> = {}
  for (const e of (dailyLogs[today]?.entries ?? [])) {
    takenTodayCount[e.supplementId] = (takenTodayCount[e.supplementId] ?? 0) + 1
  }

  return Object.values(supplements).filter(s => {
    if (!s.active || s.inStock === false) return false
    if (s.schedule.kind !== 'as_needed') return false

    // Días en los que apareció (para el threshold mínimo)
    const daysWithEntries = last7.filter(date =>
      (dailyLogs[date]?.entries ?? []).some(e => e.supplementId === s.id)
    )
    if (daysWithEntries.length < 2) return false

    // Frecuencia diaria típica: máximo de tomas en los días recientes
    const typicalDaily = Math.max(...daysWithEntries.map(date =>
      (dailyLogs[date]?.entries ?? []).filter(e => e.supplementId === s.id).length
    ))

    return (takenTodayCount[s.id] ?? 0) < typicalDaily
  })
}
