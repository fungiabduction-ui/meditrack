const GH_KEY = 'meditrack_gh'

export type GhConfig = {
  token: string   // obfuscado
  repo: string    // 'usuario/repo'
  lastSync?: string  // ISO8601
}

export function encToken(t: string): string {
  if (!t) return ''
  try { return btoa(unescape(encodeURIComponent('meditrack:' + t))) }
  catch { return t }
}

export function decToken(enc: string): string {
  if (!enc) return ''
  try {
    const decoded = decodeURIComponent(escape(atob(enc)))
    return decoded.startsWith('meditrack:') ? decoded.slice(10) : decoded
  } catch { return enc }
}

export function saveGhConfig(token: string, repo: string): void {
  const clean = repo.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '')
  const existing = loadGhConfig()
  const cfg: GhConfig = {
    token: token ? encToken(token) : (existing?.token ?? ''),
    repo: clean,
    lastSync: existing?.lastSync,
  }
  localStorage.setItem(GH_KEY, JSON.stringify(cfg))
}

export function loadGhConfig(): GhConfig | null {
  try {
    const raw = localStorage.getItem(GH_KEY)
    if (!raw) return null
    return JSON.parse(raw) as GhConfig
  } catch { return null }
}

export function saveLastSync(cfg: GhConfig): void {
  cfg.lastSync = new Date().toISOString()
  localStorage.setItem(GH_KEY, JSON.stringify(cfg))
}

async function ghFetch(method: string, url: string, token: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github.v3+json',
  }
  return fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
}

export type GhTestResult = { ok: boolean; message: string }

export async function ghTest(cfg: GhConfig): Promise<GhTestResult> {
  const token = decToken(cfg.token)
  if (!token || !cfg.repo) return { ok: false, message: 'Sin configuración' }
  try {
    const r = await ghFetch('GET', `https://api.github.com/repos/${cfg.repo}`, token)
    if (r.ok) {
      const d = await r.json() as { full_name: string; private: boolean }
      return { ok: true, message: `${d.full_name} · ${d.private ? 'privado' : 'público'}` }
    }
    const e = await r.json().catch(() => ({ message: r.statusText })) as { message: string }
    return { ok: false, message: e.message }
  } catch (err) {
    return { ok: false, message: (err as Error).message }
  }
}

async function getFileSha(cfg: GhConfig, token: string, filename: string): Promise<string | null> {
  try {
    const r = await ghFetch('GET', `https://api.github.com/repos/${cfg.repo}/contents/${filename}`, token)
    if (!r.ok) return null
    const d = await r.json() as { sha: string }
    return d.sha
  } catch { return null }
}

async function ensureRepo(cfg: GhConfig, token: string): Promise<void> {
  const r = await ghFetch('GET', `https://api.github.com/repos/${cfg.repo}`, token)
  if (r.ok) return
  const [, name] = cfg.repo.split('/')
  await ghFetch('POST', 'https://api.github.com/user/repos', token, {
    name,
    private: true,
    description: 'MediTrack backup',
    auto_init: true,
  })
  await new Promise(resolve => setTimeout(resolve, 1500))
}

export async function ghPush(cfg: GhConfig, data: unknown): Promise<void> {
  const token = decToken(cfg.token)
  if (!token || !cfg.repo) throw new Error('GitHub no configurado')

  await ensureRepo(cfg, token)

  const filename = 'meditrack-full.json'
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))))
  const sha = await getFileSha(cfg, token, filename)
  const body: Record<string, unknown> = {
    message: `MediTrack sync · ${new Date().toLocaleString('es-AR')}`,
    content,
  }
  if (sha) body.sha = sha

  const r = await ghFetch('PUT', `https://api.github.com/repos/${cfg.repo}/contents/${filename}`, token, body)
  if (!r.ok) {
    const e = await r.json().catch(() => ({ message: r.statusText })) as { message: string }
    throw new Error(e.message)
  }
  saveLastSync(cfg)
}

export type GhBackupFile = { name: string; path: string; sha: string }

export async function ghBackup(cfg: GhConfig, data: unknown): Promise<string> {
  const token = decToken(cfg.token)
  if (!token || !cfg.repo) throw new Error('GitHub no configurado')

  const now = new Date()
  const pad = (v: number) => String(v).padStart(2, '0')
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const path = `backups/meditrack-${ts}.json`
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))))

  const r = await ghFetch('PUT', `https://api.github.com/repos/${cfg.repo}/contents/${path}`, token, {
    message: `MediTrack backup · ${ts}`,
    content,
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({ message: r.statusText })) as { message: string }
    throw new Error(e.message)
  }
  return path
}

export async function ghListBackups(cfg: GhConfig): Promise<GhBackupFile[]> {
  const token = decToken(cfg.token)
  if (!token || !cfg.repo) throw new Error('GitHub no configurado')

  const r = await ghFetch('GET', `https://api.github.com/repos/${cfg.repo}/contents/backups`, token)
  if (r.status === 404) return []
  if (!r.ok) {
    const e = await r.json().catch(() => ({ message: r.statusText })) as { message: string }
    throw new Error(e.message)
  }
  const files = await r.json() as { name: string; path: string; sha: string }[]
  return files.filter(f => f.name.endsWith('.json')).reverse()
}

export async function ghRestoreBackup(cfg: GhConfig, path: string): Promise<unknown> {
  const token = decToken(cfg.token)
  if (!token || !cfg.repo) throw new Error('GitHub no configurado')

  const r = await ghFetch('GET', `https://api.github.com/repos/${cfg.repo}/contents/${path}`, token)
  if (!r.ok) {
    const e = await r.json().catch(() => ({ message: r.statusText })) as { message: string }
    throw new Error(e.message)
  }
  const d = await r.json() as { content: string }
  const decoded = decodeURIComponent(escape(atob(d.content.replace(/\n/g, ''))))
  return JSON.parse(decoded)
}

export async function ghPull(cfg: GhConfig): Promise<unknown> {
  const token = decToken(cfg.token)
  if (!token || !cfg.repo) throw new Error('GitHub no configurado')

  const filename = 'meditrack-full.json'
  const r = await ghFetch('GET', `https://api.github.com/repos/${cfg.repo}/contents/${filename}`, token)
  if (!r.ok) {
    const e = await r.json().catch(() => ({ message: r.statusText })) as { message: string }
    throw new Error(e.message)
  }
  const d = await r.json() as { content: string }
  const decoded = decodeURIComponent(escape(atob(d.content.replace(/\n/g, ''))))
  return JSON.parse(decoded)
}
