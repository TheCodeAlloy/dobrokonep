const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, LevelFormat, Footer, PageNumber, ExternalHyperlink, PageBreak,
  TableOfContents
} = require('docx');

const KORAL = 'C4524E', TMAVA = '2A2121', SEDA = '6E6262', SVETLA = 'FBE9E8', ZELENA = 'E6F2EC', ZLUTA = 'FFF3D6';
const SIRKA = 9026; // A4 s okraji 1 palec
const WEB = 'https://thecodealloy.github.io/dobrokonep/';

// ---------- pomocné stavební bloky ----------
function runs(text, opts = {}) {
  // **tučně** uvnitř textu
  return String(text).split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(t =>
    t.startsWith('**') ? new TextRun({ text: t.slice(2, -2), bold: true, ...opts }) : new TextRun({ text: t, ...opts }));
}
const P = (text, opts = {}) => new Paragraph({ children: runs(text), spacing: { after: 120, line: 288 }, ...opts });
const H1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)], pageBreakBefore: false });
const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const H3 = t => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });
const B = (text, level = 0) => new Paragraph({ numbering: { reference: 'odrazky', level }, children: runs(text), spacing: { after: 60, line: 276 } });
let cisloSeznamu = 0;
function N(items) { // číslovaný seznam, každý seznam od 1
  const ref = 'cisla' + (++cisloSeznamu);
  NUMBERINGS.push({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] });
  return items.map(t => new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(t), spacing: { after: 60, line: 276 } }));
}
const NUMBERINGS = [{ reference: 'odrazky', levels: [
  { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } },
  { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1000, hanging: 300 } } } }
] }];

const okraj = { style: BorderStyle.SINGLE, size: 4, color: 'E6D6D5' };
const okraje = { top: okraj, bottom: okraj, left: okraj, right: okraj };
function cell(content, width, opts = {}) {
  const deti = (Array.isArray(content) ? content : [content]).map(c => typeof c === 'string'
    ? new Paragraph({ children: runs(c, opts.bold ? { bold: true } : {}), spacing: { after: 40 } }) : c);
  return new TableCell({
    children: deti, width: { size: width, type: WidthType.DXA }, borders: okraje,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 }
  });
}
function tabulka(sloupce, hlavicka, radky) {
  const celkem = sloupce.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: celkem, type: WidthType.DXA }, columnWidths: sloupce,
    rows: [new TableRow({ tableHeader: true, children: hlavicka.map((h, i) => cell(h, sloupce[i], { fill: SVETLA, bold: true })) })]
      .concat(radky.map(r => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, sloupce[i])) })))
  });
}
function box(nadpis, texty, fill = ZELENA) {
  const obsah = [new Paragraph({ children: [new TextRun({ text: nadpis, bold: true })], spacing: { after: 60 } })]
    .concat(texty.map(t => new Paragraph({ children: runs(t), spacing: { after: 40, line: 276 } })));
  return new Table({ width: { size: SIRKA, type: WidthType.DXA }, columnWidths: [SIRKA],
    rows: [new TableRow({ children: [new TableCell({ children: obsah, width: { size: SIRKA, type: WidthType.DXA },
      shading: { fill: fill, type: ShadingType.CLEAR, color: 'auto' },
      borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.SINGLE, size: 24, color: KORAL } },
      margins: { top: 120, bottom: 120, left: 200, right: 200 } })] })] });
}
const mezera = () => new Paragraph({ children: [], spacing: { after: 80 } });
const odkaz = (text, url) => new Paragraph({ spacing: { after: 60 }, children: [new ExternalHyperlink({ link: url, children: [new TextRun({ text, style: 'Hyperlink' })] })] });

// ---------- obsah ----------
const obsah = [];
const add = (...x) => x.forEach(i => Array.isArray(i) ? obsah.push(...i) : obsah.push(i));

