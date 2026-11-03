import { useEffect, useMemo, useRef, useState } from 'react'
import type { Backend, Note } from './db'
import type { OrgDoc } from './types'

// Komentáře kolegů k pozicím. Jsou dobře vidět v aplikaci (počet v liště, značky
// u pozic, upozornění na nový), ale nikdy se netisknou ani nedostanou do PDF.

const fmt = new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' })

export function useNotes(backend: Backend | null) {
  const [notes, setNotes] = useState<Note[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [fresh, setFresh] = useState<Note | null>(null)
  const seen = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!backend) return
    return backend.subscribeNotes((list) => {
      setNotes(list)
      // Upozornění jen na komentáře, které přibyly od ostatních během návštěvy.
      if (seen.current) {
        const added = list.find((n) => !seen.current!.has(n.id) && !n.resolved && n.by !== backend.me)
        if (added && backend.kind === 'cloud') setFresh(added)
      }
      seen.current = new Set(list.map((n) => n.id))
    })
  }, [backend])

  useEffect(() => {
    if (!backend) return
    const ids = [...new Set(notes.flatMap((n) => [n.by, n.resolvedBy]).filter((x): x is string => !!x))]
    backend.names(ids).then(setNames)
  }, [backend, notes])

  const open = useMemo(() => notes.filter((n) => !n.resolved), [notes])
  const openCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of open) if (n.nodeId) m.set(n.nodeId, (m.get(n.nodeId) ?? 0) + 1)
    return m
  }, [open])

  return { notes, open, openCounts, names, fresh, dismissFresh: () => setFresh(null) }
}

type NotesState = ReturnType<typeof useNotes>
type ClaudeUse = { use(name: string): Promise<unknown> }
type Comments = { openComposer(t: { element: Element }): Promise<{ opened: boolean }> }

/** Pro čtenáře bez práva zápisu: otevře komentář claude.ai přímo u pozice. */
async function openPlatformComposer(nodeId: string | null): Promise<boolean> {
  const claude = (window as unknown as { claude?: ClaudeUse }).claude
  const comments = claude?.use ? ((await claude.use('comments').catch(() => null)) as Comments | null) : null
  if (!comments) return false
  const el = (nodeId && document.querySelector(`svg.sheet [data-node-id="${nodeId}"]`)) || document.querySelector('svg.sheet')
  if (!el) return false
  const r = await comments.openComposer({ element: el }).catch(() => ({ opened: false }))
  return r.opened
}

export function caption(doc: OrgDoc, nodeId: string | null): string {
  if (!nodeId) return 'Celý organigram'
  const n = doc.nodes[nodeId]
  if (!n) return 'Smazaná pozice'
  return [n.titleCs, n.name.replace(/\n/g, ', ')].filter(Boolean).join(', ')
}

function NoteItem({
  note,
  state,
  backend,
  doc,
  onShow,
}: {
  note: Note
  state: NotesState
  backend: Backend
  doc?: OrgDoc
  onShow?: (nodeId: string) => void
}) {
  const who = note.by ? state.names[note.by] || (note.by === backend.me ? 'Vy' : 'Kolega') : ''
  return (
    <li className={`note ${note.resolved ? 'resolved' : ''}`}>
      <div className="note-head">
        <strong>{who || 'Komentář'}</strong>
        <span>{fmt.format(note.ts)}</span>
      </div>
      {doc && (
        <button type="button" className="link note-target" onClick={() => note.nodeId && onShow?.(note.nodeId)}>
          {caption(doc, note.nodeId)}
        </button>
      )}
      <p className="note-text">{note.text}</p>
      <div className="note-actions">
        {note.resolved ? (
          <>
            <span className="hint">
              Vyřešeno{note.resolvedBy ? `, ${state.names[note.resolvedBy] || 'kolega'}` : ''}
            </span>
            {backend.canWrite && (
              <button type="button" className="link small" onClick={() => backend.setNoteResolved(note.id, false)}>
                Znovu otevřít
              </button>
            )}
          </>
        ) : (
          backend.canWrite && (
            <button type="button" className="btn small" onClick={() => backend.setNoteResolved(note.id, true)}>
              Vyřešeno
            </button>
          )
        )}
      </div>
    </li>
  )
}

