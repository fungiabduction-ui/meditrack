import { useMemo } from 'react'
import { useStore } from '../../store'
import { computeTRTCycleData } from '../../utils/analysis'

function intensityClass(score: number, count: number): string {
  if (count === 0) return 'bg-slate-800 text-slate-700'
  if (score >= 80) return 'bg-violet-600 text-white'
  if (score >= 60) return 'bg-violet-500/60 text-white'
  if (score >= 40) return 'bg-violet-500/30 text-slate-300'
  return 'bg-violet-500/15 text-slate-400'
}

export function TRTCycleHeatmap() {
  const dailyLogs = useStore(s => s.dailyLogs)
  const data = useMemo(() => computeTRTCycleData(dailyLogs), [dailyLogs])

  if (data.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
        <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Ciclo TRT 14 días</p>
        <p className="text-slate-600 text-sm">No se detectó registro de inyección de enantato</p>
      </div>
    )
  }

  const withData = data.filter(d => d.count > 0)
  const avgAll = withData.length > 0
    ? Math.round(withData.reduce((a, b) => a + b.avgScore, 0) / withData.length)
    : null

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-slate-500 text-xs uppercase tracking-widest">Ciclo TRT 14 días</p>
        {avgAll !== null && (
          <span className="text-slate-400 text-xs">avg {avgAll}/100</span>
        )}
      </div>

      <div className="space-y-1.5">
        {[0, 7].map(rowStart => (
          <div key={rowStart} className="grid grid-cols-7 gap-1">
            {data.slice(rowStart, rowStart + 7).map(d => (
              <div
                key={d.dayInCycle}
                title={d.count > 0 ? `Día ${d.dayInCycle + 1} · avg ${d.avgScore}/100 · ${d.count} registros` : `Día ${d.dayInCycle + 1} · sin datos`}
                className={`rounded-lg p-1.5 text-center transition-colors ${intensityClass(d.avgScore, d.count)}`}
              >
                <p className="text-xs font-bold leading-none">{d.dayInCycle + 1}</p>
                {d.count > 0 && (
                  <p className="text-xs leading-none mt-0.5 opacity-80">{d.avgScore}</p>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="text-slate-600 text-xs mt-3 text-center">Día 1 = día de inyección. Color = score promedio.</p>
    </div>
  )
}
