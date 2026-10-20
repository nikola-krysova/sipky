import { useMemo } from 'react'
import { childrenOf, layoutOf } from './layout'
import { descendants, setCategory, setParent, shift } from './ops'
import { defaultViewsFor } from './seed'
import { ALL_VIEW, type ChildLayout, type OrgDoc, type OrgNode } from './types'

interface Props {
  doc: OrgDoc
  node: OrgNode
  autoFocus: boolean
  commit: (fn: (d: OrgDoc) => void, desc: string, key?: string) => void
  onAddChild: () => void
  onAddSibling: () => void
  onDelete: () => void
}

function nodeCaption(n: OrgNode) {
  return [n.titleCs, n.name.replace(/\n/g, ', ')].filter(Boolean).join(', ')
}

export function NodeEditor({ doc, node, autoFocus, commit, onAddChild, onAddSibling, onDelete }: Props) {
  const plants = doc.categories.filter((c) => c.isPlant)
  const cat = doc.categories.find((c) => c.id === node.categoryId)
  const who = node.name.split('\n')[0] || node.titleCs

  const edit = (field: keyof OrgNode, value: string) =>
    commit(
      (d) => {
        ;(d.nodes[node.id] as unknown as Record<string, unknown>)[field] = value || (field.startsWith('label') ? undefined : '')
      },
      `Úprava: ${who}`,
      `edit:${node.id}`,
    )

  const parentOptions = useMemo(() => {
    const banned = descendants(doc, node.id)
    banned.add(node.id)
    const out: { id: string; label: string; depth: number }[] = []
    const walk = (pid: string | null, depth: number) => {
      for (const c of childrenOf(doc, pid)) {
        if (banned.has(c.id)) continue
        out.push({ id: c.id, label: nodeCaption(c), depth })
        walk(c.id, depth + 1)
      }
    }
    walk(null, 0)
    return out
  }, [doc, node.id])

  const isRoot = !node.parentId
  const layoutAll = layoutOf(node, ALL_VIEW, isRoot)
  const layoutPlants = layoutOf(node, 'plants', isRoot)
  const setLayout = (key: string, v: ChildLayout) =>
    commit((d) => {
      d.nodes[node.id].layout = { ...d.nodes[node.id].layout, [key]: v }
    }, `Uspořádání: ${who}`)

  const hasKids = childrenOf(doc, node.id).length > 0

  return (
    <div className="panel-body">
      <div className="panel-actions">
        <button type="button" className="btn primary" onClick={onAddChild} title="Klávesa Tab">
          + Podřízená pozice
        </button>
        <button type="button" className="btn" onClick={onAddSibling} disabled={isRoot} title="Klávesa Enter">
          + Vedle
        </button>
      </div>

      <label className="field">
        <span>Funkce česky</span>
        <input value={node.titleCs} onChange={(e) => edit('titleCs', e.target.value)} autoFocus={autoFocus} onFocus={(e) => autoFocus && e.target.select()} />
      </label>
      <label className="field">
        <span>Funkce anglicky</span>
        <input value={node.titleEn} onChange={(e) => edit('titleEn', e.target.value)} placeholder={node.titleCs} />
      </label>
      <label className="field">
        <span>Jméno</span>
        <textarea
          rows={Math.max(1, node.name.split('\n').length)}
          value={node.name}
          onChange={(e) => edit('name', e.target.value)}
          placeholder="Neobsazeno"
        />
        <small>Víc jmen pište na samostatné řádky. V organigramu se sází verzálkami.</small>
      </label>

      <div className="field">
        <span>Barva, závod</span>
        <div className="chips">
          {doc.categories.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`chip ${c.id === node.categoryId ? 'active' : ''}`}
              style={{ background: c.fill, color: c.text, borderStyle: c.dashed ? 'dashed' : 'solid' }}
              onClick={() =>
                commit((d) => setCategory(d, node.id, c.id), `Změna závodu: ${who}`)
              }
            >
              {c.nameCs}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>Zobrazit v organigramu závodu</span>
        <div className="checks">
          {plants.map((p) => (
            <label key={p.id} className="check">
              <input
                type="checkbox"
                checked={node.views.includes(p.id)}
                onChange={(e) =>
                  commit((d) => {
                    const n = d.nodes[node.id]
                    n.views = e.target.checked ? [...n.views, p.id] : n.views.filter((v) => v !== p.id)
                  }, `Viditelnost: ${who}`)
                }
              />
              {p.nameCs}
            </label>
          ))}
        </div>
        <small>
          Celkový organigram SANBORN ukazuje vždy všechny pozice. Skrytá pozice v závodu zmizí a její podřízení se
          připojí k nejbližšímu nadřízenému.
          {(() => {
            const def = defaultViewsFor(node.categoryId, doc.categories)
            const same = def.length === node.views.length && def.every((v) => node.views.includes(v))
            return same ? null : (
              <>
                {' '}
                <button
                  type="button"
                  className="link"
                  onClick={() => commit((d) => (d.nodes[node.id].views = def), `Viditelnost: ${who}`)}
                >
                  Obnovit podle barvy
                </button>
              </>
            )
          })()}
        </small>
      </div>

      <details className="field more" open={!!node.labelCs}>
        <summary>Vlastní popisek lokality</summary>
        <label className="field">
          <span>Česky</span>
          <input
            value={node.labelCs ?? ''}
            onChange={(e) => edit('labelCs', e.target.value)}
            placeholder={cat?.nameCs}
          />
        </label>
        <label className="field">
          <span>Anglicky</span>
          <input
            value={node.labelEn ?? ''}
            onChange={(e) => edit('labelEn', e.target.value)}
            placeholder={node.labelCs || cat?.nameEn}
          />
        </label>
      </details>

      {hasKids && (
        <div className="field">
          <span>Podřízení</span>
          <div className="layout-grid">
            <span>Celkový</span>
            <Seg value={layoutAll} onChange={(v) => setLayout(ALL_VIEW, v)} />
            <span>Závody</span>
            <Seg value={layoutPlants} onChange={(v) => setLayout('plants', v)} />
          </div>
        </div>
      )}

      <label className="field">
        <span>Nadřízený</span>
        <select
          value={node.parentId ?? ''}
          onChange={(e) =>
            commit((d) => {
              setParent(d, node.id, e.target.value || null)
            }, `Přesun: ${who}`)
          }
        >
          <option value="">(nejvyšší úroveň)</option>
          {parentOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {'  '.repeat(o.depth) + o.label}
            </option>
          ))}
        </select>
      </label>

      <div className="panel-actions">
        <button type="button" className="btn" onClick={() => commit((d) => shift(d, node.id, -1), `Pořadí: ${who}`)}>
          Posunout dřív
        </button>
        <button type="button" className="btn" onClick={() => commit((d) => shift(d, node.id, 1), `Pořadí: ${who}`)}>
          Posunout dál
        </button>
      </div>
      <p className="hint">Pozici můžete také přetáhnout myší na jinou: na střed pod ni, na horní nebo dolní okraj vedle ní.</p>

      <div className="panel-actions danger-zone">
        <button type="button" className="btn danger" onClick={onDelete}>
          Smazat pozici{hasKids ? ' i s podřízenými' : ''}
        </button>
      </div>
    </div>
  )
}

function Seg({ value, onChange }: { value: ChildLayout; onChange: (v: ChildLayout) => void }) {
  return (
    <div className="seg">
      <button type="button" className={value === 'v' ? 'active' : ''} onClick={() => onChange('v')}>
        Pod sebou
      </button>
      <button type="button" className={value === 'h' ? 'active' : ''} onClick={() => onChange('h')}>
        Vedle sebe
      </button>
    </div>
  )
}
