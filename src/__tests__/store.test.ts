import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../store'

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
    const today = entry.timestamp.slice(0, 10)
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
