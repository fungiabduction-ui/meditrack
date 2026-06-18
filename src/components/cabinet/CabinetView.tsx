import { useState } from 'react'
import { useStore } from '../../store'
import { SupplementCard } from './SupplementCard'
import { SupplementForm } from './SupplementForm'
import { Supplement } from '../../schema/types'

export function CabinetView() {
  const supplements = useStore(s => s.supplements)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Supplement | null>(null)

  const active = Object.values(supplements).filter(s => s.active)

  return (
    <div className="pb-24 min-h-full">
      <div className="px-4 pt-6 pb-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-white">Botiquín</h1>
        <button
          onClick={() => { setEditing(null); setFormOpen(true) }}
          className="bg-sky-600 hover:bg-sky-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          + Agregar
        </button>
      </div>

      <div className="px-4 space-y-3">
        {active.length === 0 && (
          <p className="text-slate-500 text-center py-16 text-sm">
            No hay suplementos.<br />Tocá "+ Agregar" para empezar.
          </p>
        )}
        {active.map(s => (
          <SupplementCard
            key={s.id}
            supplement={s}
            onEdit={() => { setEditing(s); setFormOpen(true) }}
          />
        ))}
      </div>

      <SupplementForm
        open={formOpen}
        supplement={editing}
        onClose={() => { setFormOpen(false); setEditing(null) }}
      />
    </div>
  )
}
