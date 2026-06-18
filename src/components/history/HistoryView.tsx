import { useState } from 'react'
import { useStore } from '../../store'
import { DayTimeline } from './DayTimeline'
import { CalendarRangePicker } from './CalendarRangePicker'
import { getLocalDateStr, parseLocalDate } from '../../utils/date'
import { downloadAnalysisJsonRange } from '../../utils/export'
import { read } from '../../storage/persistence'

function addDays(dateStr: string, n: number): string {
  const d = parseLocalDate(dateStr)
  d.setDate(d.getDate() + n)
  return getLocalDateStr(d)
}

export function HistoryView() {
  const today = getLocalDateStr()
  const [selected, setSelected] = useState(today)
  const [rangeFrom, setRangeFrom] = useState<string | null>(null)
  const [rangeTo, setRangeTo] = useState<string | null>(null)
  const dailyLogs = useStore(s => s.dailyLogs)

  const log = dailyLogs[selected]
  const canGoForward = selected < today

  const dateLabel = parseLocalDate(selected).toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const handleRangeChange = (from: string, to: string) => {
    setRangeFrom(from)
    setRangeTo(to)
  }

  const handleRangeClear = () => {
    setRangeFrom(null)
    setRangeTo(null)
  }

  return (
    <div className="pb-24 min-h-full">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-white mb-4">Historial</h1>

        {/* nav de día */}
        <div className="flex items-center justify-between bg-slate-800 rounded-xl px-3 py-2">
          <button onClick={() => setSelected(d => addDays(d, -1))} className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center text-xl">‹</button>
          <div className="text-center">
            <p className="text-white text-sm font-medium capitalize">{dateLabel}</p>
            {selected === today && <p className="text-sky-400 text-xs">Hoy</p>}
          </div>
          <button
            onClick={() => canGoForward && setSelected(d => addDays(d, 1))}
            className={`w-8 h-8 flex items-center justify-center text-xl ${canGoForward ? 'text-slate-400 hover:text-white' : 'text-slate-700'}`}
          >›</button>
        </div>

        {/* calendario de exportación */}
        <CalendarRangePicker
          dailyLogs={dailyLogs}
          rangeFrom={rangeFrom}
          rangeTo={rangeTo}
          onRangeChange={handleRangeChange}
          onRangeClear={handleRangeClear}
        />

        {/* botón exportar — solo visible cuando hay rango seleccionado */}
        {rangeFrom && rangeTo && (
          <button
            onClick={() => downloadAnalysisJsonRange(read(), rangeFrom, rangeTo)}
            className="mt-3 w-full text-sm px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors"
          >
            Exportar JSON — {rangeFrom} → {rangeTo}
          </button>
        )}
      </div>

      <div className="px-4">
        {log
          ? <DayTimeline log={log} />
          : (
            <div className="text-center py-16">
              <p className="text-slate-500 text-sm">Sin registros para este día.</p>
            </div>
          )
        }
      </div>
    </div>
  )
}
