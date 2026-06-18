import { Supplement } from '../schema/types'
import { getLocalDateStr, parseLocalDate } from './date'

export function isScheduledToday(s: Supplement, dateStr: string): boolean {
  const { schedule } = s
  if (schedule.kind === 'as_needed') return false
  if (schedule.kind === 'fixed_interval') {
    if (!s.nextDue) return false
    return getLocalDateStr(new Date(s.nextDue)) === dateStr
  }
  if (schedule.kind === 'weekdays') {
    const date = parseLocalDate(dateStr)
    const dow = (date.getDay() + 6) % 7 // 0=Lun, 6=Dom
    return schedule.days.includes(dow)
  }
  return false
}

export function calcNextDue(timestamp: string, intervalDays: number): string {
  const base = new Date(timestamp)
  return new Date(base.getTime() + intervalDays * 86_400_000).toISOString()
}

export function isAlertActive(s: Supplement): boolean {
  if (s.schedule.kind !== 'fixed_interval' || !s.nextDue) return false
  const daysUntilDue = (new Date(s.nextDue).getTime() - Date.now()) / 86_400_000
  return daysUntilDue <= s.schedule.alertDaysBefore && daysUntilDue > -1
}
