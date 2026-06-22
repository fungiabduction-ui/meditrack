export type BPCategory = {
  label: 'Normal' | 'Elevada' | 'Alta I' | 'Alta II'
  color: string
}

export function classifyBP(sys: number, dia: number): BPCategory {
  if (sys >= 140 || dia >= 90) return { label: 'Alta II', color: '#ef4444' }
  if (sys >= 130 || dia >= 80) return { label: 'Alta I', color: '#f97316' }
  if (sys >= 120 && dia < 80) return { label: 'Elevada', color: '#eab308' }
  return { label: 'Normal', color: '#22c55e' }
}

// Exponential Moving Average: k = 2/(period+1), seed = first value
export function computeEMA(values: number[], period: number): number[] {
  if (values.length === 0) return []
  const k = 2 / (period + 1)
  const result: number[] = [values[0]]
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k))
  }
  return result
}
