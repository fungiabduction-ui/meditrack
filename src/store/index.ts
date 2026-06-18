import { create } from 'zustand'
import type { Supplement, LogEntry, DailyLog, StorageSchema, SkippedItem } from '../schema/types'
import { read, write } from '../storage/persistence'
import { generateId } from '../utils/id'
import { getLocalDateStr } from '../utils/date'
import { calcNextDue, isScheduledToday } from '../utils/schedule'

type Store = {
  supplements: Record<string, Supplement>
  dailyLogs: Record<string, DailyLog>
  init: () => void
  addSupplement: (data: Omit<Supplement, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'active'>) => Supplement
  updateSupplement: (id: string, partial: Partial<Omit<Supplement, 'id' | 'createdAt'>>) => void
  deactivateSupplement: (id: string) => void
  addLogEntry: (supplementId: string, quantity: number, timestamp?: string) => LogEntry
  editLogTimestamp: (date: string, entryId: string, newTimestamp: string) => void
  sealPastDays: () => void
}

function commitWrite(set: (s: Partial<Store>) => void, schema: StorageSchema) {
  write(schema) // throws on failure — never updates Zustand if write fails
  set({ supplements: schema.supplements, dailyLogs: schema.dailyLogs })
}

export const useStore = create<Store>((set, get) => ({
  supplements: {},
  dailyLogs: {},

  init: () => {
    const schema = read()
    set({ supplements: schema.supplements, dailyLogs: schema.dailyLogs })
  },

  addSupplement: (data) => {
    const now = new Date().toISOString()
    const s: Supplement = { ...data, id: generateId(), active: true, createdAt: now, updatedAt: now, version: 0 }
    const supplements = { ...get().supplements, [s.id]: s }
    commitWrite(set, { ...read(), supplements })
    return s
  },

  updateSupplement: (id, partial) => {
    const prev = get().supplements[id]
    if (!prev) throw new Error(`Supplement not found: ${id}`)
    const updated: Supplement = {
      ...prev, ...partial,
      id: prev.id,
      createdAt: prev.createdAt,
      updatedAt: new Date().toISOString(),
      version: prev.version + 1,
    }
    const supplements = { ...get().supplements, [id]: updated }
    commitWrite(set, { ...read(), supplements })
  },

  deactivateSupplement: (id) => {
    get().updateSupplement(id, { active: false })
  },

  addLogEntry: (supplementId, quantity, timestamp) => {
    const s = get().supplements[supplementId]
    if (!s) throw new Error(`Supplement not found: ${supplementId}`)
    const now = new Date()
    const ts = timestamp ?? now.toISOString()
    const dateStr = getLocalDateStr(new Date(ts))

    const entry: LogEntry = {
      id: generateId(),
      supplementId,
      supplementSnapshot: {
        name: s.name,
        doseUnit: s.doseUnit,
        category: s.category,
        activeIngredients: s.activeIngredients,
        version: s.version,
      },
      quantity,
      doseUnit: s.doseUnit,
      timestamp: ts,
      recordedAt: now.toISOString(),
    }

    const existing = get().dailyLogs[dateStr]
    const updatedLog: DailyLog = existing
      ? { ...existing, entries: [...existing.entries, entry], updatedAt: now.toISOString() }
      : {
          id: generateId(), date: dateStr, entries: [entry], skipped: [],
          sealed: false, checksum: '', createdAt: now.toISOString(), updatedAt: now.toISOString(),
        }

    let supplements = get().supplements
    if (s.schedule.kind === 'fixed_interval') {
      supplements = {
        ...supplements,
        [s.id]: { ...s, nextDue: calcNextDue(ts, s.schedule.intervalDays), updatedAt: now.toISOString() },
      }
    }

    const dailyLogs = { ...get().dailyLogs, [dateStr]: updatedLog }
    commitWrite(set, { ...read(), dailyLogs, supplements })
    return entry
  },

  editLogTimestamp: (date, entryId, newTimestamp) => {
    const log = get().dailyLogs[date]
    if (!log) throw new Error(`No log for ${date}`)
    if (log.sealed) throw new Error(`Day ${date} is sealed`)
    const entries = log.entries.map(e =>
      e.id === entryId
        ? { ...e, timestamp: newTimestamp, timestampEditedFrom: e.timestampEditedFrom ?? e.timestamp }
        : e
    )
    const dailyLogs = { ...get().dailyLogs, [date]: { ...log, entries, updatedAt: new Date().toISOString() } }
    commitWrite(set, { ...read(), dailyLogs })
  },

  sealPastDays: () => {
    const today = getLocalDateStr()
    const logs = get().dailyLogs
    const supplements = get().supplements
    const active = Object.values(supplements).filter(s => s.active)
    const toSeal = Object.entries(logs).filter(([date, log]) => date < today && !log.sealed)
    if (toSeal.length === 0) return

    const updated = Object.fromEntries(
      toSeal.map(([date, log]) => {
        const loggedIds = new Set(log.entries.map(e => e.supplementId))
        const missed = active.filter(s =>
          s.schedule.kind === 'weekdays' &&
          isScheduledToday(s, date) &&
          !loggedIds.has(s.id)
        )
        const newSkipped: SkippedItem[] = missed.map(s => ({
          supplementId: s.id,
          supplementName: s.name,
          reason: 'missed',
        }))
        return [date, { ...log, sealed: true, skipped: [...log.skipped, ...newSkipped], updatedAt: new Date().toISOString() }]
      })
    )
    commitWrite(set, { ...read(), dailyLogs: { ...logs, ...updated } })
  },
}))
