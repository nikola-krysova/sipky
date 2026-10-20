import { useEffect, useState } from 'react'
import type { OrgDoc, OrgNode } from './types'

// Překlad názvů funkcí do angličtiny přes Clauda (capability `sample` na claude.ai).

type Sampler = {
  json<T>(input: string, opts?: { modelTier?: 'quick' | 'default' | 'complex'; cache?: boolean }): Promise<T>
}
type ClaudeUse = { use(name: string): Promise<unknown> }

let sampler: Promise<Sampler | null> | null = null
function getSampler(): Promise<Sampler | null> {
  if (!sampler) {
    const claude = (window as unknown as { claude?: ClaudeUse }).claude
    sampler = claude?.use ? (claude.use('sample') as Promise<Sampler | null>).catch(() => null) : Promise.resolve(null)
  }
  return sampler
}

/** null = ještě se zjišťuje, false = překlad není k dispozici. */
export function useTranslateAvailable(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    getSampler().then((s) => setOk(!!s))
  }, [])
  return ok
}

/** Anglický název chybí, nebo se od posledního překladu změnil český. */
export function enStale(n: OrgNode): boolean {
  if (!n.titleCs.trim()) return false
  if (!n.titleEn.trim()) return true
  return n.enFor !== undefined && n.enFor !== n.titleCs
}

export class TranslateError extends Error {
  constructor(public code: string) {
    super(code)
  }
}

export const translateErrorText = (code: string) =>
  code === 'not_granted' || code === 'sampling_disabled'
    ? 'Automatický překlad není povolený. Povolte ho v oprávněních stránky.'
    : code === 'rate_limited'
      ? 'Příliš mnoho požadavků, zkuste to za chvíli.'
      : 'Překlad se nepodařil, zkuste to znovu.'

/** Přeloží názvy funkcí; vrací mapu id → anglický název. */
export async function translateTitles(doc: OrgDoc, ids: string[]): Promise<Record<string, string>> {
  const s = await getSampler()
  if (!s) throw new TranslateError('not_granted')
  const items = Object.fromEntries(ids.map((id) => [id, doc.nodes[id].titleCs]))
  // Ustálené překlady z organigramu, aby byla terminologie jednotná.
  const glossary = new Map<string, string>()
  for (const n of Object.values(doc.nodes)) {
    if (!ids.includes(n.id) && n.titleEn.trim() && !enStale(n)) glossary.set(n.titleCs, n.titleEn)
  }
  const prompt = [
    'Translate Czech job titles from the organisational chart of SANBORN, a Czech manufacturer of precision machined parts, into British English as used in corporate org charts.',
    'Rules: keep it short like a job title; British spelling (Centre, Organisation); keep abbreviations such as CI, IT, EHS, CEO; translate BOZP as OHS and PO as Fire Protection; no en or em dashes, use a comma instead; no full stop at the end.',
    'Use the existing translations below for consistency when a title or part of it matches.',
    '',
    'Existing translations (Czech => English):',
    ...[...glossary].slice(0, 120).map(([cs, en]) => `${cs} => ${en}`),
    '',
    'Titles to translate, as a JSON object {id: Czech title}:',
    JSON.stringify(items),
    '',
    'Reply with only a JSON object mapping each id to its English title, e.g. {"n12": "Quality Manager"}.',
  ].join('\n')
  try {
    const out = await s.json<Record<string, unknown>>(prompt, { modelTier: 'quick', cache: false })
    const res: Record<string, string> = {}
    for (const id of ids) if (typeof out?.[id] === 'string' && (out[id] as string).trim()) res[id] = (out[id] as string).trim()
    return res
  } catch (e) {
    throw new TranslateError((e as { code?: string })?.code ?? 'upstream_error')
  }
}
