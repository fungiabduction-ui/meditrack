import { Supplement, LogEntry } from '../../schema/types'
import { TimingGroup } from '../../hooks/useToday'
import { formatTimestamp } from '../../utils/date'

type Props = {
  group: TimingGroup
  takenIds: Set<string>
  takenEntries: LogEntry[]
  onLog: (s: Supplement) => void
}

export function TimeGroup({ group, takenIds, takenEntries, onLog }: Props) {
  return (
    <section>
      <p className="text-slate-500 text-xs uppercase tracking-widest mb-2 px-1">{group.label}</p>
      <div className="space-y-2">
        {group.items.map(s => {
          const taken = takenIds.has(s.id)
          const entry = takenEntries.find(e => e.supplementId === s.id)
          const doseChanged = entry && entry.quantity !== s.defaultDose

          return (
            <div
              key={s.id}
              className={`bg-slate-800 rounded-xl px-4 py-3 flex items-center justify-between transition-opacity ${taken ? 'opacity-50' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${taken ? 'text-slate-400 line-through' : 'text-white'}`}>
                  {s.name}
                </p>
                <p className="text-slate-500 text-xs mt-0.5">
                  {s.defaultDose} {s.doseUnit}
                  {doseChanged && (
                    <span className="text-amber-400 ml-1">· tomado: {entry!.quantity}</span>
                  )}
                  {entry && (
                    <span className="text-green-400 ml-2">· {formatTimestamp(entry.timestamp)}</span>
                  )}
                </p>
              </div>
              {taken
                ? <span className="text-green-400 text-xl ml-3">✓</span>
                : (
                  <button
                    onClick={() => onLog(s)}
                    className="ml-3 bg-green-600 hover:bg-green-500 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                  >
                    Tomar
                  </button>
                )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
