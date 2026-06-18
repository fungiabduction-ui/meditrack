import { useMemo } from 'react'
import { useStore } from '../../store'
import { computeSupplementCorrelations } from '../../utils/analysis'

export function SupplementCorrelation() {
  const dailyLogs = useStore(s => s.dailyLogs)
  const supplements = useStore(s => s.supplements)
  const correlations = useMemo(
    () => computeSupplementCorrelations(dailyLogs, supplements),
    [dailyLogs, supplements]
  )

  const daysWithSymptoms = Object.values(dailyLogs).filter(l => l.symptoms).length

  if (daysWithSymptoms < 7) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
        <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Correlaciones</p>
        <p className="text-slate-600 text-sm">Necesitás al menos 7 días con síntomas</p>
        <p className="text-slate-700 text-xs mt-1">Tenés {daysWithSymptoms} registrados</p>
      </div>
    )
  }

  if (correlations.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
        <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Correlaciones</p>
        <p className="text-slate-600 text-sm">Ningún suplemento tiene ≥3 días de datos aún</p>
      </div>
    )
  }

  const maxDelta = Math.max(...correlations.map(c => Math.abs(c.delta)), 1)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <p className="text-slate-500 text-xs uppercase tracking-widest mb-3">Correlaciones top 5</p>

      <div className="space-y-4">
        {correlations.map(c => {
          const deltaPos = c.delta > 0
          const barWidth = Math.round((Math.abs(c.delta) / maxDelta) * 100)

          return (
            <div key={c.supplementId}>
              <div className="flex items-baseline justify-between mb-1">
                <div className="min-w-0 mr-2">
                  <span className="text-white text-sm font-medium">{c.name}</span>
                  {c.brand && <span className="text-slate-500 text-xs ml-1.5">{c.brand}</span>}
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${deltaPos ? 'text-green-400' : 'text-red-400'}`}>
                  {deltaPos ? '+' : ''}{c.delta}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="w-8 text-right">{c.avgScoreWithout}</span>
                <div className="flex-1 relative h-3 bg-slate-700 rounded-full overflow-hidden">
                  {deltaPos ? (
                    <div
                      className="absolute right-1/2 top-0 bottom-0 bg-green-500/50 rounded-full"
                      style={{ width: `${barWidth / 2}%` }}
                    />
                  ) : (
                    <div
                      className="absolute left-1/2 top-0 bottom-0 bg-red-500/50 rounded-full"
                      style={{ width: `${barWidth / 2}%` }}
                    />
                  )}
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-500" />
                </div>
                <span className="w-8">{c.avgScoreWith}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-700 px-10 mt-0.5">
                <span>sin</span>
                <span>{c.daysLogged}d tomado</span>
                <span>con</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
