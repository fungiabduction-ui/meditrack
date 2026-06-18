import { useState } from 'react'
import type { Schedule, TimingSlot } from '../../schema/types'
import { Modal } from '../shared/Modal'

type Props = {
  open: boolean
  count: number
  onClose: () => void
  onApply: (schedule: Schedule, timing: TimingSlot | null) => void
}

type ScheduleKind = 'daily' | 'weekdays_lv' | 'custom_weekdays' | 'fixed_interval' | 'as_needed'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const TIMING_OPTIONS: { value: TimingSlot | 'null'; label: string }[] = [
  { value: 'morning', label: 'Mañana' },
  { value: 'midday', label: 'Mediodía' },
  { value: 'afternoon', label: 'Tarde' },
  { value: 'evening', label: 'Tarde-noche' },
  { value: 'night', label: 'Noche' },
  { value: 'null', label: 'Sin momento' },
]

function buildSchedule(kind: ScheduleKind, intervalDays: string, alertDays: string, customDays: number[]): Schedule {
  if (kind === 'daily') return { kind: 'weekdays', days: [0, 1, 2, 3, 4, 5, 6] }
  if (kind === 'weekdays_lv') return { kind: 'weekdays', days: [0, 1, 2, 3, 4] }
  if (kind === 'custom_weekdays') return { kind: 'weekdays', days: customDays }
  if (kind === 'fixed_interval') return {
    kind: 'fixed_interval',
    intervalDays: parseInt(intervalDays) || 7,
    alertDaysBefore: parseInt(alertDays) || 2,
  }
  return { kind: 'as_needed' }
}

export function BulkScheduleModal({ open, count, onClose, onApply }: Props) {
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>('daily')
  const [intervalDays, setIntervalDays] = useState('7')
  const [alertDays, setAlertDays] = useState('2')
  const [customDays, setCustomDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [timing, setTiming] = useState<TimingSlot | 'null'>('morning')

  const toggleDay = (i: number) =>
    setCustomDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort())

  const handleApply = () => {
    onApply(
      buildSchedule(scheduleKind, intervalDays, alertDays, customDays),
      timing === 'null' ? null : timing as TimingSlot,
    )
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Programar ${count} suplemento${count !== 1 ? 's' : ''}`}>
      <div className="space-y-5">

        {/* schedule kind */}
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Frecuencia</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['daily', 'Diario'],
              ['weekdays_lv', 'Lun–Vie'],
              ['custom_weekdays', 'Días custom'],
              ['fixed_interval', 'Cada N días'],
              ['as_needed', 'A demanda'],
            ] as [ScheduleKind, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setScheduleKind(k)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  scheduleKind === k ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {scheduleKind === 'custom_weekdays' && (
            <div className="flex gap-2 mt-3">
              {DAYS.map((d, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                    customDays.includes(i) ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {d.slice(0, 1)}
                </button>
              ))}
            </div>
          )}

          {scheduleKind === 'fixed_interval' && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div>
                <p className="text-slate-500 text-xs mb-1">Cada (días)</p>
                <input
                  type="number" min="1" value={intervalDays}
                  onChange={e => setIntervalDays(e.target.value)}
                  className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Alerta (días antes)</p>
                <input
                  type="number" min="0" value={alertDays}
                  onChange={e => setAlertDays(e.target.value)}
                  className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* timing */}
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Momento del día</p>
          <div className="grid grid-cols-3 gap-2">
            {TIMING_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTiming(opt.value)}
                className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                  timing === opt.value ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleApply}
          className="w-full bg-sky-600 hover:bg-sky-500 text-white rounded-xl py-3 font-semibold transition-colors"
        >
          Aplicar a {count} suplemento{count !== 1 ? 's' : ''}
        </button>
      </div>
    </Modal>
  )
}