// Titulní strana
add(
  new Paragraph({ spacing: { before: 2400, after: 120 }, children: [new TextRun({ text: 'Dobrovolnické centrum', color: KORAL, bold: true, size: 28 })] }),
  new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: 'Dobrovolnický systém', bold: true, size: 56, color: TMAVA })] }),
  new Paragraph({ spacing: { after: 600 }, children: [new TextRun({ text: 'Návod k vyzkoušení pro koordinátorky', size: 32, color: SEDA })] }),
  P('Tento návod popisuje, jak systém v současné podobě funguje, co v něm najdete, co se dá nastavit a co si doporučujeme vyzkoušet. Systém je ve zkušebním provozu – budeme rádi za každou připomínku.'),
  P('Stav k 22. 10. 2026', { children: [new TextRun({ text: 'Stav k 22. 10. 2026', color: SEDA })] }),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Obsah', bold: true, size: 34, color: KORAL })] }),
  ...['1. Co systém umí', '2. Přihlášení do dashboardu', '3. Registrační formulář', '4. Dashboard (Přehled, Dobrovolníci, Detail, Hodiny, Administrace)',
    '5. Portál dobrovolníka', '6. Co doporučujeme vyzkoušet (kontrolní seznam)', '7. Časté otázky'].map(t => new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: t, size: 24 })] })),
  new Paragraph({ children: [new PageBreak()] })
);

// 1. Přehled
add(H1('1. Co systém umí'),
  P('Systém slouží k evidenci zájemců o dobrovolnictví, dobrovolníků a jejich odpracovaných hodin. Má tři části, každou na vlastní webové adrese:'),
  tabulka([2300, 3600, 3126], ['Část', 'K čemu slouží', 'Kdo ji používá'], [
    ['**Registrační formulář**', 'Zájemce o dobrovolnictví vyplní své údaje. Odkaz je na webu organizace.', 'Veřejnost'],
    ['**Dashboard**', 'Správa zájemců a dobrovolníků, schůzky, dokumenty, hodiny, nastavení systému.', 'Koordinátorky a správci'],
    ['**Portál dobrovolníka**', 'Dobrovolník si zapisuje hodiny a vidí svůj přehled. Funguje na mobilu i na počítači.', 'Aktivní dobrovolníci']
  ]),
  mezera(),
  P('Všechna data se ukládají do jedné tabulky Google a dokumenty (registrace, smlouvy) do složek na Disku Google. Tabulka se každou noc automaticky zálohuje.'),
  H2('Adresy'),
  tabulka([2300, 6726], ['Část', 'Adresa'], [
    ['Registrační formulář', WEB],
    ['Dashboard', WEB + 'dashboard.html'],
    ['Portál dobrovolníka', WEB + 'hodiny.html']
  ]),
  mezera(),
  box('Tip', ['Dashboard si uložte do záložek prohlížeče. Na mobilu si můžete dashboard i portál přidat na plochu jako aplikaci (v prohlížeči nabídka „Přidat na plochu“).'])
);

// 2. Přihlášení
add(H1('2. Přihlášení do dashboardu'),
  P('Do dashboardu se dostane jen ten, kdo je zapsaný v seznamu administrátorů (Administrace → Administrátoři) a má nastaveno Aktivní = ANO. Přidá vás tam hlavní správce systému. Hesla se nepoužívají.'),
  H3('Způsoby přihlášení'),
  B('**Přihlásit přes Google** – jedno kliknutí, pokud jste v prohlížeči přihlášená ke svému účtu Google a váš e-mail je v seznamu administrátorů.'),
  B('**E-mailem** – zadáte svůj e-mail a přijde vám zpráva s tlačítkem „Přihlásit se do dashboardu“ a šestimístným kódem. Stačí klepnout na tlačítko, nebo kód opsat. Kód i tlačítko platí 10 minut.'),
  B('**Z notifikace o novém zájemci** – odkaz v e-mailu vás rovnou přihlásí a otevře detail zájemce. Odkaz platí 3 dny.'),
  P('Po přihlášení si vás prohlížeč pamatuje (výchozí nastavení 30 dní). Odhlásit se můžete v levém menu.'),
  H3('Role'),
  tabulka([2300, 6726], ['Role', 'Co smí'], [
    ['**Hlavní admin**', 'Všechno včetně nastavení systému, správy administrátorů, šablon e-mailů a mazání záznamů.'],
    ['**Koordinátor**', 'Pracuje s dobrovolníky, schůzkami, dokumenty a hodinami; upravuje organizace, činnosti, místa a oblasti zájmu.'],
    ['**Jen čtení**', 'Data si pouze prohlíží.']
  ]),
  mezera(),
  box('Když se nedaří přihlásit', [
    'E-mail s kódem nepřišel → zkontrolujte složku Spam, po minutě si vyžádejte nový.',
    'Stránka vypadá jinak než v návodu → obnovte ji klávesami Ctrl+F5. Dole v přihlašovacím okně je malým písmem uvedena verze.'
  ], ZLUTA)
);

