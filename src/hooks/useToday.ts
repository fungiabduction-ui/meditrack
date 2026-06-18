import { useMemo } from 'react'
import { useStore } from '../store'
import { Supplement, LogEntry } from '../schema/types'
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

export function useToday() {
  const supplements = useStore(s => s.supplements)
  const dailyLogs = useStore(s => s.dailyLogs)
  const addLogEntry = useStore(s => s.addLogEntry)
  const editLogTimestamp = useStore(s => s.editLogTimestamp)

  const today = getLocalDateStr()
  const todayLog = dailyLogs[today]
  const takenEntries: LogEntry[] = todayLog?.entries ?? []
  const takenIds = new Set(takenEntries.map(e => e.supplementId))

  const active = useMemo(
    () => Object.values(supplements).filter(s => s.active),
    [supplements]
  )

  const scheduledToday = useMemo(
    () => active.filter(s => isScheduledToday(s, today)),
    [active, today]
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
    today, groups, asNeeded, takenIds, takenEntries, todayLog,
    alerts, scheduledCount, takenCount,
    logItem: (supplementId: string, quantity: number) => addLogEntry(supplementId, quantity),
    editTimestamp: (entryId: string, newTimestamp: string) => editLogTimestamp(today, entryId, newTimestamp),
  }
}
