import { useState } from 'react'
import type { Supplement } from '../../schema/types'
import { useStore } from '../../store'

type Props = {
  supplement: Supplement
  onEdit: () => void
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}

function scheduleLabel(s: Supplement): string {
  const { schedule } = s
  if (schedule.kind === 'fixed_interval') return `Cada ${schedule.intervalDays} días`
  if (schedule.kind === 'weekdays') {
    if (schedule.days.length === 7) return 'Diario'
    const names = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
    return schedule.days.map(d => names[d]).join(', ')
  }
  return 'A demanda'
}

export function SupplementCard({ supplement: s, onEdit, selectable, selected, onToggleSelect }: Props) {
  const [open, setOpen] = useState(false)
  const deactivate = useStore(st => st.deactivateSupplement)
  const setInStock = useStore(st => st.setInStock)
  const [confirming, setConfirming] = useState(false)
  const inStock = s.inStock !== false

  return (
    <div className={`bg-slate-800 rounded-xl overflow-hidden transition-opacity ${inStock ? '' : 'opacity-50'}`}>
      {/* header row */}
      <button
        onClick={selectable ? onToggleSelect : () => setOpen(v => !v)}
        className="w-full text-left px-4 py-3 flex items-start gap-3"
      >
        {selectable && (
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
            selected ? 'bg-sky-500 border-sky-500' : 'border-slate-500'
          }`}>
            {selected && <span className="text-white text-xs font-bold">✓</span>}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">{s.name}</p>
          {s.brand && <p className="text-slate-500 text-xs">{s.brand}</p>}
          <p className="text-slate-400 text-xs mt-0.5">{s.defaultDose} {s.doseUnit} · {scheduleLabel(s)}</p>
        </div>
        {!selectable && <span className="text-slate-500 mt-1">{open ? '▲' : '▼'}</span>}
      </button>

      {/* detail */}
      {open && !selectable && (
        <div className="border-t border-slate-700 px-4 pb-4 space-y-4">

          {s.description && (
            <div className="pt-3">
              <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Descripción</p>
              <p className="text-slate-300 text-sm leading-relaxed">{s.description}</p>
            </div>
          )}

          {s.activeIngredients.length > 0 && (
            <div>
              <p className="text-sky-400 text-xs uppercase tracking-wide mb-2">Composición activa — por porción</p>
              <div className="space-y-2">
                {s.activeIngredients.map((ing, i) => (
                  <div key={i} className="bg-slate-900 rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm">{ing.name}</p>
                      <p className="text-slate-500 text-xs">
                        {ing.form}
                        {ing.source ? ` · ${ing.source}` : ''}
                        {ing.brand ? ` · ${ing.brand}` : ''}
                      </p>
                    </div>
                    <p className="text-sky-400 font-bold text-sm">{ing.amount} {ing.unit}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wide mb-2">Dosis y uso</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900 rounded-lg p-3">
                <p className="text-slate-500 text-xs">Porción</p>
                <p className="text-white text-sm">{s.defaultDose} {s.doseUnit}</p>
              </div>
              {s.presentation && (
                <div className="bg-slate-900 rounded-lg p-3">
                  <p className="text-slate-500 text-xs">Presentación</p>
                  <p className="text-white text-sm">{s.presentation}</p>
                </div>
              )}
              <div className="bg-slate-900 rounded-lg p-3 col-span-2">
                <p className="text-slate-500 text-xs">Instrucción</p>
                <p className="text-white text-sm">{s.instructions}</p>
              </div>
            </div>
          </div>

          {s.excipients && (
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Excipientes</p>
              <p className="text-slate-400 text-sm">{s.excipients}</p>
            </div>
          )}

          {s.benefits && (
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Beneficios</p>
              <p className="text-slate-400 text-sm">{s.benefits}</p>
            </div>
          )}

          {s.certifications.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {s.certifications.map(c => (
                <span key={c} className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded-full">{c}</span>
              ))}
            </div>
          )}

          {s.warnings && (
            <div className="border-l-2 border-amber-500 pl-3">
              <p className="text-amber-400 text-xs uppercase tracking-wide mb-1">⚠ Advertencias</p>
              <p className="text-slate-300 text-sm">{s.warnings}</p>
            </div>
          )}

          {/* schedule badge */}
          <div className="flex flex-wrap gap-2">
            <span className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded-full">{scheduleLabel(s)}</span>
            {s.nextDue && (
              <span className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded-full">
                Próx: {new Date(s.nextDue).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* actions */}
          <div className="flex gap-2 pt-1 flex-wrap">
            <button onClick={onEdit} className="flex-1 border border-sky-600 text-sky-400 rounded-lg py-2 text-sm hover:bg-sky-600/10 transition-colors">
              Editar
            </button>
            <button
              onClick={() => setInStock(s.id, !inStock)}
              className={`flex-1 rounded-lg py-2 text-sm transition-colors border ${
                inStock
                  ? 'border-slate-600 text-slate-400 hover:border-slate-400'
                  : 'border-emerald-600/60 text-emerald-400 hover:bg-emerald-600/10'
              }`}
            >
              {inStock ? 'Sin stock' : 'Con stock'}
            </button>
            {!confirming
              ? <button onClick={() => setConfirming(true)} className="flex-1 border border-red-600/50 text-red-400 rounded-lg py-2 text-sm hover:bg-red-600/10 transition-colors">
                  Eliminar
                </button>
              : <button onClick={() => { deactivate(s.id); setConfirming(false) }} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm">
                  ¿Confirmar?
                </button>
            }
          </div>
        </div>
      )}
    </div>
  )
}