// 3. Registrace
add(H1('3. Registrační formulář'),
  P('Formulář obsahuje: jméno, příjmení, titul, datum narození, trvalé bydliště (ulice a č. p., město, PSČ), telefon, e-mail, současné zaměstnání nebo studium, nejvyšší dokončené vzdělání, zájmy a dovednosti a souhlas se zpracováním osobních údajů.'),
  H3('Co se stane po odeslání'),
  N([
    'Zájemce dostane **registrační číslo** (např. DC-2026-0001), které ho provází celým systémem.',
    'Údaje se uloží do tabulky se stavem **Nový zájemce**.',
    'Vytvoří se **PDF s registrací** do složky Registrace a osobní složka zájemce ve složce Dobrovolníci.',
    'Zájemci přijde **děkovný e-mail** (bez osobních údajů).',
    'Administrátorům s nastavenou notifikací přijde **upozornění** s odkazem rovnou na detail zájemce.'
  ]),
  P('Nadpis a úvodní text formuláře se mění v Administraci → Nastavení (položky nadpis_formulare a uvodni_text_formulare).')
);

// 4. Dashboard
add(H1('4. Dashboard'),
  P('V levém menu (na mobilu nahoře) jsou čtyři části: Přehled, Dobrovolníci, Hodiny a Administrace.'),
  box('Rychlost', ['Systém ukládá změny na pozadí. Když něco uložíte, okno se hned zavře a chvíli se zobrazuje „Ukládám…“. Pokud by se uložení nepovedlo, okno se znovu otevře s chybou a vašimi vyplněnými údaji. Data se během práce sama obnovují.']),
  H2('4.1 Přehled'),
  P('Dlaždice podle stavu: Noví zájemci, Kontaktovaní, Domluvené schůzky, Čeká na rozhodnutí, Aktivní dobrovolníci, případná Upozornění a Hodiny ke schválení. V každé dlaždici jsou 4 nejnovější jména – kliknutím na jméno otevřete detail, kliknutím na dlaždici celý seznam.'),
  H2('4.2 Dobrovolníci'),
  P('Seznam všech zájemců a dobrovolníků s vyhledáváním (jméno, ID, e-mail, telefon, obec) a filtry podle stavu, oblasti a místa. Kliknutím na řádek otevřete detail.'),
  H2('4.3 Detail dobrovolníka'),
  P('**Všechny změny se ukládají automaticky** – stačí vyplnit pole a kliknout jinam. U pole se krátce ukáže „Uloženo ✓“.'),
  H3('Stav a zařazení'),
  P('Stav určuje, kde se člověk zobrazuje v Přehledu:'),
  tabulka([3000, 6026], ['Stav', 'Význam'], [
    ['Nový zájemce', 'Právě se zaregistroval.'],
    ['Kontaktován', 'Ozvali jsme se mu.'],
    ['Schůzka domluvena', 'Nastaví se automaticky při naplánování schůzky.'],
    ['Schůzka proběhla', 'Čeká se na rozhodnutí.'],
    ['Aktivní dobrovolník', 'Dobrovolničí. Automaticky se doplní „Dobrovolníkem od“. Jen v tomto stavu má přístup do portálu dobrovolníka.'],
    ['Neaktivní / Odstoupil / Nevhodný', 'Ukončená spolupráce. Přístup do portálu se okamžitě ukončí.']
  ]),
  H3('Organizace a hodiny'),
  B('**Přiřazení k organizaci**: vyberte organizaci, volitelně datum „od“ (může být i zpětně, nebo prázdné = od začátku) a klikněte Přiřadit. Dobrovolník může být u více organizací.'),
  B('Tlačítko **Data** upraví období přiřazení, **Ukončit** přiřazení ukončí (hodiny zůstávají), **Obnovit** ho vrátí.'),
  B('Pod přiřazeními jsou **součty hodin** (celkem, letos, tento měsíc). Je-li dobrovolník u více organizací, přepínáte mezi „Všechny organizace“ a jednotlivými organizacemi.'),
  B('Tlačítko **Zapsat hodiny** otevře zápis s předvyplněným dobrovolníkem.'),
  H3('Schůzka'),
  P('Zadáte datum, čas a místo a kliknete Naplánovat schůzku. Schůzka se zapíše do kalendáře a dobrovolníkovi (pokud necháte zaškrtnuté) přijde e-mail s potvrzením. Termín lze změnit nebo zrušit – i o tom dostane e-mail.'),
  H3('Dokumenty'),
  P('Odkazy na osobní složku, registrační PDF, smlouvu a docházkový list. Tlačítkem **Vygenerovat smlouvu** vznikne smlouva s automatickým číslem (SM-2026-0001) z šablony, údaje se doplní z databáze. Smlouva se uloží jako PDF i jako upravitelný dokument Google.'),
  H3('Portál dobrovolníka'),
  P('Tlačítko **Poslat pozvánku do portálu** pošle dobrovolníkovi e-mail s osobním odkazem (platí 14 dní). Funguje jen pro stav Aktivní dobrovolník s vyplněným e-mailem.'),
  H3('Smazání záznamu (jen hlavní admin)'),
  P('Trvale odstraní osobní údaje, schůzku z kalendáře a volitelně i dokumenty (do koše na Disku). Odpracované hodiny zůstanou zachované jen pod číslem, bez jména. Používejte pro testovací data nebo při žádosti o výmaz.'),

  H2('4.4 Hodiny'),
  P('Přehled všech zapsaných hodin s filtry podle měsíce (prázdný měsíc = celé období), organizace, dobrovolníka a stavu. Nahoře je součet schválených hodin a počet zápisů čekajících na schválení.'),
  H3('Stavy hodin'),
  B('**Schváleno** – hodiny zapsané koordinátorkou platí rovnou.'),
  B('**Ke schválení** – hodiny, které si zapsal dobrovolník sám v portálu. Schválíte je tlačítkem ✓, zamítnete ✕. Lze i hromadně: zaškrtněte řádky a použijte tlačítka nad tabulkou.'),
  B('**Zamítnuto** – dobrovolník zápis vidí a může ho opravit (pošle se znovu ke schválení) nebo smazat.'),
  H3('Tři způsoby zápisu'),
  tabulka([2400, 6626], ['Tlačítko', 'Kdy použít'], [
    ['**+ Zapsat hodiny**', 'Jeden zápis pro jednoho dobrovolníka. Čas zadáte jako „od–do“ (délka se spočítá sama) nebo jen délku. Činnost vyberete kliknutím.'],
    ['**+ Akce / směna**', 'Více dobrovolníků se stejným datem, časem a činností – zaškrtnete přítomné. Vhodné i pro přepis papírové docházky z akce.'],
    ['**Měsíční výkaz**', 'Tabulka dobrovolníci × dny v měsíci. Do políček píšete hodiny: 2 · 1,5 · 1:30 · 45m. Šedě je vidět, co už je zapsané. Hodí se pro pravidelnou službu a přepis papírových výkazů.']
  ]),
  mezera(),
  P('Pravidla: čas se zaokrouhluje na 5 minut, nelze zapisovat do budoucnosti, dobrovolník musí být přiřazený k organizaci. Koordinátorky mohou zapisovat zpětně bez omezení.'),
  P('**Uzávěrka:** když v Nastavení vyplníte hodiny_uzavreno_do (např. 2026-09), hodiny do konce zvoleného měsíce může měnit už jen hlavní admin.'),

  H2('4.5 Administrace'),
  P('Změny se ukládají automaticky po opuštění pole. Úpravy se projeví hned – formulář i portál si nastavení čtou pokaždé znovu.'),
  tabulka([2400, 6626], ['Záložka', 'Co se zde nastavuje'], [
    ['Nastavení', 'Texty formuláře, e-maily, složky, šablony dokumentů, pravidla hodin a přihlášení, zálohy (viz tabulka níže). Jen hlavní admin.'],
    ['Administrátoři', 'Kdo má přístup do dashboardu, jeho role, zda je aktivní a zda dostává notifikace o nových zájemcích. Jen hlavní admin.'],
    ['Šablony e-mailů', 'Texty všech automatických e-mailů. Zástupné znaky jako {jmeno} nebo {termin} se nahradí skutečnými údaji – klepnutím na ně je zkopírujete. Jen hlavní admin.'],
    ['Šablony dokumentů', 'Šablony smlouvy a docházkového listu (dokumenty Google se zástupnými znaky jako {{cele_jmeno}}). Tlačítko vytvoří ukázkové šablony.'],
    ['Organizace', 'Přijímající organizace včetně kontaktu a adresy (doplňuje se do smlouvy).'],
    ['Činnosti', 'Přednastavené činnosti pro zápis hodin – pro všechny organizace nebo jen pro konkrétní.'],
    ['Místa, Oblasti zájmu', 'Číselníky pro detail dobrovolníka. Neaktivní položky (NE) se přestanou nabízet.']
  ]),
  H3('Nejdůležitější položky v Nastavení'),
  tabulka([3200, 5826], ['Položka', 'Co ovlivňuje'], [
    ['nazev_organizace, podnazev_organizace', 'Název v záhlaví formuláře, v e-mailech a dokumentech.'],
    ['nadpis_formulare, uvodni_text_formulare', 'Nadpis a úvodní text registračního formuláře. **text** = tučně, prázdný řádek = nový odstavec.'],
    ['text_po_odeslani', 'Text, který zájemce uvidí po odeslání formuláře.'],
    ['email_odpovedi', 'Na jakou adresu zájemci odpovídají na automatické e-maily.'],
    ['email_notifikace', 'Další adresy pro upozornění na nové zájemce (kromě administrátorů s Notifikace = ANO).'],
    ['odkaz_gdpr, minimalni_vek', 'Odkaz na zásady zpracování údajů ve formuláři; minimální věk zájemce.'],
    ['delka_schuzky_min, misto_schuzky_vychozi', 'Délka schůzky v kalendáři a předvyplněné místo.'],
    ['sablona_smlouvy, sablona_dochazky', 'Odkazy na šablony dokumentů.'],
    ['hodiny_zpetne_dni', 'Kolik dní zpětně si smí dobrovolník sám zapsat hodiny (výchozí 60).'],
    ['hodiny_uzavreno_do', 'Uzávěrka hodin (viz kapitola Hodiny).'],
    ['platnost_pozvanky_dni, delka_prihlaseni_dobrovolnik_dni', 'Platnost pozvánky do portálu (14 dní) a jak dlouho zůstane dobrovolník přihlášený (365 dní).'],
    ['delka_prihlaseni_hod, platnost_odkazu_dni', 'Jak dlouho zůstane přihlášený administrátor; platnost odkazu v notifikaci (3 dny).'],
    ['zalohy_hodina, zalohy_denni_pocet, zalohy_tydenni_pocet', 'Čas noční zálohy a kolik záloh se uchovává (5 denních, 30 týdenních).']
  ]),
  mezera(),
  box('Pozor', ['Položky se složkami, adresou webu (web_adresa) a klíčem Google (google_client_id) prosím neměňte bez domluvy se správcem – systém by mohl přestat ukládat dokumenty nebo posílat správné odkazy.'], ZLUTA)
);

