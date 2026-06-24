import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import type { LogEntry } from '../../schema/types'
import { computePKCurve } from '../../utils/trt-pk'
import { computeWellbeingScore, computeAvgSymptoms } from '../../utils/wellbeing'
import type { InjectionPoint } from '../../utils/trt-pk'

const MG_PER_ML = 250  // Testenat Depot 250mg/ml

function isEnanthateEntry(e: LogEntry): boolean {
  return (
    e.supplementSnapshot.name.toLowerCase().includes('enantato') ||
    e.supplementSnapshot.activeIngredients.some(
      i => i.name.toLowerCase().includes('testosterona') &&
           (i.form?.toLowerCase() ?? '').includes('enantato')
    )
  )
}

const W = 300
const H = 150
const PAD = { top: 14, right: 12, bottom: 22, left: 30 }

function toY(val: number): number {
  return PAD.top + (1 - Math.max(0, Math.min(100, val)) / 100) * (H - PAD.top - PAD.bottom)
}

function currentMonthStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function offsetMonthStr(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function daysInMonthFor(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function diffDaysFromOrigin(origin: string, date: string): number {
  return Math.round(
    (new Date(date + 'T00:00:00').getTime() - new Date(origin + 'T00:00:00').getTime()) / 86400000
  )
}

export function TRTCurveChart() {
  const dailyLogs = useStore(s => s.dailyLogs)
  const [month, setMonth] = useState(currentMonthStr)

  const { injections, origin } = useMemo(() => {
    const map = new Map<string, number>()
    for (const log of Object.values(dailyLogs)) {
      for (const entry of log.entries) {
        if (isEnanthateEntry(entry)) {
          map.set(log.date, (map.get(log.date) ?? 0) + entry.quantity * MG_PER_ML)
        }
      }
    }
    const injs: InjectionPoint[] = [...map.entries()]
      .map(([date, mgDose]) => ({ date, mgDose }))
      .sort((a, b) => a.date.localeCompare(b.date))
    return { injections: injs, origin: injs[0]?.date ?? null }
  }, [dailyLogs])

  const today = currentMonthStr()
  const dim = daysInMonthFor(month)
  const monthLabel = new Date(`${month}-15`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const toX = (day: number) =>
    PAD.left + ((day - 1) / Math.max(dim - 1, 1)) * (W - PAD.left - PAD.right)

  // Window in days-from-origin
  const windowStart = origin ? diffDaysFromOrigin(origin, `${month}-01`) : 0
  const windowEnd = windowStart + dim

  // PK curve — only compute if we have injections that reach this month
  const curvePoints = useMemo(() => {
    if (!origin || injections.length === 0) return ''
    if (windowEnd <= 0) return ''
    const totalDays = Math.max(windowEnd + 5, 1)
    const curve = computePKCurve(injections, totalDays)
    return curve
      .filter(p => p.t >= windowStart && p.t <= windowEnd)
      .map(p => {
        const dayF = p.t - windowStart + 1
        const x = PAD.left + ((dayF - 1) / Math.max(dim - 1, 1)) * (W - PAD.left - PAD.right)
        return `${x.toFixed(1)},${toY(p.level).toFixed(1)}`
      })
      .join(' ')
  }, [injections, origin, windowStart, windowEnd, dim])

  // Injection markers within this month
  const injectionMarkers = useMemo(() => {
    if (!origin) return []
    return injections
      .filter(inj => inj.date.startsWith(month))
      .map(inj => ({ day: parseInt(inj.date.slice(-2), 10), label: `${Math.round(inj.mgDose)}mg` }))
  }, [injections, origin, month])

  // Wellbeing dots
  const wellbeingDots = useMemo(() => {
    return Object.entries(dailyLogs)
      .filter(([date]) => date.startsWith(month))
      .flatMap(([date, log]) => {
        const day = parseInt(date.slice(-2), 10)
        let score: number | null = null
        if (log.symptomLog && log.symptomLog.length > 0) {
          score = computeWellbeingScore(computeAvgSymptoms(log.symptomLog.map(e => e.symptoms)))
        } else if (log.symptoms) {
          score = computeWellbeingScore(log.symptoms)
        }
        return score !== null ? [{ day, score }] : []
      })
  }, [dailyLogs, month])

  if (injections.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
        <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Curva TRT</p>
        <p className="text-slate-600 text-sm">Sin inyecciones de enantato registradas</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setMonth(m => offsetMonthStr(m, -1))} className="text-slate-400 hover:text-white px-2 text-lg">‹</button>
        <span className="text-white text-sm font-semibold capitalize">{monthLabel}</span>
        <button onClick={() => setMonth(m => offsetMonthStr(m, 1))} disabled={month >= today} className="text-slate-400 hover:text-white px-2 text-lg disabled:opacity-20 disabled:cursor-not-allowed">›</button>
      </div>

      <div className="flex gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5 bg-violet-400 rounded-full" />Nivel T estimado</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-400" />Bienestar</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        {/* Y grid lines */}
        {[0, 30, 60, 100].map(v => (
          <g key={v}>
            <line x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)}
              stroke={v === 30 ? '#ef444430' : '#1e293b'} strokeWidth="1"
              strokeDasharray={v === 30 ? '4,3' : undefined} />
            <text x={PAD.left - 3} y={toY(v) + 3} fontSize="6" fill="#334155" textAnchor="end">{v}%</text>
          </g>
        ))}

        {/* Optimal zone 60–100% */}
        <rect x={PAD.left} y={toY(100)} width={W - PAD.left - PAD.right}
          height={toY(60) - toY(100)} fill="#22c55e07" />

        {/* Reinjection zone <30% */}
        <rect x={PAD.left} y={toY(30)} width={W - PAD.left - PAD.right}
          height={toY(0) - toY(30)} fill="#ef444407" />

        {/* PK curve */}
        {curvePoints && (
          <polyline points={curvePoints} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinejoin="round" />
        )}

        {/* Injection markers */}
        {injectionMarkers.map(({ day, label }) => (
          <g key={day}>
            <line x1={toX(day)} y1={PAD.top} x2={toX(day)} y2={H - PAD.bottom}
              stroke="#8b5cf6" strokeWidth="1" strokeDasharray="2,2" opacity="0.5" />
            <text x={toX(day)} y={PAD.top - 3} fontSize="7" fill="#a78bfa" textAnchor="middle">💉{label}</text>
          </g>
        ))}

        {/* Wellbeing dots */}
        {wellbeingDots.map(({ day, score }) => (
          <g key={day}>
            <circle cx={toX(day)} cy={toY(score)} r="3.5" fill="#fb923c" />
            <text x={toX(day)} y={toY(score) - 5} fontSize="6" fill="#fb923c" textAnchor="middle">{score}</text>
          </g>
        ))}

        {/* X axis labels */}
        {[1, 8, 15, 22, dim].filter(d => d <= dim).map(day => (
          <text key={day} x={toX(day)} y={H - PAD.bottom + 10} fontSize="6" fill="#475569" textAnchor="middle">{day}</text>
        ))}
      </svg>

      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-2 rounded-sm bg-green-500/10 border border-green-500/20" />zona óptima 60-100%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 border-t border-red-500/40 border-dashed" />reinjectar &lt;30%
        </span>
      </div>
    </div>
  )
}
