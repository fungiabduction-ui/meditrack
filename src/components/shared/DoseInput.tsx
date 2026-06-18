type Props = {
  value: number
  unit: string
  step: number
  min?: number
  onChange: (v: number) => void
}

export function DoseInput({ value, unit, step, min = 0, onChange }: Props) {
  const dec = () => onChange(Math.max(min, parseFloat((value - step).toFixed(6))))
  const inc = () => onChange(parseFloat((value + step).toFixed(6)))

  return (
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
  )
}
