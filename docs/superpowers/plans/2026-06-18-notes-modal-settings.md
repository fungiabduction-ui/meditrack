# Notes Terminal + Mobile Modal Fix + Settings Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-day terminal-style journal to TodayView, fix mobile modal layout instability, and update Settings UI text + default GitHub repo.

**Architecture:** DayNote is a new sub-type of DailyLog.notes (array). Zod default([]) handles backward compat with existing localStorage data — no version bump needed. DailyNotes is a self-contained component. Modal fix is a 2-line CSS change.

**Tech Stack:** React 19, TypeScript strict, Zustand 5, Zod 4, Tailwind v4

---

### Task 1: types.ts + zod-schemas.ts — DayNote type + DailyLog.notes

**Files:**
- Modify: `src/schema/types.ts`
- Modify: `src/schema/zod-schemas.ts`

- [ ] **Step 1: Add DayNote to types.ts**

In `src/schema/types.ts`, add after the `LogEntry` type:

```ts
export type DayNote = {
  id: string
  text: string
  timestamp: string
  editedAt?: string
}
```

And add `notes: DayNote[]` to `DailyLog`:

```ts
export type DailyLog = {
  id: string
  date: string
  entries: LogEntry[]
  skipped: SkippedItem[]
  notes: DayNote[]       // ← new
  sealed: boolean
  checksum: string
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 2: Add DayNoteSchema + update DailyLogSchema in zod-schemas.ts**

After `LogEntrySchema`, add:

```ts
export const DayNoteSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1),
  timestamp: z.string(),
  editedAt: z.string().optional(),
})
```

In `DailyLogSchema`, add `notes` field with default:

```ts
notes: z.array(DayNoteSchema).default([]),
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to DayNote or DailyLog.

- [ ] **Step 4: Commit**

```bash
git add src/schema/types.ts src/schema/zod-schemas.ts
git commit -m "feat: add DayNote type and DailyLog.notes schema field"
```

---

### Task 2: store/index.ts — note actions

**Files:**
- Modify: `src/store/index.ts`

- [ ] **Step 1: Add import for DayNote**

Update the import line at top of `src/store/index.ts`:

```ts
import type { Supplement, LogEntry, DailyLog, StorageSchema, SkippedItem, DayNote } from '../schema/types'
```

- [ ] **Step 2: Add 3 actions to Store type**

In the `type Store` block, after `setInStock`:

```ts
addDayNote: (dateStr: string, text: string) => void
editDayNote: (dateStr: string, noteId: string, text: string) => void
removeDayNote: (dateStr: string, noteId: string) => void
```

- [ ] **Step 3: Implement the 3 actions**

After `setInStock` implementation, add:

```ts
addDayNote: (dateStr, text) => {
  const now = new Date().toISOString()
  const note: DayNote = { id: generateId(), text, timestamp: now }
  const existing = get().dailyLogs[dateStr]
  const log: DailyLog = existing
    ? { ...existing, notes: [...(existing.notes ?? []), note], updatedAt: now }
    : { id: generateId(), date: dateStr, entries: [], skipped: [], notes: [note], sealed: false, checksum: '', createdAt: now, updatedAt: now }
  const dailyLogs = { ...get().dailyLogs, [dateStr]: log }
  commitWrite(set, { ...read(), dailyLogs })
},

editDayNote: (dateStr, noteId, text) => {
  const log = get().dailyLogs[dateStr]
  if (!log) return
  const now = new Date().toISOString()
  const notes = (log.notes ?? []).map(n => n.id === noteId ? { ...n, text, editedAt: now } : n)
  const dailyLogs = { ...get().dailyLogs, [dateStr]: { ...log, notes, updatedAt: now } }
  commitWrite(set, { ...read(), dailyLogs })
},

removeDayNote: (dateStr, noteId) => {
  const log = get().dailyLogs[dateStr]
  if (!log) return
  const now = new Date().toISOString()
  const notes = (log.notes ?? []).filter(n => n.id !== noteId)
  const dailyLogs = { ...get().dailyLogs, [dateStr]: { ...log, notes, updatedAt: now } }
  commitWrite(set, { ...read(), dailyLogs })
},
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/store/index.ts
git commit -m "feat: add addDayNote, editDayNote, removeDayNote store actions"
```

---

### Task 3: DailyNotes.tsx — terminal component

**Files:**
- Create: `src/components/today/DailyNotes.tsx`

- [ ] **Step 1: Create component**

