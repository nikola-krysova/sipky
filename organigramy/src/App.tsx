import { useCallback, useEffect, useState } from 'react'
import { Canvas } from './Canvas'
import type { HistoryEntry } from './db'
import { createBlankDoc } from './seed'
import { NodeEditor } from './NodeEditor'
import { addChild, addSibling, deleteNode, descendants, isOrgDoc, moveNode } from './ops'
import { HistoryPanel, PrintDialog, SettingsDialog, SheetMetaEditor, viewName, type PrintJob } from './Panels'
import { Sheet } from './Sheet'
import { useOrgStore } from './store'
import { ALL_VIEW, pageSize, type Lang, type OrgDoc, type PageSpec } from './types'

const timeFmt = new Intl.DateTimeFormat('cs-CZ', { timeStyle: 'short' })
const PREVIEW_PAGE: PageSpec = { format: 'A3', orientation: 'landscape' }

export default function App() {
  const store = useOrgStore()
  const { doc, commit } = store
  const [view, setView] = useState<string>(ALL_VIEW)
  const [lang, setLang] = useState<Lang>('cs')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [freshId, setFreshId] = useState<string | null>(null)
  const [side, setSide] = useState<'edit' | 'history'>('edit')
  const [preview, setPreview] = useState<{ entry: HistoryEntry; doc: OrgDoc } | null>(null)
  const [lastByName, setLastByName] = useState('')
  const ro = store.readOnly

  useEffect(() => {
    const b = store.backend
    if (!b || !store.lastBy) return setLastByName('')
    b.names([store.lastBy]).then((n) => setLastByName(store.lastBy === b.me ? '' : n[store.lastBy!] || 'kolega'))
  }, [store.backend, store.lastBy])

  const openPreview = useCallback(
    async (entry: HistoryEntry) => {
      const d = await store.backend?.getSnapshot(entry.id)
      if (d) setPreview({ entry, doc: d })
      else alert('Tato verze už není k dispozici.')
    },
    [store.backend],
  )
  const [dialog, setDialog] = useState<'print' | 'settings' | null>(null)
  const [printJob, setPrintJob] = useState<PrintJob | null>(null)

  const selected = doc && selectedId ? doc.nodes[selectedId] : undefined

  const select = useCallback((id: string | null) => {
    if (ro) return
    setSelectedId(id)
    setFreshId(null)
    if (id) setSide('edit')
  }, [ro])

  const add = useCallback(
    (kind: 'child' | 'sibling') => {
      if (!selectedId || !doc) return
      if (kind === 'sibling' && !doc.nodes[selectedId].parentId) return
      let id = ''
      commit((d) => {
        id = kind === 'child' ? addChild(d, selectedId, view) : addSibling(d, selectedId, view)
      }, 'Přidána pozice', undefined)
      setSelectedId(id)
      setFreshId(id)
    },
    [commit, doc, selectedId, view],
  )

  const remove = useCallback(() => {
    if (!selectedId || !doc) return
    const n = doc.nodes[selectedId]
    const count = descendants(doc, selectedId).size
    const what = [n.titleCs, n.name.replace(/\n/g, ', ')].filter(Boolean).join(', ')
    const msg = count
      ? `Smazat pozici „${what}“ a ${count} podřízených? Změnu lze vrátit přes Zpět nebo Historii.`
      : `Smazat pozici „${what}“?`
    if (!confirm(msg)) return
    commit((d) => deleteNode(d, selectedId), `Smazána pozice: ${what}`)
    setSelectedId(n.parentId)
  }, [commit, doc, selectedId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t.closest('input, textarea, select, [contenteditable]')
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        if (e.shiftKey) store.redo()
        else store.undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault()
        store.redo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setDialog('print')
        return
      }
      if (typing || dialog || preview) return
      if (e.key === 'Escape') select(null)
      else if (e.key === 'Tab' && selectedId) {
        e.preventDefault()
        add('child')
      } else if (e.key === 'Enter' && selectedId) {
        e.preventDefault()
        add('sibling')
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        remove()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [add, dialog, preview, remove, select, selectedId, store])

  useEffect(() => {
    if (!printJob) return
    const { w, h } = pageSize(printJob.sheets[0].page)
    const style = document.createElement('style')
    style.textContent = `@page { size: ${w}mm ${h}mm; margin: 0 }`
    document.head.appendChild(style)
    const done = () => setPrintJob(null)
    window.addEventListener('afterprint', done, { once: true })
    const t = window.setTimeout(() => window.print(), 150)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('afterprint', done)
      style.remove()
    }
  }, [printJob])

  const exportJson = () => {
    if (!doc) return
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `organigram-sanborn-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importJson = (file: File) => {
    file.text().then((txt) => {
      try {
        const data = JSON.parse(txt)
        if (!isOrgDoc(data)) throw new Error()
        if (!doc) {
          store.create(data, `Založeno ze zálohy ${file.name}`)
        } else if (confirm('Nahradit současný organigram obsahem souboru? Současný stav zůstane v historii.')) {
          store.replace(data, `Import ze souboru ${file.name}`)
          select(null)
        }
      } catch {
        alert('Soubor není záloha organigramu.')
      }
    })
  }

  if (!doc) {
    if (store.saveState !== 'empty') {
      return <div className="loading">{store.saveState === 'error' ? 'Úložiště není dostupné. Zkuste stránku načíst znovu.' : 'Načítám…'}</div>
    }
    return (
      <div className="empty-state">
        <div>
          <img src="./logo.png" alt="SANBORN" className="logo" style={{ height: 48 }} />
          <h1>Organigram zatím neexistuje</h1>
          {ro ? (
            <p className="hint">Organigram ještě nikdo nezaložil. K úpravám potřebujete od vlastníka stránky oprávnění.</p>
          ) : (
            <>
              <p className="hint">Založte nový organigram, nebo nahrajte zálohu ze souboru.</p>
              <div className="panel-actions">
                <button type="button" className="btn primary" onClick={() => store.create(createBlankDoc(), 'Založen nový organigram')}>
                  Založit nový organigram
                </button>
                <label className="btn">
                  Nahrát zálohu
                  <input type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
                </label>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  const views = [ALL_VIEW, ...doc.categories.filter((c) => c.isPlant).map((c) => c.id)]
  const shownDoc: OrgDoc = preview?.doc ?? doc
  const shownView = shownDoc.views[view] || view === ALL_VIEW ? view : ALL_VIEW

  return (
    <>
      <div className="app">
        <header className="topbar">
          <img src="./logo.png" alt="SANBORN" className="logo" />
          <div className="app-title">Organigramy</div>
          <nav className="tabs">
            {views.map((v) => {
              const cat = doc.categories.find((c) => c.id === v)
              return (
                <button
                  type="button"
                  key={v}
                  className={v === view ? 'active' : ''}
                  onClick={() => setView(v)}
                >
                  {cat && <i style={{ background: cat.fill }} />}
                  {v === ALL_VIEW ? 'SANBORN' : cat?.nameCs}
                </button>
              )
            })}
          </nav>
          <div className="spacer" />
          <div className="seg small">
            <button type="button" className={lang === 'cs' ? 'active' : ''} onClick={() => setLang('cs')}>
              CZ
            </button>
            <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
              EN
            </button>
          </div>
          {!ro && (
            <>
              <button type="button" className="btn ghost" onClick={store.undo} disabled={!store.canUndo} title="Ctrl+Z">
                Zpět
              </button>
              <button type="button" className="btn ghost" onClick={store.redo} disabled={!store.canRedo} title="Ctrl+Y">
                Znovu
              </button>
              <button type="button" className="btn ghost" onClick={() => setDialog('settings')}>
                Barvy a závody
              </button>
            </>
          )}
          <button type="button" className="btn primary" onClick={() => setDialog('print')}>
            Tisk, PDF
          </button>
        </header>

        <main className="main">
          <section className="stage">
            {ro && <div className="readonly-bar">Jen pro čtení. K úpravám potřebujete od vlastníka stránky oprávnění Contributor nebo Editor.</div>}
            {preview && (
              <div className="preview-bar">
                <span>
                  Náhled verze z {new Date(preview.entry.ts).toLocaleString('cs-CZ')}
                  {preview.entry.label ? `, ${preview.entry.label}` : ''}
                </span>
                {!ro && <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    store.replace(structuredClone(preview.doc), `Obnovena verze z ${new Date(preview.entry.ts).toLocaleString('cs-CZ')}`)
                    setPreview(null)
                    select(null)
                  }}
                >
                  Obnovit tuto verzi
                </button>}
                <button type="button" className="btn" onClick={() => setPreview(null)}>
                  Zavřít náhled
                </button>
              </div>
            )}
            <Canvas
              doc={shownDoc}
              view={shownView}
              lang={lang}
              page={PREVIEW_PAGE}
              selectedId={preview ? null : selectedId}
              readOnly={!!preview || ro}
              onSelect={preview ? () => {} : select}
              onMove={(id, hint) =>
                commit((d) => {
                  moveNode(d, id, hint.targetId, hint.mode)
                }, `Přesun: ${doc.nodes[id].name.split('\n')[0] || doc.nodes[id].titleCs}`)
              }
            />
            <div className="statusbar">
              <span className={`save ${store.saveState}`}>
                {store.saveState === 'saving'
                  ? 'Ukládám…'
                  : store.saveState === 'error'
                    ? 'Uložení selhalo'
                    : `${store.backend?.kind === 'cloud' ? 'Uloženo pro všechny' : 'Uloženo'}${store.savedAt ? ` ${timeFmt.format(store.savedAt)}` : ''}${lastByName ? `, změnu udělal(a) ${lastByName}` : ''}`}
              </span>
              <span>
                {viewName(doc, view)}, {Object.keys(doc.nodes).length} pozic celkem
              </span>
              <span className="spacer" />
              <button type="button" className="link" onClick={exportJson}>
                Zálohovat do souboru
              </button>
              {!ro && <label className="link">
                Nahrát zálohu
                <input
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) importJson(f)
                    e.target.value = ''
                  }}
                />
              </label>}
            </div>
          </section>

          <aside className="side">
            <div className="side-tabs">
              <button type="button" className={side === 'edit' ? 'active' : ''} onClick={() => setSide('edit')}>
                {selected ? 'Pozice' : 'List'}
              </button>
              <button type="button" className={side === 'history' ? 'active' : ''} onClick={() => setSide('history')}>
                Historie
              </button>
            </div>
            {side === 'history' || ro ? (
              <HistoryPanel
                tick={store.historyTick}
                previewId={preview?.entry.id ?? null}
                onPreview={openPreview}
                backend={store.backend!}
                readOnly={ro}
                onSaveVersion={store.saveNamedVersion}
              />
            ) : selected ? (
              <NodeEditor
                key={selected.id}
                doc={doc}
                node={selected}
                autoFocus={freshId === selected.id}
                commit={commit}
                onAddChild={() => add('child')}
                onAddSibling={() => add('sibling')}
                onDelete={remove}
              />
            ) : (
              <SheetMetaEditor doc={doc} view={view} commit={commit} />
            )}
          </aside>
        </main>
      </div>

      {dialog === 'print' && (
        <PrintDialog
          doc={doc}
          view={view}
          lang={lang}
          onClose={() => setDialog(null)}
          onPrint={(job) => {
            setDialog(null)
            setPrintJob(job)
          }}
        />
      )}
      {dialog === 'settings' && <SettingsDialog doc={doc} commit={commit} onClose={() => setDialog(null)} />}

      {printJob && (
        <div className="print-root">
          {printJob.sheets.map((sh, i) => {
            const { w, h } = pageSize(sh.page)
            return (
              <div key={i} className="print-page" style={{ width: `${w}mm`, height: `${h}mm` }}>
                <Sheet
                  doc={doc}
                  view={sh.view}
                  lang={printJob.lang}
                  page={sh.page}
                  trees={sh.trees}
                  part={sh.part}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
