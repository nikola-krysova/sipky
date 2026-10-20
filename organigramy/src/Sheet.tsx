import { useMemo } from 'react'
import { FONT, FONT_SIZES, layoutChart, NODE_W } from './layout'
import { ALL_VIEW, pageSize, type Lang, type OrgDoc, type PageSpec } from './types'

export const BRAND = {
  navy: '#05294C',
  corporate: '#084B87',
  bright: '#0591F2',
  black: '#0E1B26',
  gray: '#6B7C8C',
  light: '#F4F6F8',
  hairline: '#DDE3E8',
}

export interface DropHint {
  targetId: string
  mode: 'before' | 'after' | 'child'
}

interface Props {
  doc: OrgDoc
  view: string
  lang: Lang
  page: PageSpec
  selectedId?: string | null
  dragId?: string | null
  drop?: DropHint | null
  className?: string
  style?: React.CSSProperties
}

const PT_PER_MM = 72 / 25.4

export function sheetGeometry(page: PageSpec) {
  const { w, h } = pageSize(page)
  const k = Math.min(w, h) / 297
  const m = 12 * k
  const barH = 15 * k
  const legendH = 5.5 * k
  const legendY = m + barH + 3 * k
  const footerH = 17 * k
  const area = { x: m, y: legendY + legendH + 6 * k, w: w - 2 * m, h: 0 }
  area.h = h - m - footerH - area.y
  return { w, h, k, m, barH, legendH, legendY, footerH, area }
}

// Graf se vejde do plochy listu, ale nezvětší se nad rozumnou velikost uzlu (cca 46 mm na A3).
function chartScale(g: ReturnType<typeof sheetGeometry>, chart: { width: number; height: number }) {
  return Math.min(g.area.w / chart.width, g.area.h / chart.height, (46 * g.k) / NODE_W)
}

/** Nejmenší výška písma na vytištěném listu v bodech. */
export function minFontPt(doc: OrgDoc, view: string, lang: Lang, page: PageSpec): number {
  const s = chartScale(sheetGeometry(page), layoutChart(doc, view, lang))
  return FONT_SIZES.label * s * PT_PER_MM
}

export function Sheet({ doc, view, lang, page, selectedId, dragId, drop, className, style }: Props) {
  const g = sheetGeometry(page)
  const { w, h, k, m, barH } = g
  const chart = useMemo(() => layoutChart(doc, view, lang), [doc, view, lang])
  const meta = doc.views[view] ?? doc.views[ALL_VIEW]
  const title = lang === 'cs' ? meta.titleCs : meta.titleEn
  const version = lang === 'cs' ? meta.versionCs : meta.versionEn
  const approved = lang === 'cs' ? meta.approvedCs : meta.approvedEn

  const s = chartScale(g, chart)
  const ox = g.area.x + (g.area.w - chart.width * s) / 2
  const oy = g.area.y
  const stroke = Math.max(0.8, (0.18 * k) / s)

  const usedCats = new Set(chart.nodes.map((n) => n.node.categoryId))
  const legend = doc.categories.filter((c) => usedCats.has(c.id))
  const chipW = 24 * k
  const chipGap = 1.5 * k
  const legendX0 = w - m - legend.length * chipW - (legend.length - 1) * chipGap

  const logoW = Math.max(31 * k, 30)
  const logoH = (logoW * 244) / 690

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      style={style}
      fontFamily={FONT}
    >
      <rect x={0} y={0} width={w} height={h} fill="#FFFFFF" />

      <rect x={m} y={m} width={w - 2 * m} height={barH} fill={BRAND.corporate} />
      <text x={m + 7 * k} y={m + barH / 2 + 2.5 * k} fill="#FFFFFF" fontWeight="bold" fontSize={7 * k}>
        {title}
      </text>
      <text
        x={w - m - 6 * k}
        y={m + barH / 2 + 0.9 * k}
        fill="#FFFFFF"
        fontWeight="bold"
        fontSize={2.4 * k}
        letterSpacing={0.48 * k}
        textAnchor="end"
      >
        {version.toLocaleUpperCase(lang)}
      </text>

      {legend.map((c, i) => (
        <g key={c.id} transform={`translate(${legendX0 + i * (chipW + chipGap)} ${g.legendY})`}>
          <rect
            width={chipW}
            height={g.legendH}
            fill={c.fill}
            stroke={BRAND.navy}
            strokeWidth={0.2 * k}
            strokeDasharray={c.dashed ? `${0.8 * k} ${0.6 * k}` : undefined}
          />
          <text x={chipW / 2} y={g.legendH / 2 + 0.85 * k} fontSize={2.4 * k} fill={c.text} textAnchor="middle">
            {lang === 'cs' ? c.nameCs : c.nameEn}
          </text>
        </g>
      ))}

      <g transform={`translate(${ox} ${oy}) scale(${s})`}>
        {chart.lines.map((l, i) => (
          <polyline
            key={i}
            points={l.points.map((p) => p.join(',')).join(' ')}
            fill="none"
            stroke={BRAND.navy}
            strokeWidth={stroke}
          />
        ))}
        {chart.nodes.map((p) => {
          const selected = p.node.id === selectedId
          const isDrop = drop?.targetId === p.node.id
          return (
            <g
              key={p.node.id}
              data-node-id={p.node.id}
              transform={`translate(${p.x} ${p.y})`}
              opacity={dragId === p.node.id ? 0.4 : 1}
            >
              <rect
                width={p.w}
                height={p.h}
                rx={6}
                fill={p.cat?.fill ?? '#FFFFFF'}
                stroke={BRAND.navy}
                strokeWidth={stroke}
                strokeDasharray={p.cat?.dashed ? `${stroke * 4} ${stroke * 3}` : undefined}
              />
              {p.lines.map((l, i) => (
                <text
                  key={i}
                  x={p.w / 2}
                  y={l.y}
                  fontSize={l.size}
                  fontWeight={l.bold ? 'bold' : 'normal'}
                  fill={p.cat?.text ?? BRAND.black}
                  textAnchor="middle"
                >
                  {l.text}
                </text>
              ))}
              {selected && (
                <rect
                  className="no-print"
                  x={-4}
                  y={-4}
                  width={p.w + 8}
                  height={p.h + 8}
                  rx={8}
                  fill="none"
                  stroke={BRAND.bright}
                  strokeWidth={2.4}
                />
              )}
              {isDrop && drop.mode === 'child' && (
                <rect x={-3} y={-3} width={p.w + 6} height={p.h + 6} rx={8} fill="none" stroke={BRAND.bright} strokeWidth={3} strokeDasharray="6 4" />
              )}
              {isDrop && drop.mode !== 'child' && (
                <line
                  x1={-6}
                  x2={p.w + 6}
                  y1={drop.mode === 'before' ? -5 : p.h + 5}
                  y2={drop.mode === 'before' ? -5 : p.h + 5}
                  stroke={BRAND.bright}
                  strokeWidth={3.5}
                />
              )}
            </g>
          )
        })}
      </g>

      <image href="./logo.png" x={m} y={h - m - logoH} width={logoW} height={logoH} />
      <text x={w - m} y={h - m - 5 * k} fontSize={3.4 * k} fontWeight="bold" fill={BRAND.black} textAnchor="end">
        {meta.docCode}
      </text>
      <text x={w - m} y={h - m} fontSize={2.8 * k} fill={BRAND.gray} textAnchor="end">
        {approved}
      </text>
    </svg>
  )
}
