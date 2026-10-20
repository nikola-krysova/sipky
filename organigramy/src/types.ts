export type Lang = 'cs' | 'en'

/** Barevná kategorie uzlu: závod (má vlastní organigram), Group nebo Externí. */
export interface Category {
  id: string
  nameCs: string
  nameEn: string
  fill: string
  text: string
  /** Přerušovaný rámeček (Externí). */
  dashed?: boolean
  /** Závod má vlastní organigram, do kterého se celkový organigram rozsekne. */
  isPlant: boolean
}

export type ChildLayout = 'v' | 'h'

export interface OrgNode {
  id: string
  parentId: string | null
  order: number
  titleCs: string
  titleEn: string
  /** Jméno; víc jmen na samostatných řádcích. */
  name: string
  categoryId: string
  /** Závody (id kategorií), v jejichž organigramu se uzel zobrazí. Celkový organigram ukazuje vše. */
  views: string[]
  /** Vlastní popisek lokality místo názvu kategorie, např. „Brno / Znojmo“. */
  labelCs?: string
  labelEn?: string
  /** Uspořádání podřízených pro konkrétní pohled ('all' nebo id závodu). */
  layout?: Record<string, ChildLayout>
}

export interface ViewMeta {
  titleCs: string
  titleEn: string
  docCode: string
  versionCs: string
  versionEn: string
  approvedCs: string
  approvedEn: string
}

export interface OrgDoc {
  schema: 1
  categories: Category[]
  nodes: Record<string, OrgNode>
  /** Hlavička a zápatí listu pro 'all' a pro každý závod. */
  views: Record<string, ViewMeta>
}

export const ALL_VIEW = 'all'

export type PageFormat = 'A4' | 'A3'
export type Orientation = 'landscape' | 'portrait'

export interface PageSpec {
  format: PageFormat
  orientation: Orientation
}

export function pageSize({ format, orientation }: PageSpec): { w: number; h: number } {
  const [a, b] = format === 'A3' ? [420, 297] : [297, 210]
  return orientation === 'landscape' ? { w: a, h: b } : { w: b, h: a }
}
