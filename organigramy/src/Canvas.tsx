import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { descendants } from './ops'
import { Sheet, type DropHint } from './Sheet'
import { pageSize, type Lang, type OrgDoc, type PageSpec } from './types'

const PX_PER_MM = 96 / 25.4

interface Props {
  doc: OrgDoc
  view: string
  lang: Lang
  page: PageSpec
  selectedId: string | null
  readOnly?: boolean
  flagIds?: Set<string>
  onSelect: (id: string | null) => void
  onMove: (id: string, hint: DropHint) => void
}

export function Canvas({ doc, view, lang, page, selectedId, readOnly, flagIds, onSelect, onMove }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const { w, h } = pageSize(page)
  const [zoom, setZoom] = useState(1)
  const [fitted, setFitted] = useState(false)
  const [drag, setDrag] = useState<{ id: string; drop: DropHint | null } | null>(null)
  const gesture = useRef<{
    kind: 'pan' | 'node'
    id?: string
    x: number
    y: number
    sl: number
    st: number
    moved: boolean
  } | null>(null)

  const fit = useCallback(() => {
    const el = wrap.current
    if (!el) return
    const z = Math.min((el.clientWidth - 48) / (w * PX_PER_MM), (el.clientHeight - 48) / (h * PX_PER_MM))
    setZoom(Math.max(0.1, z))
  }, [w, h])

  useLayoutEffect(() => {
    if (!fitted && wrap.current) {
      fit()
      setFitted(true)
    }
  }, [fit, fitted])

  useEffect(() => {
    fit()
  }, [page.format, page.orientation, fit])

  const zoomAt = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      const el = wrap.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const px = cx ?? rect.left + el.clientWidth / 2
      const py = cy ?? rect.top + el.clientHeight / 2
      const contentX = el.scrollLeft + px - rect.left
      const contentY = el.scrollTop + py - rect.top
      setZoom((z) => {
        const nz = Math.min(8, Math.max(0.1, z * factor))
        const r = nz / z
        requestAnimationFrame(() => {
          el.scrollLeft = contentX * r - (px - rect.left)
          el.scrollTop = contentY * r - (py - rect.top)
        })
        return nz
      })
    },
    [],
  )

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      zoomAt(Math.exp(-e.deltaY * 0.0025), e.clientX, e.clientY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const hitTest = (x: number, y: number, dragId: string): DropHint | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-node-id]') as SVGGElement | null
    const id = el?.dataset.nodeId
    if (!el || !id || id === dragId || descendants(doc, dragId).has(id)) return null
    const r = el.querySelector('rect')!.getBoundingClientRect()
    const rel = (y - r.top) / r.height
    const mode = rel < 0.28 ? 'before' : rel > 0.72 ? 'after' : 'child'
    if (mode !== 'child' && !doc.nodes[id].parentId) return { targetId: id, mode: 'child' }
    return { targetId: id, mode }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const el = wrap.current!
    const nodeEl = (e.target as Element).closest('[data-node-id]') as SVGGElement | null
    gesture.current = {
      kind: nodeEl && !readOnly ? 'node' : 'pan',
      id: nodeEl?.dataset.nodeId,
      x: e.clientX,
      y: e.clientY,
      sl: el.scrollLeft,
      st: el.scrollTop,
      moved: false,
    }
    el.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (!g.moved && Math.hypot(dx, dy) < 5) return
    g.moved = true
    if (g.kind === 'pan') {
      wrap.current!.scrollLeft = g.sl - dx
      wrap.current!.scrollTop = g.st - dy
    } else if (g.id) {
      setDrag({ id: g.id, drop: hitTest(e.clientX, e.clientY, g.id) })
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current
    gesture.current = null
    wrap.current?.releasePointerCapture(e.pointerId)
    if (!g) return
    if (!g.moved) {
      onSelect(g.id ?? null)
    } else if (g.kind === 'node' && g.id) {
      const hint = hitTest(e.clientX, e.clientY, g.id)
      if (hint) onMove(g.id, hint)
      onSelect(g.id)
    }
    setDrag(null)
  }

  return (
    <div className="canvas-wrap">
      <div
        ref={wrap}
        className={`canvas ${drag ? 'dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          gesture.current = null
          setDrag(null)
        }}
      >
        <div className="sheet-holder" style={{ width: w * PX_PER_MM * zoom + 48, height: h * PX_PER_MM * zoom + 48 }}>
          <Sheet
            doc={doc}
            view={view}
            lang={lang}
            page={page}
            selectedId={selectedId}
            dragId={drag?.id}
            drop={drag?.drop}
            flagIds={flagIds}
            className="sheet"
            style={{ width: w * PX_PER_MM * zoom, height: h * PX_PER_MM * zoom }}
          />
        </div>
      </div>
      <div className="zoom-controls">
        <button type="button" onClick={() => zoomAt(1 / 1.25)} title="Oddálit">
          −
        </button>
        <span>{Math.round(zoom * 100)} %</span>
        <button type="button" onClick={() => zoomAt(1.25)} title="Přiblížit">
          +
        </button>
        <button type="button" onClick={fit} title="Celý list">
          Celý list
        </button>
      </div>
    </div>
  )
}