// 5. Portál dobrovolníka
add(H1('5. Portál dobrovolníka'),
  P('Na adrese ' + WEB + 'hodiny.html si aktivní dobrovolníci zapisují hodiny. Odkaz je vhodné umístit na web organizace jako tlačítko „Zapsat dobrovolnické hodiny“.'),
  H3('Jak se dobrovolník dostane dovnitř'),
  N([
    'Koordinátorka mu v detailu pošle **pozvánku** – klepnutím na tlačítko v e-mailu je přihlášený.',
    'Kdykoli později zadá na stránce svůj e-mail a přijde mu tlačítko „Přihlásit se“ a kód.',
    'Pokud má účet Google, může použít „Přihlásit přes Google“.'
  ]),
  P('Přihlášení vydrží na zařízení rok. Dobrovolník se může odhlásit ze všech zařízení najednou (např. při ztrátě telefonu). Přístup mají jen dobrovolníci ve stavu Aktivní dobrovolník s vyplněným e-mailem.'),
  H3('Co dobrovolník v portálu vidí a dělá'),
  B('Součty hodin za tento měsíc, letos a celkem a kolik hodin čeká na schválení.'),
  B('**+ Zapsat hodiny**: den (Dnes / Včera / Jiný den), organizace (jen pokud jich má víc), čas od–do nebo délka (rychlé volby 1–4 h), činnost klepnutím, poznámka.'),
  B('**↺ Zopakovat poslední** – předvyplní poslední zápis s dnešním datem.'),
  B('Své zápisy po měsících; neschválené může upravit nebo smazat.'),
  B('Přehled po měsících a letech, rozdělený i podle organizací.'),
  P('Pravidla: nejvýše 60 dní zpětně, jen k organizacím, ke kterým je k danému dni přiřazený. Jeho zápisy se v dashboardu objeví jako „Ke schválení“.'),
  P('Dobrovolníci bez e-mailu (např. senioři s papírovým výkazem) přístup do portálu nemají – hodiny jim zapisuje koordinátorka (nejlépe přes Měsíční výkaz nebo Akci).')
);

