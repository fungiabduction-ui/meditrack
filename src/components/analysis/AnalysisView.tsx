import { useState } from 'react'
import { WellbeingTrend } from './WellbeingTrend'
import { TRTCycleHeatmap } from './TRTCycleHeatmap'
import { SupplementCorrelation } from './SupplementCorrelation'
import { LaboratorioView } from './LaboratorioView'

type SubTab = 'symptoms' | 'lab'

export function AnalysisView() {
  const [subTab, setSubTab] = useState<SubTab>('symptoms')

  return (
    <div className="pb-24 min-h-full">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-white mb-4">Análisis</h1>

        {/* sub-tabs */}
        <div className="flex bg-slate-800 rounded-xl p-1 mb-4">
          <button
            onClick={() => setSubTab('symptoms')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
              subTab === 'symptoms'
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Síntomas
          </button>
          <button
            onClick={() => setSubTab('lab')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
              subTab === 'lab'
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Laboratorio
          </button>
        </div>

        {subTab === 'symptoms' && (
          <div className="space-y-4">
            <WellbeingTrend />
            <TRTCycleHeatmap />
            <SupplementCorrelation />
          </div>
        )}

        {subTab === 'lab' && <LaboratorioView />}
      </div>
    </div>
  )
}
