import { z } from 'zod'

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

export const DailyLogSchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(LogEntrySchema),
  skipped: z.array(z.object({
    supplementId: z.string().uuid(),
    supplementName: z.string(),
    reason: z.string().optional(),
  })),
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
  supplements: z.record(SupplementSchema),
  dailyLogs: z.record(DailyLogSchema),
  migrations: z.array(z.object({
    from: z.number(),
    to: z.number(),
    appliedAt: z.string(),
  })),
})

export const CabinetExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  supplements: z.array(SupplementSchema),
})
