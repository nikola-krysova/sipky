import type { Category, OrgDoc, OrgNode, ViewMeta } from './types'

// Barvy z odvozené modré škály a neutrál grafického manuálu SANBORN (kap. 03).
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'group', nameCs: 'Group', nameEn: 'Group', fill: '#ECF6FF', text: '#05294C', isPlant: false },
  { id: 'vm', nameCs: 'Velké Meziříčí', nameEn: 'Velké Meziříčí', fill: '#A9DBFF', text: '#05294C', isPlant: true },
  { id: 'brno', nameCs: 'Brno', nameEn: 'Brno', fill: '#0591F2', text: '#FFFFFF', isPlant: true },
  { id: 'zn', nameCs: 'Znojmo', nameEn: 'Znojmo', fill: '#DDE3E8', text: '#05294C', isPlant: true },
  { id: 'ext', nameCs: 'Externí', nameEn: 'External', fill: '#FFFFFF', text: '#05294C', dashed: true, isPlant: false },
]

const VERSION_CS = 'VERZE 11/2026'
const VERSION_EN = 'VERSION 11/2026'
const APPROVED_CS = 'Schválil XX.11.2026 Jan Čáp, GŘ'
const APPROVED_EN = 'Approved on XX November 2026 by Jan Čáp, Managing Director & CEO'

export function defaultViewMeta(cat: Category | null, code: string): ViewMeta {
  if (!cat) {
    return {
      titleCs: 'Organizační schéma SANBORN',
      titleEn: 'Organisational Chart SANBORN',
      docCode: 'MGT_300 (Group)',
      versionCs: VERSION_CS,
      versionEn: VERSION_EN,
      approvedCs: APPROVED_CS,
      approvedEn: APPROVED_EN,
    }
  }
  const upper = cat.nameCs.includes(' ') ? cat.nameCs : cat.nameCs.toUpperCase()
  return {
    titleCs: `Organizační schéma, závod ${upper}`,
    titleEn: `Organisational Chart, ${upper} plant`,
    docCode: `MGT_300_${code}`,
    versionCs: VERSION_CS,
    versionEn: VERSION_EN,
    approvedCs: APPROVED_CS,
    approvedEn: APPROVED_EN,
  }
}

// [funkce CZ, funkce EN, jméno, kategorie, podřízení, volby]
type Opts = { views?: string[]; labelCs?: string; labelEn?: string; layout?: OrgNode['layout'] }
type S = [string, string, string, string, S[]?, Opts?]

const H = { layout: { all: 'h' as const } }