```tsx
import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store'
import type { DayNote } from '../../schema/types'
import { getLocalHHMM } from '../../utils/date'

type Props = { dateStr: string; notes: DayNote[]; isToday: boolean }

export function DailyNotes({ dateStr, notes, isToday }: Props) {
  const addDayNote = useStore(s => s.addDayNote)
  const editDayNote = useStore(s => s.editDayNote)
  const removeDayNote = useStore(s => s.removeDayNote)

  const [input, setInput] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [activeNote, setActiveNote] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [notes.length])

  function submit() {
    const text = (editing ? editing.text : input).trim()
    if (!text) return
    if (editing) {
      editDayNote(dateStr, editing.id, text)
      setEditing(null)
      setActiveNote(null)
    } else {
      addDayNote(dateStr, text)
      setInput('')
    }
  }

  function formatNoteTime(iso: string) {
    return getLocalHHMM(new Date(iso))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); submit() }
    if (e.key === 'Escape') { setEditing(null); setActiveNote(null); setInput('') }
  }

  function startEdit(note: DayNote) {
    setEditing({ id: note.id, text: note.text })
    setActiveNote(note.id)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div className="px-4 mt-4">
      <p className="text-slate-500 text-xs uppercase tracking-widest mb-2 px-1">Notas del día</p>
      <div className="bg-[#020617] border border-slate-800 rounded-xl overflow-hidden">
        {/* log lines */}
        <div ref={listRef} className="px-3 pt-3 pb-1 font-mono text-xs leading-relaxed max-h-48 overflow-y-auto">
          {notes.length === 0 && (
            <p className="text-slate-700 mb-2">sin notas aún…</p>
          )}
          {notes.map(n => (
            <div
              key={n.id}
              className={`flex items-start gap-1.5 mb-1 group cursor-pointer rounded px-1 py-0.5 transition-colors ${
                activeNote === n.id ? 'bg-slate-900' : 'hover:bg-slate-900/60'
              }`}
              onClick={() => {
                if (!isToday) return
                if (confirmDelete === n.id) return
                setActiveNote(activeNote === n.id ? null : n.id)
              }}
            >
              <span className="text-slate-600 flex-shrink-0">
                [{formatNoteTime(n.timestamp)}]
              </span>
              <span className={`flex-1 break-words ${n.editedAt ? 'text-slate-300' : 'text-slate-400'}`}>
                {n.text}
              </span>
              {isToday && activeNote === n.id && (
                <span className="flex gap-2 flex-shrink-0 ml-1">
                  {confirmDelete === n.id ? (
                    <>
                      <button
                        onClick={e => { e.stopPropagation(); removeDayNote(dateStr, n.id); setConfirmDelete(null); setActiveNote(null) }}
                        className="text-red-400 text-[10px] font-bold"
                      >¿borrar?</button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDelete(null) }}
                        className="text-slate-600 text-[10px]"
                      >✕</button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={e => { e.stopPropagation(); startEdit(n) }}
                        className="text-sky-500 text-[10px]"
                      >✎</button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDelete(n.id) }}
                        className="text-slate-600 hover:text-red-400 text-[10px]"
                      >✕</button>
                    </>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* input */}
        {isToday && (
          <div className="border-t border-slate-800 flex items-center gap-2 px-3 py-2">
            <span className="text-sky-400 font-mono text-sm flex-shrink-0">›</span>
            <input
              ref={inputRef}
              value={editing ? editing.text : input}
              onChange={e => editing
                ? setEditing(v => v ? { ...v, text: e.target.value } : null)
                : setInput(e.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder={editing ? 'editando…' : 'escribir nota…'}
              className="flex-1 bg-transparent text-slate-300 font-mono text-xs outline-none placeholder:text-slate-700"
            />
            {editing && (
              <button
                onClick={() => { setEditing(null); setActiveNote(null) }}
                className="text-slate-600 text-xs"
              >✕</button>
            )}
            <button
              onClick={submit}
              disabled={!(editing ? editing.text.trim() : input.trim())}
              className="text-slate-600 hover:text-sky-400 text-xs font-mono disabled:opacity-30 transition-colors"
            >↵</button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/today/DailyNotes.tsx
git commit -m "feat: add DailyNotes terminal component"
```

---

### Task 4: TodayView.tsx — mount DailyNotes

**Files:**
- Modify: `src/components/today/TodayView.tsx`

- [ ] **Step 1: Import DailyNotes**

Add import after existing imports:

```ts
import { DailyNotes } from './DailyNotes'
```

- [ ] **Step 2: Get notes from store**

`useToday` hook returns `today` (dateStr) and `isToday`. Notes come from `dailyLogs`. Add after existing `useStore(s => s.supplements)` line:

```ts
const dailyLogs = useStore(s => s.dailyLogs)
```

And derive notes:

```ts
const todayNotes = dailyLogs[selectedDate]?.notes ?? []
```

- [ ] **Step 3: Render DailyNotes below Tomados section**

After the closing `</div>` of the "tomados" block (and the empty state block), add:

```tsx
<DailyNotes dateStr={selectedDate} notes={todayNotes} isToday={isToday} />
```

- [ ] **Step 4: Verify TypeScript + visual check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/today/TodayView.tsx
git commit -m "feat: mount DailyNotes terminal in TodayView"
```

---

### Task 5: Modal.tsx — mobile fix

**Files:**
- Modify: `src/components/shared/Modal.tsx`

- [ ] **Step 1: Fix max-h + add body overflow lock**

Replace `max-h-[90vh]` with `max-h-[85dvh]` in the modal panel class.

Add a `useEffect` to lock body scroll when modal is open:

```ts
useEffect(() => {
  if (!open) return
  document.body.style.overflow = 'hidden'
  return () => { document.body.style.overflow = '' }
}, [open])
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/Modal.tsx
git commit -m "fix: modal mobile stability — dvh + body overflow lock"
```

---

### Task 6: SettingsView.tsx — default repo + button text

**Files:**
- Modify: `src/components/settings/SettingsView.tsx`

- [ ] **Step 1: Default repo**

Change the `useState` for repo:

```ts
const [repo, setRepo] = useState(() => loadGhConfig()?.repo ?? 'fungiabduction-ui/meditrack')
```

- [ ] **Step 2: Button text + size**

Push button: change `'⬆ Push'` → `'GUARDAR'`
Pull button: change `'⬇ Pull'` → `'RESTABLECER'`
Change both from `text-xs` to `text-[10px]` for smaller typography.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/SettingsView.tsx
git commit -m "fix: settings — default repo, GUARDAR/RESTABLECER button labels"
```

---

### Task 7: Build check + GitHub push

- [ ] **Step 1: Full build**

```bash
npm run build
```

Expected: `dist/` generated, 0 errors.

- [ ] **Step 2: Push to GitHub via app Settings**

Open `http://localhost:5173`, go to Config → GitHub Sync → GUARDAR → GUARDAR config → GUARDAR (push).
