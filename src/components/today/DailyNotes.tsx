import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store'
import type { DayNote } from '../../schema/types'
import { formatTimestamp } from '../../utils/date'

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
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
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
        <div ref={listRef} className="px-3 pt-3 pb-1 font-mono text-xs leading-relaxed max-h-48 overflow-y-auto">
          {notes.length === 0 && (
            <p className="text-green-900 mb-2">sin notas aún…</p>
          )}
          {notes.map(n => (
            <div
              key={n.id}
              className={`flex items-start gap-1.5 mb-1 rounded px-1 py-0.5 transition-colors ${
                isToday ? 'cursor-pointer' : ''
              } ${activeNote === n.id ? 'bg-slate-900' : isToday ? 'hover:bg-slate-900/60' : ''}`}
              onClick={() => {
                if (!isToday || confirmDelete === n.id) return
                setActiveNote(activeNote === n.id ? null : n.id)
              }}
            >
              <span className="text-green-800 flex-shrink-0">[{formatTimestamp(n.timestamp)}]</span>
              <span className="flex-1 break-words text-green-400">{n.text}</span>
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

        {isToday && (
          <div className="border-t border-slate-800 flex items-center gap-2 px-3 py-2">
            <span className="text-green-500 font-mono text-sm flex-shrink-0">›</span>
            <input
              ref={inputRef}
              value={editing ? editing.text : input}
              onChange={e => editing
                ? setEditing(v => v ? { ...v, text: e.target.value } : null)
                : setInput(e.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder={editing ? 'editando…' : 'escribir nota…'}
              className="flex-1 bg-transparent text-green-400 font-mono outline-none placeholder:text-green-900"
              style={{ fontSize: '16px' }}
            />
            {editing && (
              <button
                onClick={() => { setEditing(null); setActiveNote(null) }}
                className="text-green-900 text-xs"
              >✕</button>
            )}
            <button
              onClick={submit}
              disabled={!(editing ? editing.text.trim() : input.trim())}
              className="text-green-800 hover:text-green-400 text-xs font-mono disabled:opacity-30 transition-colors"
            >↵</button>
          </div>
        )}
      </div>
    </div>
  )
}
