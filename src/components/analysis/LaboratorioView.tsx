import { useState } from 'react'
import type { BloodMarker, BloodWorkEntry } from '../../schema/types'
import { BLOOD_MARKER_META, BLOOD_MARKER_ORDER } from '../../schema/bloodMarkers'
import { useStore } from '../../store'
import { BloodWorkForm } from './BloodWorkForm'

function semaphoreClass(marker: BloodMarker, value: number): string {
  const meta = BLOOD_MARKER_META[marker]
  if (meta.refMin !== undefined && value < meta.refMin) return 'text-red-400'
  if (meta.refMax !== undefined && value > meta.refMax) return 'text-red-400'
  if (meta.refMin !== undefined && value < meta.refMin * 1.1) return 'text-yellow-400'
  if (meta.refMax !== undefined && value > meta.refMax * 0.9) return 'text-yellow-400'
  if (meta.refMin !== undefined || meta.refMax !== undefined) return 'text-green-400'
  return 'text-slate-300'
}

function trendArrow(current: number, prev: number | undefined): string {
  if (prev === undefined) return ''
  if (current > prev * 1.05) return ' ↑'
  if (current < prev * 0.95) return ' ↓'
  return ' →'
}

type EntryCardProps = {
  entry: BloodWorkEntry
  prevEntry: BloodWorkEntry | undefined
  onEdit: () => void
  onDelete: () => void
}

function EntryCard({ entry, prevEntry, onEdit, onDelete }: EntryCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const markers = BLOOD_MARKER_ORDER.filter(m => entry.values[m] !== undefined)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-white text-sm font-semibold">{entry.date}</p>
          <p className="text-slate-500 text-xs">{markers.length} marcadores registrados</p>
        </div>
        <span className="text-slate-500 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-slate-700 px-4 py-3 space-y-2">
          {markers.map(marker => {
            const value = entry.values[marker]!
            const prevValue = prevEntry?.values[marker]
            const meta = BLOOD_MARKER_META[marker]
            return (
              <div key={marker} className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">{meta.label}</span>
                <span className={`text-sm font-medium ${semaphoreClass(marker, value)}`}>
                  {value} {meta.unit}{trendArrow(value, prevValue)}
                </span>
              </div>
            )
          })}
          {entry.notes && (
            <p className="text-slate-500 text-xs mt-2 italic">{entry.notes}</p>
          )}
          <div className="flex gap-3 mt-3 pt-2 border-t border-slate-700">
            <button onClick={onEdit} className="text-xs text-sky-400 hover:text-sky-300">Editar</button>
            {confirmDel ? (
              <>
                <button onClick={onDelete} className="text-xs text-red-400 font-semibold">¿Eliminar?</button>
                <button onClick={() => setConfirmDel(false)} className="text-xs text-slate-500">Cancelar</button>
              </>
            ) : (
              <button onClick={() => setConfirmDel(true)} className="text-xs text-slate-600 hover:text-red-400">Eliminar</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function LaboratorioView() {
  const bloodWork = useStore(s => s.bloodWork)
  const removeBloodWork = useStore(s => s.removeBloodWork)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<BloodWorkEntry | null>(null)

  const sorted = [...bloodWork].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-xs uppercase tracking-widest">Análisis de sangre</p>
        <button
          onClick={() => { setEditing(null); setFormOpen(true) }}
          className="text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
        >
          + Nuevo análisis
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 text-sm">Todavía no tenés análisis registrados.</p>
          <p className="text-slate-600 text-xs mt-1">Agregá tus resultados para trackear tu evolución.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((entry, i) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              prevEntry={sorted[i + 1]}
              onEdit={() => { setEditing(entry); setFormOpen(true) }}
              onDelete={() => removeBloodWork(entry.id)}
            />
          ))}
        </div>
      )}

      <BloodWorkForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        editing={editing}
      />
    </div>
  )
}
