import { z } from 'zod'

const zBloodMarker = z.enum([
  'tTotal', 'tLibre', 'e2', 'shbg', 'lh', 'fsh', 'hematocrito', 'psa', 'prolactina',
] as const)

const zBloodWorkEntry = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  values: z.record(z.string(), z.number().nonnegative()),
  notes: z.string().optional(),
  createdAt: z.string(),
})

export const UnitTypeSchema = z.enum(['IU', 'mcg', 'mg', 'ml', 'g', 'caps', 'custom'])

export const ActiveIngredientSchema = z.object({
  name: z.string().min(1),
  form: z.string(),
  amount: z.number().positive(),
  unit: UnitTypeSchema,
  source: z.string().optional(),
  brand: z.string().optional(),
})

export const ScheduleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('fixed_interval'),
    intervalDays: z.number().int().positive(),
    alertDaysBefore: z.number().int().min(0),
  }),
  z.object({
    kind: z.literal('weekdays'),
    days: z.array(z.number().int().min(0).max(6)),
  }),
  z.object({ kind: z.literal('as_needed') }),
])

export const SupplementSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  brand: z.string().optional(),
  category: z.enum(['supplement', 'medication', 'vitamin', 'mineral', 'hormone', 'adaptogen', 'herb', 'other']),
  description: z.string(),
  form: z.string(),
  presentation: z.string().optional(),
  activeIngredients: z.array(ActiveIngredientSchema),
  excipients: z.string().optional(),
  benefits: z.string().optional(),
  instructions: z.string(),
  warnings: z.string().optional(),
  certifications: z.array(z.string()),
  schedule: ScheduleSchema,
  defaultDose: z.number().positive(),
  doseUnit: z.string().min(1),
  doseStep: z.number().positive(),
  timing: z.enum(['morning', 'midday', 'afternoon', 'evening', 'night']).nullable(),
  nextDue: z.string().optional(),
  active: z.boolean(),
  inStock: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().nonnegative(),
})

export const LogEntrySchema = z.object({
  id: z.string().uuid(),
  supplementId: z.string().uuid(),
  supplementSnapshot: z.object({
    name: z.string(),
    brand: z.string().optional(),
    doseUnit: z.string(),
    category: SupplementSchema.shape.category,
    activeIngredients: z.array(ActiveIngredientSchema),
    version: z.number().int().nonnegative(),
  }),
  quantity: z.number().positive(),
  doseUnit: z.string(),
  timestamp: z.string(),
  timestampEditedFrom: z.string().optional(),
  notes: z.string().optional(),
  recordedAt: z.string(),
})

export const DayNoteSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1),
  timestamp: z.string(),
  editedAt: z.string().optional(),
})

export const DailySymptomsSchema = z.object({
  energy: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  libido: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  sleep: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  recovery: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  mood: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  erectionQuality: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  nippleSensitivity: z.boolean(),
  orgasms: z.number().int().min(0),
})

export const DailyLogSchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(LogEntrySchema),
  skipped: z.array(z.object({
    supplementId: z.string().uuid(),
    supplementName: z.string(),
    reason: z.string().optional(),
  })),
  notes: z.array(DayNoteSchema).default([]),
  symptoms: DailySymptomsSchema.optional(),
  sealed: z.boolean(),
  checksum: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const StorageSchemaSchema = z.object({
  _version: z.number().int().nonnegative(),
  _createdAt: z.string(),
  _updatedAt: z.string(),
  _checksum: z.string(),
  supplements: z.record(z.string(), SupplementSchema),
  dailyLogs: z.record(z.string(), DailyLogSchema),
  migrations: z.array(z.object({
    from: z.number(),
    to: z.number(),
    appliedAt: z.string(),
  })),
  bloodWork: z.array(zBloodWorkEntry).default([]),
})

export const CabinetExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  supplements: z.array(SupplementSchema),
})
