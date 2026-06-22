import { useState } from 'react'
import { useStore } from '../../store'
import { classifyBP } from '../../utils/bp'
import { getLocalHHMM } from '../../utils/date'

type Props = { dateStr: string; isToday: boolean }
type Draft = { sys: number; dia: number; pulse: number; time: string; note: string }

const FIELDS = [
  { key: 'sys',   label: 'SYS (mmHg)',  min: 60,  max: 250 },
  { key: 'dia',   label: 'DIA (mmHg)',  min: 30,  max: 150 },
  { key: 'pulse', label: 'PULSO (bpm)', min: 30,  max: 220 },
] as const

export function BloodPressureWidget({ dateStr, isToday }: Props) {
  const bpReadings = useStore(s => s.bpReadings)
  const addBPReading = useStore(s => s.addBPReading)
  const removeBPReading = useStore(s => s.removeBPReading)

  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<Draft>({ sys: 120, dia: 80, pulse: 72, time: getLocalHHMM(), note: '' })
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const dayReadings = bpReadings
    .filter(r => r.date === dateStr)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  if (!isToday && dayReadings.length === 0) return null

  const save = () => {
    const [h, m] = draft.time.split(':').map(Number)
    const base = new Date(`${dateStr}T12:00:00`)
    base.setHours(h, m, 0, 0)
    addBPReading({ date: dateStr, timestamp: base.toISOString(), sys: draft.sys, dia: draft.dia, pulse: draft.pulse, note: draft.note.trim() || undefined })
    setShowForm(false)
    setDraft({ sys: 120, dia: 80, pulse: 72, time: getLocalHHMM(), note: '' })
    setConfirmDelete(null)
  }

  return (
    <div className="px-4 mt-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-slate-500 text-xs uppercase tracking-widest">Presión Arterial</p>
          {isToday && !showForm && (
            <button
              onClick={() => { setShowForm(true); setDraft(d => ({ ...d, time: getLocalHHMM() })) }}
              className="text-xs bg-sky-600 hover:bg-sky-500 text-white rounded-lg px-3 py-1 transition-colors"
            >
              + Registrar
            </button>
          )}
        </div>

        {/* readings list */}
        {dayReadings.length > 0 && (
          <div className="space-y-2 mb-3">
            {dayReadings.map(r => {
              const cat = classifyBP(r.sys, r.dia)
              const hhmm = new Date(r.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={r.id} className="flex items-center gap-3 bg-slate-900 rounded-xl px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold">{r.sys} / {r.dia}</p>
                    <p className="text-slate-500 text-xs">{r.pulse} bpm · {hhmm}</p>
                  </div>
                  <span className="text-xs font-semibold flex-shrink-0" style={{ color: cat.color }}>
                    {cat.label}
                  </span>
                  {confirmDelete === r.id ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => { removeBPReading(r.id); setConfirmDelete(null) }}
                        className="text-red-400 text-xs font-semibold"
                      >¿Borrar?</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-slate-500 text-xs">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(r.id)}
                      className="text-slate-600 hover:text-red-400 text-xs transition-colors flex-shrink-0"
                    >🗑</button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* empty state */}
        {dayReadings.length === 0 && !showForm && (
          <p className="text-slate-600 text-xs text-center py-2">Sin registros</p>
        )}

        {/* inline form */}
        {showForm && (
          <div className="space-y-3 pt-1">
            <div className="flex gap-2">
              {FIELDS.map(({ key, label, min, max }) => (
                <div key={key} className="flex-1 bg-slate-900 rounded-xl p-2 text-center">
                  <p className="text-slate-500 text-xs mb-1.5 leading-tight">{label}</p>
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => setDraft(d => ({ ...d, [key]: Math.max(min, d[key] - 1) }))}
                      className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center hover:bg-slate-600 text-sm flex-shrink-0"
                    >−</button>
                    <input
                      type="number"
                      min={min}
                      max={max}
                      value={draft[key]}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10)
                        if (!isNaN(v)) setDraft(d => ({ ...d, [key]: Math.max(min, Math.min(max, v)) }))
                      }}
                      className="w-12 bg-transparent text-white text-base font-bold text-center tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => setDraft(d => ({ ...d, [key]: Math.min(max, d[key] + 1) }))}
                      className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center hover:bg-slate-600 text-sm flex-shrink-0"
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
            <input
              type="time"
              value={draft.time}
              onChange={e => setDraft(d => ({ ...d, time: e.target.value }))}
              className="w-full bg-slate-900 text-white rounded-xl px-4 py-2.5 text-center text-base outline-none"
            />
            <input
              type="text"
              placeholder="Nota (opcional) — ej: después del gym, en reposo..."
              value={draft.note}
              onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
              className="w-full bg-slate-900 text-white placeholder-slate-600 rounded-xl px-4 py-2.5 text-sm outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl py-2.5 text-sm font-semibold transition-colors"
              >Cancelar</button>
              <button
                onClick={save}
                className="flex-[2] bg-green-600 hover:bg-green-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
              >Guardar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
