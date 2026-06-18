export type UnitType = 'IU' | 'mcg' | 'mg' | 'ml' | 'g' | 'caps' | 'custom'

export type ActiveIngredient = {
  name: string
  form: string
  amount: number
  unit: UnitType
  source?: string
  brand?: string
}

export type ScheduleFixedInterval = {
  kind: 'fixed_interval'
  intervalDays: number
  alertDaysBefore: number
}

export type ScheduleWeekdays = {
  kind: 'weekdays'
  days: number[] // 0=Lun, 6=Dom
}

export type ScheduleAsNeeded = {
  kind: 'as_needed'
}

export type Schedule = ScheduleFixedInterval | ScheduleWeekdays | ScheduleAsNeeded

export type TimingSlot = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'

export type SupplementCategory =
  | 'supplement' | 'medication' | 'vitamin' | 'mineral'
  | 'hormone' | 'adaptogen' | 'herb' | 'other'

export type Supplement = {
  id: string
  name: string
  brand?: string
  category: SupplementCategory
  description: string
  form: string
  presentation?: string
  activeIngredients: ActiveIngredient[]
  excipients?: string
  benefits?: string
  instructions: string
  warnings?: string
  certifications: string[]
  schedule: Schedule
  defaultDose: number
  doseUnit: string
  doseStep: number
  timing: TimingSlot | null
  nextDue?: string // ISO8601, solo para fixed_interval, calculado post-log
  active: boolean
  createdAt: string
  updatedAt: string
  version: number
}

export type SupplementSnapshot = {
  name: string
  doseUnit: string
  category: SupplementCategory
  activeIngredients: ActiveIngredient[]
  version: number
}

export type LogEntry = {
  id: string
  supplementId: string
  supplementSnapshot: SupplementSnapshot
  quantity: number
  doseUnit: string
  timestamp: string          // ISO8601 — auto Date.now(), editable
  timestampEditedFrom?: string // valor original si fue corregido
  notes?: string
  recordedAt: string         // cuándo se presionó el botón — nunca editable
}

export type SkippedItem = {
  supplementId: string
  supplementName: string
  reason?: string
}

export type DailyLog = {
  id: string
  date: string  // YYYY-MM-DD
  entries: LogEntry[]
  skipped: SkippedItem[]
  sealed: boolean
  checksum: string
  createdAt: string
  updatedAt: string
}

export type MigrationRecord = {
  from: number
  to: number
  appliedAt: string
}

export type StorageSchema = {
  _version: number
  _createdAt: string
  _updatedAt: string
  _checksum: string
  supplements: Record<string, Supplement>
  dailyLogs: Record<string, DailyLog>
  migrations: MigrationRecord[]
}
