import { useMemo } from 'react'
import { useStore } from '../../store'
import { computeWellbeingTrend } from '../../utils/analysis'

const SVG_W = 300
const SVG_H = 80
const PAD = 8

export function WellbeingTrend() {
  const dailyLogs = useStore(s => s.dailyLogs)
  const points = useMemo(() => computeWellbeingTrend(dailyLogs, 30), [dailyLogs])

  if (points.length < 3) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
        <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Tendencia 30 días</p>
        <p className="text-slate-600 text-sm">Necesitás al menos 3 días con síntomas registrados</p>
      </div>
    )
  }

  const scores = points.map(p => p.score)
  const minScore = Math.min(...scores)
  const maxScore = Math.max(...scores)
  const range = maxScore - minScore || 1

  const toX = (i: number) => PAD + (i / (points.length - 1)) * (SVG_W - PAD * 2)
  const toY = (score: number) => SVG_H - PAD - ((score - minScore) / range) * (SVG_H - PAD * 2)

  const polyPoints = points.map((p, i) => `${toX(i)},${toY(p.score)}`).join(' ')

  const lastScore = points[points.length - 1].score
  const firstScore = points[0].score
  const delta = lastScore - firstScore
  const deltaColor = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-slate-400'
  const deltaSign = delta > 0 ? '+' : ''

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-slate-500 text-xs uppercase tracking-widest">Tendencia 30 días</p>
        <div className="text-right">
          <span className="text-white text-lg font-bold">{lastScore}</span>
          <span className="text-slate-500 text-xs">/100 </span>
          <span className={`text-xs font-semibold ${deltaColor}`}>{deltaSign}{delta}</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ height: SVG_H }}>
        <defs>
          <linearGradient id="wbGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${toX(0)},${SVG_H} ${polyPoints} ${toX(points.length - 1)},${SVG_H}`}
          fill="url(#wbGrad)"
        />
        <polyline
          points={polyPoints}
          fill="none"
          stroke="#7c3aed"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <circle key={p.date} cx={toX(i)} cy={toY(p.score)} r="2.5" fill="#7c3aed" />
        ))}
      </svg>

      <div className="flex justify-between mt-1">
        <span className="text-slate-600 text-xs">{points[0].date.slice(5)}</span>
        <span className="text-slate-600 text-xs">{minScore} min · {maxScore} max</span>
        <span className="text-slate-600 text-xs">{points[points.length - 1].date.slice(5)}</span>
      </div>
    </div>
  )
}
