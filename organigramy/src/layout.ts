import { ALL_VIEW, type Category, type ChildLayout, type Lang, type OrgDoc, type OrgNode } from './types'

// Rozměry v jednotkách grafu (před zmenšením na list).
export const NODE_W = 132
const PAD_X = 6
const PAD_Y = 5
const FS_TITLE = 10
const FS_NAME = 10
const FS_LABEL = 9
const LH = 1.22
const MIN_H = 36
const INDENT = 18
const V_GAP = 7
const H_GAP = 14
const BUS = 12

export const FONT = 'Arial, "Helvetica Neue", Helvetica, sans-serif'
export const FONT_SIZES = { title: FS_TITLE, name: FS_NAME, label: FS_LABEL }

export interface ViewTree {
  node: OrgNode
  children: ViewTree[]
}

export function childrenOf(doc: OrgDoc, parentId: string | null): OrgNode[] {
  return Object.values(doc.nodes)
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => a.order - b.order)
}

export function isVisible(node: OrgNode, view: string): boolean {
  return view === ALL_VIEW || node.views.includes(view)
}

/** Strom pro daný pohled. Skrytý uzel zmizí a jeho viditelní podřízení se přesunou k nejbližšímu viditelnému nadřízenému. */
export function buildViewTree(doc: OrgDoc, view: string): ViewTree[] {
  const kids = new Map<string | null, OrgNode[]>()
  for (const n of Object.values(doc.nodes)) {
    const list = kids.get(n.parentId) ?? []
    list.push(n)
    kids.set(n.parentId, list)
  }
  for (const list of kids.values()) list.sort((a, b) => a.order - b.order)
  const build = (n: OrgNode): ViewTree[] => {
    const children = (kids.get(n.id) ?? []).flatMap(build)
    return isVisible(n, view) ? [{ node: n, children }] : children
  }
  return (kids.get(null) ?? []).flatMap(build)
}

export function layoutOf(node: OrgNode, view: string, isRoot: boolean): ChildLayout {
  return node.layout?.[view] ?? (view !== ALL_VIEW ? node.layout?.plants : undefined) ?? (isRoot ? 'h' : 'v')
}

