import { childrenOf } from './layout'
import { defaultViewMeta, defaultViewsFor } from './seed'
import { ALL_VIEW, type Category, type OrgDoc, type OrgNode } from './types'

export function newId(): string {
  return `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

export function descendants(doc: OrgDoc, id: string): Set<string> {
  const out = new Set<string>()
  const walk = (pid: string) => {
    for (const c of childrenOf(doc, pid)) {
      out.add(c.id)
      walk(c.id)
    }
  }
  walk(id)
  return out
}

function renumber(doc: OrgDoc, parentId: string | null, ordered: OrgNode[]) {
  ordered.forEach((n, i) => {
    doc.nodes[n.id].parentId = parentId
    doc.nodes[n.id].order = i
  })
}

function blankNode(doc: OrgDoc, parentId: string | null, view: string): OrgNode {
  const parent = parentId ? doc.nodes[parentId] : null
  const categoryId =
    view !== ALL_VIEW ? view : parent?.categoryId ?? doc.categories[0]?.id ?? 'group'
  return {
    id: newId(),
    parentId,
    order: 0,
    titleCs: 'Nová pozice',
    titleEn: '',
    name: '',
    categoryId,
    views: defaultViewsFor(categoryId, doc.categories),
  }
}

export function addChild(doc: OrgDoc, parentId: string, view: string): string {
  const n = blankNode(doc, parentId, view)
  n.order = childrenOf(doc, parentId).length
  doc.nodes[n.id] = n
  return n.id
}

export function addSibling(doc: OrgDoc, id: string, view: string): string {
  const ref = doc.nodes[id]
  const n = blankNode(doc, ref.parentId, view)
  if (view === ALL_VIEW) {
    n.categoryId = ref.categoryId
    n.views = defaultViewsFor(ref.categoryId, doc.categories)
  }
  const sibs = childrenOf(doc, ref.parentId)
  doc.nodes[n.id] = n
  sibs.splice(sibs.findIndex((s) => s.id === id) + 1, 0, n)
  renumber(doc, ref.parentId, sibs)
  return n.id
}

export function deleteNode(doc: OrgDoc, id: string) {
  for (const d of descendants(doc, id)) delete doc.nodes[d]
  const parentId = doc.nodes[id].parentId
  delete doc.nodes[id]
  renumber(doc, parentId, childrenOf(doc, parentId))
}

/** Přesune uzel před/za cílový uzel nebo pod něj. Vrací false, pokud by vznikl cyklus. */
export function moveNode(doc: OrgDoc, id: string, targetId: string, mode: 'before' | 'after' | 'child'): boolean {
  if (id === targetId || descendants(doc, id).has(targetId)) return false
  const node = doc.nodes[id]
  const oldParent = node.parentId
  if (mode === 'child') {
    const sibs = childrenOf(doc, targetId).filter((s) => s.id !== id)
    sibs.push(node)
    renumber(doc, targetId, sibs)
  } else {
    const parentId = doc.nodes[targetId].parentId
    const sibs = childrenOf(doc, parentId).filter((s) => s.id !== id)
    const at = sibs.findIndex((s) => s.id === targetId) + (mode === 'after' ? 1 : 0)
    sibs.splice(at, 0, node)
    renumber(doc, parentId, sibs)
  }
  if (oldParent !== doc.nodes[id].parentId) renumber(doc, oldParent, childrenOf(doc, oldParent))
  return true
}

export function setParent(doc: OrgDoc, id: string, parentId: string | null): boolean {
  if (parentId && (parentId === id || descendants(doc, id).has(parentId))) return false
  const oldParent = doc.nodes[id].parentId
  const sibs = childrenOf(doc, parentId).filter((s) => s.id !== id)
  sibs.push(doc.nodes[id])
  renumber(doc, parentId, sibs)
  renumber(doc, oldParent, childrenOf(doc, oldParent))
  return true
}

export function shift(doc: OrgDoc, id: string, dir: -1 | 1) {
  const parentId = doc.nodes[id].parentId
  const sibs = childrenOf(doc, parentId)
  const i = sibs.findIndex((s) => s.id === id)
  const j = i + dir
  if (j < 0 || j >= sibs.length) return
  ;[sibs[i], sibs[j]] = [sibs[j], sibs[i]]
  renumber(doc, parentId, sibs)
}

export function setCategory(doc: OrgDoc, id: string, categoryId: string) {
  const n = doc.nodes[id]
  const oldDefault = defaultViewsFor(n.categoryId, doc.categories)
  const sameAsDefault = oldDefault.length === n.views.length && oldDefault.every((v) => n.views.includes(v))
  n.categoryId = categoryId
  if (sameAsDefault) n.views = defaultViewsFor(categoryId, doc.categories)
}

export function ensureViewMeta(doc: OrgDoc, cat: Category) {
  if (cat.isPlant && !doc.views[cat.id]) {
    const code = cat.nameCs
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z]/g, '')
      .slice(0, 2)
      .toUpperCase()
    doc.views[cat.id] = defaultViewMeta(cat, code)
  }
}

export function isOrgDoc(x: unknown): x is OrgDoc {
  const d = x as OrgDoc
  return !!d && d.schema === 1 && typeof d.nodes === 'object' && Array.isArray(d.categories) && typeof d.views === 'object'
}

/** Nový závod s vlastním organigramem: ukáže v něm jeho pozice a společné pozice (Group, Externí). */
export function enablePlant(doc: OrgDoc, id: string) {
  const nonPlant = new Set(doc.categories.filter((c) => !c.isPlant).map((c) => c.id))
  for (const n of Object.values(doc.nodes)) {
    if ((n.categoryId === id || nonPlant.has(n.categoryId)) && !n.views.includes(id)) n.views.push(id)
  }
}
