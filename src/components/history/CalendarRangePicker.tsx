import { useState } from 'react'
import type { DailyLog } from '../../schema/types'

type Props = {
  dailyLogs: Record<string, DailyLog>
  rangeFrom: string | null
  rangeTo: string | null
  onRangeChange: (from: string, to: string) => void
  onRangeClear: () => void
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function todayStr(): string {
  const d = new Date()
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate())
}

export function CalendarRangePicker({ dailyLogs, rangeFrom, rangeTo, onRangeChange, onRangeClear }: Props) {
  const today = todayStr()
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())
  const [pendingFrom, setPendingFrom] = useState<string | null>(null)

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  // firstDow: 0=Dom, 1=Lun, ..., 6=Sáb → offset para grilla Lun-primero
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const offset = firstDow === 0 ? 6 : firstDow - 1

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const handleDayClick = (dateStr: string) => {
    if (dateStr > today) return
    if (!pendingFrom) {
      setPendingFrom(dateStr)
      return
    }
    if (dateStr < pendingFrom) {
      setPendingFrom(dateStr)
      return
    }
    // dateStr >= pendingFrom → confirmar rango
    onRangeChange(pendingFrom, dateStr)
    setPendingFrom(null)
  }

  const handleClear = () => {
    setPendingFrom(null)
    onRangeClear()
  }

  // Celdas: null para padding, number para día
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const activeFrom = pendingFrom ?? rangeFrom
  const activeTo = pendingFrom ? null : rangeTo

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 mt-3">
      {/* Header mes */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-sm">‹</button>
        <span className="text-white text-sm font-semibold">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-sm">›</button>
      </div>

      {/* Cabeceras días */}
      <div className="grid grid-cols-7 mb-1">
        {['L','M','X','J','V','S','D'].map(d => (
          <div key={d} className="text-center text-xs text-slate-600 py-0.5">{d}</div>
        ))}
      </div>

      {/* Grilla */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} />
          const dateStr = toDateStr(viewYear, viewMonth, day)
          const isFuture = dateStr > today
          const hasEntries = !!(dailyLogs[dateStr]?.entries?.length)
          const hasSymptoms = !!(dailyLogs[dateStr]?.symptoms)
          const isEndpoint = dateStr === activeFrom || dateStr === activeTo
          const inRange = !!(activeFrom && activeTo && dateStr > activeFrom && dateStr < activeTo)

          let bg = isFuture
            ? 'opacity-25 cursor-not-allowed text-slate-600'
            : isEndpoint
              ? 'bg-violet-600 text-white'
              : inRange
                ? 'bg-violet-500/20 text-slate-300'
                : 'text-slate-300 hover:bg-slate-700 cursor-pointer'

          return (
            <button
              key={dateStr}
              disabled={isFuture}
              onClick={() => handleDayClick(dateStr)}
              className={`relative flex flex-col items-center justify-center rounded-lg h-9 text-xs font-medium transition-colors ${bg}`}
            >
              <span>{day}</span>
              {(hasEntries || hasSymptoms) && (
                <div className="flex gap-0.5 absolute bottom-1">
                  {hasEntries && <span className="w-1 h-1 rounded-full bg-sky-400" />}
                  {hasSymptoms && <span className="w-1 h-1 rounded-full bg-violet-400" />}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Leyenda y estado */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-slate-500 flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" /> tomas</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" /> síntomas</span>
        </div>
        {(rangeFrom || pendingFrom) && (
          <button onClick={handleClear} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Limpiar</button>
        )}
      </div>

      {pendingFrom && !activeTo && (
        <p className="text-xs text-violet-400 mt-2 text-center">Desde {pendingFrom} — elegí fecha fin</p>
      )}
    </div>
  )
}
