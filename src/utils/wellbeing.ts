import type { DailySymptoms } from '../schema/types'

// Weights deben sumar 100. erectionQuality/nippleSensitivity/orgasms son KPIs
// TRT, no de bienestar general, se excluyen del score compuesto.
// all 5s → 100 | all 3s → 60 | all 1s → 20
export function computeWellbeingScore(s: DailySymptoms): number {
  return Math.round(
    (s.energy * 25 + s.sleep * 25 + s.mood * 20 + s.recovery * 15 + s.libido * 15) / 5
  )
}

export function computeAvgSymptoms(entries: DailySymptoms[]): DailySymptoms {
  if (entries.length === 1) return entries[0]
  const n = entries.length
  const clamp = (v: number): 1 | 2 | 3 | 4 | 5 =>
    Math.max(1, Math.min(5, Math.round(v))) as 1 | 2 | 3 | 4 | 5
  const numAvg = (key: keyof Pick<DailySymptoms, 'energy' | 'libido' | 'sleep' | 'recovery' | 'mood' | 'erectionQuality'>) =>
    clamp(entries.reduce((s, e) => s + e[key], 0) / n)
  return {
    energy: numAvg('energy'),
    libido: numAvg('libido'),
    sleep: numAvg('sleep'),
    recovery: numAvg('recovery'),
    mood: numAvg('mood'),
    erectionQuality: numAvg('erectionQuality'),
    nippleSensitivity: entries.filter(e => e.nippleSensitivity).length >= n / 2,
    orgasms: entries.reduce((s, e) => s + e.orgasms, 0),
  }
}