// 6. Doporučený test
add(new Paragraph({ children: [new PageBreak()] }), H1('6. Co doporučujeme vyzkoušet'),
  P('Postupujte prosím krok za krokem. Testovací osoby pojmenujte tak, aby bylo jasné, že jde o test (např. příjmení „Test“), a používejte svůj vlastní e-mail, abyste viděla, co dobrovolníkům chodí.'),
  tabulka([500, 4400, 3426, 700], ['#', 'Co udělat', 'Co by se mělo stát', '✓'], [
    ['1', 'Otevřete registrační formulář a zaregistrujte se jako testovací zájemce se svým e-mailem. Zkuste nejdřív odeslat nevyplněný formulář.', 'Chybějící pole se označí červeně. Po vyplnění se zobrazí poděkování s registračním číslem.', '☐'],
    ['2', 'Zkontrolujte e-mail.', 'Přišel děkovný e-mail. Administrátorům s notifikací přišlo upozornění na nového zájemce.', '☐'],
    ['3', 'Přihlaste se do dashboardu (přes Google nebo e-mailem s kódem).', 'Otevře se Přehled, testovací zájemce je v dlaždici Noví zájemci.', '☐'],
    ['4', 'Otevřete detail zájemce. Změňte stav na Kontaktován a doplňte poznámku.', 'U polí se ukáže „Uloženo ✓“, v Přehledu se zájemce přesune.', '☐'],
    ['5', 'Naplánujte schůzku (zaškrtnuté posílání e-mailu). Pak termín změňte.', 'Schůzka je v kalendáři, přišel e-mail s potvrzením a pak se změnou termínu. Stav se změnil na Schůzka domluvena.', '☐'],
    ['6', 'Změňte stav na Aktivní dobrovolník a přiřaďte ho ke dvěma organizacím, u jedné se zpětným datem „od“.', 'Doplnilo se „Dobrovolníkem od“. Organizace jsou v sekci Organizace a hodiny.', '☐'],
    ['7', 'V detailu klikněte Zapsat hodiny a zapište čas od–do (např. 9:00–11:25).', 'Délka se spočítá (2 h 25 min). V součtech se hodiny objeví.', '☐'],
    ['8', 'V Hodinách vyzkoušejte + Akce / směna (více lidí) a Měsíční výkaz (zkuste zadat 2, 1:30 i nesmysl „abc“).', 'Zápisy se objeví v seznamu. Nesmyslná hodnota se označí červeně a výkaz se neuloží, dokud ji neopravíte.', '☐'],
    ['9', 'V detailu přepněte přehled hodin mezi organizacemi.', 'Součty se mění podle zvolené organizace.', '☐'],
    ['10', 'Pošlete testovacímu dobrovolníkovi pozvánku do portálu a otevřete ji v mobilu.', 'Po klepnutí na tlačítko jste v portálu přihlášená. Přidejte si stránku na plochu.', '☐'],
    ['11', 'V portálu zapište hodiny („Včera“, od–do, činnost) a pak použijte „Zopakovat poslední“.', 'Zápisy mají stav „čeká na schválení“.', '☐'],
    ['12', 'V dashboardu v Hodinách jeden zápis schvalte a druhý zamítněte.', 'V portálu (po obnovení) je jeden schválený a započítaný, druhý zamítnutý – lze ho opravit nebo smazat.', '☐'],
    ['13', 'V Administraci → Činnosti přidejte novou činnost pro jednu organizaci.', 'Při zápisu hodin se u této organizace nabízí nová činnost.', '☐'],
    ['14', '(Volitelně) V Administraci → Šablony dokumentů vytvořte ukázkové šablony a v detailu vygenerujte smlouvu.', 'Vznikne PDF smlouvy s číslem SM-… a údaji dobrovolníka.', '☐'],
    ['15', 'Nakonec testovací záznamy smažte (hlavní admin, tlačítko Smazat záznam v detailu).', 'Záznam zmizí, dokumenty jsou v koši na Disku.', '☐']
  ]),
  mezera(),
  P('Při testování si prosím všímejte, co je nejasné, co chybí nebo co by se dalo zjednodušit. Napište i drobnosti – například nejasný text tlačítka nebo zbytečný krok.')
);

