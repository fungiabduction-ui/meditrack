import { create } from 'zustand'
import type { Supplement, LogEntry, DailyLog, StorageSchema, SkippedItem, DayNote, DailySymptoms, BloodWorkEntry, BPReading } from '../schema/types'
import { read, write } from '../storage/persistence'
import { generateId } from '../utils/id'
import { getLocalDateStr } from '../utils/date'
import { calcNextDue, isScheduledToday } from '../utils/schedule'
import { classifyBP } from '../utils/bp'

type Store = {
  supplements: Record<string, Supplement>
  dailyLogs: Record<string, DailyLog>
  bloodWork: BloodWorkEntry[]
  init: () => void
  addSupplement: (data: Omit<Supplement, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'active'>) => Supplement
  updateSupplement: (id: string, partial: Partial<Omit<Supplement, 'id' | 'createdAt'>>) => void
  deactivateSupplement: (id: string) => void
  addLogEntry: (supplementId: string, quantity: number, timestamp?: string) => LogEntry
  editLogTimestamp: (date: string, entryId: string, newTimestamp: string) => void
  removeLogEntry: (date: string, entryId: string) => void
  sealPastDays: () => void
  setInStock: (id: string, val: boolean) => void
  addDayNote: (dateStr: string, text: string) => void
  editDayNote: (dateStr: string, noteId: string, text: string) => void
  removeDayNote: (dateStr: string, noteId: string) => void
  updateSymptoms: (dateStr: string, symptoms: DailySymptoms) => void
  addBloodWork: (data: Omit<BloodWorkEntry, 'id' | 'createdAt'>) => void
  updateBloodWork: (id: string, partial: Partial<Omit<BloodWorkEntry, 'id' | 'createdAt'>>) => void
  removeBloodWork: (id: string) => void
  bpReadings: BPReading[]
  addBPReading: (data: { date: string; timestamp: string; sys: number; dia: number; pulse: number; note?: string }) => BPReading
  removeBPReading: (id: string) => void
}

function commitWrite(set: (s: Partial<Store>) => void, schema: StorageSchema) {
  write(schema) // throws on failure — never updates Zustand if write fails
  set({ supplements: schema.supplements, dailyLogs: schema.dailyLogs, bloodWork: schema.bloodWork, bpReadings: schema.bpReadings })
}

export const useStore = create<Store>((set, get) => ({
  supplements: {},
  dailyLogs: {},
  bloodWork: [],
  bpReadings: [],

  init: () => {
    const schema = read()
    // Repair: rewrite with canonical key order so checksum always matches
    try { write(schema) } catch { /* ignore — state is loaded regardless */ }
    set({ supplements: schema.supplements, dailyLogs: schema.dailyLogs, bloodWork: schema.bloodWork ?? [], bpReadings: schema.bpReadings ?? [] })
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
        brand: s.brand,
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
          id: generateId(), date: dateStr, entries: [entry], skipped: [], notes: [],
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

  removeLogEntry: (date, entryId) => {
    const log = get().dailyLogs[date]
    if (!log) return
    const entries = log.entries.filter(e => e.id !== entryId)
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

  setInStock: (id, val) => {
    const prev = get().supplements[id]
    if (!prev) return
    const supplements = { ...get().supplements, [id]: { ...prev, inStock: val, updatedAt: new Date().toISOString() } }
    commitWrite(set, { ...read(), supplements })
  },

  addDayNote: (dateStr, text) => {
    const now = new Date().toISOString()
    const note: DayNote = { id: generateId(), text, timestamp: now }
    const existing = get().dailyLogs[dateStr]
    const log: DailyLog = existing
      ? { ...existing, notes: [...(existing.notes ?? []), note], updatedAt: now }
      : { id: generateId(), date: dateStr, entries: [], skipped: [], notes: [note], sealed: false, checksum: '', createdAt: now, updatedAt: now }
    const dailyLogs = { ...get().dailyLogs, [dateStr]: log }
    commitWrite(set, { ...read(), dailyLogs })
  },

  editDayNote: (dateStr, noteId, text) => {
    const log = get().dailyLogs[dateStr]
    if (!log) return
    const now = new Date().toISOString()
    const notes = (log.notes ?? []).map(n => n.id === noteId ? { ...n, text, editedAt: now } : n)
    const dailyLogs = { ...get().dailyLogs, [dateStr]: { ...log, notes, updatedAt: now } }
    commitWrite(set, { ...read(), dailyLogs })
  },

  removeDayNote: (dateStr, noteId) => {
    const log = get().dailyLogs[dateStr]
    if (!log) return
    const now = new Date().toISOString()
    const notes = (log.notes ?? []).filter(n => n.id !== noteId)
    const dailyLogs = { ...get().dailyLogs, [dateStr]: { ...log, notes, updatedAt: now } }
    commitWrite(set, { ...read(), dailyLogs })
  },

  updateSymptoms: (dateStr, symptoms) => {
    const now = new Date().toISOString()
    const existing = get().dailyLogs[dateStr]
    const log: DailyLog = existing
      ? { ...existing, symptoms, updatedAt: now }
      : { id: generateId(), date: dateStr, entries: [], skipped: [], notes: [], symptoms, sealed: false, checksum: '', createdAt: now, updatedAt: now }
    const dailyLogs = { ...get().dailyLogs, [dateStr]: log }
    commitWrite(set, { ...read(), dailyLogs })
  },

  addBloodWork: (data) => {
    const now = new Date().toISOString()
    const entry: BloodWorkEntry = { ...data, id: generateId(), createdAt: now }
    const bloodWork = [...get().bloodWork, entry]
    commitWrite(set, { ...read(), bloodWork })
  },

  updateBloodWork: (id, partial) => {
    const bloodWork = get().bloodWork.map(e =>
      e.id === id ? { ...e, ...partial, id: e.id, createdAt: e.createdAt } : e
    )
    commitWrite(set, { ...read(), bloodWork })
  },

  removeBloodWork: (id) => {
    const bloodWork = get().bloodWork.filter(e => e.id !== id)
    commitWrite(set, { ...read(), bloodWork })
  },

  addBPReading: (data) => {
    const { date, timestamp, sys, dia, pulse, note } = data
    const now = new Date().toISOString()
    const reading: BPReading = {
      id: generateId(),
      date,
      timestamp,
      sys,
      dia,
      pulse,
      recordedAt: now,
    }

    // build auto-note atomically with the reading
    const { label } = classifyBP(sys, dia)
    const hhmm = new Date(timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    const noteText = `🩺 PA: ${sys}/${dia} mmHg · Pulso: ${pulse} bpm · ${hhmm} [${label}]${note ? ` — ${note}` : ''}`
    const note: DayNote = { id: generateId(), text: noteText, timestamp: now }

    const existing = get().dailyLogs[date]
    const log: DailyLog = existing
      ? { ...existing, notes: [...(existing.notes ?? []), note], updatedAt: now }
      : { id: generateId(), date, entries: [], skipped: [], notes: [note], sealed: false, checksum: '', createdAt: now, updatedAt: now }

    const bpReadings = [...get().bpReadings, reading]
    const dailyLogs = { ...get().dailyLogs, [date]: log }

    commitWrite(set, { ...read(), bpReadings, dailyLogs })
    return reading
  },

  removeBPReading: (id) => {
    const bpReadings = get().bpReadings.filter(r => r.id !== id)
    commitWrite(set, { ...read(), bpReadings })
  },
}))
