import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import type { LogEntry } from '../../schema/types'
import { computePKCurve } from '../../utils/trt-pk'
import { computeWellbeingScore, computeAvgSymptoms } from '../../utils/wellbeing'
import type { InjectionPoint } from '../../utils/trt-pk'

const MG_PER_ML = 250

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

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function diffDays(origin: string, date: string): number {
  return Math.round(
    (new Date(date + 'T00:00:00').getTime() - new Date(origin + 'T00:00:00').getTime()) / 86400000
  )
}

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function TRTCurveChart() {
  const dailyLogs = useStore(s => s.dailyLogs)
  const [period, setPeriod] = useState<string>('all')

  // All injections sorted
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

  // Months that have injection or wellbeing data
  const availableMonths = useMemo(() => {
    const set = new Set<string>()
    for (const log of Object.values(dailyLogs)) {
      const hasInj = log.entries.some(isEnanthateEntry)
      const hasWell = log.symptoms || (log.symptomLog && log.symptomLog.length > 0)
      if (hasInj || hasWell) set.add(log.date.slice(0, 7))
    }
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [dailyLogs])

  const today = todayStr()

  // t range: [start, end] in days-from-origin
  const tRange = useMemo<{ start: number; end: number }>(() => {
    if (!origin) return { start: 0, end: 0 }
    if (period === 'all') return { start: 0, end: diffDays(origin, today) + 8 }
    const dim = daysInMonth(period)
    const wStart = diffDays(origin, `${period}-01`)
    return { start: wStart, end: wStart + dim }
  }, [origin, period, today])

  // Unified x mapper — always works in t (days from origin)
  const toX = (t: number) =>
    PAD.left + ((t - tRange.start) / Math.max(tRange.end - tRange.start, 1)) * (W - PAD.left - PAD.right)

  // Curve data filtered to visible range
  const curveData = useMemo(() => {
    if (!origin || injections.length === 0) return []
    const curve = computePKCurve(injections, tRange.end + 5)
    return curve.filter(p => p.t >= tRange.start && p.t <= tRange.end)
  }, [injections, origin, tRange])

  const curvePoints = curveData
    .map(p => `${toX(p.t).toFixed(1)},${toY(p.level).toFixed(1)}`)
    .join(' ')

  // Injection markers visible in this period
  const injectionMarkers = useMemo(() => {
    if (!origin) return []
    return injections
      .map(inj => ({ t: diffDays(origin, inj.date), label: `${Math.round(inj.mgDose)}mg` }))
      .filter(({ t }) => t >= tRange.start && t <= tRange.end)
  }, [injections, origin, tRange])

  // Wellbeing dots visible in this period
  const wellbeingDots = useMemo(() => {
    if (!origin) return []
    return Object.entries(dailyLogs).flatMap(([date, log]) => {
      const t = diffDays(origin, date)
      if (t < tRange.start || t > tRange.end) return []
      let score: number | null = null
      if (log.symptomLog && log.symptomLog.length > 0) {
        score = computeWellbeingScore(computeAvgSymptoms(log.symptomLog.map(e => e.symptoms)))
      } else if (log.symptoms) {
        score = computeWellbeingScore(log.symptoms)
      }
      return score !== null ? [{ t, score }] : []
    })
  }, [dailyLogs, origin, tRange])

  // X-axis labels
  const xLabels = useMemo(() => {
    if (!origin) return []
    if (period !== 'all') {
      const dim = daysInMonth(period)
      return [1, 8, 15, 22, dim].filter(d => d <= dim).map(day => ({
        t: tRange.start + day - 1,
        label: String(day),
      }))
    }
    // all-period: one label per month at the 1st
    const labels: { t: number; label: string }[] = []
    let cur = origin.slice(0, 7)
    const todayMonth = today.slice(0, 7)
    while (cur <= todayMonth) {
      const t = diffDays(origin, `${cur}-01`)
      labels.push({ t, label: new Date(`${cur}-15`).toLocaleDateString('es-AR', { month: 'short' }) })
      const [y, m] = cur.split('-').map(Number)
      const next = new Date(y, m, 1)
      cur = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
    }
    return labels.filter(({ t }) => t >= tRange.start && t <= tRange.end)
  }, [origin, period, tRange, today])

  if (injections.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
        <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Curva TRT</p>
        <p className="text-slate-600 text-sm">Sin inyecciones de enantato registradas</p>
      </div>
    )
  }

  const periodLabel = period === 'all'
    ? 'Todo el período'
    : new Date(`${period}-15`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
      <select
        value={period}
        onChange={e => setPeriod(e.target.value)}
        className="w-full bg-slate-700 text-white text-sm font-semibold rounded-xl px-3 py-2 outline-none capitalize"
      >
        <option value="all">Todo el período</option>
        {availableMonths.map(m => (
          <option key={m} value={m}>
            {new Date(`${m}-15`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
          </option>
        ))}
      </select>

      <div className="flex gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5 bg-violet-400 rounded-full" />Nivel T estimado</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-400" />Bienestar</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        {[0, 30, 60, 100].map(v => (
          <g key={v}>
            <line x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)}
              stroke={v === 30 ? '#ef444430' : '#1e293b'} strokeWidth="1"
              strokeDasharray={v === 30 ? '4,3' : undefined} />
            <text x={PAD.left - 3} y={toY(v) + 3} fontSize="6" fill="#334155" textAnchor="end">{v}%</text>
          </g>
        ))}

        <rect x={PAD.left} y={toY(100)} width={W - PAD.left - PAD.right}
          height={toY(60) - toY(100)} fill="#22c55e07" />
        <rect x={PAD.left} y={toY(30)} width={W - PAD.left - PAD.right}
          height={toY(0) - toY(30)} fill="#ef444407" />

        {curvePoints && (
          <polyline points={curvePoints} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinejoin="round" />
        )}

        {injectionMarkers.map(({ t, label }) => (
          <g key={t}>
            <line x1={toX(t)} y1={PAD.top} x2={toX(t)} y2={H - PAD.bottom}
              stroke="#8b5cf6" strokeWidth="1" strokeDasharray="2,2" opacity="0.5" />
            <text x={toX(t)} y={PAD.top - 3} fontSize="7" fill="#a78bfa" textAnchor="middle">💉{label}</text>
          </g>
        ))}

        {wellbeingDots.map(({ t, score }) => (
          <g key={t}>
            <circle cx={toX(t)} cy={toY(score)} r="3.5" fill="#fb923c" />
            <text x={toX(t)} y={toY(score) - 5} fontSize="6" fill="#fb923c" textAnchor="middle">{score}</text>
          </g>
        ))}

        {xLabels.map(({ t, label }) => (
          <text key={t} x={toX(t)} y={H - PAD.bottom + 10} fontSize="6" fill="#475569" textAnchor="middle">{label}</text>
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