const TREE: S = ['Generální ředitel', 'CEO', 'Jan Čáp', 'group', [
  ['Obchodní ředitel', 'CSO', 'Tomáš Vrbka', 'group', [
    ['Vedoucí obchodu', 'Head of Sales', 'Martin Kučera', 'group', [
      ['Obchodní oddělení', 'Business Department', '', 'vm', [
        ['Obchodní manažer', 'Business Manager', 'Kateřina Novotná', 'vm'],
        ['Obchodní manažer', 'Business Manager', 'David Macháč', 'vm'],
        ['Obchodní manažer', 'Business Manager', 'Miroslav Pondělíček', 'vm'],
        ['Obchodní manažer', 'Business Manager', 'Miroslav Fic', 'vm'],
        ['Obchodně technický zástupce', 'Business and Technical Representative', 'Aleš Svoboda', 'vm'],
        ['Kalkulant', 'Cost Accountant', 'Bohuslav Rössler', 'vm'],
        ['Projektový manažer', 'Project Manager', 'Pavel Pešek', 'vm'],
        ['Back Office', 'Back Office', '', 'vm'],
      ], { views: [] }],
      ['Obchodní oddělení', 'Business Department', '', 'brno', [
        ['Obchodní manažer', 'Business Manager', 'Róbert Šarocký', 'brno'],
        ['Obchodní manažer', 'Business Manager', 'Jiří Richter', 'brno'],
        ['Kalkulant', 'Cost Accountant', 'Miroslav Čech', 'brno'],
        ['Back Office', 'Back Office', '', 'brno'],
      ], { views: [] }],
      ['Obchodní oddělení', 'Business Department', '', 'zn', [
        ['Obchodní manažer', 'Business Manager', 'Vlastimil Vrba', 'zn'],
        ['Obchodní manažer', 'Business Manager', 'Petr Schwarz', 'zn'],
        ['Kalkulant', 'Cost Accountant', 'Josef Semotam', 'zn'],
        ['Back Office', 'Back Office', '', 'zn'],
      ], { views: [] }],
    ], H],
    ['Obchodní manažer', 'Business Manager', 'Lubomír Svoboda', 'brno'],
    ['Logistika a celní deklarace', 'Logistics and Customs Declaration', '', 'vm'],
  ]],
  ['Finanční ředitel', 'CFO', 'Martin Chromý', 'group', [
    ['Účetní oddělení', 'Accounting Department', 'Marcela Schneiderová', 'zn', [
      ['Účetní', 'Accountant', 'Kateřina Dubová', 'zn'],
    ]],
    ['Účetní oddělení', 'Accounting Department', 'Miroslav Sysel', 'brno'],
    ['Účetní oddělení', 'Accounting Department', '', 'vm', [
      ['Finanční kontrolor', 'Financial Controller', 'Lukáš Pololáník', 'vm'],
      ['Účetní', 'Accountant', 'Magda Komínková', 'vm'],
      ['Účetní', 'Accountant', 'Jana Baráková', 'vm'],
    ]],
    ['Vedoucí nákupu', 'Purchasing Manager', 'Pavel Krejčí', 'group', [
      ['Nákup materiálu', 'Material Procurement', 'Leona Pospíšilová', 'vm'],
      ['Kooperace', 'Cooperation', 'Jitka Bublánová', 'vm'],
      ['Faktury, doprava', 'Invoicing, Transport', 'Jitka Kafková', 'vm'],
      ['Faktury', 'Invoicing', 'Eva Nedomová', 'vm', [], { views: ['vm', 'brno'] }],
      ['Nákup materiálu', 'Material Procurement', 'Radek Štolba', 'brno'],
      ['Technologické kooperace', 'Technological Cooperation', '', 'brno'],
      ['Nákup materiálu a kooperací', 'Material Procurement and Cooperation', 'Jana Konvalinová', 'zn'],
    ]],
    ['IT oddělení', 'IT Department', '', 'group', [
      ['IT specialista', 'IT Specialist', 'Silvestr Dvořák', 'vm'],
      ['IT specialista', 'IT Specialist', 'Libor Paleček', 'zn'],
      ['IT administrátor', 'IT Administrator', 'Vanessa Pejchlová', 'vm'],
    ]],
    ['Kantýna', 'Canteen', 'Pavla Poulová', 'vm'],
  ]],
  ['Personální a brand ředitelka', 'HR & Brand Director', 'Šárka Matyášková', 'group', [
    ['Personalistka/Mzdová účetní', 'Payroll Accountant and HR Officer', 'Gabriela Polová', 'vm'],
    ['HR Generalista & Employer Branding Specialista', 'HR Generalist & Employer Branding Specialist', 'Nikola Krýsová', 'vm'],
    ['HR Specialista', 'HR Specialist', 'Jana Pěťová', 'vm'],
    ['Personalistka/Mzdová účetní', 'Payroll Accountant and HR Officer', 'Eva Sedláková', 'brno'],
    ['Personalistka/Mzdová účetní', 'Payroll Accountant and HR Officer', 'Jitka Balíková', 'zn'],
  ]],
  ['Technický ředitel', 'CTO', 'Michal Koudela', 'group', [
    ['Technický manažer', 'Technical Manager', 'Jiří Valerián', 'vm', [
      ['Technologie', 'Technology', 'Jiří Kubíček', 'vm'],
      ['Konstrukce', 'Designing Section', 'Jitka Bednářová', 'vm'],
      ['Výdejna nástrojů', 'Tool Crib', 'Zdeněk Bambula', 'vm'],
    ]],
    ['Technický manažer', 'Technical Manager', 'Zdeněk Martinek', 'brno', [
      ['Technologie', 'Technology', '', 'brno'],
      ['Výdejna nástrojů', 'Tool Crib', 'Dušan Chrobák', 'brno'],
    ]],
    ['Technický manažer', 'Technical Manager', 'XX XX', 'zn', [
      ['Technologie', 'Technology', 'Markéta Nováková', 'zn'],
      ['Výdejna nástrojů', 'Tool Crib', 'Lenka Krulová', 'zn'],
    ]],
    ['CI manažer', 'CI Manager', 'Pavel Strašák', 'group'],
    ['CI manažer', 'CI Manager', 'Tomáš Pipa', 'group'],
    ['Specialista automatizace a robotizace', 'Automation and Robotics Specialist', 'Richard Spišák', 'group'],
  ]],
  ['Ředitel kvality', 'CQO', 'Martin Dolejší', 'group', [
    ['Manažer kvality', 'Quality Manager', 'Zdeněk Jůda', 'vm', [
      ['Technická kontrola', 'Technical Inspection', 'Jiří Bojanovský', 'vm'],
      ['Dokum. kontrola', 'Document Inspection', 'Pavlína Hošková', 'vm'],
      ['Kontrolní a měřové středisko', 'Inspection and Calibration Centre', 'Radek Dočekal', 'vm'],
      ['Dodavatelská kvalita', 'Supplier Quality Engineer', 'Jiří Pokorný', 'vm'],
    ]],
    ['Manažer kvality', 'Quality Manager', 'Michal Krištof', 'brno', [
      ['Vedoucí oddělení kontroly', 'Inspection Department Manager', 'Jiří Buryánek', 'brno'],
    ]],
    ['Manažer zákaznické kvality', 'Customer Quality Manager', 'Petr Šebela', 'brno', [],
      { views: ['brno', 'zn'], labelCs: 'Brno / Znojmo', labelEn: 'Brno / Znojmo' }],
    ['Manažer kvality', 'Quality Manager', 'Ivan Chobot', 'zn', [
      ['Vedoucí oddělení kontroly', 'Inspection Department Manager', 'Petr Celnar', 'zn'],
    ]],
    ['EHS specialista', 'EHS Specialist', 'Radek Kronovet', 'group'],
    ['BOZP + PO', 'OHS + Fire Protection', '', 'ext'],
  ]],
  ['Provozní ředitel', 'COO', 'Petr Pospěch', 'group', [
    ['Manažer provozu', 'Operations Manager', 'Roman Zouhar', 'vm', [
      ['Manažer plánování', 'Planning Manager', 'Vladimír Marek', 'vm', [
        ['Plánování výroby', 'Production Planning', '', 'vm'],
        ['Výrobní technologie', 'Production Technology', 'Pavel Mahel', 'vm'],
      ]],
      ['Výrobní úsek', 'Production Department', '', 'vm', [
        ['Výrobní stř. 51', 'Production Centre No. 51', 'Josef Pernička', 'vm'],
        ['Výrobní stř. 52', 'Production Centre No. 52', 'Jakub Komínek', 'vm'],
        ['Výrobní stř. 53', 'Production Centre No. 53', 'Stanislav Šašek\nBohuslav Pešek', 'vm'],
        ['Výrobní stř. 54', 'Production Centre No. 54', 'Milan Joura', 'vm', [
          ['Nástrojárna', 'Tool Room', '', 'vm'],
        ]],
        ['Řezárna, sklad materiálu, stř. 41', 'Cutting Room, Material Warehouse, Centre No. 41', 'Josef Rohovský', 'vm'],
      ]],
      ['Údržba a správa majetku, stř. 50', 'Maintenance and Asset Administration, No. 50', 'Martin Sodomka', 'vm', [
        ['Recepce', 'Reception Desk', '', 'vm'],
        ['Údržba strojní a elektro', 'Machinery and Electrical Maintenance', '', 'vm'],
      ]],
      ['Expedice', 'Shipping Department', 'Jana Vítová', 'vm'],
    ]],
    ['Manažer provozu', 'Operations Manager', 'Hynek Sadovský', 'brno', [
      ['Koordinace zakázek', 'Order Coordination', 'Roman Emelin', 'brno'],
      ['Výrobní úsek', 'Production', 'Ondřej Kaláb', 'brno'],
      ['Údržba', 'Maintenance', 'Filip Kalousek', 'brno'],
      ['Logistika a sklad', 'Logistics and Warehouse', 'Lenka Karásková', 'brno'],
    ]],
    ['Manažer provozu', 'Operations Manager', 'Tomáš Škrobálek', 'zn', [
      ['Plánování výroby', 'Production Planning', 'Petr Klaudinger', 'zn'],
      ['Výrobní úsek', 'Production', '', 'zn', [
        ['Výrobní stř. 331', 'Production Centre No. 331', 'Tapšíková Jana', 'zn'],
        ['Výrobní stř. 334', 'Production Centre No. 334', 'Veselý Marek', 'zn'],
        ['Výrobní stř. 335', 'Production Centre No. 335', 'Klika Marek', 'zn', [
          ['Nástrojárna', 'Tool Room', '', 'zn'],
        ]],
      ]],
      ['Údržba', 'Maintenance', 'Marek Blatný', 'zn'],
      ['Logistika', 'Logistics', 'Veronika Kroupová', 'zn', [
        ['Logistika', 'Logistics', '', 'zn'],
        ['Sklad a řezárna', 'Warehouse and Cutting Room', '', 'zn'],
      ]],
    ]],
  ], H],
  ['Projektový manažer', 'Project Manager', 'František Schossmeier', 'group', [
    ['Kapacitní kooperace', 'Capacity Subcontracting', '', 'group', [
      ['Kapacitní kooperace', 'Capacity Subcontracting', 'Lukáš Sosík', 'brno'],
    ]],
  ]],
], H]

