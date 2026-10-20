import { useEffect, useState } from 'react'
import { deleteHistory, listHistory, type HistoryEntry } from './db'
import { enablePlant, ensureViewMeta } from './ops'
import { minFontPt } from './Sheet'
import { ALL_VIEW, type Category, type Lang, type OrgDoc, type PageSpec, type ViewMeta } from './types'

type Commit = (fn: (d: OrgDoc) => void, desc: string, key?: string) => void

export function viewName(doc: OrgDoc, view: string): string {
  if (view === ALL_VIEW) return 'SANBORN, všechny závody'
  return doc.categories.find((c) => c.id === view)?.nameCs ?? view
}

export function SheetMetaEditor({ doc, view, commit }: { doc: OrgDoc; view: string; commit: Commit }) {
  const meta = doc.views[view]
  if (!meta) return null
  const field = (key: keyof ViewMeta, label: string) => (
    <label className="field">
      <span>{label}</span>
      <input
        value={meta[key]}
        onChange={(e) =>
          commit((d) => (d.views[view][key] = e.target.value), `Hlavička listu: ${viewName(doc, view)}`, `meta:${view}`)
        }
      />
    </label>
  )
  return (
    <div className="panel-body">
      <p className="hint">
        Klikněte na pozici v organigramu a upravte ji. Níže je hlavička a zápatí listu pro pohled{' '}
        <strong>{viewName(doc, view)}</strong>.
      </p>
      {field('titleCs', 'Titulek česky')}
      {field('titleEn', 'Titulek anglicky')}
      {field('versionCs', 'Verze česky')}
      {field('versionEn', 'Verze anglicky')}
      {field('docCode', 'Kód dokumentu')}
      {field('approvedCs', 'Schválení česky')}
      {field('approvedEn', 'Schválení anglicky')}
      <p className="hint">
        Klávesy: Tab přidá podřízenou pozici, Enter pozici vedle, Delete smaže, Ctrl+Z vrátí změnu. Ctrl + kolečko myši
        přibližuje.
      </p>
    </div>
  )
}

const fmt = new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' })

export function HistoryPanel({
  tick,
  previewId,
  onPreview,
  onSaveVersion,
}: {
  tick: number
  previewId: number | null
  onPreview: (e: HistoryEntry) => void
  onSaveVersion: (label: string) => void
}) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [label, setLabel] = useState('')
  const [onlyNamed, setOnlyNamed] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    listHistory().then(setEntries)
  }, [tick, reload])

  const shown = onlyNamed ? entries.filter((e) => e.label) : entries

  return (
    <div className="panel-body">
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!label.trim()) return
          onSaveVersion(label.trim())
          setLabel('')
        }}
      >
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Název verze, např. Schváleno 11/2026" />
        <button type="submit" className="btn primary">
          Uložit verzi
        </button>
      </form>
      <label className="check">
        <input type="checkbox" checked={onlyNamed} onChange={(e) => setOnlyNamed(e.target.checked)} />
        Jen pojmenované verze
      </label>
      <p className="hint">
        Každá změna se ukládá automaticky. Úpravy jedné pozice během dvou minut se slučují do jednoho záznamu. Kliknutím
        zobrazíte náhled a verzi můžete obnovit.
      </p>
      <ul className="history">
        {shown.map((e) => (
          <li key={e.id} className={e.id === previewId ? 'active' : ''}>
            <button type="button" onClick={() => onPreview(e)}>
              <span className="when">{fmt.format(e.ts)}</span>
              {e.label && <span className="badge">{e.label}</span>}
              <span className="what">{e.desc}</span>
            </button>
            {e.label && (
              <button
                type="button"
                className="link small"
                onClick={async () => {
                  if (e.id != null && confirm(`Smazat uloženou verzi „${e.label}“?`)) {
                    await deleteHistory(e.id)
                    setReload((r) => r + 1)
                  }
                }}
              >
                Smazat
              </button>
            )}
          </li>
        ))}
        {!shown.length && <li className="empty">Zatím žádné záznamy.</li>}
      </ul>
    </div>
  )
}

