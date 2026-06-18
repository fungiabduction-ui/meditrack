import { useEffect, useState, Component, type ReactNode } from 'react'
import { useStore } from './store'
import { useStorageHealth } from './hooks/useStorageHealth'
import { TodayView } from './components/today/TodayView'
import { CabinetView } from './components/cabinet/CabinetView'
import { HistoryView } from './components/history/HistoryView'
import { SettingsView } from './components/settings/SettingsView'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: '#f87171', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          <strong>Error de render:</strong>{'\n'}
          {(this.state.error as Error).message}{'\n\n'}
          {(this.state.error as Error).stack}
        </div>
      )
    }
    return this.props.children
  }
}

type Tab = 'today' | 'cabinet' | 'history' | 'settings'

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Hoy', icon: '◎' },
  { id: 'cabinet', label: 'Botiquín', icon: '⬡' },
  { id: 'history', label: 'Historial', icon: '≡' },
  { id: 'settings', label: 'Config', icon: '⚙️' },
]

export function App() {
  const [tab, setTab] = useState<Tab>('today')
  const init = useStore(s => s.init)
  const sealPastDays = useStore(s => s.sealPastDays)
  const { healthy, error } = useStorageHealth()

  useEffect(() => {
    init()
    sealPastDays()
  }, [init, sealPastDays])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-900 max-w-md mx-auto relative">
        {!healthy && (
          <div className="bg-red-900/80 text-red-300 text-xs px-4 py-2 text-center">
            ⚠ {error}
          </div>
        )}
        <main className="overflow-y-auto">
          {tab === 'today' && <TodayView />}
          {tab === 'cabinet' && <CabinetView />}
          {tab === 'history' && <HistoryView />}
          {tab === 'settings' && <SettingsView />}
        </main>
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-slate-900/95 backdrop-blur border-t border-slate-800 flex">
          {NAV.map(n => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${tab === n.id ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <span className="text-lg leading-none">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
      </div>
    </ErrorBoundary>
  )
}
