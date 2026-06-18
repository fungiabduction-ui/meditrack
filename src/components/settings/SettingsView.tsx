import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store'
import { read, write } from '../../storage/persistence'
import { createFreshSchema } from '../../storage/migrations'
import { StorageSchemaSchema } from '../../schema/zod-schemas'
import {
  saveGhConfig, loadGhConfig, ghTest, ghPush, ghPull,
} from '../../utils/github'
import type { GhConfig } from '../../utils/github'

type Toast = { msg: string; ok: boolean }

export function SettingsView() {
  const init = useStore(s => s.init)
  const supplements = useStore(s => s.supplements)
  const dailyLogs = useStore(s => s.dailyLogs)

  const [ghCfg, setGhCfg] = useState<GhConfig | null>(loadGhConfig)
  const [tokenInput, setTokenInput] = useState(() => loadGhConfig()?.token ? '••••••••••••••••' : '')
  const [tokenDirty, setTokenDirty] = useState(false)
  const [repo, setRepo] = useState(() => loadGhConfig()?.repo ?? '')
  const [showToken, setShowToken] = useState(false)
  const [ghStatus, setGhStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [resetPhrase, setResetPhrase] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const showToast = (msg: string, ok = true) => setToast({ msg, ok })

  // ── Backup local ──────────────────────────────────────────────
  function handleExport() {
    const schema = read()
    const payload = { ...schema, _exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `meditrack-full-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    showToast('Backup exportado')
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (!confirm('¿Restaurar backup? Esto sobreescribirá todos tus datos actuales.')) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target!.result as string)
        const result = StorageSchemaSchema.safeParse(raw)
        if (!result.success) {
          showToast(`Archivo inválido: ${result.error.issues[0]?.message}`, false)
          return
        }
        write(result.data)
        init()
        showToast('Backup restaurado')
      } catch {
        showToast('El archivo no es JSON válido', false)
      }
    }
    reader.readAsText(file)
  }

  // ── GitHub ────────────────────────────────────────────────────
  function handleSaveGh() {
    if (!repo.trim()) { showToast('Repo requerido (usuario/repo)', false); return }
    const rawToken = tokenDirty ? tokenInput.trim() : ''
    saveGhConfig(rawToken, repo.trim())
    const updated = loadGhConfig()
    setGhCfg(updated)
    setTokenDirty(false)
    showToast('Configuración guardada')
  }

  async function handleTest() {
    const cfg = loadGhConfig()
    if (!cfg) { showToast('Guardá la configuración primero', false); return }
    setLoading('test')
    const result = await ghTest(cfg)
    setGhStatus({ ok: result.ok, msg: result.message })
    setLoading(null)
  }

  async function handlePush() {
    const cfg = loadGhConfig()
    if (!cfg) { showToast('Configurá GitHub primero', false); return }
    setLoading('push')
    try {
      const schema = read()
      await ghPush(cfg, schema)
      setGhCfg(loadGhConfig())
      showToast('Guardado en GitHub ✓')
    } catch (err) {
      showToast((err as Error).message, false)
    }
    setLoading(null)
  }

  async function handlePull() {
    const cfg = loadGhConfig()
    if (!cfg) { showToast('Configurá GitHub primero', false); return }
    if (!confirm('¿Restaurar desde GitHub? Se perderán los datos locales no sincronizados.')) return
    setLoading('pull')
    try {
      const data = await ghPull(cfg)
      const result = StorageSchemaSchema.safeParse(data)
      if (!result.success) {
        showToast(`Datos inválidos en GitHub: ${result.error.issues[0]?.message}`, false)
        setLoading(null)
        return
      }
      write(result.data)
      init()
      showToast('Datos restaurados desde GitHub ✓')
    } catch (err) {
      showToast((err as Error).message, false)
    }
    setLoading(null)
  }

  // ── Reset ─────────────────────────────────────────────────────
  function handleReset() {
    if (resetPhrase !== 'RESET') return
    write(createFreshSchema())
    init()
    localStorage.removeItem('meditrack_gh')
    setGhCfg(null)
    setTokenInput('')
    setRepo('')
    setResetOpen(false)
    setResetPhrase('')
    showToast('Sistema reseteado')
  }

  const lastSync = ghCfg?.lastSync
    ? new Date(ghCfg.lastSync).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null

  const suppCount = Object.values(supplements).filter(s => s.active).length
  const logCount = Object.keys(dailyLogs).length

  return (
    <div className="pb-24 min-h-full">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-white">Configuración</h1>
        <p className="text-slate-500 text-xs mt-1">{suppCount} suplementos activos · {logCount} días en historial</p>
      </div>

      {toast && (
        <div className={`mx-4 mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
          toast.ok
            ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
            : 'bg-red-900/60 text-red-300 border border-red-700'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="px-4 space-y-4">

        {/* Backup local */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
            <span>💾</span>
            <span className="font-semibold text-white text-sm">Backup local</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-white text-sm">Exportar todo</p>
                <p className="text-slate-500 text-xs">Suplementos + historial completo en JSON</p>
              </div>
              <button
                onClick={handleExport}
                className="flex-shrink-0 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
              >
                ⬇ Exportar
              </button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-white text-sm">Importar</p>
                <p className="text-slate-500 text-xs">Restaurar desde archivo JSON</p>
              </div>
              <button
                onClick={() => importRef.current?.click()}
                className="flex-shrink-0 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold px-3 py-2 rounded-lg transition-colors border border-slate-600"
              >
                ⬆ Importar
              </button>
            </div>
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </div>
        </div>

        {/* GitHub sync */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
            <span>🐙</span>
            <span className="font-semibold text-white text-sm flex-1">GitHub Sync</span>
            {ghCfg && <span className="text-xs text-slate-500 truncate max-w-[140px]">{ghCfg.repo}</span>}
          </div>

          {ghStatus && (
            <div className={`mx-4 mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${
              ghStatus.ok
                ? 'bg-green-900/40 text-green-400 border border-green-800'
                : 'bg-red-900/40 text-red-400 border border-red-800'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ghStatus.ok ? 'bg-green-400' : 'bg-red-400'}`} />
              {ghStatus.msg}
            </div>
          )}

          {lastSync && (
            <p className="text-slate-500 text-xs px-4 pt-3">Último sync: {lastSync}</p>
          )}

          <div className="p-4 space-y-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">
                Token de acceso
                <span className="text-slate-600 ml-1">(github.com → Settings → Developer settings → PAT → repo scope)</span>
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={tokenInput}
                  placeholder="ghp_..."
                  onChange={e => { setTokenInput(e.target.value); setTokenDirty(true) }}
                  className="w-full bg-slate-900 border border-slate-600 focus:border-sky-500 rounded-lg px-3 py-2 text-white text-sm outline-none font-mono pr-8"
                />
                <button
                  onClick={() => setShowToken(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs"
                >
                  {showToken ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Repositorio (usuario/nombre)</label>
              <input
                value={repo}
                placeholder="JET/meditrack-data"
                onChange={e => setRepo(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 focus:border-sky-500 rounded-lg px-3 py-2 text-white text-sm outline-none"
              />
            </div>
            <button
              onClick={handleSaveGh}
              className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold py-2 rounded-lg transition-colors border border-slate-600"
            >
              Guardar configuración
            </button>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                onClick={handlePush}
                disabled={!!loading}
                className="bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-lg transition-colors"
              >
                {loading === 'push' ? '…' : '⬆ Push'}
              </button>
              <button
                onClick={handlePull}
                disabled={!!loading}
                className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-xs font-bold py-2.5 rounded-lg transition-colors border border-slate-600"
              >
                {loading === 'pull' ? '…' : '⬇ Pull'}
              </button>
              <button
                onClick={handleTest}
                disabled={!!loading}
                className="bg-emerald-900/60 hover:bg-emerald-800/60 disabled:opacity-50 text-emerald-400 text-xs font-bold py-2.5 rounded-lg transition-colors border border-emerald-800"
              >
                {loading === 'test' ? '…' : '✓ Test'}
              </button>
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-slate-800 border border-red-900/40 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-red-900/40 flex items-center gap-2">
            <span>⚠️</span>
            <span className="font-semibold text-red-400 text-sm">Zona de riesgo</span>
          </div>
          <div className="p-4">
            {!resetOpen ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-white text-sm">Resetear todo</p>
                  <p className="text-slate-500 text-xs">Borra suplementos e historial. Irreversible.</p>
                </div>
                <button
                  onClick={() => setResetOpen(true)}
                  className="flex-shrink-0 bg-red-900/40 hover:bg-red-900/60 text-red-400 text-xs font-bold px-3 py-2 rounded-lg transition-colors border border-red-800"
                >
                  Reset
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-red-400 text-sm font-medium">Escribí RESET para confirmar:</p>
                <input
                  value={resetPhrase}
                  onChange={e => setResetPhrase(e.target.value)}
                  placeholder="RESET"
                  className="w-full bg-slate-900 border border-red-800 rounded-lg px-3 py-2 text-white text-sm outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleReset}
                    disabled={resetPhrase !== 'RESET'}
                    className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-bold py-2 rounded-lg transition-colors"
                  >
                    Confirmar reset
                  </button>
                  <button
                    onClick={() => { setResetOpen(false); setResetPhrase('') }}
                    className="px-4 bg-slate-700 text-slate-300 text-sm rounded-lg"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
