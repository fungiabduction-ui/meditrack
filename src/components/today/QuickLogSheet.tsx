import { useState } from 'react'
import type { Supplement, DailyLog } from '../../schema/types'
import { getHistoricalDose } from '../../utils/dose-history'
import { getLocalHHMM } from '../../utils/date'

const MULTIPLIER_LABELS: Record<number, string> = { 0.25: '¼', 0.5: '½' }

function buildQuickpicks(defaultDose: number) {
  const seen = new Set<number>()
  return [0.25, 0.5, 1, 2, 3, 4]
    .map(m => ({
      value: parseFloat((defaultDose * m).toFixed(6)),
      label: MULTIPLIER_LABELS[m] ?? String(parseFloat((defaultDose * m).toFixed(6))),
    }))
    .filter(({ value }) => {
      if (value <= 0 || seen.has(value)) return false
      seen.add(value)
      return true
    })
}

type Props = {
  supplement: Supplement
  dailyLogs: Record<string, DailyLog>
  onConfirm: (qty: number, time: string) => void
  onOpenFull: (capturedTime: string) => void
  onClose: () => void
}

export function QuickLogSheet({ supplement, dailyLogs, onConfirm, onOpenFull, onClose }: Props) {
  const [capturedTime] = useState(() => getLocalHHMM())
  const historical = getHistoricalDose(supplement.id, dailyLogs, supplement.defaultDose)
  const [selectedQty, setSelectedQty] = useState(historical.dose)

  const quickpicks = buildQuickpicks(supplement.defaultDose)

  return (
    <>
      {/* overlay */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-800 border-t border-slate-700 rounded-t-2xl shadow-2xl">
        {/* handle + close */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="w-9 h-1 bg-slate-600 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
          <div className="w-9" />
          <button
            onClick={onClose}
            className="ml-auto text-slate-500 hover:text-slate-300 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-4 pb-6 space-y-4">
          {/* header */}
          <div className="flex justify-between items-start">
            <div>
              <p className="text-white font-bold text-base">{supplement.name}</p>
              {supplement.brand && (
                <p className="text-slate-500 text-xs">{supplement.brand} · {supplement.doseUnit}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-green-400 text-xs font-semibold">Ahora</p>
              <p className="text-slate-400 text-xs">{capturedTime}</p>
            </div>
          </div>

          {/* historial badge */}
          {historical.percent !== null && (
            <div className="bg-sky-950 border border-sky-800 rounded-lg px-3 py-2 text-xs text-sky-300 flex items-center gap-2">
              <span>📊</span>
              <span>
                Tomás <strong>{historical.dose} {supplement.doseUnit}</strong> el {historical.percent}% de las veces
              </span>
            </div>
          )}

          {/* quickpicks */}
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Cantidad</p>
            <div className="flex gap-2">
              {quickpicks.map(({ value, label }) => {
                const isHabitual = value === historical.dose && historical.percent !== null
                const isSelected = value === selectedQty
                return (
                  <button
                    key={value}
                    onClick={() => setSelectedQty(value)}
                    className={`relative flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors ${
                      isSelected
                        ? isHabitual
                          ? 'bg-green-900 border-green-500 text-green-300'
                          : 'bg-sky-900 border-sky-500 text-sky-200'
                        : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-400'
                    }`}
                  >
                    {isHabitual && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        ★
                      </span>
                    )}
                    <span className="block">{value}</span>
                    <span className="block text-[10px] opacity-60 mt-0.5">{supplement.doseUnit}</span>
                  </button>
                )
              })}

              {/* chip ··· */}
              <button
                onClick={() => onOpenFull(capturedTime)}
                className="flex-none w-14 py-3 rounded-xl text-sm font-semibold border bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-400 transition-colors"
              >
                ···
              </button>
            </div>
          </div>

          {/* confirm */}
          <button
            onClick={() => onConfirm(selectedQty, capturedTime)}
            className="w-full bg-green-600 hover:bg-green-500 text-white rounded-xl py-3.5 font-bold text-sm transition-colors"
          >
            Registrar — {selectedQty} {supplement.doseUnit} · {capturedTime}
          </button>
        </div>
      </div>
    </>
  )
}
