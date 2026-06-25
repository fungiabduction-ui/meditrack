const MULTIPLIER_LABELS: Record<number, string> = { 0.25: '¼', 0.5: '½' }

type Props = {
  value: number
  unit: string
  step: number
  defaultDose: number
  min?: number
  onChange: (v: number) => void
}

type Quickpick = { value: number; label: string }

function buildQuickpicks(defaultDose: number): Quickpick[] {
  const seen = new Set<number>()
  return [0.25, 0.5, 1, 2, 3, 4]
    .map(m => ({
      value: parseFloat((defaultDose * m).toFixed(6)),
      label: MULTIPLIER_LABELS[m] ?? String(parseFloat((defaultDose * m).toFixed(6))),
    }))
    .filter(({ value }) => {
      if (value <= 0 || seen.has(value)) return false
      seen.add(value)
      return true
    })
}

export function DoseInput({ value, unit, step, defaultDose, min = 0, onChange }: Props) {
  const dec = () => onChange(Math.max(min, parseFloat((value - step).toFixed(6))))
  const inc = () => onChange(parseFloat((value + step).toFixed(6)))

  const quickpicks = buildQuickpicks(defaultDose)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 bg-slate-700 rounded-xl p-2">
        <button
          onClick={dec}
          className="w-10 h-10 bg-slate-600 hover:bg-slate-500 rounded-lg text-white text-xl font-bold flex items-center justify-center transition-colors"
        >
          −
        </button>
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          onChange={e => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v) && v >= min) onChange(v)
          }}
          className="flex-1 bg-transparent text-center text-sky-400 text-2xl font-bold outline-none w-20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-slate-400 text-sm min-w-[2rem]">{unit}</span>
        <button
          onClick={inc}
          className="w-10 h-10 bg-slate-600 hover:bg-slate-500 rounded-lg text-white text-xl font-bold flex items-center justify-center transition-colors"
        >
          +
        </button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {quickpicks.map(({ value: qp, label }) => (
          <button
            key={qp}
            onClick={() => onChange(qp)}
            className={`flex-1 min-w-[2.5rem] py-1.5 rounded-lg text-sm font-semibold transition-colors border ${
              value === qp
                ? 'bg-sky-600 border-sky-500 text-white'
                : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
