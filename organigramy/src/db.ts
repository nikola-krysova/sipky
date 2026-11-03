import type { OrgDoc } from './types'

// Úložiště organigramu. Na claude.ai sdílená databáze stránky (všichni, kdo mají
// stránku nasdílenou, vidí stejná data), jinde IndexedDB v prohlížeči.

export interface HistoryEntry {
  id: string
  ts: number
  desc: string
  /** Klíč pro slučování rychle po sobě jdoucích úprav téhož uzlu. */
  key?: string
  /** Pojmenovaná verze, nikdy se nepromazává. */
  label?: string
  /** Kdo změnu udělal (neprůhledné id uživatele, jen ve sdíleném režimu). */
  by?: string
}

/** Komentář k pozici (nodeId) nebo k celému organigramu (nodeId null). Nikdy se netiskne. */
export interface Note {
  id: string
  nodeId: string | null
  /** Pohled, ve kterém komentář vznikl ('all' nebo závod). */
  view: string
  text: string
  ts: number
  by?: string
  resolved?: boolean
  resolvedBy?: string
  resolvedTs?: number
}

export interface RemoteChange {
  doc: OrgDoc
  by?: string
  ts: number
}

export interface Backend {
  kind: 'cloud' | 'local'
  me: string | null
  /** false = jen pro čtení. */
  canWrite: boolean
  loadDoc(): Promise<RemoteChange | undefined>
  saveDoc(doc: OrgDoc): Promise<void>
  /** Změny od ostatních (jen sdílený režim). */
  subscribe(fn: (c: RemoteChange) => void): () => void
  listHistory(): Promise<HistoryEntry[]>
  getSnapshot(id: string): Promise<OrgDoc | undefined>
  putHistory(e: HistoryEntry, doc: OrgDoc): Promise<void>
  deleteHistory(id: string): Promise<void>
  pruneHistory(): Promise<void>
  /** Jména lidí podle id; neznámé id vrací "". */
  names(ids: string[]): Promise<Record<string, string>>
  /** Komentáře: živý seznam (nejnovější první). */
  subscribeNotes(fn: (notes: Note[]) => void): () => void
  addNote(n: Omit<Note, 'id' | 'by' | 'ts'>): Promise<void>
  setNoteResolved(id: string, resolved: boolean): Promise<void>
}

export function newNoteId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

const MAX_HISTORY = 200

/** Organigram mezitím uložil někdo jiný; nese jeho aktuální stav. */
export class ConflictError extends Error {
  constructor(public remote: RemoteChange) {
    super('conflict')
  }
}

