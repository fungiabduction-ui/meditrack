import { useState, useMemo } from 'react'
import type { DailyLog } from '../../schema/types'
import { formatTimestamp } from '../../utils/date'
import { computeWellbeingScore } from '../../utils/wellbeing'
import { MetabolicSummary } from './MetabolicSummary'
import { useStore } from '../../store'

type Props = { log: DailyLog }

export function DayTimeline({ log }: Props) {
  const supplements = useStore(s => s.supplements)
  const [sortMode, setSortMode] = useState<'chronological' | 'grouped'>('chronological')

  const sorted = useMemo(
    () => [...log.entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [log.entries]
  )

  const groupedEntries = useMemo(() => {
    const order: string[] = []
    const buckets: Record<string, typeof sorted> = {}
    for (const e of sorted) {
      if (!buckets[e.supplementId]) {
        buckets[e.supplementId] = []
        order.push(e.supplementId)
      }
      buckets[e.supplementId].push(e)
    }
    return order.map(id => ({ supplementId: id, entries: buckets[id] }))
  }, [sorted])
  const total = sorted.length + log.skipped.length
  const adherence = total > 0 ? Math.round((sorted.length / total) * 100) : 100
  const wellbeingScore = log.symptoms ? computeWellbeingScore(log.symptoms) : null

  return (
    <div className="space-y-4">
      {/* stats */}
      <div className="flex gap-2 flex-wrap">
        <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full">{sorted.length} tomados</span>
        {log.skipped.length > 0 && (
          <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-full">{log.skipped.length} omitidos</span>
        )}
        {log.sealed && <span className="bg-slate-700 text-slate-400 text-xs px-2 py-1 rounded-full">🔒 sellado</span>}
        {wellbeingScore !== null && (
          <span className="bg-violet-500/20 text-violet-400 text-xs px-2 py-1 rounded-full">⚡ {wellbeingScore}/100</span>
        )}
        <span className="bg-slate-700 text-slate-400 text-xs px-2 py-1 rounded-full ml-auto">{adherence}%</span>
      </div>

      {/* timeline */}
      {sorted.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-slate-500 text-xs uppercase tracking-wide">Entradas</p>
            <div className="flex gap-1">
              <button
                onClick={() => setSortMode('chronological')}
                className={`text-sm px-1 rounded transition-colors ${sortMode === 'chronological' ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}
                title="Orden cronológico"
              >🕐</button>
              <button
                onClick={() => setSortMode('grouped')}
                className={`text-sm px-1 rounded transition-colors ${sortMode === 'grouped' ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}
                title="Agrupar por suplemento"
              >📦</button>
            </div>
          </div>

          {sortMode === 'chronological' && (
            <div className="relative pl-5">
              <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-slate-700" />
              <div className="space-y-3">
                {sorted.map(e => (
                  <div key={e.id} className="relative">
                    <div className="absolute -left-3 top-2 w-2 h-2 rounded-full bg-green-500 border-2 border-slate-900" />
                    <div className="bg-slate-800 rounded-xl px-3 py-2.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm font-medium">{e.supplementSnapshot.name}</p>
                            {!supplements[e.supplementId]?.active && (
                              <span className="text-slate-500 text-xs bg-slate-700 px-1.5 py-0.5 rounded">eliminado</span>
                            )}
                          </div>
                          {e.supplementSnapshot.brand && (
                            <p className="text-slate-500 text-xs">{e.supplementSnapshot.brand}</p>
                          )}
                          <p className="text-slate-400 text-xs mt-0.5">
                            {e.quantity} {e.doseUnit}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-green-400 text-sm font-medium">{formatTimestamp(e.timestamp)}</p>
                          {e.timestampEditedFrom && (
                            <p className="text-slate-600 text-xs line-through">{formatTimestamp(e.timestampEditedFrom)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sortMode === 'grouped' && (
            <div className="space-y-3">
              {groupedEntries.map(({ supplementId, entries }) => (
                <div key={supplementId} className="bg-slate-800 rounded-xl overflow-hidden">
                  <div className="px-3 pt-2.5 pb-2 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-medium">{entries[0].supplementSnapshot.name}</p>
                      {!supplements[supplementId]?.active && (
                        <span className="text-slate-500 text-xs bg-slate-700 px-1.5 py-0.5 rounded">eliminado</span>
                      )}
                    </div>
                    {entries[0].supplementSnapshot.brand && (
                      <p className="text-slate-500 text-xs">{entries[0].supplementSnapshot.brand}</p>
                    )}
                    <p className="text-slate-600 text-xs mt-0.5">{entries.length} {entries.length === 1 ? 'toma' : 'tomas'}</p>
                  </div>
                  <div className="divide-y divide-slate-700/50">
                    {entries.map(e => (
                      <div key={e.id} className="flex items-center justify-between px-3 py-2">
                        <span className="text-slate-400 text-xs">{e.quantity} {e.doseUnit}</span>
                        <div className="text-right">
                          <p className="text-green-400 text-xs font-medium">{formatTimestamp(e.timestamp)}</p>
                          {e.timestampEditedFrom && (
                            <p className="text-slate-600 text-xs line-through">{formatTimestamp(e.timestampEditedFrom)}</p>
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

      {/* skipped */}
      {log.skipped.length > 0 && (
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wide mb-2">Omitidos</p>
          <div className="space-y-2">
            {log.skipped.map((sk, i) => (
              <div key={i} className="bg-slate-800 border-l-2 border-red-500 rounded-r-xl px-3 py-2">
                <p className="text-red-400 text-sm">{sk.supplementName}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <MetabolicSummary entries={sorted} />
    </div>
  )
}
