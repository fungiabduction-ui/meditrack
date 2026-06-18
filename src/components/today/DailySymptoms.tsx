import { useState } from 'react'
import { useStore } from '../../store'
import type { DailySymptoms } from '../../schema/types'
import { computeWellbeingScore } from '../../utils/wellbeing'

const DEFAULTS: DailySymptoms = {
  energy: 3,
  libido: 3,
  sleep: 3,
  recovery: 3,
  mood: 3,
  erectionQuality: 3,
  nippleSensitivity: false,
  orgasms: 0,
}

const LABELS: { key: keyof Pick<DailySymptoms, 'energy' | 'libido' | 'sleep' | 'recovery' | 'mood' | 'erectionQuality'>; label: string }[] = [
  { key: 'energy', label: 'Energía' },
  { key: 'libido', label: 'Libido' },
  { key: 'sleep', label: 'Sueño' },
  { key: 'recovery', label: 'Recuperación' },
  { key: 'mood', label: 'Ánimo' },
  { key: 'erectionQuality', label: 'Erección' },
]

type Props = { dateStr: string; isToday: boolean }

export function DailySymptoms({ dateStr, isToday }: Props) {
  const dailyLog = useStore(s => s.dailyLogs[dateStr])
  const updateSymptoms = useStore(s => s.updateSymptoms)

  const saved = dailyLog?.symptoms ?? null
  const [local, setLocal] = useState<DailySymptoms>(saved ?? DEFAULTS)

  if (!isToday && !saved) return null

  const readOnly = !isToday && !!saved

  const setNum = (key: keyof Pick<DailySymptoms, 'energy' | 'libido' | 'sleep' | 'recovery' | 'mood' | 'erectionQuality'>, val: 1 | 2 | 3 | 4 | 5) =>
    setLocal(p => ({ ...p, [key]: val }))

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-xs uppercase tracking-widest">Síntomas del día</p>
        {saved && (
          <span className="text-xs font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
            {computeWellbeingScore(saved)}/100
          </span>
        )}
      </div>

      {LABELS.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between gap-2">
          <span className="text-slate-300 text-sm w-28 flex-shrink-0">{label}</span>
          <div className="flex gap-1">
            {([1, 2, 3, 4, 5] as const).map(n => (
              <button
                key={n}
                disabled={readOnly}
                onClick={() => setNum(key, n)}
                className={`w-7 h-7 rounded-full text-xs font-semibold transition-colors ${
                  local[key] === n
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                } ${readOnly ? 'cursor-default' : ''}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <span className="text-slate-300 text-sm">Sensibilidad pezón</span>
        <button
          disabled={readOnly}
          onClick={() => !readOnly && setLocal(p => ({ ...p, nippleSensitivity: !p.nippleSensitivity }))}
          className={`w-10 h-6 rounded-full transition-colors relative ${
            local.nippleSensitivity ? 'bg-violet-600' : 'bg-slate-700'
          } ${readOnly ? 'cursor-default' : ''}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${local.nippleSensitivity ? 'left-5' : 'left-1'}`} />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-slate-300 text-sm">Orgasmos</span>
        <div className="flex items-center gap-3">
          {!readOnly && (
            <button
              onClick={() => setLocal(p => ({ ...p, orgasms: Math.max(0, p.orgasms - 1) }))}
              className="w-7 h-7 rounded-full bg-slate-700 text-slate-300 text-lg flex items-center justify-center hover:bg-slate-600"
            >−</button>
          )}
          <span className="text-white text-sm w-4 text-center">{local.orgasms}</span>
          {!readOnly && (
            <button
              onClick={() => setLocal(p => ({ ...p, orgasms: p.orgasms + 1 }))}
              className="w-7 h-7 rounded-full bg-slate-700 text-slate-300 text-lg flex items-center justify-center hover:bg-slate-600"
            >+</button>
          )}
        </div>
      </div>

      {!readOnly && (
        <button
          onClick={() => updateSymptoms(dateStr, local)}
          className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl py-2.5 w-full text-sm font-semibold transition-colors"
        >
          Guardar síntomas
        </button>
      )}
    </div>
  )
}
