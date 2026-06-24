import { useMemo } from 'react'
import { generateSteadyState } from '../../utils/trt-pk'

const PROTOCOLS = [
  { label: '1x/14d', intervalDays: 14, description: 'Quincenal' },
  { label: '1x/7d',  intervalDays: 7,  description: 'Semanal' },
  { label: '2x/7d',  intervalDays: 3.5, description: 'Bisemanal' },
] as const

const MW = 80
const MH = 40
const MP = { top: 3, right: 3, bottom: 3, left: 3 }

type Props = { currentIntervalDays?: number }

export function ProtocolComparator({ currentIntervalDays }: Props) {
  const data = useMemo(() => {
    return PROTOCOLS.map(p => {
      const full = generateSteadyState(p.intervalDays, 100, 12)
      // Show last 3 cycles (steady-state visible)
      const cyclesDays = p.intervalDays * 3
      const startT = p.intervalDays * 9
      const slice = full.filter(pt => pt.t >= startT && pt.t <= startT + cyclesDays)
      if (slice.length === 0) return { ...p, points: '', peak: 100, trough: 0, fluctuation: 100 }

      const peak = Math.max(...slice.map(s => s.level))
      const trough = Math.min(...slice.map(s => s.level))

      const points = slice.map(pt => {
        const x = MP.left + ((pt.t - startT) / cyclesDays) * (MW - MP.left - MP.right)
        const y = MP.top + (1 - pt.level / 100) * (MH - MP.top - MP.bottom)
        return `${x.toFixed(1)},${y.toFixed(1)}`
      }).join(' ')

      return { ...p, points, peak: Math.round(peak), trough: Math.round(trough), fluctuation: Math.round(peak - trough) }
    })
  }, [])

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
      <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Comparador de protocolos</p>
      <p className="text-slate-600 text-xs mb-3">Steady-state 100mg/dosis · menor fluctuación = niveles más estables</p>
      <div className="grid grid-cols-3 gap-2">
        {data.map(p => {
          const isCurrent = currentIntervalDays !== undefined &&
            Math.abs(currentIntervalDays - p.intervalDays) <= p.intervalDays * 0.4
          return (
            <div key={p.label} className={`rounded-xl p-2.5 border transition-colors ${isCurrent ? 'border-violet-500 bg-violet-500/10' : 'border-slate-700 bg-slate-900'}`}>
              <p className="text-white text-xs font-bold text-center">{p.label}</p>
              <p className="text-slate-500 text-xs text-center mb-1.5">{p.description}</p>
              <svg viewBox={`0 0 ${MW} ${MH}`} width="100%">
                <polyline points={p.points} fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <div className="mt-1.5 space-y-0.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Pico</span>
                  <span className="text-violet-400 font-semibold">{p.peak}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Valle</span>
                  <span className="text-slate-300">{p.trough}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fluctuac.</span>
                  <span className={p.fluctuation < 30 ? 'text-green-400' : p.fluctuation < 60 ? 'text-yellow-400' : 'text-red-400'}>
                    {p.fluctuation}%
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