let ctx: CanvasRenderingContext2D | null = null
function measure(text: string, size: number, bold: boolean): number {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return text.length * size * 0.55
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`
  return ctx.measureText(text).width
}

function wrap(text: string, size: number, bold: boolean, max: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.trim().split(/\s+/).filter(Boolean)
    let line = ''
    for (const w of words) {
      const next = line ? `${line} ${w}` : w
      if (line && measure(next, size, bold) > max) {
        out.push(line)
        line = w
      } else line = next
    }
    if (line) out.push(line)
  }
  return out
}

export interface TextLine {
  text: string
  size: number
  bold: boolean
  y: number
}

export interface PlacedNode {
  node: OrgNode
  cat: Category | undefined
  x: number
  y: number
  w: number
  h: number
  lines: TextLine[]
  layout: ChildLayout
}

export interface ChartLayout {
  nodes: PlacedNode[]
  /** Spojnice jako lomené čáry. */
  lines: { points: [number, number][] }[]
  width: number
  height: number
}

export function nodeLabel(node: OrgNode, cat: Category | undefined, lang: Lang): string {
  const custom = lang === 'cs' ? node.labelCs : node.labelEn || node.labelCs
  if (custom) return custom
  if (!cat) return ''
  return lang === 'cs' ? cat.nameCs : cat.nameEn
}

function nodeLines(node: OrgNode, cat: Category | undefined, lang: Lang): { lines: TextLine[]; h: number } {
  const max = NODE_W - PAD_X * 2
  const title = lang === 'cs' ? node.titleCs : node.titleEn || node.titleCs
  const parts: { text: string; size: number; bold: boolean }[] = []
  for (const t of wrap(title, FS_TITLE, true, max)) parts.push({ text: t, size: FS_TITLE, bold: true })
  for (const t of wrap(node.name.toLocaleUpperCase('cs'), FS_NAME, true, max)) parts.push({ text: t, size: FS_NAME, bold: true })
  const label = nodeLabel(node, cat, lang)
  if (label) for (const t of wrap(label, FS_LABEL, false, max)) parts.push({ text: t, size: FS_LABEL, bold: false })
  const textH = parts.reduce((s, p) => s + p.size * LH, 0)
  const h = Math.max(MIN_H, textH + PAD_Y * 2)
  let y = (h - textH) / 2
  const lines = parts.map((p) => {
    const line = { ...p, y: y + p.size * 0.95 }
    y += p.size * LH
    return line
  })
  return { lines, h }
}

interface Sized {
  t: ViewTree
  h: number
  lines: TextLine[]
  layout: ChildLayout
  kids: Sized[]
  /** Rozměry celého podstromu. */
  sw: number
  sh: number
  /** Vodorovná pozice uzlu v rámci podstromu. */
  nx: number
}

function size(t: ViewTree, doc: OrgDoc, view: string, lang: Lang, isRoot: boolean): Sized {
  const cat = doc.categories.find((c) => c.id === t.node.categoryId)
  const { lines, h } = nodeLines(t.node, cat, lang)
  const layout = layoutOf(t.node, view, isRoot)
  const kids = t.children.map((c) => size(c, doc, view, lang, false))
  let sw = NODE_W
  let sh = h
  let nx = 0
  if (kids.length && layout === 'v') {
    sw = Math.max(NODE_W, INDENT + Math.max(...kids.map((k) => k.sw)))
    sh = h + kids.reduce((s, k) => s + V_GAP + k.sh, 0)
  } else if (kids.length) {
    const rowW = kids.reduce((s, k) => s + k.sw, 0) + H_GAP * (kids.length - 1)
    // Uzel nad středem mezi prvním a posledním podřízeným uzlem.
    let acc = 0
    const centers = kids.map((k) => {
      const c = acc + k.nx + NODE_W / 2
      acc += k.sw + H_GAP
      return c
    })
    const mid = (centers[0] + centers[centers.length - 1]) / 2
    const offset = Math.max(0, NODE_W / 2 - mid)
    nx = Math.max(0, mid - NODE_W / 2)
    sw = Math.max(rowW + offset, nx + NODE_W)
    sh = h + BUS * 2 + Math.max(...kids.map((k) => k.sh))
  }
  return { t, h, lines, layout, kids, sw, sh, nx }
}

function place(s: Sized, x0: number, y0: number, doc: OrgDoc, out: ChartLayout) {
  const x = x0 + s.nx
  const cat = doc.categories.find((c) => c.id === s.t.node.categoryId)
  out.nodes.push({ node: s.t.node, cat, x, y: y0, w: NODE_W, h: s.h, lines: s.lines, layout: s.layout })
  if (!s.kids.length) return
  const bottom = y0 + s.h
  if (s.layout === 'v') {
    const lx = x + INDENT / 2
    let y = bottom + V_GAP
    let lastMid = bottom
    for (const k of s.kids) {
      const cx = x + INDENT
      place(k, cx, y, doc, out)
      lastMid = y + k.h / 2
      out.lines.push({ points: [[lx, lastMid], [cx + k.nx, lastMid]] })
      y += k.sh + V_GAP
    }
    out.lines.push({ points: [[lx, bottom], [lx, lastMid]] })
  } else {
    const busY = bottom + BUS
    const cx = x + NODE_W / 2
    let acc = 0
    const centers = s.kids.map((k) => {
      const c = acc + k.nx + NODE_W / 2
      acc += k.sw + H_GAP
      return c
    })
    const mid = (centers[0] + centers[centers.length - 1]) / 2
    const rowX = x0 + Math.max(0, NODE_W / 2 - mid)
    out.lines.push({ points: [[cx, bottom], [cx, busY]] })
    out.lines.push({ points: [[rowX + centers[0], busY], [rowX + centers[centers.length - 1], busY]] })
    let kx = rowX
    s.kids.forEach((k, i) => {
      place(k, kx, busY + BUS, doc, out)
      out.lines.push({ points: [[rowX + centers[i], busY], [rowX + centers[i], busY + BUS]] })
      kx += k.sw + H_GAP
    })
  }
}

export function layoutChart(doc: OrgDoc, view: string, lang: Lang, trees?: ViewTree[]): ChartLayout {
  const roots = (trees ?? buildViewTree(doc, view)).map((t) => size(t, doc, view, lang, true))
  const out: ChartLayout = { nodes: [], lines: [], width: 0, height: 0 }
  let x = 0
  for (const r of roots) {
    place(r, x, 0, doc, out)
    x += r.sw + H_GAP * 2
  }
  out.width = Math.max(NODE_W, x - H_GAP * 2)
  out.height = Math.max(MIN_H, ...roots.map((r) => r.sh))
  return out
}
