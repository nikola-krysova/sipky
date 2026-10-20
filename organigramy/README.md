# Organigramy SANBORN

Webová aplikace pro tvorbu organigramů podle grafického manuálu SANBORN (verze 2.0, srpen 2026).

Tvoříte jeden celkový organigram SANBORN se všemi závody. Každá pozice má barvu podle závodu
(Group, Velké Meziříčí, Brno, Znojmo, Externí) a z celkového organigramu se automaticky
rozseknou organigramy jednotlivých závodů.

## Spuštění

```bash
cd organigramy
npm install
npm run dev      # vývoj na http://localhost:5173
npm run build    # produkční build do organigramy/dist
```

Nasazení na Vercel: nový projekt ze stejného repozitáře, Root Directory `organigramy`,
framework Vite.

## Jak to funguje

- **Celkový organigram a závody.** Záložka SANBORN ukazuje všechny pozice. Záložky závodů
  ukazují pozice, které mají daný závod zaškrtnutý v poli „Zobrazit v organigramu závodu“.
  Výchozí nastavení: pozice závodu jen v jeho organigramu, pozice Group a Externí ve všech.
  Skrytá pozice zmizí a její podřízení se připojí k nejbližšímu viditelnému nadřízenému
  (např. „Obchodní oddělení Znojmo“ se v organigramu Znojma vynechá a obchodníci visí
  přímo pod vedoucím obchodu).
- **Úpravy.** Klik na pozici otevře panel vpravo. Přetažením myší pozici přesunete: na střed
  jiné pozice pod ni, na horní nebo dolní okraj vedle ní. Klávesy: Tab podřízená pozice,
  Enter pozice vedle, Delete smazat, Ctrl+Z zpět, Ctrl+Y znovu.
- **Uspořádání.** U pozice s podřízenými lze zvolit „Pod sebou“ nebo „Vedle sebe“, zvlášť
  pro celkový organigram a pro organigramy závodů.
- **Ukládání.** Každá změna se okamžitě ukládá do prohlížeče (IndexedDB).
- **Historie.** Každá změna se zapíše do historie (úpravy jedné pozice během dvou minut se
  sloučí). Libovolnou verzi lze zobrazit v náhledu a obnovit. Pojmenované verze
  (např. „Schváleno 11/2026“) se nikdy nepromazávají.
- **Tisk.** Tlačítko Tisk, PDF: formát A4 nebo A3, na šířku či na výšku, česky nebo anglicky,
  každý vybraný organigram na samostatný list. Dialog ukazuje nejmenší velikost písma.
- **Záloha.** Data jsou uložená jen v prohlížeči, ve kterém pracujete. Pro přenos na jiný
  počítač nebo jako zálohu použijte „Zálohovat do souboru“ a „Nahrát zálohu“ (JSON).

## Grafický manuál

- Písmo Arial, titulky Bold, labely verzálkami s prostrkáním 0,2 em.
- Barvy pouze z palety manuálu: firemní modrá `#084B87` pro pruh titulku, námořní `#05294C`
  pro linky a text, jasná modrá `#0591F2` pro akcenty. Barvy závodů se vybírají jen
  z modré škály 50 až 950 a neutrálů.
- Na jasné modré bílý text, na světlé modré námořní modrý text (kontrast 4,5:1).
- Logo s claimem v levém dolním rohu listu, šířka minimálně 30 mm.
- Bez pomlček v titulcích: „Organizační schéma, závod ZNOJMO“.
