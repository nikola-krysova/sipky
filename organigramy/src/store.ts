import { useCallback, useEffect, useRef, useState } from 'react'
import { newHistoryId, openBackend, type Backend } from './db'
import { createSeedDoc } from './seed'
import type { OrgDoc } from './types'

const COALESCE_MS = 2 * 60 * 1000

export type SaveState = 'loading' | 'saving' | 'saved' | 'error' | 'empty'

export function useOrgStore() {
  const [backend, setBackend] = useState<Backend | null>(null)
  const [doc, setDoc] = useState<OrgDoc | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('loading')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [lastBy, setLastBy] = useState<string | undefined>(undefined)
  const [historyTick, setHistoryTick] = useState(0)
  const [readOnly, setReadOnly] = useState(false)
  const undo = useRef<OrgDoc[]>([])
  const redo = useRef<OrgDoc[]>([])
  const lastHist = useRef<{ id: string; key?: string; ts: number } | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  const pending = useRef<OrgDoc | null>(null)
  const docRef = useRef<OrgDoc | null>(null)
  docRef.current = doc

  useEffect(() => {
    let unsub = () => {}
    ;(async () => {
      const b = await openBackend()
      setBackend(b)
      setReadOnly(!b.canWrite)
      const loaded = await b.loadDoc()
      if (loaded) {
        setDoc(loaded.doc)
        setLastBy(loaded.by)
        setSavedAt(loaded.ts)
        setSaveState('saved')
      } else if (b.kind === 'local') {
        const d = createSeedDoc()
        await b.saveDoc(d)
        const id = newHistoryId(Date.now())
        await b.putHistory({ id, ts: Date.now(), desc: 'Výchozí stav podle vzoru', label: 'Výchozí stav' }, d)
        lastHist.current = { id, ts: Date.now() }
        setDoc(d)
        setSavedAt(Date.now())
        setSaveState('saved')
      } else {
        setSaveState('empty')
      }
      unsub = b.subscribe((c) => {
        // Změna od kolegy: převezme se celý organigram.
        pending.current = null
        window.clearTimeout(saveTimer.current)
        lastHist.current = null
        docRef.current = c.doc
        setDoc(c.doc)
        setLastBy(c.by)
        setSavedAt(c.ts)
        setSaveState('saved')
        setHistoryTick((t) => t + 1)
      })
    })().catch(() => setSaveState('error'))
    return () => unsub()
  }, [])

  const flush = useCallback(async () => {
    window.clearTimeout(saveTimer.current)
    const d = pending.current
    if (!d || !backend) return
    pending.current = null
    try {
      await backend.saveDoc(d)
      setSaveState('saved')
      setSavedAt(Date.now())
      setLastBy(backend.me ?? undefined)
    } catch {
      setSaveState('error')
    }
  }, [backend])

  useEffect(() => {
    const onHide = () => void flush()
    window.addEventListener('pagehide', onHide)
    window.addEventListener('beforeunload', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('beforeunload', onHide)
    }
  }, [flush])

  const persist = useCallback(
    (next: OrgDoc, desc: string, key?: string) => {
      if (!backend) return
      pending.current = next
      setSaveState('saving')
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => void flush(), 400)

      const now = Date.now()
      const last = lastHist.current
      const merge = !!key && !!last && last.key === key && now - last.ts < COALESCE_MS
      const id = merge ? last!.id : newHistoryId(now)
      lastHist.current = { id, key, ts: now }
      backend
        .putHistory({ id, ts: now, desc, key }, next)
        .then(() => {
          setHistoryTick((t) => t + 1)
          if (!merge) return backend.pruneHistory()
        })
        .catch(() => setSaveState('error'))
    },
    [backend, flush],
  )

  const set = useCallback(
    (next: OrgDoc, desc: string, key?: string) => {
      docRef.current = next
      setDoc(next)
      persist(next, desc, key)
    },
    [persist],
  )

  /** Provede změnu nad kopií dokumentu, uloží ji a zapíše do historie. */
  const commit = useCallback(
    (fn: (draft: OrgDoc) => void, desc: string, key?: string) => {
      const cur = docRef.current
      if (!cur || readOnly) return
      const next = structuredClone(cur)
      fn(next)
      undo.current.push(cur)
      if (undo.current.length > 200) undo.current.shift()
      redo.current = []
      set(next, desc, key)
    },
    [set, readOnly],
  )

  const replace = useCallback(
    (next: OrgDoc, desc: string) => {
      if (readOnly) return
      if (docRef.current) undo.current.push(docRef.current)
      redo.current = []
      lastHist.current = null
      set(next, desc)
    },
    [set, readOnly],
  )

  const doUndo = useCallback(() => {
    const cur = docRef.current
    const prev = undo.current.pop()
    if (!cur || !prev || readOnly) return
    redo.current.push(cur)
    lastHist.current = null
    set(prev, 'Zpět')
  }, [set, readOnly])

  const doRedo = useCallback(() => {
    const cur = docRef.current
    const next = redo.current.pop()
    if (!cur || !next || readOnly) return
    undo.current.push(cur)
    lastHist.current = null
    set(next, 'Znovu')
  }, [set, readOnly])

  const saveNamedVersion = useCallback(
    async (label: string) => {
      const d = docRef.current
      if (!d || !backend || readOnly) return
      const ts = Date.now()
      const id = newHistoryId(ts)
      await backend.putHistory({ id, ts, desc: 'Uložená verze', label }, d)
      lastHist.current = { id, ts }
      setHistoryTick((t) => t + 1)
    },
    [backend, readOnly],
  )

  /** První založení organigramu ve sdíleném úložišti. */
  const create = useCallback(
    async (d: OrgDoc, desc: string) => {
      if (!backend) return
      docRef.current = d
      setDoc(d)
      setSaveState('saving')
      await backend.saveDoc(d)
      const ts = Date.now()
      await backend.putHistory({ id: newHistoryId(ts), ts, desc, label: 'Založení' }, d)
      setSaveState('saved')
      setSavedAt(ts)
      setHistoryTick((t) => t + 1)
    },
    [backend],
  )

  return {
    backend,
    doc,
    commit,
    replace,
    create,
    undo: doUndo,
    redo: doRedo,
    canUndo: undo.current.length > 0,
    canRedo: redo.current.length > 0,
    saveState,
    savedAt,
    lastBy,
    readOnly,
    historyTick,
    saveNamedVersion,
  }
}
