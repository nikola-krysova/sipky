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
}

const MAX_HISTORY = 200

export function newHistoryId(ts: number): string {
  return `h${ts.toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

// ---------------------------------------------------------------- IndexedDB

const DB_NAME = 'sanborn-organigramy-v2'
let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        db.createObjectStore('state')
        db.createObjectStore('history', { keyPath: 'id' })
        db.createObjectStore('snapshots')
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
}

// ---------------------------------------------------------------- claude.ai db

type Snap = { exists: boolean; id: string; data(): Record<string, unknown> | undefined; metadata: { hasPendingWrites: boolean } }
type DocRef = {
  get(): Promise<Snap>
  set(d: Record<string, unknown>): Promise<void>
  delete(): Promise<void>
  onSnapshot(next: (s: Snap) => void, err?: (e: { code: string }) => void): () => void
}
type Query = { orderBy(f: string, d?: 'asc' | 'desc'): Query; limit(n: number): Query; get(): Promise<{ docs: Snap[] }> }
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
  return {
    kind: 'cloud',
    me,
    canWrite,
    async loadDoc() {
      const s = await current.get()
      const d = s.data()
      return s.exists && d?.doc ? { doc: d.doc as OrgDoc, by: d.by as string | undefined, ts: d.ts as number } : undefined
    },
    async saveDoc(doc) {
      const writeId = Math.random().toString(36).slice(2)
      mine.add(writeId)
      await current.set({ doc, ts: Date.now(), by: me ?? undefined, writeId })
    },
    subscribe(fn) {
      return current.onSnapshot(
        (s) => {
          const d = s.data()
          if (!s.exists || !d?.doc || s.metadata.hasPendingWrites || mine.has(d.writeId as string)) return
          fn({ doc: d.doc as OrgDoc, by: d.by as string | undefined, ts: d.ts as number })
        },
        () => {},
      )
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
