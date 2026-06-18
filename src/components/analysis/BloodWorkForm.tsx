import { useState } from 'react'
import type { BloodMarker, BloodWorkEntry } from '../../schema/types'
import { BLOOD_MARKER_META, BLOOD_MARKER_ORDER } from '../../schema/bloodMarkers'
import { Modal } from '../shared/Modal'
import { useStore } from '../../store'

type Props = {
  open: boolean
  onClose: () => void
  editing?: BloodWorkEntry | null
}

type FormValues = Partial<Record<BloodMarker, string>>

function toDateInputValue(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function BloodWorkForm({ open, onClose, editing }: Props) {
  const addBloodWork = useStore(s => s.addBloodWork)
  const updateBloodWork = useStore(s => s.updateBloodWork)

  const [date, setDate] = useState(() => editing?.date ?? toDateInputValue())
  const [values, setValues] = useState<FormValues>(() => {
    if (!editing) return {}
    return Object.fromEntries(
      Object.entries(editing.values).map(([k, v]) => [k, String(v)])
    ) as FormValues
  })
  const [notes, setNotes] = useState(editing?.notes ?? '')

  const hasAnyValue = Object.values(values).some(v => v !== '' && v !== undefined && !isNaN(Number(v)))

  const handleSave = () => {
    const parsedValues: Partial<Record<BloodMarker, number>> = {}
    for (const [key, raw] of Object.entries(values)) {
      const n = Number(raw)
      if (raw !== '' && !isNaN(n) && n >= 0) {
        parsedValues[key as BloodMarker] = n
      }
    }
    if (editing) {
      updateBloodWork(editing.id, { date, values: parsedValues, notes: notes || undefined })
    } else {
      addBloodWork({ date, values: parsedValues, notes: notes || undefined })
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar análisis' : 'Nuevo análisis de sangre'}>
      <div className="space-y-4">
        <div>
          <p className="text-slate-500 text-xs mb-1.5">Fecha de extracción</p>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-slate-700 text-white rounded-xl px-4 py-2.5 outline-none text-sm"
          />
        </div>

        <div className="space-y-3">
          {BLOOD_MARKER_ORDER.map(marker => {
            const meta = BLOOD_MARKER_META[marker]
            return (
              <div key={marker} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300 text-sm truncate">{meta.label}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={values[marker] ?? ''}
                    onChange={e => setValues(prev => ({ ...prev, [marker]: e.target.value }))}
                    placeholder="—"
                    className="w-24 bg-slate-700 text-white rounded-lg px-3 py-1.5 text-sm outline-none text-right placeholder:text-slate-600"
                  />
                  <span className="text-slate-500 text-xs w-14">{meta.unit}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div>
          <p className="text-slate-500 text-xs mb-1.5">Notas (opcional)</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-slate-700 text-white rounded-xl px-4 py-2.5 outline-none text-sm resize-none"
            placeholder="Ej: en ayunas, día 7 del ciclo..."
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!hasAnyValue || !date}
          className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
        >
          {editing ? 'Guardar cambios' : 'Guardar análisis'}
        </button>
      </div>
    </Modal>
  )
}
