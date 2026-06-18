import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store'
import { SupplementCard } from './SupplementCard'
import { SupplementForm } from './SupplementForm'
import { BulkScheduleModal } from './BulkScheduleModal'
import { CabinetExportSchema } from '../../schema/zod-schemas'
import { importCabinet } from '../../utils/importCabinet'
import type { Supplement, CabinetExport, Schedule, TimingSlot } from '../../schema/types'

type Toast = { message: string; type: 'success' | 'error' }

export function CabinetView() {
  const supplements = useStore(s => s.supplements)
  const addSupplement = useStore(s => s.addSupplement)
  const updateSupplement = useStore(s => s.updateSupplement)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Supplement | null>(null)
  const [search, setSearch] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const all = Object.values(supplements)
  const active = all.filter(s => s.active)
  const filtered = search.trim()
    ? active.filter(s => {
        const q = search.toLowerCase()
        return s.name.toLowerCase().includes(q)
          || (s.brand ?? '').toLowerCase().includes(q)
          || s.activeIngredients.some(i => i.name.toLowerCase().includes(q))
      })
    : active
  const conStock = active.filter(s => s.inStock !== false).length
  const sinStock = active.filter(s => s.inStock === false).length

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  function exitEditMode() {
    setEditMode(false)
    exitSelectMode()
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleBulkApply(schedule: Schedule, timing: TimingSlot | null) {
    selected.forEach(id => updateSupplement(id, { schedule, timing }))
    exitSelectMode()
    setToast({ message: `Programación aplicada a ${selected.size} suplemento${selected.size !== 1 ? 's' : ''}`, type: 'success' })
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target!.result as string)
        const result = CabinetExportSchema.safeParse(raw)
        if (!result.success) {
          const msg = result.error.issues[0]?.message ?? 'formato incorrecto'
          setToast({ message: `Archivo inválido: ${msg}`, type: 'error' })
          return
        }
        const { toAdd, skipped } = importCabinet(result.data, useStore.getState().supplements)
        toAdd.forEach(s => addSupplement(s))
        const added = toAdd.length
        const p = (count: number, word: string) => `${count} ${word}${count !== 1 ? 's' : ''}`
        const msg = `${p(added, 'suplemento')} agregado${added !== 1 ? 's' : ''}` +
          (skipped.length > 0 ? `, ${p(skipped.length, 'omitido')} (ya existían)` : '')
        setToast({ message: msg, type: 'success' })
      } catch {
        setToast({ message: 'El archivo no es JSON válido', type: 'error' })
      }
    }
    reader.readAsText(file)
  }

  function handleExport() {
    const payload: CabinetExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      supplements: active,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meditrack-cabinet-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="pb-24 min-h-full">
      <div className="px-4 pt-6 pb-4 space-y-4">

        {/* title */}
        <h1 className="text-xl font-bold text-white">Botiquín</h1>

        {/* search */}
        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-lg shadow-black/30">
          <span className="text-slate-400 text-sm">🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar suplemento…"
            className="flex-1 bg-transparent text-slate-800 text-sm outline-none placeholder:text-slate-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400 text-xs">✕</button>
          )}
        </div>

        {/* KPI dashboard */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-800 rounded-xl px-3 py-2.5 text-center">
            <p className="text-white text-xl font-bold">{active.length}</p>
            <p className="text-slate-500 text-xs mt-0.5">registrados</p>
          </div>
          <div className="bg-slate-800 rounded-xl px-3 py-2.5 text-center">
            <p className="text-emerald-400 text-xl font-bold">{conStock}</p>
            <p className="text-slate-500 text-xs mt-0.5">con stock</p>
          </div>
          <div className="bg-slate-800 rounded-xl px-3 py-2.5 text-center">
            <p className={`text-xl font-bold ${sinStock > 0 ? 'text-amber-400' : 'text-slate-600'}`}>{sinStock}</p>
            <p className="text-slate-500 text-xs mt-0.5">sin stock</p>
          </div>
        </div>

        {/* main action row */}
        {!editMode ? (
          <div className="flex gap-2">
            <button
              onClick={() => setEditMode(true)}
              disabled={active.length === 0}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Editar
            </button>
            <button
              onClick={() => { setEditing(null); setFormOpen(true) }}
              className="flex-1 bg-sky-600 hover:bg-sky-500 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
            >
              + Nuevo
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl py-2.5 text-sm font-medium transition-colors"
              >
                Importar
              </button>
              <button
                onClick={handleExport}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl py-2.5 text-sm font-medium transition-colors"
              >
                Exportar
              </button>
              <button
                onClick={() => setSelectMode(true)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl py-2.5 text-sm font-medium transition-colors"
              >
                Seleccionar
              </button>
            </div>
            <button
              onClick={exitEditMode}
              className="w-full border border-slate-700 text-slate-400 rounded-xl py-2 text-sm transition-colors hover:border-slate-500"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* bulk selection bar */}
        {selectMode && (
          <div className="flex items-center justify-between bg-sky-900/40 border border-sky-700/50 rounded-xl px-4 py-3">
            <span className="text-slate-300 text-sm">
              {selected.size === 0 ? 'Tocá las cards para seleccionar' : `${selected.size} seleccionado${selected.size !== 1 ? 's' : ''}`}
            </span>
            <button
              onClick={() => setBulkOpen(true)}
              disabled={selected.size === 0}
              className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
            >
              Programar
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImport}
      />

      {toast && (
        <div className={`mx-4 mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
          toast.type === 'success'
            ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
            : 'bg-red-900/60 text-red-300 border border-red-700'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="px-4 space-y-3">
        {active.length === 0 && (
          <p className="text-slate-500 text-center py-16 text-sm">
            No hay suplementos.<br />Tocá "+ Nuevo" para empezar.
          </p>
        )}
        {active.length > 0 && filtered.length === 0 && (
          <p className="text-slate-500 text-center py-8 text-sm">Sin resultados para "{search}"</p>
        )}
        {filtered.map(s => (
          <SupplementCard
            key={s.id}
            supplement={s}
            onEdit={() => { setEditing(s); setFormOpen(true) }}
            selectable={selectMode}
            selected={selected.has(s.id)}
            onToggleSelect={() => toggleSelect(s.id)}
          />
        ))}
      </div>

      <SupplementForm
        open={formOpen}
        supplement={editing}
        onClose={() => { setFormOpen(false); setEditing(null) }}
      />

      <BulkScheduleModal
        open={bulkOpen}
        count={selected.size}
        onClose={() => setBulkOpen(false)}
        onApply={handleBulkApply}
      />
    </div>
  )
}
