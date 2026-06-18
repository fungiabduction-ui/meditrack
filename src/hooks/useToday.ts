import { useMemo } from 'react'
import { useStore } from '../store'
import type { Supplement, LogEntry } from '../schema/types'
import { getLocalDateStr } from '../utils/date'
import { isScheduledToday, isAlertActive } from '../utils/schedule'

export type TimingGroup = {
  slot: string
  label: string
  items: Supplement[]
}

const TIMING_ORDER = ['morning', 'midday', 'afternoon', 'evening', 'night'] as const
const TIMING_LABELS: Record<string, string> = {
  morning: 'Mañana', midday: 'Mediodía', afternoon: 'Tarde',
  evening: 'Tarde-noche', night: 'Noche',
}

export function useToday(date?: string) {
  const supplements = useStore(s => s.supplements)
  const dailyLogs = useStore(s => s.dailyLogs)
  const addLogEntry = useStore(s => s.addLogEntry)
  const editLogTimestamp = useStore(s => s.editLogTimestamp)
  const removeLogEntry = useStore(s => s.removeLogEntry)

  const today = getLocalDateStr()
  const activeDate = date ?? today
  const isToday = activeDate === today
  const todayLog = dailyLogs[activeDate]
  const takenEntries: LogEntry[] = todayLog?.entries ?? []
  const takenIds = new Set(takenEntries.map(e => e.supplementId))

  const active = useMemo(
    () => Object.values(supplements).filter(s => s.active && s.inStock !== false),
    [supplements]
  )

  const scheduledToday = useMemo(
    () => active.filter(s => isScheduledToday(s, activeDate)),
    [active, activeDate]
  )

  const asNeeded = useMemo(
    () => active.filter(s => s.schedule.kind === 'as_needed'),
    [active]
  )

  const groups = useMemo<TimingGroup[]>(() => {
    const result: TimingGroup[] = []
    for (const slot of TIMING_ORDER) {
      const items = scheduledToday.filter(s => s.timing === slot)
      if (items.length > 0) result.push({ slot, label: TIMING_LABELS[slot], items })
    }
    const others = scheduledToday.filter(s => s.timing === null)
    if (others.length > 0) result.push({ slot: 'other', label: 'Otros', items: others })
    return result
  }, [scheduledToday])

  const alerts = useMemo(() => active.filter(isAlertActive), [active])

  const scheduledCount = scheduledToday.length
  const takenCount = takenIds.size

  return {
    today, activeDate, isToday, groups, asNeeded, takenIds, takenEntries, todayLog,
    alerts, scheduledCount, takenCount,
    logItem: (supplementId: string, quantity: number, time?: string) => {
      if (time) {
        const [y, mo, d] = activeDate.split('-').map(Number)
        const [h, mi] = time.split(':').map(Number)
        const ts = new Date(y, mo - 1, d, h, mi, 0, 0).toISOString()
        return addLogEntry(supplementId, quantity, ts)
      }
      return addLogEntry(supplementId, quantity)
    },
    editTimestamp: (entryId: string, newTimestamp: string) => editLogTimestamp(activeDate, entryId, newTimestamp),
    removeEntry: (entryId: string) => removeLogEntry(activeDate, entryId),
  }
}
