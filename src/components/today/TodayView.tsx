import { useState, useMemo, useRef, useEffect } from 'react'
import { useToday } from '../../hooks/useToday'
import { Modal } from '../shared/Modal'
import { DoseInput } from '../shared/DoseInput'
import { useStore } from '../../store'
import type { Supplement } from '../../schema/types'
import { formatTimestamp, getLocalHHMM, getLocalDateStr } from '../../utils/date'
import { DailyNotes } from './DailyNotes'
import { DailySymptoms } from './DailySymptoms'
import { BloodPressureWidget } from './BloodPressureWidget'
import { QuickLogSheet } from './QuickLogSheet'
import { getSuggestedRegulars } from '../../utils/regulars'

type LogModal = { supplement: Supplement; qty: number; time: string }
type EditModal = { entryId: string; currentTs: string; value: string }
type QuickSheetState = { supplement: Supplement }

function offsetDate(base: string, days: number): string {
  const d = new Date(`${base}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function TodayView() {
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateStr())
  const { today, isToday, groups, takenIds, takenEntries, alerts, scheduledCount, takenCount, logItem, editTimestamp, removeEntry } = useToday(selectedDate)
  const supplements = useStore(s => s.supplements)
  const dailyLogs = useStore(s => s.dailyLogs)

  const [logModal, setLogModal] = useState<LogModal | null>(null)
  const [editModal, setEditModal] = useState<EditModal | null>(null)
  const [quickSheet, setQuickSheet] = useState<QuickSheetState | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<'chronological' | 'grouped'>('chronological')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const adherence = scheduledCount > 0 ? Math.round((takenCount / scheduledCount) * 100) : 100
  const todayNotes = dailyLogs[selectedDate]?.notes ?? []

  const dateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  // Todos los suplementos activos para la búsqueda
  const activeSups = useMemo(
    () => Object.values(supplements).filter(s => s.active && s.inStock !== false),
    [supplements]
  )

  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return activeSups.filter(s =>
      s.name.toLowerCase().includes(q)
      || (s.brand ?? '').toLowerCase().includes(q)
      || s.activeIngredients.some(i => i.name.toLowerCase().includes(q))
    ).slice(0, 5)
  }, [search, activeSups])

  // Píldoras de pendientes (scheduled hoy, no tomados aún)
  const pendingSupplements = useMemo(() => {
    const pending: Supplement[] = []
    for (const g of groups) pending.push(...g.items.filter(s => !takenIds.has(s.id)))
    return pending
  }, [groups, takenIds])

  const suggestedRegulars = useMemo(
    () => getSuggestedRegulars(supplements, dailyLogs, today),
    [supplements, dailyLogs, today]
  )

  const groupedEntries = useMemo(() => {
    const order: string[] = []
    const buckets: Record<string, typeof takenEntries> = {}
    for (const e of [...takenEntries].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
      if (!buckets[e.supplementId]) {
        buckets[e.supplementId] = []
        order.push(e.supplementId)
      }
      buckets[e.supplementId].push(e)
    }
    return order.map(id => ({ supplementId: id, entries: buckets[id] }))
  }, [takenEntries])

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

  const defaultTime = () => isToday ? getLocalHHMM() : '12:00'

  const selectResult = (s: Supplement) => {
    setSearch('')
    setDropdownOpen(false)
    setLogModal({ supplement: s, qty: s.defaultDose, time: defaultTime() })
  }

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.closest('.search-wrap')?.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="flex flex-col pb-24 min-h-full">
      {/* header */}
      <div className="px-4 pt-6 pb-3">
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDate(d => offsetDate(d, -1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-sm"
            >‹</button>
            <h1 className="text-lg font-bold text-white capitalize">{dateLabel}</h1>
            <button
              onClick={() => setSelectedDate(d => offsetDate(d, 1))}
              disabled={isToday}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-sm disabled:opacity-20 disabled:cursor-not-allowed"
            >›</button>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isToday && (
              <button
                onClick={() => setSelectedDate(today)}
                className="text-xs text-sky-400 underline"
              >Hoy</button>
            )}
            {scheduledCount > 0 && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                adherence === 100
                  ? 'text-green-400 bg-green-400/10 border-green-400/20'
                  : 'text-sky-400 bg-sky-400/10 border-sky-400/20'
              }`}>{adherence}%</span>
            )}
          </div>
        </div>
        <p className="text-slate-500 text-xs mb-3">{takenCount} de {scheduledCount} registrados</p>

        {/* progress bar */}
        {scheduledCount > 0 && (
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-sky-600 to-sky-400 rounded-full transition-all duration-500"
              style={{ width: `${adherence}%` }}
            />
          </div>
        )}

        {/* buscador */}
        <div className="search-wrap relative">
          <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-lg shadow-black/30">
            <span className="text-slate-400 text-sm">🔍</span>
            <input
              ref={searchRef}
              value={search}
              onChange={e => { setSearch(e.target.value); setDropdownOpen(true) }}
              onFocus={() => { if (search) setDropdownOpen(true) }}
              placeholder="Buscar y registrar…"
              className="flex-1 bg-transparent text-slate-800 text-sm outline-none placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => { setSearch(''); setDropdownOpen(false) }} className="text-slate-400 text-xs">✕</button>
            )}
          </div>
          {dropdownOpen && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl shadow-black/40 overflow-hidden z-10">
              {searchResults.map(s => (
                <button
                  key={s.id}
                  onClick={() => selectResult(s)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 text-left"
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${takenIds.has(s.id) ? 'bg-green-500' : 'bg-slate-300'}`} />
                  <span className="text-slate-800 text-sm font-medium flex-1">{s.name}</span>
                  <span className="text-slate-400 text-xs">{s.defaultDose} {s.doseUnit}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* alertas */}
      {alerts.map(s => (
        <div key={s.id} className="mx-4 mb-2 bg-slate-800 border border-red-500/30 rounded-xl p-3">
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

      {/* pendientes */}
      {pendingSupplements.length > 0 && (
        <div className="px-4 mb-4">
          <p className="text-slate-500 text-xs uppercase tracking-widest mb-2 px-1">Pendientes hoy</p>
          <div className="flex flex-wrap gap-2">
            {pendingSupplements.map(s => (
              <button
                key={s.id}
                onClick={() => setQuickSheet({ supplement: s })}
                className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-full px-3 py-1.5 text-xs text-slate-300 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 flex-shrink-0" />
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* regulares sugeridos */}
      {suggestedRegulars.length > 0 && (
        <div className="px-4 mb-4">
          <p className="text-slate-500 text-xs uppercase tracking-widest mb-2 px-1">Regulares sugeridos</p>
          <div className="flex flex-wrap gap-2">
            {suggestedRegulars.map(s => (
              <button
                key={s.id}
                onClick={() => setQuickSheet({ supplement: s })}
                className="flex items-center gap-1.5 bg-slate-800 border border-slate-600 hover:border-sky-600 rounded-full px-3 py-1.5 text-xs text-slate-300 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 flex-shrink-0" />
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* tomados hoy */}
      {takenEntries.length > 0 && (
        <div className="px-4">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-slate-500 text-xs uppercase tracking-widest">Tomados</p>
            <div className="flex gap-1">
              <button
                onClick={() => { setSortMode('chronological'); setConfirmDelete(null) }}
                className={`text-sm px-1 rounded transition-colors ${sortMode === 'chronological' ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}
                title="Orden cronológico"
              >🕐</button>
              <button
                onClick={() => { setSortMode('grouped'); setConfirmDelete(null) }}
                className={`text-sm px-1 rounded transition-colors ${sortMode === 'grouped' ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}
                title="Agrupar por suplemento"
              >📦</button>
            </div>
          </div>

          {sortMode === 'chronological' && (
            <div className="space-y-2">
              {[...takenEntries]
                .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
                .map(e => (
                  <div key={e.id} className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
                    <div className="w-5 h-5 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-green-400 text-xs">✓</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{e.supplementSnapshot.name}</p>
                      {e.supplementSnapshot.brand && (
                        <p className="text-slate-500 text-xs">{e.supplementSnapshot.brand}</p>
                      )}
                      <p className="text-slate-400 text-xs">{e.quantity} {e.doseUnit}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {e.timestampEditedFrom && (
                        <span className="text-slate-600 text-xs line-through">{formatTimestamp(e.timestampEditedFrom)}</span>
                      )}
                      {isToday ? (
                        <button onClick={() => openEdit(e.id, e.timestamp)} className="text-sky-400 text-xs underline">
                          {formatTimestamp(e.timestamp)}
                        </button>
                      ) : (
                        <span className="text-slate-500 text-xs">{formatTimestamp(e.timestamp)}</span>
                      )}
                      {confirmDelete === e.id ? (
                        <>
                          <button
                            onClick={() => { removeEntry(e.id); setConfirmDelete(null) }}
                            className="text-red-400 text-xs font-semibold"
                          >
                            ¿Borrar?
                          </button>
                          <button onClick={() => setConfirmDelete(null)} className="text-slate-500 text-xs">✕</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDelete(e.id)} className="text-slate-600 hover:text-red-400 text-xs transition-colors">
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {sortMode === 'grouped' && (
            <div className="space-y-3">
              {groupedEntries.map(({ supplementId, entries }) => (
                <div key={supplementId} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-3 pt-2.5 pb-2 border-b border-slate-700">
                    <p className="text-white text-sm font-medium">{entries[0].supplementSnapshot.name}</p>
                    {entries[0].supplementSnapshot.brand && (
                      <p className="text-slate-500 text-xs">{entries[0].supplementSnapshot.brand}</p>
                    )}
                    <p className="text-slate-600 text-xs mt-0.5">{entries.length} {entries.length === 1 ? 'toma' : 'tomas'}</p>
                  </div>
                  <div className="divide-y divide-slate-700/50">
                    {entries.map(e => (
                      <div key={e.id} className="flex items-center gap-2 px-3 py-2">
                        <span className="text-green-400 text-xs flex-shrink-0">✓</span>
                        <span className="text-slate-300 text-xs flex-1">{e.quantity} {e.doseUnit}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isToday ? (
                            <button onClick={() => openEdit(e.id, e.timestamp)} className="text-sky-400 text-xs underline">
                              {formatTimestamp(e.timestamp)}
                            </button>
                          ) : (
                            <span className="text-slate-500 text-xs">{formatTimestamp(e.timestamp)}</span>
                          )}
                          {confirmDelete === e.id ? (
                            <>
                              <button
                                onClick={() => { removeEntry(e.id); setConfirmDelete(null) }}
                                className="text-red-400 text-xs font-semibold"
                              >
                                ¿Borrar?
                              </button>
                              <button onClick={() => setConfirmDelete(null)} className="text-slate-500 text-xs">✕</button>
                            </>
                          ) : (
                            <button onClick={() => setConfirmDelete(e.id)} className="text-slate-600 hover:text-red-400 text-xs transition-colors">
                              🗑
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* empty state */}
      {takenEntries.length === 0 && pendingSupplements.length === 0 && (
        <div className="flex-1 flex items-center justify-center py-16">
          <p className="text-slate-600 text-sm text-center">
            Buscá un suplemento arriba para registrarlo.
          </p>
        </div>
      )}

      <DailyNotes dateStr={selectedDate} notes={todayNotes} isToday={isToday} />

      <div className="px-4 mt-4">
        <DailySymptoms key={selectedDate} dateStr={selectedDate} isToday={isToday} />
      </div>

      <BloodPressureWidget dateStr={selectedDate} isToday={isToday} />

      {/* quick log sheet */}
      {quickSheet && (
        <QuickLogSheet
          supplement={quickSheet.supplement}
          dailyLogs={dailyLogs}
          onConfirm={(qty, time) => {
            logItem(quickSheet.supplement.id, qty, time)
            setQuickSheet(null)
          }}
          onOpenFull={(capturedTime) => {
            const s = quickSheet.supplement
            setQuickSheet(null)
            setLogModal({ supplement: s, qty: s.defaultDose, time: capturedTime })
          }}
          onClose={() => setQuickSheet(null)}
        />
      )}

      {/* modal de log */}
      <Modal open={!!logModal} onClose={() => setLogModal(null)} title={logModal?.supplement.name ?? ''}>
        {logModal && (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">{logModal.supplement.instructions}</p>
            <DoseInput
              value={logModal.qty}
              unit={logModal.supplement.doseUnit}
              step={logModal.supplement.doseStep}
              defaultDose={logModal.supplement.defaultDose}
              min={logModal.supplement.doseStep}
              onChange={qty => setLogModal(m => m ? { ...m, qty } : null)}
            />
            <div>
              <p className="text-slate-500 text-xs mb-1.5">Hora de toma</p>
              <input
                type="time"
                value={logModal.time}
                onChange={e => setLogModal(m => m ? { ...m, time: e.target.value } : null)}
                className="w-full bg-slate-700 text-white rounded-xl px-4 py-2.5 text-center text-lg outline-none"
              />
            </div>
            <button
              onClick={() => { logItem(logModal.supplement.id, logModal.qty, logModal.time); setLogModal(null) }}
              className="w-full bg-green-600 hover:bg-green-500 text-white rounded-xl py-3 font-semibold transition-colors"
            >
              Confirmar — {logModal.qty} {logModal.supplement.doseUnit}
            </button>
          </div>
        )}
      </Modal>

      {/* modal editar timestamp */}
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
