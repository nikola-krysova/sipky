import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PrintJob } from './Panels'
import { Sheet } from './Sheet'
import { pageSize, type OrgDoc } from './types'

// Vektorové PDF přímo v aplikaci (tisk z prohlížeče v okně claude.ai nefunguje spolehlivě).
// Písmo Liberation Sans má stejné rozměry jako Arial a obsahuje českou diakritiku.

async function fetchBase64(url: string): Promise<string> {
  const buf = await (await fetch(url)).arrayBuffer()
  let bin = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export async function buildPdf(doc: OrgDoc, job: PrintJob): Promise<Blob> {
  const [{ jsPDF }, , regular, bold, logo] = await Promise.all([
    import('jspdf'),
    import('svg2pdf.js'),
    fetchBase64('./fonts/LiberationSans-Regular.ttf'),
    fetchBase64('./fonts/LiberationSans-Bold.ttf'),
    fetchBase64('./logo.png'),
  ])

  const first = pageSize(job.sheets[0].page)
  const pdf = new jsPDF({
    unit: 'mm',
    format: [first.w, first.h],
    orientation: first.w > first.h ? 'landscape' : 'portrait',
    compress: true,
  })
  pdf.addFileToVFS('LiberationSans-Regular.ttf', regular)
  pdf.addFileToVFS('LiberationSans-Bold.ttf', bold)
  pdf.addFont('LiberationSans-Regular.ttf', 'Arial', 'normal')
  pdf.addFont('LiberationSans-Bold.ttf', 'Arial', 'bold')
  pdf.setFont('Arial', 'normal')
  pdf.setProperties({ title: 'Organigram SANBORN', creator: 'Organigramy SANBORN' })

  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-100000px;top:0;width:10px;height:10px;overflow:hidden'
  document.body.appendChild(host)
  try {
    for (const [i, sh] of job.sheets.entries()) {
      const { w, h } = pageSize(sh.page)
      if (i > 0) pdf.addPage([w, h], w > h ? 'landscape' : 'portrait')
      host.innerHTML = renderToStaticMarkup(
        createElement(Sheet, { doc, view: sh.view, lang: job.lang, page: sh.page, trees: sh.trees, part: sh.part }),
      )
      const svg = host.querySelector('svg')!
      svg.setAttribute('font-family', 'Arial')
      svg.setAttribute('width', `${w}`)
      svg.setAttribute('height', `${h}`)
      for (const img of svg.querySelectorAll('image')) img.setAttribute('href', `data:image/png;base64,${logo}`)
      for (const el of svg.querySelectorAll('.no-print')) el.remove()
      await pdf.svg(svg, { x: 0, y: 0, width: w, height: h })
    }
  } finally {
    host.remove()
  }
  return pdf.output('blob')
}

type Downloads = { save(r: { filename: string; data: Blob | string }): Promise<unknown> }
type ClaudeUse = { use(name: string): Promise<unknown> }

/** Uloží soubor: na claude.ai přes potvrzovací dialog platformy, jinde klasickým stažením. */
export async function saveFile(filename: string, data: Blob): Promise<void> {
  const claude = (window as unknown as { claude?: ClaudeUse }).claude
  const downloads = claude?.use ? ((await claude.use('downloads').catch(() => null)) as Downloads | null) : null
  if (downloads) {
    try {
      await downloads.save({ filename, data })
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'declined') return
      throw e
    }
    return
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(data)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}
