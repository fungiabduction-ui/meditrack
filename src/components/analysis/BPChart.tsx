import { useState, useMemo } from 'react'
import { useStore } from '../../store'
import { computeEMA } from '../../utils/bp'

type SeriesKey = 'sys' | 'dia' | 'pulse' | 'ema7' | 'ema14' | 'ema30'

const SERIES: { key: SeriesKey; label: string; color: string; dashed: boolean; opacity: number }[] = [
  { key: 'sys',   label: 'SYS',   color: '#ef4444', dashed: false, opacity: 1 },
  { key: 'dia',   label: 'DIA',   color: '#3b82f6', dashed: false, opacity: 1 },
  { key: 'pulse', label: 'PULSO', color: '#22c55e', dashed: false, opacity: 1 },
  { key: 'ema7',  label: 'EMA7',  color: '#ef4444', dashed: true,  opacity: 0.7 },
  { key: 'ema14', label: 'EMA14', color: '#ef4444', dashed: true,  opacity: 0.5 },
  { key: 'ema30', label: 'EMA30', color: '#ef4444', dashed: true,  opacity: 0.35 },
]

const Y_MIN = 50
const Y_MAX = 200
const W = 300
const H = 120
const PAD = { top: 8, right: 12, bottom: 18, left: 26 }

function toY(val: number): number {
  const clamped = Math.max(Y_MIN, Math.min(Y_MAX, val))
  return PAD.top + (1 - (clamped - Y_MIN) / (Y_MAX - Y_MIN)) * (H - PAD.top - PAD.bottom)
}

function avg(arr: number[]): number {
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
}

function currentMonthStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function offsetMonthStr(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function BPChart() {
  const bpReadings = useStore(s => s.bpReadings)
  const [month, setMonth] = useState(currentMonthStr)
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    sys: true, dia: true, pulse: true, ema7: true, ema14: true, ema30: false,
  })
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const today = currentMonthStr()
  const monthLabel = new Date(`${month}-15`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5)), 0).getDate()

  const toX = (day: number) =>
    PAD.left + ((day - 1) / Math.max(daysInMonth - 1, 1)) * (W - PAD.left - PAD.right)

  const data = useMemo(() => {
    const filtered = bpReadings.filter(r => r.date.startsWith(month))
    const byDate = new Map<string, { sys: number[]; dia: number[]; pulse: number[] }>()
    for (const r of filtered) {
      if (!byDate.has(r.date)) byDate.set(r.date, { sys: [], dia: [], pulse: [] })
      const g = byDate.get(r.date)!
      g.sys.push(r.sys); g.dia.push(r.dia); g.pulse.push(r.pulse)
    }
    const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
    const days = sorted.map(([d]) => parseInt(d.slice(-2), 10))
    const sys = sorted.map(([, g]) => avg(g.sys))
    const dia = sorted.map(([, g]) => avg(g.dia))
    const pulse = sorted.map(([, g]) => avg(g.pulse))
    const ema7 = computeEMA(sys, 7).map(Math.round)
    const ema14 = computeEMA(sys, 14).map(Math.round)
    const ema30 = computeEMA(sys, 30).map(Math.round)

    const allSys = filtered.map(r => r.sys)
    const allDia = filtered.map(r => r.dia)
    const allPulse = filtered.map(r => r.pulse)
    const safeAvg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

    return {
      days, sys, dia, pulse, ema7, ema14, ema30,
      stats: { sys: safeAvg(allSys), dia: safeAvg(allDia), pulse: safeAvg(allPulse), count: filtered.length },
    }
  }, [bpReadings, month])

  const toggle = (key: SeriesKey) => setVisible(v => ({ ...v, [key]: !v[key] }))

  const pts = (series: number[]) =>
    data.days.map((d, i) => `${toX(d)},${toY(series[i])}`).join(' ')

  if (data.days.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setMonth(m => offsetMonthStr(m, -1))} className="text-slate-400 hover:text-white text-sm px-2">‹</button>
          <span className="text-white text-sm font-semibold capitalize">{monthLabel}</span>
          <button onClick={() => setMonth(m => offsetMonthStr(m, 1))} disabled={month >= today} className="text-slate-400 hover:text-white text-sm px-2 disabled:opacity-20 disabled:cursor-not-allowed">›</button>
        </div>
        <p className="text-slate-500 text-sm text-center py-4">Sin registros en {monthLabel}</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
      {/* month nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => setMonth(m => offsetMonthStr(m, -1))} className="text-slate-400 hover:text-white px-2 text-lg">‹</button>
        <span className="text-white text-sm font-semibold capitalize">{monthLabel}</span>
        <button onClick={() => setMonth(m => offsetMonthStr(m, 1))} disabled={month >= today} className="text-slate-400 hover:text-white px-2 text-lg disabled:opacity-20 disabled:cursor-not-allowed">›</button>
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-1.5">
        {SERIES.map(s => (
          <button
            key={s.key}
            onClick={() => toggle(s.key)}
            className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border transition-all ${
              visible[s.key] ? 'border-slate-600 text-slate-300' : 'border-slate-800 text-slate-600'
            }`}
          >
            <span style={{
              display: 'inline-block', width: 14,
              ...(s.dashed
                ? { borderTop: `1px dashed ${s.color}`, opacity: s.opacity }
                : { height: 2, background: s.color }),
            }} />
            {s.label}
          </button>
        ))}
      </div>

      {/* chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* grid + Y labels */}
        {[80, 120, 140].map(v => (
          <g key={v}>
            <line x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)} stroke="#1e293b" strokeWidth="1"/>
            <text x={PAD.left - 3} y={toY(v) + 3} fontSize="6" fill="#334155" textAnchor="end">{v}</text>
          </g>
        ))}
        {/* normal zone */}
        <rect x={PAD.left} y={toY(120)} width={W - PAD.left - PAD.right} height={toY(50) - toY(120)} fill="#22c55e08"/>

        {/* series */}
        {data.days.length > 1 && (
          <>
            {visible.pulse && <polyline points={pts(data.pulse)} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinejoin="round"/>}
            {visible.dia   && <polyline points={pts(data.dia)}   fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round"/>}
            {visible.sys   && <polyline points={pts(data.sys)}   fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinejoin="round"/>}
            {visible.ema7  && <polyline points={pts(data.ema7)}  fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="3,2" opacity="0.7"/>}
            {visible.ema14 && <polyline points={pts(data.ema14)} fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="5,3" opacity="0.5"/>}
            {visible.ema30 && <polyline points={pts(data.ema30)} fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="8,4" opacity="0.35"/>}
          </>
        )}

        {/* hover targets + dots */}
        {data.days.map((day, i) => (
          <g key={day}>
            <rect x={toX(day) - 7} y={PAD.top} width={14} height={H - PAD.top - PAD.bottom} fill="transparent" onMouseEnter={() => setHoveredIdx(i)}/>
            {visible.sys   && <circle cx={toX(day)} cy={toY(data.sys[i])}   r={hoveredIdx === i ? 3.5 : 2}   fill="#ef4444"/>}
            {visible.dia   && <circle cx={toX(day)} cy={toY(data.dia[i])}   r={hoveredIdx === i ? 3   : 1.5} fill="#3b82f6"/>}
            {visible.pulse && <circle cx={toX(day)} cy={toY(data.pulse[i])} r={hoveredIdx === i ? 3   : 1.5} fill="#22c55e"/>}
          </g>
        ))}

        {/* X labels — first, last, and every 7th day */}
        {data.days
          .filter((d, i) => i === 0 || i === data.days.length - 1 || d % 7 === 1)
          .map(day => (
            <text key={day} x={toX(day)} y={H - PAD.bottom + 10} fontSize="7" fill="#475569" textAnchor="middle">{day}</text>
          ))}
      </svg>

      {/* tooltip */}
      {hoveredIdx !== null && (
        <div className="bg-slate-900 rounded-xl px-3 py-2 text-xs flex gap-4 flex-wrap">
          <span className="text-slate-500">Día {data.days[hoveredIdx]}</span>
          <span><span className="text-red-400">SYS</span> {data.sys[hoveredIdx]}</span>
          <span><span className="text-blue-400">DIA</span> {data.dia[hoveredIdx]}</span>
          <span><span className="text-green-400">PULSO</span> {data.pulse[hoveredIdx]}</span>
        </div>
      )}

      {/* stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Prom SYS',   value: data.stats.sys,   color: 'text-red-400' },
          { label: 'Prom DIA',   value: data.stats.dia,   color: 'text-blue-400' },
          { label: 'Prom PULSO', value: data.stats.pulse, color: 'text-green-400' },
          { label: 'Registros',  value: data.stats.count, color: 'text-slate-300' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-900 rounded-xl p-2 text-center">
            <p className="text-slate-500 text-xs mb-0.5 leading-tight">{label}</p>
            <p className={`${color} text-sm font-bold tabular-nums`}>{value ?? '—'}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