export function newHistoryId(ts: number): string {
  return `h${ts.toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

// ---------------------------------------------------------------- IndexedDB

const DB_NAME = 'sanborn-organigramy-v2'
let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2)
      req.onupgradeneeded = () => {
        const db = req.result
        for (const [name, opts] of [
          ['state', undefined],
          ['history', { keyPath: 'id' }],
          ['snapshots', undefined],
          ['notes', { keyPath: 'id' }],
        ] as const) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, opts)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = fn(t.objectStore(store))
        t.oncomplete = () => resolve(req.result)
        t.onerror = () => reject(t.error)
      }),
  )
}

const localNotesListeners = new Set<() => void>()

const localBackend: Backend = {
  kind: 'local',
  me: null,
  canWrite: true,
  async loadDoc() {
    const doc = await tx<OrgDoc | undefined>('state', 'readonly', (s) => s.get('doc'))
    return doc ? { doc, ts: Date.now() } : undefined
  },
  async saveDoc(doc) {
    await tx('state', 'readwrite', (s) => s.put(doc, 'doc'))
  },
  subscribe: () => () => {},
  async listHistory() {
    const all = await tx<HistoryEntry[]>('history', 'readonly', (s) => s.getAll())
    return all.sort((a, b) => b.ts - a.ts)
  },
  getSnapshot: (id) => tx<OrgDoc | undefined>('snapshots', 'readonly', (s) => s.get(id)),
  async putHistory(e, doc) {
    await tx('snapshots', 'readwrite', (s) => s.put(doc, e.id))
    await tx('history', 'readwrite', (s) => s.put(e))
  },
  async deleteHistory(id) {
    await tx('history', 'readwrite', (s) => s.delete(id))
    await tx('snapshots', 'readwrite', (s) => s.delete(id))
  },
  async pruneHistory() {
    const auto = (await this.listHistory()).filter((e) => !e.label)
    for (const e of auto.slice(MAX_HISTORY)) await this.deleteHistory(e.id)
  },
  async names(ids) {
    return Object.fromEntries(ids.map((i) => [i, '']))
  },
  subscribeNotes(fn) {
    const load = () =>
      tx<Note[]>('notes', 'readonly', (s) => s.getAll()).then((all) => fn(all.sort((a, b) => b.ts - a.ts)))
    localNotesListeners.add(load)
    load()
    return () => localNotesListeners.delete(load)
  },
  async addNote(n) {
    await tx('notes', 'readwrite', (s) => s.put({ ...n, id: newNoteId(), ts: Date.now() }))
    localNotesListeners.forEach((l) => l())
  },
  async setNoteResolved(id, resolved) {
    const cur = await tx<Note | undefined>('notes', 'readonly', (s) => s.get(id))
    if (!cur) return
    await tx('notes', 'readwrite', (s) => s.put({ ...cur, resolved, resolvedTs: resolved ? Date.now() : undefined }))
    localNotesListeners.forEach((l) => l())
  },
}

// ---------------------------------------------------------------- claude.ai db

type Snap = { exists: boolean; id: string; data(): Record<string, unknown> | undefined; metadata: { hasPendingWrites: boolean } }
type DocRef = {
  get(): Promise<Snap>
  set(d: Record<string, unknown>): Promise<void>
  delete(): Promise<void>
  update(d: Record<string, unknown>): Promise<void>
  onSnapshot(next: (s: Snap) => void, err?: (e: { code: string }) => void): () => void
}
type Query = {
  orderBy(f: string, d?: 'asc' | 'desc'): Query
  limit(n: number): Query
  get(): Promise<{ docs: Snap[] }>
  onSnapshot(next: (s: { docs: Snap[] }) => void, err?: (e: { code: string }) => void): () => void
}
type DB = { doc(p: string): DocRef; collection(p: string): Query & { doc(id: string): DocRef } }
type User = {
  id(): Promise<string | null>
  can(name: string): Promise<boolean | null>
  profiles(ids: string[]): Promise<Record<string, { name: string }>>
}
type ClaudeUse = { use(name: string): Promise<unknown> }

// Dokumenty: org/current = aktuální organigram, history/<id> = záznam historie
// (bez dat, aby se seznam načítal rychle), snapshots/<id> = organigram k záznamu.
function cloudBackend(db: DB, user: User | null, me: string | null, canWrite: boolean): Backend {
  const mine = new Set<string>()
  const current = db.doc('org/current')
  /** Čas nejnovějšího stavu, který tato stránka zná. */
  let seenTs = 0
  return {
    kind: 'cloud',
    me,
    canWrite,
    async loadDoc() {
      const s = await current.get()
      const d = s.data()
      if (!s.exists || !d?.doc) return undefined
      seenTs = Math.max(seenTs, d.ts as number)
      return { doc: d.doc as OrgDoc, by: d.by as string | undefined, ts: d.ts as number }
    },
    async saveDoc(doc) {
      // Ochrana proti přepsání: když mezitím uložil někdo jiný, neukládat zastaralý stav.
      const s = await current.get()
      const d = s.data()
      if (s.exists && d && (d.ts as number) > seenTs && !mine.has(d.writeId as string)) {
        throw new ConflictError({ doc: d.doc as OrgDoc, by: d.by as string | undefined, ts: d.ts as number })
      }
      const writeId = Math.random().toString(36).slice(2)
      const ts = Math.max(Date.now(), seenTs + 1)
      mine.add(writeId)
      seenTs = ts
      await current.set({ doc, ts, by: me ?? undefined, writeId })
    },
    subscribe(fn) {
      // Živé změny přes onSnapshot; navíc kontrola při návratu do okna a každých 30 s,
      // a obnovení odběru, když spojení spadne.
      let stopped = false
      let unsub = () => {}
      let retry: number | undefined
      const handle = (s: Snap) => {
        const d = s.data()
        if (!s.exists || !d?.doc || s.metadata.hasPendingWrites || mine.has(d.writeId as string)) return
        const ts = d.ts as number
        if (ts <= seenTs) return
        seenTs = ts
        fn({ doc: d.doc as OrgDoc, by: d.by as string | undefined, ts })
      }
      const listen = () => {
        if (stopped) return
        unsub = current.onSnapshot(handle, () => {
          if (!stopped) retry = window.setTimeout(listen, 3000)
        })
      }
      const poll = () => {
        if (!stopped) current.get().then(handle, () => {})
      }
      const onVisible = () => document.visibilityState === 'visible' && poll()
      listen()
      const timer = window.setInterval(poll, 30000)
      window.addEventListener('focus', poll)
      document.addEventListener('visibilitychange', onVisible)
      return () => {
        stopped = true
        unsub()
        window.clearTimeout(retry)
        window.clearInterval(timer)
        window.removeEventListener('focus', poll)
        document.removeEventListener('visibilitychange', onVisible)
      }
    },
    async listHistory() {
      const q = await db.collection('history').orderBy('ts', 'desc').limit(1000).get()
      return q.docs.map((s) => ({ ...(s.data() as Omit<HistoryEntry, 'id'>), id: s.id }))
    },
    async getSnapshot(id) {
      const s = await db.doc(`snapshots/${id}`).get()
      return s.exists ? (s.data()?.doc as OrgDoc) : undefined
    },
    async putHistory(e, doc) {
      const { id, ...meta } = e
      await db.doc(`snapshots/${id}`).set({ doc })
      await db.doc(`history/${id}`).set(JSON.parse(JSON.stringify({ ...meta, by: me ?? undefined })))
    },
    async deleteHistory(id) {
      await db.doc(`history/${id}`).delete()
      await db.doc(`snapshots/${id}`).delete()
    },
    async pruneHistory() {
      const auto = (await this.listHistory()).filter((e) => !e.label)
      for (const e of auto.slice(MAX_HISTORY)) await this.deleteHistory(e.id)
    },
    subscribeNotes(fn) {
      let stopped = false
      let unsub = () => {}
      let retry: number | undefined
      const q = db.collection('notes').orderBy('ts', 'desc').limit(500)
      const deliver = (snap: { docs: Snap[] }) =>
        fn(snap.docs.filter((d) => d.exists).map((d) => ({ ...(d.data() as Omit<Note, 'id'>), id: d.id })))
      const listen = () => {
        if (stopped) return
        unsub = q.onSnapshot(deliver, () => {
          if (!stopped) retry = window.setTimeout(listen, 3000)
        })
      }
      const poll = () => {
        if (!stopped) q.get().then(deliver, () => {})
      }
      listen()
      window.addEventListener('focus', poll)
      return () => {
        stopped = true
        unsub()
        window.clearTimeout(retry)
        window.removeEventListener('focus', poll)
      }
    },
    async addNote(n) {
      const note = JSON.parse(JSON.stringify({ ...n, ts: Date.now(), by: me ?? undefined }))
      await db.doc(`notes/${newNoteId()}`).set(note)
    },
    async setNoteResolved(id, resolved) {
      await db.doc(`notes/${id}`).update(
        resolved ? { resolved: true, resolvedBy: me ?? '', resolvedTs: Date.now() } : { resolved: false, resolvedBy: '', resolvedTs: 0 },
      )
    },
    async names(ids) {
      if (!user || !ids.length) return Object.fromEntries(ids.map((i) => [i, '']))
      const ps = await user.profiles(ids)
      return Object.fromEntries(ids.map((i) => [i, ps[i]?.name || '']))
    },
  }
}

export async function openBackend(): Promise<Backend> {
  const claude = (window as unknown as { claude?: ClaudeUse }).claude
  if (!claude?.use) return localBackend
  const db = (await claude.use('db')) as DB | null
  if (!db) return localBackend
  const user = (await claude.use('user')) as User | null
  const me = user ? await user.id() : null
  const can = user ? await user.can('data.write') : null
  return cloudBackend(db, user, me, can !== false)
}
