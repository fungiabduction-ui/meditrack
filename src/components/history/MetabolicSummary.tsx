import { LogEntry } from '../../schema/types'

type Props = { entries: LogEntry[] }

export function MetabolicSummary({ entries }: Props) {
  const totals = new Map<string, { amount: number; unit: string }>()

  for (const entry of entries) {
    for (const ing of entry.supplementSnapshot.activeIngredients) {
      const key = `${ing.name}__${ing.unit}`
      const prev = totals.get(key)
      totals.set(key, {
        amount: (prev?.amount ?? 0) + ing.amount * entry.quantity,
        unit: ing.unit,
      })
    }
  }

  if (totals.size === 0) return null

  return (
    <div className="bg-slate-800 rounded-xl px-4 py-3 border-l-2 border-violet-500">
      <p className="text-violet-400 text-xs uppercase tracking-wide mb-3">Resumen metabólico del día</p>
      <div className="space-y-1.5">
        {[...totals.entries()].map(([key, { amount, unit }]) => {
          const name = key.split('__')[0]
          return (
            <div key={key} className="flex justify-between text-sm">
              <span className="text-slate-400">{name}</span>
              <span className="text-white font-medium">{parseFloat(amount.toFixed(3))} {unit}</span>
            </div>
          )
        })}
      </div>
      <p className="text-slate-600 text-xs mt-3">Base para sistema metabólico futuro</p>
    </div>
  )
}