// 7. Časté otázky
add(H1('7. Časté otázky'),
  H3('E-mail nepřišel'),
  P('Zkontrolujte Spam. Kód lze znovu vyžádat po minutě. Systém posílá e-maily jen na adresy, které zná (administrátoři, aktivní dobrovolníci) – na neznámý e-mail nic nepřijde, i když stránka napíše, že byl odeslán.'),
  H3('Stránka se načítá dlouho nebo vypadá jinak'),
  P('Data se načítají ze serveru Google, první otevření může trvat několik sekund. Pokud stránka vypadá jinak, než popisuje návod, obnovte ji klávesami Ctrl+F5 (na mobilu stáhnutím stránky dolů).'),
  H3('Udělala jsem chybu v zápisu hodin'),
  P('V Hodinách klikněte u zápisu na tužku ✎ a opravte ho, nebo ho zaškrtněte a smažte. Hodiny v uzavřeném měsíci může měnit jen hlavní admin.'),
  H3('Dobrovolník se nemůže přihlásit do portálu'),
  P('Zkontrolujte v detailu, že má stav Aktivní dobrovolník a správně vyplněný e-mail, a pošlete mu novou pozvánku.'),
  H3('Ztráta telefonu'),
  P('Dobrovolník se z jiného zařízení přihlásí a zvolí „Odhlásit ze všech zařízení“. Případně mu dočasně změňte stav (např. na Neaktivní) – přístup okamžitě skončí.'),
  H2('Připravujeme'),
  B('Portál pro přijímající organizace (vlastní dobrovolníci, schvalování, statistiky).'),
  B('Statistiky a výstupy pro výkazy.'),
  B('Motivační upozornění a odznaky za odpracované hodiny.'),
  B('Podpis smluv na tabletu.')
);

const doc = new Document({
  creator: 'Dobrovolnické centrum',
  title: 'Dobrovolnický systém – návod k vyzkoušení',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22, color: TMAVA } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 34, bold: true, color: KORAL, font: 'Calibri' }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0, keepNext: true } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 27, bold: true, color: TMAVA, font: 'Calibri' }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1, keepNext: true } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 23, bold: true, color: KORAL, font: 'Calibri' }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2, keepNext: true } }
    ]
  },
  numbering: { config: NUMBERINGS },
  sections: [{
    properties: { page: { margin: { top: 1440, bottom: 1300, left: 1440, right: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: 'Dobrovolnický systém – návod   |   ', color: SEDA, size: 18 }), new TextRun({ children: [PageNumber.CURRENT], color: SEDA, size: 18 })] })] }) },
    children: obsah
  }]
});

Packer.toBuffer(doc).then(b => { fs.writeFileSync('Navod_dobrovolnicky_system.docx', b); console.log('ok'); });
