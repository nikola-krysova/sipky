import { useCallback, useEffect, useRef, useState } from 'react'
import { listHistory, loadDoc, pruneHistory, putHistory, saveDoc } from './db'
import { createSeedDoc } from './seed'
import type { OrgDoc } from './types'

const COALESCE_MS = 2 * 60 * 1000

export type SaveState = 'loading' | 'saving' | 'saved' | 'error'

export function useOrgStore() {
  const [doc, setDoc] = useState<OrgDoc | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('loading')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [historyTick, setHistoryTick] = useState(0)
  const undo = useRef<OrgDoc[]>([])
  const redo = useRef<OrgDoc[]>([])
  const lastHist = useRef<{ id: number; key?: string; ts: number } | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  const pending = useRef<OrgDoc | null>(null)

  useEffect(() => {
    ;(async () => {
      let d = await loadDoc()
      if (!d) {
        d = createSeedDoc()
        await saveDoc(d)
        const id = await putHistory({ ts: Date.now(), desc: 'Výchozí stav podle vzoru', label: 'Výchozí stav', doc: d })
        lastHist.current = { id, ts: Date.now() }
      } else {
        const [last] = await listHistory()
        if (last?.id != null) lastHist.current = { id: last.id, key: last.key, ts: last.ts }
      }
      setDoc(d)
      setSaveState('saved')
      setSavedAt(Date.now())
    })().catch(() => setSaveState('error'))
  }, [])

  const flush = useCallback(async () => {
    window.clearTimeout(saveTimer.current)
    const d = pending.current
    if (!d) return
    pending.current = null
    try {
      await saveDoc(d)
      setSaveState('saved')
      setSavedAt(Date.now())
    } catch {
      setSaveState('error')
    }
  }, [])

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
      pending.current = next
      setSaveState('saving')
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => void flush(), 250)

      const now = Date.now()
      const last = lastHist.current
      const merge = key && last && last.key === key && now - last.ts < COALESCE_MS
      const entry = { ts: now, desc, key, doc: next, ...(merge ? { id: last.id } : {}) }
      putHistory(entry)
        .then((id) => {
          lastHist.current = { id, key, ts: now }
          setHistoryTick((t) => t + 1)
          if (!merge) return pruneHistory()
        })
        .catch(() => setSaveState('error'))
    },
    [flush],
  )

  const docRef = useRef<OrgDoc | null>(null)
  docRef.current = doc

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
      if (!cur) return
      const next = structuredClone(cur)
      fn(next)
      undo.current.push(cur)
      if (undo.current.length > 200) undo.current.shift()
      redo.current = []
      set(next, desc, key)
    },
    [set],
  )

  const replace = useCallback(
    (next: OrgDoc, desc: string) => {
      if (docRef.current) undo.current.push(docRef.current)
      redo.current = []
      lastHist.current = null
      set(next, desc)
    },
    [set],
  )

  const doUndo = useCallback(() => {
    const cur = docRef.current
    const prev = undo.current.pop()
    if (!cur || !prev) return
    redo.current.push(cur)
    lastHist.current = null
    set(prev, 'Zpět')
  }, [set])

  const doRedo = useCallback(() => {
    const cur = docRef.current
    const next = redo.current.pop()
    if (!cur || !next) return
    undo.current.push(cur)
    lastHist.current = null
    set(next, 'Znovu')
  }, [set])

  const saveNamedVersion = useCallback(
    async (label: string) => {
      if (!doc) return
      const id = await putHistory({ ts: Date.now(), desc: 'Uložená verze', label, doc })
      lastHist.current = { id, ts: Date.now() }
      setHistoryTick((t) => t + 1)
    },
    [doc],
  )

  return {
    doc,
    commit,
    replace,
    undo: doUndo,
    redo: doRedo,
    canUndo: undo.current.length > 0,
    canRedo: redo.current.length > 0,
    saveState,
    savedAt,
    historyTick,
    saveNamedVersion,
  }
}