function AddNote({ backend, nodeId, view }: { backend: Backend; nodeId: string | null; view: string }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  if (!backend.canWrite) {
    return (
      <div className="note-add">
        <button
          type="button"
          className="btn primary"
          onClick={async () => {
            const ok = await openPlatformComposer(nodeId)
            if (!ok) setMsg('Komentář se tu nedá přidat. Požádejte vlastníka stránky o oprávnění Contributor.')
          }}
        >
          Přidat komentář
        </button>
        {msg && <small className="warn-text">{msg}</small>}
      </div>
    )
  }

  return (
    <form
      className="note-add"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!text.trim()) return
        setBusy(true)
        setMsg('')
        try {
          await backend.addNote({ nodeId, view, text: text.trim() })
          setText('')
        } catch {
          setMsg('Komentář se nepodařilo uložit, zkuste to znovu.')
        } finally {
          setBusy(false)
        }
      }}
    >
      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={nodeId ? 'Komentář k této pozici, např. co je potřeba změnit' : 'Komentář k celému organigramu'}
      />
      <button type="submit" className="btn primary" disabled={busy || !text.trim()}>
        {busy ? 'Ukládám…' : 'Přidat komentář'}
      </button>
      {msg && <small className="warn-text">{msg}</small>}
    </form>
  )
}

/** Komentáře u jedné pozice (v panelu pozice). */
export function NodeNotes({ backend, state, nodeId, view }: { backend: Backend; state: NotesState; nodeId: string; view: string }) {
  const list = state.notes.filter((n) => n.nodeId === nodeId)
  const open = list.filter((n) => !n.resolved)
  const done = list.filter((n) => n.resolved)
  return (
    <div className={`node-notes ${open.length ? 'has-open' : ''}`}>
      <div className="node-notes-title">
        Komentáře{open.length ? ` (${open.length} nevyřešené)` : ''}
        <small>netisknou se</small>
      </div>
      {open.length > 0 && (
        <ul className="notes">
          {open.map((n) => (
            <NoteItem key={n.id} note={n} state={state} backend={backend} />
          ))}
        </ul>
      )}
      <AddNote backend={backend} nodeId={nodeId} view={view} />
      {done.length > 0 && (
        <details>
          <summary className="hint">Vyřešené ({done.length})</summary>
          <ul className="notes">
            {done.map((n) => (
              <NoteItem key={n.id} note={n} state={state} backend={backend} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

/** Přehled všech komentářů (záložka Komentáře). */
export function NotesPanel({
  backend,
  state,
  doc,
  view,
  onShow,
}: {
  backend: Backend
  state: NotesState
  doc: OrgDoc
  view: string
  onShow: (nodeId: string) => void
}) {
  const [showResolved, setShowResolved] = useState(false)
  const list = showResolved ? state.notes : state.open
  return (
    <div className="panel-body">
      <p className="hint">
        Komentáře vidí všichni, kdo mají odkaz. Do tisku ani do PDF se nedostanou. Komentář k pozici přidáte po kliknutí
        na pozici v organigramu.
      </p>
      <label className="check">
        <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
        Zobrazit i vyřešené
      </label>
      <ul className="notes">
        {list.map((n) => (
          <NoteItem key={n.id} note={n} state={state} backend={backend} doc={doc} onShow={onShow} />
        ))}
        {!list.length && <li className="hint">{showResolved ? 'Zatím žádné komentáře.' : 'Žádné nevyřešené komentáře.'}</li>}
      </ul>
      <div className="node-notes">
        <div className="node-notes-title">Komentář k celému organigramu</div>
        <AddNote backend={backend} nodeId={null} view={view} />
      </div>
    </div>
  )
}
