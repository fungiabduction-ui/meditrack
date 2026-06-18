import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../store'
import { getLocalDateStr } from '../utils/date'

beforeEach(() => {
  localStorage.clear()
  useStore.getState().init()
})

describe('addSupplement', () => {
  it('adds supplement and persists to localStorage', () => {
    const s = useStore.getState().addSupplement({
      name: 'Omega-3', category: 'supplement', description: '', form: 'cáps',
      activeIngredients: [], instructions: '4 cáps/día', certifications: [],
      schedule: { kind: 'weekdays', days: [0,1,2,3,4] },
      defaultDose: 4, doseUnit: 'cáps', doseStep: 1, timing: 'morning',
    })
    expect(useStore.getState().supplements[s.id]).toBeDefined()
    expect(useStore.getState().supplements[s.id].name).toBe('Omega-3')
    // verify persisted
    useStore.getState().init()
    expect(useStore.getState().supplements[s.id].name).toBe('Omega-3')
  })
})

describe('addLogEntry', () => {
  it('creates log entry and updates nextDue for fixed_interval', () => {
    const s = useStore.getState().addSupplement({
      name: 'Testosterona', category: 'medication', description: '', form: 'ampolla',
      activeIngredients: [], instructions: '0.4 ml cada 7 días', certifications: [],
      schedule: { kind: 'fixed_interval', intervalDays: 7, alertDaysBefore: 2 },
      defaultDose: 0.4, doseUnit: 'ml', doseStep: 0.05, timing: 'evening',
    })
    const entry = useStore.getState().addLogEntry(s.id, 0.4)
    expect(entry.quantity).toBe(0.4)
    expect(entry.supplementSnapshot.name).toBe('Testosterona')
    // nextDue should be set to ~7 days from now
    const updated = useStore.getState().supplements[s.id]
    expect(updated.nextDue).toBeDefined()
    const daysUntil = (new Date(updated.nextDue!).getTime() - Date.now()) / 86_400_000
    expect(daysUntil).toBeCloseTo(7, 0)
  })
})

describe('editLogTimestamp', () => {
  it('updates timestamp and stores original', () => {
    const s = useStore.getState().addSupplement({
      name: 'D3', category: 'vitamin', description: '', form: 'cáps',
      activeIngredients: [], instructions: '1/día', certifications: [],
      schedule: { kind: 'weekdays', days: [0,1,2,3,4,5,6] },
      defaultDose: 1, doseUnit: 'cáps', doseStep: 1, timing: 'morning',
    })
    const entry = useStore.getState().addLogEntry(s.id, 1)
    const today = getLocalDateStr(new Date(entry.timestamp))
    const newTs = '2026-06-17T08:00:00.000Z'
    useStore.getState().editLogTimestamp(today, entry.id, newTs)
    const updatedEntry = useStore.getState().dailyLogs[today].entries.find(e => e.id === entry.id)!
    expect(updatedEntry.timestamp).toBe(newTs)
    expect(updatedEntry.timestampEditedFrom).toBe(entry.timestamp)
  })
})

describe('deactivateSupplement', () => {
  it('sets active to false', () => {
    const s = useStore.getState().addSupplement({
      name: 'Test', category: 'supplement', description: '', form: 'caps',
      activeIngredients: [], instructions: '', certifications: [],
      schedule: { kind: 'as_needed' },
      defaultDose: 1, doseUnit: 'caps', doseStep: 1, timing: null,
    })
    useStore.getState().deactivateSupplement(s.id)
    expect(useStore.getState().supplements[s.id].active).toBe(false)
  })
})

describe('sealPastDays', () => {
  it('marca como missed los weekday supplements no logueados en días pasados', async () => {
    // Crear suplemento programado todos los días
    const s = useStore.getState().addSupplement({
      name: 'Vitamina D3', category: 'vitamin', description: '', form: 'cáps',
      activeIngredients: [], instructions: '1/día', certifications: [],
      schedule: { kind: 'weekdays', days: [0,1,2,3,4,5,6] },
      defaultDose: 1, doseUnit: 'cáps', doseStep: 1, timing: 'morning',
    })

    // Crear log de ayer sin entries (sin tomar nada)
    const yesterday = getLocalDateStr(new Date(Date.now() - 86_400_000))
    const { read, write } = await import('../storage/persistence')
    const schema = read()
    schema.dailyLogs[yesterday] = {
      id: crypto.randomUUID(), date: yesterday, entries: [], skipped: [],
      sealed: false, checksum: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    write(schema)
    useStore.getState().init()

    useStore.getState().sealPastDays()

    const log = useStore.getState().dailyLogs[yesterday]
    expect(log.sealed).toBe(true)
    expect(log.skipped).toHaveLength(1)
    expect(log.skipped[0].supplementId).toBe(s.id)
    expect(log.skipped[0].supplementName).toBe('Vitamina D3')
    expect(log.skipped[0].reason).toBe('missed')
  })

  it('no marca como missed si el suplemento fue logueado', async () => {
    const s = useStore.getState().addSupplement({
      name: 'Omega-3', category: 'supplement', description: '', form: 'cáps',
      activeIngredients: [], instructions: '4/día', certifications: [],
      schedule: { kind: 'weekdays', days: [0,1,2,3,4,5,6] },
      defaultDose: 4, doseUnit: 'cáps', doseStep: 1, timing: 'midday',
    })

    const yesterday = getLocalDateStr(new Date(Date.now() - 86_400_000))
    const { read, write } = await import('../storage/persistence')
    const schema = read()
    schema.dailyLogs[yesterday] = {
      id: crypto.randomUUID(), date: yesterday,
      entries: [{
        id: crypto.randomUUID(), supplementId: s.id,
        supplementSnapshot: { name: 'Omega-3', doseUnit: 'cáps', category: 'supplement', activeIngredients: [], version: 0 },
        quantity: 4, doseUnit: 'cáps',
        timestamp: `${yesterday}T13:00:00.000Z`, recordedAt: `${yesterday}T13:00:00.000Z`,
      }],
      skipped: [], sealed: false, checksum: '',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    write(schema)
    useStore.getState().init()

    useStore.getState().sealPastDays()

    const log = useStore.getState().dailyLogs[yesterday]
    expect(log.sealed).toBe(true)
    expect(log.skipped).toHaveLength(0)
  })

  it('no procesa días ya sellados', async () => {
    const yesterday = getLocalDateStr(new Date(Date.now() - 86_400_000))
    const { read, write } = await import('../storage/persistence')
    const schema = read()
    schema.dailyLogs[yesterday] = {
      id: crypto.randomUUID(), date: yesterday, entries: [], skipped: [],
      sealed: true, checksum: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    write(schema)
    useStore.getState().init()

    // Agregar suplemento DESPUÉS de sellar - no debería aparecer en skipped
    useStore.getState().addSupplement({
      name: 'Post-seal', category: 'supplement', description: '', form: 'cáps',
      activeIngredients: [], instructions: '', certifications: [],
      schedule: { kind: 'weekdays', days: [0,1,2,3,4,5,6] },
      defaultDose: 1, doseUnit: 'cáps', doseStep: 1, timing: null,
    })

    useStore.getState().sealPastDays()

    // El día ya estaba sellado, no se re-procesa
    const log = useStore.getState().dailyLogs[yesterday]
    expect(log.skipped).toHaveLength(0)
  })
})
