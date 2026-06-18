import type { DailySymptoms } from '../schema/types'

// Weights deben sumar 100. erectionQuality/nippleSensitivity/orgasms son KPIs
// TRT, no de bienestar general, se excluyen del score compuesto.
// all 5s → 100 | all 3s → 60 | all 1s → 20
export function computeWellbeingScore(s: DailySymptoms): number {
  return Math.round(
    (s.energy * 25 + s.sleep * 25 + s.mood * 20 + s.recovery * 15 + s.libido * 15) / 5
  )
}
