import type { OrgDoc } from './types'

// Lokální úložiště v prohlížeči (IndexedDB): aktuální stav + historie změn.

export interface HistoryEntry {
  id?: number
  ts: number
  desc: string
  /** Klíč pro slučování rychle po sobě jdoucích úprav téhož uzlu. */
  key?: string
  /** Pojmenovaná verze, nikdy se nepromazává. */
  label?: string
  doc: OrgDoc
}

const DB_NAME = 'sanborn-organigramy'
const MAX_HISTORY = 400

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        db.createObjectStore('state')
        db.createObjectStore('history', { keyPath: 'id', autoIncrement: true })
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

export function loadDoc(): Promise<OrgDoc | undefined> {
  return tx<OrgDoc | undefined>('state', 'readonly', (s) => s.get('doc'))
}

export function saveDoc(doc: OrgDoc): Promise<IDBValidKey> {
  return tx('state', 'readwrite', (s) => s.put(doc, 'doc'))
}

export function listHistory(): Promise<HistoryEntry[]> {
  return tx<HistoryEntry[]>('history', 'readonly', (s) => s.getAll()).then((all) => all.sort((a, b) => b.ts - a.ts))
}

export function putHistory(entry: HistoryEntry): Promise<number> {
  return tx('history', 'readwrite', (s) => s.put(entry)).then((id) => id as number)
}

export function deleteHistory(id: number): Promise<undefined> {
  return tx('history', 'readwrite', (s) => s.delete(id))
}

export async function pruneHistory(): Promise<void> {
  const all = await listHistory()
  const auto = all.filter((e) => !e.label)
  for (const e of auto.slice(MAX_HISTORY)) if (e.id != null) await deleteHistory(e.id)
}
