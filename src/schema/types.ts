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
  inStock?: boolean   // undefined/true = con stock; false = sin stock (se oscurece y no aparece en pendientes)
  createdAt: string
  updatedAt: string
  version: number
}

export type SupplementSnapshot = {
  name: string
  brand?: string
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

export type DayNote = {
  id: string
  text: string
  timestamp: string
  editedAt?: string
}

export type SkippedItem = {
  supplementId: string
  supplementName: string
  reason?: string
}

export type DailySymptoms = {
  energy: 1 | 2 | 3 | 4 | 5
  libido: 1 | 2 | 3 | 4 | 5
  sleep: 1 | 2 | 3 | 4 | 5
  recovery: 1 | 2 | 3 | 4 | 5
  mood: 1 | 2 | 3 | 4 | 5
  erectionQuality: 1 | 2 | 3 | 4 | 5
  nippleSensitivity: boolean
  orgasms: number
}

export type DailyLog = {
  id: string
  date: string  // YYYY-MM-DD
  entries: LogEntry[]
  skipped: SkippedItem[]
  notes: DayNote[]
  symptoms?: DailySymptoms
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

export type BloodMarker =
  | 'tTotal'
  | 'tLibre'
  | 'e2'
  | 'shbg'
  | 'lh'
  | 'fsh'
  | 'hematocrito'
  | 'psa'
  | 'prolactina'

export type BloodWorkEntry = {
  id: string
  date: string
  values: Partial<Record<BloodMarker, number>>
  notes?: string
  createdAt: string
}

export type BPReading = {
  id: string
  date: string        // YYYY-MM-DD
  timestamp: string   // ISO8601 — time of actual measurement, editable
  sys: number         // mmHg, 60–250
  dia: number         // mmHg, 30–150
  pulse: number       // bpm, 30–220
  recordedAt: string  // ISO8601 — when button pressed, never editable
}

export type StorageSchema = {
  _version: number
  _createdAt: string
  _updatedAt: string
  _checksum: string
  supplements: Record<string, Supplement>
  dailyLogs: Record<string, DailyLog>
  migrations: MigrationRecord[]
  bloodWork: BloodWorkEntry[]
  bpReadings: BPReading[]
}

export type CabinetExport = {
  version: 1
  exportedAt: string
  supplements: Supplement[]
}