export function defaultViewsFor(categoryId: string, categories: Category[]): string[] {
  const cat = categories.find((c) => c.id === categoryId)
  if (cat?.isPlant) return [cat.id]
  return categories.filter((c) => c.isPlant).map((c) => c.id)
}

export function createSeedDoc(): OrgDoc {
  const nodes: Record<string, OrgNode> = {}
  let n = 0
  const add = (s: S, parentId: string | null, order: number) => {
    const [titleCs, titleEn, name, categoryId, children = [], opts = {}] = s
    const id = `n${++n}`
    nodes[id] = {
      id,
      parentId,
      order,
      titleCs,
      titleEn,
      name,
      categoryId,
      views: opts.views ?? defaultViewsFor(categoryId, DEFAULT_CATEGORIES),
      labelCs: opts.labelCs,
      labelEn: opts.labelEn,
      layout: opts.layout,
    }
    children.forEach((c, i) => add(c, id, i))
  }
  add(TREE, null, 0)
  const codes: Record<string, string> = { vm: 'VM', brno: 'BN', zn: 'ZN' }
  const views: Record<string, ViewMeta> = { all: defaultViewMeta(null, '') }
  for (const c of DEFAULT_CATEGORIES.filter((c) => c.isPlant)) views[c.id] = defaultViewMeta(c, codes[c.id])
  return { schema: 1, categories: DEFAULT_CATEGORIES, nodes, views }
}

/** Prázdný organigram jen s generálním ředitelem. */
export function createBlankDoc(): OrgDoc {
  const seed = createSeedDoc()
  const root = Object.values(seed.nodes).find((n) => !n.parentId)!
  return { ...seed, nodes: { [root.id]: { ...root, name: '' } } }
}