export interface PrintJob {
  page: PageSpec
  lang: Lang
  views: string[]
}

export function PrintDialog({
  doc,
  view,
  lang,
  onClose,
  onPrint,
}: {
  doc: OrgDoc
  view: string
  lang: Lang
  onClose: () => void
  onPrint: (job: PrintJob) => void
}) {
  const allViews = [ALL_VIEW, ...doc.categories.filter((c) => c.isPlant).map((c) => c.id)]
  const [page, setPage] = useState<PageSpec>({ format: 'A3', orientation: 'landscape' })
  const [plang, setLang] = useState<Lang>(lang)
  const [views, setViews] = useState<string[]>([view])

  return (
    <Modal title="Tisk a PDF" onClose={onClose}>
      <div className="field">
        <span>Formát</span>
        <div className="seg">
          {(['A4', 'A3'] as const).map((f) => (
            <button type="button" key={f} className={page.format === f ? 'active' : ''} onClick={() => setPage({ ...page, format: f })}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Orientace</span>
        <div className="seg">
          <button type="button" className={page.orientation === 'landscape' ? 'active' : ''} onClick={() => setPage({ ...page, orientation: 'landscape' })}>
            Na šířku
          </button>
          <button type="button" className={page.orientation === 'portrait' ? 'active' : ''} onClick={() => setPage({ ...page, orientation: 'portrait' })}>
            Na výšku
          </button>
        </div>
      </div>
      <div className="field">
        <span>Jazyk</span>
        <div className="seg">
          <button type="button" className={plang === 'cs' ? 'active' : ''} onClick={() => setLang('cs')}>
            Česky
          </button>
          <button type="button" className={plang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
            Anglicky
          </button>
        </div>
      </div>
      <div className="field">
        <span>Organigramy, každý na samostatný list</span>
        <div className="checks column">
          {allViews.map((v) => {
            const pt = minFontPt(doc, v, plang, page)
            return (
              <label key={v} className="check">
                <input
                  type="checkbox"
                  checked={views.includes(v)}
                  onChange={(e) => setViews(e.target.checked ? allViews.filter((x) => x === v || views.includes(x)) : views.filter((x) => x !== v))}
                />
                {viewName(doc, v)}
                <small className={pt < 4 ? 'warn' : ''}>nejmenší písmo {pt.toFixed(1).replace('.', ',')} pt</small>
              </label>
            )
          })}
        </div>
        <small>
          Velký organigram se zmenší, aby se vešel na list. Pokud je písmo pod 4 pt, zvolte A3 nebo přepněte část
          podřízených na uspořádání pod sebou.
        </small>
      </div>
      <p className="hint">V tiskovém dialogu prohlížeče zvolte tiskárnu, nebo Uložit jako PDF. Okraje nastavte na Žádné.</p>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>
          Zrušit
        </button>
        <button type="button" className="btn primary" disabled={!views.length} onClick={() => onPrint({ page, lang: plang, views })}>
          Tisknout
        </button>
      </div>
    </Modal>
  )
}

// Barvy povolené grafickým manuálem: modrá škála 50 až 950 a neutrály.
export const PALETTE = [
  '#FFFFFF', '#F4F6F8', '#DDE3E8', '#ECF6FF', '#D6EEFF', '#A9DBFF', '#78C8FF',
  '#3DA9F5', '#0591F2', '#0772C7', '#0A5BA3', '#084B87', '#05294C', '#6B7C8C',
]
const DARK = new Set(['#0591F2', '#0772C7', '#0A5BA3', '#084B87', '#05294C', '#6B7C8C', '#3DA9F5'])
export const textFor = (fill: string) => (DARK.has(fill.toUpperCase()) ? '#FFFFFF' : '#05294C')

export function SettingsDialog({ doc, commit, onClose }: { doc: OrgDoc; commit: Commit; onClose: () => void }) {
  const used = new Set(Object.values(doc.nodes).map((n) => n.categoryId))
  const upd = (id: string, patch: Partial<Category>, desc = 'Úprava barev a závodů') =>
    commit((d) => {
      const c = d.categories.find((x) => x.id === id)!
      Object.assign(c, patch)
      ensureViewMeta(d, c)
    }, desc, `cat:${id}`)

  return (
    <Modal title="Barvy a závody" onClose={onClose} wide>
      <p className="hint">
        Každá barva odpovídá závodu nebo skupině. Závod s volbou Vlastní organigram dostane samostatný list, do kterého se
        celkový organigram rozsekne. Barvy jsou omezené na paletu grafického manuálu.
      </p>
      <table className="cats">
        <thead>
          <tr>
            <th>Pořadí</th>
            <th>Název česky</th>
            <th>Název anglicky</th>
            <th>Barva</th>
            <th>Vlastní organigram</th>
            <th>Přerušovaný rámeček</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {doc.categories.map((c, i) => (
            <tr key={c.id}>
              <td className="nowrap">
                <button
                  type="button"
                  className="icon-btn"
                  disabled={i === 0}
                  onClick={() =>
                    commit((d) => {
                      const a = d.categories
                      ;[a[i - 1], a[i]] = [a[i], a[i - 1]]
                    }, 'Pořadí v legendě')
                  }
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={i === doc.categories.length - 1}
                  onClick={() =>
                    commit((d) => {
                      const a = d.categories
                      ;[a[i + 1], a[i]] = [a[i], a[i + 1]]
                    }, 'Pořadí v legendě')
                  }
                >
                  ↓
                </button>
              </td>
              <td>
                <input value={c.nameCs} onChange={(e) => upd(c.id, { nameCs: e.target.value })} />
              </td>
              <td>
                <input value={c.nameEn} onChange={(e) => upd(c.id, { nameEn: e.target.value })} />
              </td>
              <td>
                <div className="palette">
                  {PALETTE.map((p) => (
                    <button
                      type="button"
                      key={p}
                      title={p}
                      className={c.fill.toUpperCase() === p ? 'active' : ''}
                      style={{ background: p }}
                      onClick={() => upd(c.id, { fill: p, text: textFor(p) })}
                    />
                  ))}
                </div>
              </td>
              <td className="center">
                <input type="checkbox" checked={c.isPlant} onChange={(e) =>
                    commit((d) => {
                      const x = d.categories.find((y) => y.id === c.id)!
                      x.isPlant = e.target.checked
                      ensureViewMeta(d, x)
                      if (x.isPlant) enablePlant(d, x.id)
                    }, `Vlastní organigram: ${c.nameCs}`)
                  }
                />
              </td>
              <td className="center">
                <input type="checkbox" checked={!!c.dashed} onChange={(e) => upd(c.id, { dashed: e.target.checked })} />
              </td>
              <td>
                <button
                  type="button"
                  className="link small"
                  disabled={used.has(c.id)}
                  title={used.has(c.id) ? 'Barvu používají pozice v organigramu' : ''}
                  onClick={() =>
                    commit((d) => {
                      d.categories = d.categories.filter((x) => x.id !== c.id)
                      for (const n of Object.values(d.nodes)) n.views = n.views.filter((v) => v !== c.id)
                      delete d.views[c.id]
                    }, `Smazána barva ${c.nameCs}`)
                  }
                >
                  Smazat
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="modal-actions">
        <button
          type="button"
          className="btn"
          onClick={() =>
            commit((d) => {
              const c: Category = { id: `c${Date.now().toString(36)}`, nameCs: 'Nový závod', nameEn: 'New plant', fill: '#78C8FF', text: '#05294C', isPlant: true }
              d.categories.push(c)
              ensureViewMeta(d, c)
              enablePlant(d, c.id)
            }, 'Přidán závod')
          }
        >
          + Přidat závod
        </button>
        <button type="button" className="btn primary" onClick={onClose}>
          Hotovo
        </button>
      </div>
    </Modal>
  )
}

export function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}
