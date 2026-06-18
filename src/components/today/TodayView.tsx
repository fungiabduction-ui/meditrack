import { useState } from 'react'
import { useToday } from '../../hooks/useToday'
import { TimeGroup } from './TimeGroup'
import { Modal } from '../shared/Modal'
import { DoseInput } from '../shared/DoseInput'
import { Supplement } from '../../schema/types'
import { formatTimestamp } from '../../utils/date'

type LogModal = { supplement: Supplement; qty: number }
type EditModal = { entryId: string; currentTs: string; value: string }

export function TodayView() {
  const { today, groups, asNeeded, takenIds, takenEntries, alerts, scheduledCount, takenCount, logItem, editTimestamp } = useToday()
  const [logModal, setLogModal] = useState<LogModal | null>(null)
  const [asNeededOpen, setAsNeededOpen] = useState(false)
  const [editModal, setEditModal] = useState<EditModal | null>(null)

  const adherence = scheduledCount > 0 ? Math.round((takenCount / scheduledCount) * 100) : 100

  const dateLabel = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  const openEdit = (entryId: string, currentTs: string) => {
    setEditModal({ entryId, currentTs, value: formatTimestamp(currentTs) })
  }

  const confirmEdit = () => {
    if (!editModal) return
    const [h, m] = editModal.value.split(':').map(Number)
    const base = new Date(today)
    base.setHours(h, m, 0, 0)
    editTimestamp(editModal.entryId, base.toISOString())
    setEditModal(null)
  }

  return (
    <div className="flex flex-col pb-24 min-h-full">
      {/* header */}
      <div className="px-4 pt-6 pb-2">
        <div className="flex justify-between items-start mb-1">
          <h1 className="text-lg font-bold text-white capitalize">{dateLabel}</h1>
          <span className="text-green-400 font-bold">{adherence}%</span>
        </div>
        <p className="text-slate-400 text-sm">{takenCount} de {scheduledCount} tomados</p>
      </div>

      {/* alerts */}
      {alerts.map(s => (
        <div key={s.id} className="mx-4 mt-3 bg-slate-800 border border-red-500/30 rounded-xl p-3">
          <p className="text-red-400 text-xs font-semibold uppercase tracking-wide">⚠ Recordatorio</p>
          <p className="text-white font-medium mt-1">{s.name}</p>
          {s.nextDue && (
            <p className="text-slate-400 text-xs mt-0.5">
              Próxima: {new Date(s.nextDue).toLocaleDateString('es-AR', {
                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          )}
        </div>
      ))}

      {/* groups */}
      <div className="px-4 mt-4 space-y-5">
        {groups.length === 0 && (
          <p className="text-slate-500 text-center py-12">No hay ítems programados para hoy.</p>
        )}
        {groups.map(g => (
          <TimeGroup
            key={g.slot}
            group={g}
            takenIds={takenIds}
            takenEntries={takenEntries}
            onLog={s => setLogModal({ supplement: s, qty: s.defaultDose })}
          />
        ))}
      </div>

      {/* taken entries with edit option */}
      {takenEntries.length > 0 && (
        <div className="px-4 mt-5">
          <p className="text-slate-500 text-xs uppercase tracking-widest mb-2 px-1">Registro de hoy</p>
          <div className="space-y-1">
            {takenEntries
              .slice()
              .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
              .map(e => (
                <div key={e.id} className="flex items-center justify-between py-1.5 px-2">
                  <span className="text-slate-300 text-sm">{e.supplementSnapshot.name} · {e.quantity} {e.doseUnit}</span>
                  <div className="flex items-center gap-2">
                    {e.timestampEditedFrom && (
                      <span className="text-slate-600 text-xs line-through">{formatTimestamp(e.timestampEditedFrom)}</span>
                    )}
                    <button
                      onClick={() => openEdit(e.id, e.timestamp)}
                      className="text-sky-400 text-xs underline"
                    >
                      {formatTimestamp(e.timestamp)}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* as_needed button */}
      {asNeeded.length > 0 && (
        <div className="px-4 mt-4">
          <button
            onClick={() => setAsNeededOpen(true)}
            className="w-full border border-slate-700 text-slate-400 rounded-xl py-3 text-sm hover:bg-slate-800 transition-colors"
          >
            + Registrar ítem a demanda
          </button>
        </div>
      )}

      {/* log modal */}
      <Modal open={!!logModal} onClose={() => setLogModal(null)} title={logModal?.supplement.name ?? ''}>
        {logModal && (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">{logModal.supplement.instructions}</p>
            <DoseInput
              value={logModal.qty}
              unit={logModal.supplement.doseUnit}
              step={logModal.supplement.doseStep}
              min={logModal.supplement.doseStep}
              onChange={qty => setLogModal(m => m ? { ...m, qty } : null)}
            />
            <button
              onClick={() => { logItem(logModal.supplement.id, logModal.qty); setLogModal(null) }}
              className="w-full bg-green-600 hover:bg-green-500 text-white rounded-xl py-3 font-semibold transition-colors"
            >
              Confirmar — {logModal.qty} {logModal.supplement.doseUnit}
            </button>
          </div>
        )}
      </Modal>

      {/* as_needed modal */}
      <Modal open={asNeededOpen} onClose={() => setAsNeededOpen(false)} title="Registrar a demanda">
        <div className="space-y-2">
          {asNeeded.map(s => (
            <button
              key={s.id}
              onClick={() => { setAsNeededOpen(false); setLogModal({ supplement: s, qty: s.defaultDose }) }}
              className="w-full text-left bg-slate-700 hover:bg-slate-600 rounded-xl p-3 transition-colors"
            >
              <p className="text-white font-medium">{s.name}</p>
              <p className="text-slate-400 text-xs mt-0.5">{s.defaultDose} {s.doseUnit}</p>
            </button>
          ))}
        </div>
      </Modal>

      {/* edit timestamp modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Editar hora">
        {editModal && (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">Hora original: {formatTimestamp(editModal.currentTs)}</p>
            <input
              type="time"
              value={editModal.value}
              onChange={e => setEditModal(m => m ? { ...m, value: e.target.value } : null)}
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-lg text-center outline-none"
            />
            <button
              onClick={confirmEdit}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white rounded-xl py-3 font-semibold transition-colors"
            >
              Confirmar
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
