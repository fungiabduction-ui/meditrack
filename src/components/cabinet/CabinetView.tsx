import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store'
import { SupplementCard } from './SupplementCard'
import { SupplementForm } from './SupplementForm'
import { CabinetExportSchema } from '../../schema/zod-schemas'
import { importCabinet } from '../../utils/importCabinet'
import type { Supplement, CabinetExport } from '../../schema/types'

type Toast = { message: string; type: 'success' | 'error' }

export function CabinetView() {
  const supplements = useStore(s => s.supplements)
  const addSupplement = useStore(s => s.addSupplement)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Supplement | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const active = Object.values(supplements).filter(s => s.active)

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
        const { toAdd, skipped } = importCabinet(result.data, supplements)
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
      <div className="px-4 pt-6 pb-4 flex justify-between items-center gap-2">
        <h1 className="text-xl font-bold text-white">Botiquín</h1>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            Importar
          </button>
          <button
            onClick={handleExport}
            disabled={active.length === 0}
            className="bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Exportar
          </button>
          <button
            onClick={() => { setEditing(null); setFormOpen(true) }}
            className="bg-sky-600 hover:bg-sky-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            + Agregar
          </button>
        </div>
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
