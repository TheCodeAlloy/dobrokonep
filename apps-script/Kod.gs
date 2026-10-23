/**
 * DOBROVOLNICKÉ CENTRUM – ZÁKLAD SYSTÉMU
 * --------------------------------------------------------------
 * Webové stránky (formulář a dashboard) běží na GitHub Pages.
 * Tento skript je jejich „datové rozhraní“ (API): jedno nasazení
 * Webová aplikace, Spustit jako: Já, Kdo má přístup: Kdokoli.
 *
 * Soubory:
 *   Kod.gs        – nastavení tabulky, registrace, e-maily, pomocné funkce
 *   Dashboard.gs  – přihlášení, dashboard, schůzky, dokumenty, administrace
 *   Api.gs        – příjem požadavků z webových stránek (doGet/doPost)
 *
 * První spuštění: vyberte nahoře funkci „nastavTabulku“ a klikněte na Spustit.
 * Po každé aktualizaci kódu spusťte „nastavTabulku“ znovu – doplní nové sloupce a šablony.
 */

// ===== ZÁKLADNÍ KONSTANTY =====================================

// ID tabulky se ukládá do vlastností skriptu (SS_ID) při prvním spuštění nastavTabulku.
// V kódu ho nemáme, protože repozitář je veřejný.
const SS_ID_VYCHOZI = '';
const TZ = 'Europe/Prague';

// E-mail přihlášeného administrátora během zpracování požadavku (pro Log změn)
let AKTUALNI_UZIVATEL = '';

// Mezipaměť v rámci jednoho požadavku (zrychlení opakovaného čtení listů)
let MEMO = {};

const LISTY = {
  DOBROVOLNICI: 'Dobrovolníci',
  NASTAVENI: 'Nastavení',
  ADMINI: 'Administrátoři',
  OBLASTI: 'Oblasti zájmu',
  MISTA: 'Místa',
  ORGANIZACE: 'Organizace',
  SABLONY: 'Šablony e-mailů',
  HODINY: 'Hodiny',
  PRIRAZENI: 'Přiřazení',
  CINNOSTI: 'Činnosti',
  LOG: 'Log změn'
};

const SLOUPCE_DOBROVOLNICI = [
  'ID', 'Časové razítko', 'Titul', 'Jméno', 'Příjmení', 'Datum narození',
  'E-mail', 'Telefon', 'Ulice a č.p.', 'Obec', 'PSČ', 'Preferovaný kontakt',
  'Oblasti zájmu', 'Oblast – jiné', 'Preferované místo', 'Dostupnost',
  'Zkušenosti a dovednosti', 'Zaměstnání / studium', 'Vzdělání', 'Jak se o nás dozvěděl/a', 'Souhlas GDPR',
  'Stav', 'Termín schůzky', 'Místo schůzky', 'ID události kalendáře',
  'Organizace', 'Místo působení', 'Dobrovolníkem od', 'Poznámky',
  'Číslo smlouvy', 'Smlouva (PDF)', 'Datum smlouvy', 'Docházkový list',
  'Složka', 'Registrace (PDF)', 'Pozvánka do portálu', 'Upozornění', 'Naposledy upraveno', 'Upravil/a',
  'Služba do', 'Zástupce – jméno', 'Zástupce – adresa', 'Zástupce – datum narození', 'Zástupce – kontakt',
  'Záznam o přípravě'
];

const POLE_DATUM = ['Datum narození', 'Dobrovolníkem od', 'Datum smlouvy', 'Služba do', 'Zástupce – datum narození'];
const POLE_CAS = ['Časové razítko', 'Termín schůzky', 'Naposledy upraveno', 'Pozvánka do portálu'];

const STAVY = [
  'Nový zájemce', 'Kontaktován', 'Schůzka domluvena', 'Schůzka proběhla',
  'Aktivní dobrovolník', 'Neaktivní', 'Odstoupil', 'Nevhodný'
];

const BARVY_STAVU = {
  'Nový zájemce': '#cfe2ff',
  'Kontaktován': '#e0dcff',
  'Schůzka domluvena': '#fff3cd',
  'Schůzka proběhla': '#fde7b0',
  'Aktivní dobrovolník': '#c9ecd6',
  'Neaktivní': '#e9ecef',
  'Odstoupil': '#ffd8a8',
  'Nevhodný': '#ffd8a8'
};

const ROLE = ['Hlavní admin', 'Koordinátor', 'Jen čtení'];

const VYCHOZI_OBLASTI = [
  'Ochrana přírody a životního prostředí',
  'Pomoc uprchlíkům a cizincům',
  'Práce se seniory',
  'Práce s dětmi a mládeží',
  'Lidé se zdravotním postižením',
  'Nemocnice, hospice, paliativní péče',
  'Zvířata (útulky, záchranné stanice)',
  'Kultura a pořádání akcí',
  'Sport',
  'Potravinová a materiální pomoc',
  'Krizová a humanitární pomoc',
  'Odborné dovednosti (IT, grafika, účetnictví, překlady…)'
];

const VYCHOZI_MISTA = ['Pardubice', 'Chrudim', 'Sezemice'];

const DOSTUPNOST = ['Všední dny', 'Víkendy', 'Pravidelně (každý týden)', 'Jednorázově / na akce'];
const ZDROJE = ['Web', 'Sociální sítě', 'Od známých', 'Škola', 'Akce / festival', 'Jiné'];
const KONTAKTY = ['E-mail', 'Telefon', 'SMS'];
const VZDELANI = ['Základní', 'Středoškolské s výučním listem', 'Středoškolské s maturitou', 'Vyšší odborné', 'Vysokoškolské'];

const VYCHOZI_UVOD =
  'Rádi byste pomáhali, ale zatím nevíte přesně kde nebo jak začít? 😊 **Vyplňte krátký formulář a my vám pomůžeme najít dobrovolnictví, které vám bude sedět.** ✨\n\n' +
  'Po jeho vyplnění se vám ozve **jedna z našich koordinátorek - Lucka nebo Káťa.** 👋 Společně proberete vaše představy, možnosti i to, kolik času chcete dobrovolnictví věnovat. 😊\n\n' +
  '**Nemusíte mít nic předem rozhodnuté. Společně najdeme možnost, která vám bude dávat smysl.** 💗';

function vychoziNastaveni_(email) {
  return [
    ['nazev_organizace', 'Dobrovolnické centrum', 'Název zobrazený ve formuláři, dokumentech a e-mailech'],
    ['podnazev_organizace', 'Koalice nevládek Pardubicka', 'Druhý řádek v záhlaví formuláře'],
    ['nadpis_formulare', 'Chcete se zapojit jako dobrovolník? ❤️', 'Nadpis registračního formuláře'],
    ['uvodni_text_formulare', VYCHOZI_UVOD, 'Úvodní text formuláře. **text** = tučně, prázdný řádek = nový odstavec'],
    ['email_notifikace', '', 'Další adresy pro upozornění na nové zájemce (kromě administrátorů s Notifikace = ANO); více adres oddělte čárkou'],
    ['email_odpovedi', email, 'Adresa, na kterou zájemci odpovídají (Reply-To)'],
    ['slozka_registrace', '', 'Složka pro registrační PDF (odkaz nebo ID)'],
    ['slozka_smlouvy', '', 'Složka pro smlouvy (PDF)'],
    ['slozka_dobrovolnici', '', 'Složka, ve které vznikají osobní složky dobrovolníků'],
    ['prefix_id', 'DC', 'Předpona ID dobrovolníka, např. DC → DC-2026-0001'],
    ['prefix_smlouvy', 'SM', 'Předpona čísla smlouvy, např. SM → SM-2026-0001'],
    ['minimalni_vek', 15, 'Minimální věk pro registraci (0 = bez omezení)'],
    ['odkaz_gdpr', 'https://www.konep.cz/o-nas/gdpr/', 'Odkaz na informace o zpracování osobních údajů (zobrazí se u souhlasu)'],
    ['text_po_odeslani', 'Děkujeme! Registrace byla odeslána a na váš e-mail jsme poslali potvrzení. Brzy se vám ozveme.', 'Text, který zájemce uvidí po odeslání formuláře'],
    ['web_adresa', '', 'Adresa webu na GitHub Pages, např. https://uzivatel.github.io/dobrovolnici/ (pro odkazy v notifikacích)'],
    ['hodiny_uzavreno_do', '', 'Uzávěrka hodin: měsíce do tohoto včetně (RRRR-MM, např. 2026-09) může měnit jen hlavní admin'],
    ['slozka_zalohy', '', 'Složka pro zálohy tabulky (prázdné = vytvoří se složka „Zálohy“ vedle složky Registrace)'],
    ['zalohy_hodina', 2, 'V kolik hodin v noci se dělá denní záloha (0–23)'],
    ['zalohy_denni_pocet', 5, 'Kolik posledních denních záloh uchovávat'],
    ['zalohy_tydenni_pocet', 30, 'Kolik posledních týdenních záloh uchovávat (týdenní záloha se dělá v pondělí)'],
    ['delka_prihlaseni_dobrovolnik_dni', 365, 'Jak dlouho zůstane dobrovolník v portálu přihlášený na jednom zařízení (dny)'],
    ['platnost_pozvanky_dni', 14, 'Jak dlouho platí odkaz v pozvánce do portálu dobrovolníka (dny)'],
    ['hodiny_zpetne_dni', 60, 'Kolik dní zpětně smí dobrovolník sám zapisovat hodiny'],
    ['platnost_odkazu_dni', 3, 'Jak dlouho platí přihlašovací odkaz v notifikaci o novém zájemci (dny)'],
    ['google_client_id', '', 'Klíč pro „Přihlásit přes Google“ (Client ID z Google Cloud Console); prázdné = tlačítko se nezobrazí'],
    ['delka_prihlaseni_hod', 720, 'Jak dlouho zůstane administrátor v dashboardu přihlášený (hodiny; 720 = 30 dní)'],
    ['kalendar_id', '', 'ID kalendáře pro schůzky (prázdné = hlavní kalendář účtu, pod kterým systém běží)'],
    ['delka_schuzky_min', 60, 'Délka schůzky v minutách'],
    ['misto_schuzky_vychozi', '', 'Výchozí místo schůzky (předvyplní se při plánování)'],
    ['sablona_smlouvy_18', '', 'Dokument Google se šablonou smlouvy pro dobrovolníky od 18 let (odkaz nebo ID)'],
    ['sablona_smlouvy_15_17', '', 'Dokument Google se šablonou smlouvy pro dobrovolníky 15–17 let (odkaz nebo ID)'],
    ['sablona_dochazky', '', 'Dokument Google se šablonou docházkového listu (odkaz nebo ID)'],
    ['sablona_pripravy', '', 'Dokument Google se šablonou záznamu o přípravě a výcviku (odkaz nebo ID)'],
    ['slozka_pripravy', '', 'Složka pro záznamy o přípravě (Dokumenty Google); u dobrovolníka se vytvoří jen zástupce'],
    ['mista_skoleni', 'Pardubice, Chrudim', 'Místa školení na výběr při tvorbě záznamu o přípravě (oddělte čárkou)'],
    ['skolitele_skoleni', 'Mgr. Kateřina Mužíková, DC KONEP; Ing. Lucie Křivková, DC KONEP', 'Školitelé na výběr při tvorbě záznamu o přípravě (oddělte středníkem)']
  ];
}

const VYCHOZI_SABLONY = [
  ['uvitani', 'Automatický e-mail zájemci po odeslání formuláře',
    'Děkujeme za váš zájem o dobrovolnictví',
    'Dobrý den, {jmeno},\n\n' +
    'velmi děkujeme za váš zájem stát se dobrovolníkem či dobrovolnicí v organizaci {nazev_organizace}. Vaší ochoty pomáhat si opravdu vážíme.\n\n' +
    'Vaši registraci jsme přijali pod číslem {id}.\n\n' +
    'V nejbližších dnech se vám ozve náš koordinátor a domluví s vámi termín krátké osobní schůzky. Povíme si na ní, co vás láká, ukážeme vám, kde a jak můžete pomáhat, a odpovíme na vaše otázky.\n\n' +
    'Pokud byste mezitím cokoli potřebovali, stačí odpovědět na tento e-mail.\n\n' +
    'Těšíme se na setkání!\n\n' +
    'S pozdravem\n{nazev_organizace}'],
  ['notifikace_admin', 'Upozornění administrátorovi na nového zájemce',
    'Nový zájemce o dobrovolnictví ({id})',
    'Do systému se zaregistroval nový zájemce o dobrovolnickou službu.\n\n' +
    'ID: {id}\n\n' +
    'Otevřít záznam: {odkaz_detail}\n\n' +
    'Odkaz vás rovnou přihlásí do dashboardu a platí {platnost_dni} dny.\n\n' +
    'Tento e-mail je určen pouze pro administrátora systému. Nedoporučujeme ho nikomu přeposílat ani s nikým sdílet.'],
  ['potvrzeni_schuzky', 'Potvrzení termínu schůzky',
    'Potvrzení termínu schůzky',
    'Dobrý den, {jmeno},\n\n' +
    'ještě jednou velmi děkujeme za váš zájem stát se dobrovolníkem či dobrovolnicí. Vážíme si toho.\n\n' +
    'Potvrzujeme termín osobní schůzky: {termin}\nMísto: {misto_schuzky}\n\n' +
    'Pokud by vám termín nevyhovoval, dejte nám prosím vědět odpovědí na tento e-mail.\n\n' +
    'Děkujeme a těšíme se na osobní setkání!\n\n' +
    'S pozdravem\n{nazev_organizace}'],
  ['zmena_schuzky', 'Změna termínu schůzky',
    'Změna termínu schůzky',
    'Dobrý den, {jmeno},\n\n' +
    'termín naší schůzky se mění. Nový termín: {termin}\nMísto: {misto_schuzky}\n\n' +
    'Pokud by vám nový termín nevyhovoval, dejte nám prosím vědět odpovědí na tento e-mail.\n\n' +
    'Děkujeme a těšíme se na setkání!\n\n' +
    'S pozdravem\n{nazev_organizace}'],
  ['prihlasovaci_kod', 'Jednorázový kód pro přihlášení do dashboardu',
    'Přihlašovací kód: {kod}',
    'Váš kód pro přihlášení do dashboardu: {kod}\n\n' +
    'Nebo se přihlaste jedním klepnutím:\n{odkaz}\n\n' +
    'Kód i odkaz platí 10 minut. Pokud jste o přihlášení nežádali, tento e-mail ignorujte.\n\n' +
    '{nazev_organizace}'],
  ['pozvanka_portal', 'Pozvánka dobrovolníka do portálu pro zápis hodin',
    'Vaše dobrovolnické hodiny online',
    'Dobrý den, {jmeno},\n\n' +
    'děkujeme, že jste s námi. Své dobrovolnické hodiny si nově můžete zapisovat online – z mobilu i z počítače – a kdykoli se podívat, kolik jste toho už odpracoval/a.\n\n' +
    '{odkaz}\n\n' +
    'Tip: po otevření si stránku přidejte na plochu telefonu (v prohlížeči „Přidat na plochu“). Příště už se nebudete muset přihlašovat.\n\n' +
    'Odkaz platí {platnost_dni} dní. Později se přihlásíte kdykoli na adrese {adresa_portalu} pomocí svého e-mailu.\n\n' +
    'Tento e-mail je určen jen vám – prosím nepřeposílejte ho.\n\n' +
    'S pozdravem\n{nazev_organizace}'],
  ['prihlaseni_dobrovolnik', 'Přihlašovací kód do portálu dobrovolníka',
    'Přihlášení k dobrovolnickým hodinám: {kod}',
    'Dobrý den, {jmeno},\n\n' +
    'váš kód pro přihlášení: {kod}\n\n' +
    'Nebo se přihlaste jedním klepnutím:\n{odkaz}\n\n' +
    'Kód i odkaz platí 10 minut. Pokud jste o přihlášení nežádali, tento e-mail ignorujte.\n\n' +
    '{nazev_organizace}'],
  ['zruseni_schuzky', 'Zrušení schůzky',
    'Zrušení termínu schůzky',
    'Dobrý den, {jmeno},\n\n' +
    'omlouváme se, ale schůzka v termínu {termin} se neuskuteční. Brzy se vám ozveme a domluvíme nový termín.\n\n' +
    'Děkujeme za pochopení.\n\n' +
    'S pozdravem\n{nazev_organizace}']
];

// ===== MENU V TABULCE =========================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Dobrovolnické centrum')
    .addItem('Nastavit / aktualizovat tabulku', 'nastavTabulku')
    .addItem('Zobrazit odkazy (formulář a dashboard)', 'zobrazOdkaz')
    .addSeparator()
    .addItem('Odeslat testovací registraci', 'testovaciRegistrace')
    .addItem('Otestovat notifikaci administrátorovi', 'testNotifikace')
    .addSeparator()
    .addItem('Vynulovat číslování (po smazání testovacích dat)', 'vynulujCislovani')
    .addSeparator()
    .addItem('Zapnout automatické zálohy', 'zapnoutZalohy')
    .addItem('Zálohovat nyní', 'zalohovatNyni')
    .addItem('Vypnout automatické zálohy', 'vypnoutZalohy')
    .addToUi();
}

// ===== AUTOMATICKÉ NASTAVENÍ TABULKY ==========================
// Lze spouštět opakovaně: nic nepřepíše, jen doplní, co chybí.

function nastavTabulku() {
  const ss = ss_();
  PropertiesService.getScriptProperties().setProperty('SS_ID', ss.getId());
  ss.setSpreadsheetTimeZone(TZ);
  const ja = Session.getEffectiveUser().getEmail();

  const shD = zajistiList_(ss, LISTY.DOBROVOLNICI, SLOUPCE_DOBROVOLNICI);
  nastavFormatyDobrovolniku_(shD);

  const shN = zajistiList_(ss, LISTY.NASTAVENI, ['Klíč', 'Hodnota', 'Popis']);
  doplnChybejiciRadky_(shN, vychoziNastaveni_(ja));
  shN.setColumnWidth(1, 190).setColumnWidth(2, 420).setColumnWidth(3, 460);

  const shA = zajistiList_(ss, LISTY.ADMINI, ['E-mail', 'Jméno', 'Role', 'Aktivní', 'Notifikace']);
  doplnChybejiciRadky_(shA, [[ja, '', 'Hlavní admin', 'ANO', 'ANO']]);
  shA.getRange('C2:C').setDataValidation(seznamValidace_(ROLE));
  shA.getRange('D2:D').setDataValidation(seznamValidace_(['ANO', 'NE']));
  shA.getRange('E2:E').setDataValidation(seznamValidace_(['ANO', 'NE']));
  if (shA.getLastRow() > 1) {
    const r = shA.getRange(2, 5, shA.getLastRow() - 1, 1);
    r.setValues(r.getValues().map(x => [String(x[0]).trim() ? x[0] : 'ANO']));
  }

  const shO = zajistiList_(ss, LISTY.OBLASTI, ['Oblast zájmu', 'Aktivní']);
  doplnChybejiciRadky_(shO, VYCHOZI_OBLASTI.map(o => [o, 'ANO']));
  shO.getRange('B2:B').setDataValidation(seznamValidace_(['ANO', 'NE']));
  shO.setColumnWidth(1, 380);

  const shM = zajistiList_(ss, LISTY.MISTA, ['Místo', 'Aktivní']);
  doplnChybejiciRadky_(shM, VYCHOZI_MISTA.map(m => [m, 'ANO']));
  shM.getRange('B2:B').setDataValidation(seznamValidace_(['ANO', 'NE']));

  const shOrg = zajistiList_(ss, LISTY.ORGANIZACE,
    ['ID', 'Název', 'Kontaktní osoba', 'E-mail', 'Telefon', 'Adresa', 'Oblast', 'Aktivní', 'Poznámky']);
  shOrg.getRange('H2:H').setDataValidation(seznamValidace_(['ANO', 'NE']));

  const shS = zajistiList_(ss, LISTY.SABLONY, ['Klíč', 'Popis', 'Předmět', 'Text']);
  doplnChybejiciRadky_(shS, VYCHOZI_SABLONY);
  shS.setColumnWidth(1, 150).setColumnWidth(2, 260).setColumnWidth(3, 300).setColumnWidth(4, 600);
  shS.getRange('D:D').setWrap(true);
  shS.getRange('A:D').setVerticalAlignment('top');

  nastavListyHodin_(ss);
  zajistiList_(ss, LISTY.LOG, ['Čas', 'Uživatel', 'Akce', 'ID', 'Detail']);

  migrace_(ss);

  ss.getSheets().forEach(sh => {
    const n = sh.getName();
    const jeNas = Object.keys(LISTY).some(k => LISTY[k] === n);
    if (!jeNas && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

  Object.keys(LISTY).forEach((k, i) => {
    const sh = ss.getSheetByName(LISTY[k]);
    if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); }
  });
  ss.setActiveSheet(shD);

  log_('Nastavení tabulky', '', 'Tabulka nastavena / aktualizována');
  upozorni_('Hotovo. Tabulka je nastavená a aktualizovaná.\n\nZkontrolujte prosím list „Nastavení“.');
}

// Úpravy tabulek vytvořených starší verzí kódu
function migrace_(ss) {
  const shS = ss.getSheetByName(LISTY.SABLONY);
  if (shS && shS.getLastRow() > 1) {
    const v = shS.getRange(2, 1, shS.getLastRow() - 1, 4).getValues();
    v.forEach((r, i) => {
      let text = String(r[3]);
      const puvodni = text;
      if (r[0] === 'uvitani') text = text.replace(/ ?Shrnutí vyplněných údajů najdete v příloze\./, '');
      if (r[0] === 'notifikace_admin') {
        text = text.replace(/Jméno: \{jmeno\} \{prijmeni\}\n?/, '');
        if (text.indexOf('{platnost_dni}') < 0) {
          text = text.replace(/\s*$/, '') + '\n\n' +
            'Odkaz vás rovnou přihlásí do dashboardu a platí {platnost_dni} dny.\n\n' +
            'Tento e-mail je určen pouze pro administrátora systému. Nedoporučujeme ho nikomu přeposílat ani s nikým sdílet.';
        }
      }
      if (text !== puvodni) shS.getRange(i + 2, 4).setValue(text);
    });
  }
  const shN = ss.getSheetByName(LISTY.NASTAVENI);
  if (shN && shN.getLastRow() > 1) {
    const klice = shN.getRange(2, 1, shN.getLastRow() - 1, 1).getValues();
    for (let i = klice.length - 1; i >= 0; i--) {
      if (klice[i][0] === 'priloha_pdf_zajemci') shN.deleteRow(i + 2);
      if (klice[i][0] === 'email_notifikace') {
        shN.getRange(i + 2, 3).setValue('Další adresy pro upozornění na nové zájemce (kromě administrátorů s Notifikace = ANO); více adres oddělte čárkou');
      }
      if (klice[i][0] === 'odkaz_dashboard') shN.deleteRow(i + 2);
      if (klice[i][0] === 'odkaz_gdpr' && !String(shN.getRange(i + 2, 2).getValue()).trim()) {
        shN.getRange(i + 2, 2).setValue('https://www.konep.cz/o-nas/gdpr/');
      }
    }
  }
}

function zajistiList_(ss, nazev, hlavicky) {
  let sh = ss.getSheetByName(nazev);
  if (!sh) sh = ss.insertSheet(nazev);
  if (sh.getLastColumn() === 0) {
    sh.getRange(1, 1, 1, hlavicky.length).setValues([hlavicky]);
  } else {
    const stavajici = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    const chybi = hlavicky.filter(h => stavajici.indexOf(h) < 0);
    if (chybi.length) {
      if (sh.getMaxColumns() < stavajici.length + chybi.length) {
        sh.insertColumnsAfter(sh.getMaxColumns(), stavajici.length + chybi.length - sh.getMaxColumns());
      }
      sh.getRange(1, stavajici.length + 1, 1, chybi.length).setValues([chybi]);
    }
  }
  sh.getRange(1, 1, 1, sh.getLastColumn())
    .setFontWeight('bold').setBackground('#1f5c45').setFontColor('#ffffff')
    .setVerticalAlignment('middle').setWrap(true);
  sh.setFrozenRows(1);
  return sh;
}

function doplnChybejiciRadky_(sh, radky) {
  const posl = sh.getLastRow();
  const klice = posl > 1 ? sh.getRange(2, 1, posl - 1, 1).getValues().map(r => String(r[0]).trim()) : [];
  const nove = radky.filter(r => klice.indexOf(String(r[0]).trim()) < 0);
  if (nove.length) sh.getRange(sh.getLastRow() + 1, 1, nove.length, nove[0].length).setValues(nove);
}

function seznamValidace_(hodnoty) {
  return SpreadsheetApp.newDataValidation().requireValueInList(hodnoty, true).setAllowInvalid(false).build();
}

function nastavFormatyDobrovolniku_(sh) {
  const h = hlavicky_(sh);
  const sl = nazev => h.indexOf(nazev) + 1;
  const maxR = sh.getMaxRows();
  const rozsah = nazev => sh.getRange(2, sl(nazev), maxR - 1, 1);

  POLE_CAS.forEach(p => rozsah(p).setNumberFormat('d. M. yyyy H:mm'));
  POLE_DATUM.forEach(p => rozsah(p).setNumberFormat('d. M. yyyy'));
  rozsah('Telefon').setNumberFormat('@');
  rozsah('PSČ').setNumberFormat('@');
  rozsah('Stav').setDataValidation(seznamValidace_(STAVY));

  if (sh.getConditionalFormatRules().length === 0) {
    const r = rozsah('Stav');
    sh.setConditionalFormatRules(STAVY.map(s => SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(s).setBackground(BARVY_STAVU[s]).setRanges([r]).build()));
  }
  sh.setColumnWidth(sl('ID'), 120);
  sh.setColumnWidth(sl('Oblasti zájmu'), 300);
  sh.setColumnWidth(sl('Zkušenosti a dovednosti'), 300);
  sh.setColumnWidth(sl('Upozornění'), 220);
  sh.setFrozenColumns(4);
}

// ===== KONFIGURACE PRO WEB ====================================

function konfiguraceFormulare_() {
  const n = nastaveni_();
  return {
    nazev: String(n.nazev_organizace || 'Dobrovolnické centrum'),
    podnazev: String(n.podnazev_organizace || ''),
    nadpis: String(n.nadpis_formulare || 'Registrace dobrovolníka'),
    uvod: String(n.uvodni_text_formulare || ''),
    vzdelani: VZDELANI,
    googleClientId: String(n.google_client_id || '').trim(),
    oblasti: seznam_(LISTY.OBLASTI),
    mista: seznam_(LISTY.MISTA),
    dostupnost: DOSTUPNOST,
    zdroje: ZDROJE,
    kontakty: KONTAKTY,
    minVek: Number(n.minimalni_vek) || 0,
    odkazGdpr: String(n.odkaz_gdpr || ''),
    textPoOdeslani: String(n.text_po_odeslani || 'Děkujeme, registrace byla odeslána.')
  };
}

// ===== ZPRACOVÁNÍ REGISTRACE ==================================

function odeslatRegistraci(d) {
  d = d || {};
  if (d.web_hp) return { ok: true, id: '', text: 'Děkujeme.' };
  const doba = Number(d.dobaVyplneni);
  if (!(doba >= 3000)) {
    throw new Error('Formulář byl odeslán příliš rychle. Zkuste to prosím znovu.');
  }

  const n = nastaveni_();
  const data = ocistiAValiduj_(d, n);
  const sh = list_(LISTY.DOBROVOLNICI);
  const hlav = hlavicky_(sh);
  const ted = new Date();

  const mista = data.mista.slice();
  if (data.mistoJine) mista.push('Jiné: ' + data.mistoJine);

  const zaznam = {
    'Časové razítko': ted,
    'Titul': data.titul,
    'Jméno': data.jmeno,
    'Příjmení': data.prijmeni,
    'Datum narození': data.datumNarozeni,
    'E-mail': data.email,
    'Telefon': data.telefon,
    'Ulice a č.p.': data.ulice,
    'Obec': data.obec,
    'PSČ': data.psc,
    'Preferovaný kontakt': data.kontakt,
    'Oblasti zájmu': data.oblasti.join(', '),
    'Oblast – jiné': data.oblastJine,
    'Preferované místo': mista.join(', '),
    'Dostupnost': data.dostupnost.join(', '),
    'Zkušenosti a dovednosti': data.zkusenosti,
    'Zaměstnání / studium': data.zamestnani,
    'Vzdělání': data.vzdelani,
    'Jak se o nás dozvěděl/a': data.zdroj,
    'Souhlas GDPR': 'ANO – ' + Utilities.formatDate(ted, TZ, 'd. M. yyyy H:mm'),
    'Stav': 'Nový zájemce'
  };

  let id, radek;
  const zamek = LockService.getScriptLock();
  zamek.waitLock(30000);
  try {
    id = dalsiCislo_(String(n.prefix_id || 'DC'), sh, hlav, 'ID');
    zaznam['ID'] = id;
    const dup = najdiPodleEmailu_(sh, hlav, data.email);
    if (dup) zaznam['Upozornění'] = 'Možná duplicita s ' + dup;
    sh.appendRow(hlav.map(h => bunka_(zaznam.hasOwnProperty(h) ? zaznam[h] : '')));
    radek = sh.getLastRow();
    SpreadsheetApp.flush();
  } finally {
    zamek.releaseLock();
  }

  const chyby = [];
  const zpravy = [];
  let slozka = null, pdf = null;

  try { slozka = vytvorOsobniSlozku_(n, id, data.jmeno, data.prijmeni); }
  catch (err) { chyby.push('Složka: ' + err.message); }

  try { pdf = vytvorRegistracniPdf_(n, id, data, zaznam); }
  catch (err) { chyby.push('PDF: ' + err.message); }

  try { if (slozka && pdf) slozka.createShortcut(pdf.getId()); }
  catch (err) { chyby.push('Zástupce PDF: ' + err.message); }

  const promenne = {
    id: id, jmeno: data.jmeno, prijmeni: data.prijmeni,
    nazev_organizace: String(n.nazev_organizace || ''),
    odkaz_detail: odkazNaDetail_(n, id, sh, radek)
  };

  try {
    posliSablonu_('uvitani', data.email, promenne, n);
    zpravy.push('Uvítací e-mail odeslán');
  } catch (err) { chyby.push('E-mail zájemci: ' + err.message); }

  try {
    const r = posliNotifikace_(n, promenne);
    if (r.odeslano.length) zpravy.push('Notifikace odeslána na ' + r.odeslano.join(', '));
    if (r.chyby.length) chyby.push('Notifikace: ' + r.chyby.join('; '));
    if (!r.odeslano.length && !r.chyby.length) chyby.push('Notifikace: žádný příjemce (Administrátoři s Notifikace = ANO ani email_notifikace)');
  } catch (err) { chyby.push('Notifikace: ' + err.message); }

  const doplnit = { 'Naposledy upraveno': ted, 'Upravil/a': 'registrační formulář' };
  if (slozka) doplnit['Složka'] = slozka.getUrl();
  if (pdf) doplnit['Registrace (PDF)'] = pdf.getUrl();
  if (chyby.length) {
    doplnit['Upozornění'] = [zaznam['Upozornění'], chyby.join('; ')].filter(String).join(' | ');
  }
  zapisDoRadku_(sh, radek, hlav, doplnit);

  log_('Nová registrace', id, zpravy.concat(chyby).join('; '));
  return { ok: true, id: id, text: String(n.text_po_odeslani || '') };
}

function ocistiAValiduj_(d, n) {
  const t = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 200);
  const pole = v => [].concat(v || []).map(x => String(x).trim());

  const o = {
    titul: t(d.titul, 40),
    jmeno: t(d.jmeno, 100),
    prijmeni: t(d.prijmeni, 100),
    email: t(d.email, 200).toLowerCase(),
    telefon: t(d.telefon, 40),
    ulice: t(d.ulice, 200),
    obec: t(d.obec, 100),
    psc: t(d.psc, 10),
    kontakt: KONTAKTY.indexOf(t(d.kontakt, 20)) >= 0 ? t(d.kontakt, 20) : '',
    oblastJine: t(d.oblastJine, 200),
    mistoJine: t(d.mistoJine, 200),
    zkusenosti: t(d.zkusenosti, 2000),
    zamestnani: t(d.zamestnani, 200),
    vzdelani: VZDELANI.indexOf(t(d.vzdelani, 60)) >= 0 ? t(d.vzdelani, 60) : '',
    zdroj: ZDROJE.indexOf(t(d.zdroj, 100)) >= 0 ? t(d.zdroj, 100) : ''
  };

  if (!o.jmeno || !o.prijmeni) throw new Error('Vyplňte prosím jméno a příjmení.');
  if (!platnyEmail_(o.email)) throw new Error('Zkontrolujte prosím e-mailovou adresu.');
  if (!o.ulice || !o.obec || !o.psc) throw new Error('Vyplňte prosím celou adresu trvalého bydliště.');
  if (!/^\d{3}\s?\d{2}$/.test(o.psc)) throw new Error('PSČ má mít 5 číslic (např. 530 02).');
  if (!/^[+0-9 ()\-\/]{6,}$/.test(o.telefon)) throw new Error('Zkontrolujte prosím telefonní číslo.');
  if (!o.zamestnani) throw new Error('Vyplňte prosím současné zaměstnání nebo studium.');
  if (!o.vzdelani) throw new Error('Vyberte prosím nejvyšší dokončené vzdělání.');

  const dn = parsujDatum_(d.datumNarozeni);
  if (!dn || dn > new Date() || dn.getFullYear() < 1900) throw new Error('Vyplňte prosím platné datum narození.');
  const minVek = Number(n.minimalni_vek) || 0;
  if (minVek && vek_(dn) < minVek) {
    throw new Error('Pro registraci je potřeba mít alespoň ' + minVek + ' let. Pokud jste mladší, ozvěte se nám prosím e-mailem.');
  }
  o.datumNarozeni = dn;

  const povoleneOblasti = seznam_(LISTY.OBLASTI).concat(['Jiné']);
  o.oblasti = pole(d.oblasti).filter(x => povoleneOblasti.indexOf(x) >= 0);
  if (o.oblasti.indexOf('Jiné') >= 0 && !o.oblastJine) throw new Error('Upřesněte prosím oblast „Jiné“.');

  const povolenaMista = seznam_(LISTY.MISTA);
  o.mista = pole(d.mista).filter(x => povolenaMista.indexOf(x) >= 0);
  o.dostupnost = pole(d.dostupnost).filter(x => DOSTUPNOST.indexOf(x) >= 0);

  if (d.gdpr !== true) throw new Error('Pro odeslání je potřeba souhlas se zpracováním osobních údajů.');
  return o;
}

// Další číslo v řadě PREFIX-ROK-0001 (pro ID dobrovolníků i čísla smluv)
function dalsiCislo_(prefix, sh, hlav, sloupec) {
  prefix = prefix.trim();
  const rok = Utilities.formatDate(new Date(), TZ, 'yyyy');
  const props = PropertiesService.getScriptProperties();
  const klic = 'SEQ_' + sloupec + '_' + prefix + '_' + rok;
  let cislo = Number(props.getProperty(klic) || 0);

  const sl = hlav.indexOf(sloupec) + 1;
  if (sl > 0 && sh.getLastRow() > 1) {
    const vzor = new RegExp('^' + prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '-' + rok + '-(\\d+)$');
    sh.getRange(2, sl, sh.getLastRow() - 1, 1).getValues().forEach(r => {
      const m = String(r[0]).match(vzor);
      if (m) cislo = Math.max(cislo, Number(m[1]));
    });
  }
  // ID smazaných dobrovolníků zůstávají v listu Hodiny – nesmí se znovu přidělit
  if (sloupec === 'ID') {
    const shH = ss_().getSheetByName(LISTY.HODINY);
    if (shH && shH.getLastRow() > 1) {
      const vzor = new RegExp('^' + prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '-' + rok + '-(\\d+)$');
      shH.getRange(2, 2, shH.getLastRow() - 1, 1).getValues().forEach(r => {
        const m = String(r[0]).trim().match(vzor);
        if (m) cislo = Math.max(cislo, Number(m[1]));
      });
    }
  }
  cislo++;
  props.setProperty(klic, String(cislo));
  return prefix + '-' + rok + '-' + String(cislo).padStart(4, '0');
}

// Příjemci notifikace: aktivní administrátoři s Notifikace = ANO (dostanou osobní
// přihlašovací odkaz) + další adresy z Nastavení (dostanou jen běžný odkaz na dashboard)
function prijemciNotifikace_(n) {
  const admini = [], dalsi = [];
  const sh = ss_().getSheetByName(LISTY.ADMINI);
  if (sh && sh.getLastRow() > 1) {
    const h = hlavicky_(sh);
    const iN = h.indexOf('Notifikace');
    sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues().forEach(r => {
      const e = String(r[0] || '').trim().toLowerCase();
      const aktivni = String(r[3]).trim().toUpperCase() !== 'NE';
      const chce = iN < 0 || String(r[iN]).trim().toUpperCase() !== 'NE';
      if (aktivni && chce && platnyEmail_(e) && admini.indexOf(e) < 0) admini.push(e);
    });
  }
  String(n.email_notifikace || '').split(/[,;\s]+/).forEach(e => {
    e = String(e || '').trim().toLowerCase();
    if (platnyEmail_(e) && admini.indexOf(e) < 0 && dalsi.indexOf(e) < 0) dalsi.push(e);
  });
  return { admini: admini, dalsi: dalsi };
}

// Pošle notifikaci každému příjemci zvlášť; administrátoři dostanou osobní odkaz
function posliNotifikace_(n, promenne) {
  const p = prijemciNotifikace_(n);
  const vysledek = { odeslano: [], chyby: [] };
  const dni = Number(n.platnost_odkazu_dni) || 3;
  const web = webAdresa_(n);
  const posli = (komu, odkaz) => {
    try {
      posliSablonu_('notifikace_admin', komu, Object.assign({}, promenne, { odkaz_detail: odkaz, platnost_dni: dni }), n);
      vysledek.odeslano.push(komu);
    } catch (e) { vysledek.chyby.push(komu + ': ' + e.message); }
  };
  p.admini.forEach(email => {
    let odkaz = promenne.odkaz_detail;
    if (web) {
      const t = vytvorVstupniOdkaz_(email, dni);
      odkaz = web + 'dashboard.html?id=' + encodeURIComponent(promenne.id) + '&vstup=' + t;
    }
    posli(email, odkaz);
  });
  p.dalsi.forEach(email => posli(email, promenne.odkaz_detail));
  return vysledek;
}

function najdiPodleEmailu_(sh, hlav, email) {
  if (sh.getLastRow() < 2) return '';
  const se = hlav.indexOf('E-mail'), si = hlav.indexOf('ID');
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, hlav.length).getValues();
  const nalez = data.find(r => String(r[se]).trim().toLowerCase() === email);
  return nalez ? String(nalez[si]) : '';
}

// Adresa webu na GitHub Pages, vždy zakončená lomítkem
function webAdresa_(n) {
  let v = String((n && n.web_adresa) || '').trim().split('?')[0].split('#')[0];
  if (!v) return '';
  v = v.replace(/(index|dashboard)\.html$/, '');
  return v.endsWith('/') ? v : v + '/';
}

function odkazNaDetail_(n, id, sh, radek) {
  const base = webAdresa_(n);
  if (base) return base + 'dashboard.html?id=' + encodeURIComponent(id);
  if (sh && radek) return ss_().getUrl() + '#gid=' + sh.getSheetId() + '&range=A' + radek;
  return ss_().getUrl();
}

// ===== SLOŽKY A PDF ===========================================

function vytvorOsobniSlozku_(n, id, jmeno, prijmeni) {
  const rodic = slozkaZNastaveni_(n.slozka_dobrovolnici, 'slozka_dobrovolnici');
  const nazev = id + ' ' + prijmeni + ' ' + jmeno;
  const existujici = rodic.getFoldersByName(nazev);
  return existujici.hasNext() ? existujici.next() : rodic.createFolder(nazev);
}

function vytvorRegistracniPdf_(n, id, data, zaznam) {
  const slozka = slozkaZNastaveni_(n.slozka_registrace, 'slozka_registrace');
  // Položky v pořadí registračního formuláře
  const radky = [
    ['ID', id],
    ['Datum registrace', Utilities.formatDate(zaznam['Časové razítko'], TZ, 'd. M. yyyy H:mm')],
    ['Jméno', data.jmeno],
    ['Příjmení', data.prijmeni],
    ['Titul', data.titul],
    ['Datum narození', Utilities.formatDate(data.datumNarozeni, TZ, 'd. M. yyyy')],
    ['Trvalé bydliště – ulice, č.p.', data.ulice],
    ['Trvalé bydliště – město', data.obec],
    ['Trvalé bydliště – PSČ', data.psc],
    ['Telefon', data.telefon],
    ['E-mail', data.email],
    ['Současné zaměstnání nebo studium', data.zamestnani],
    ['Nejvyšší dokončené vzdělání', data.vzdelani],
    ['Zájmy, dovednosti, zkušenosti', data.zkusenosti],
    ['Souhlas se zpracováním osobních údajů', zaznam['Souhlas GDPR']]
  ];
  const html =
    '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;color:#222;font-size:11pt;margin:30px}' +
    'h1{font-size:17pt;margin:0 0 4px;color:#1f5c45}.org{color:#666;margin:0 0 22px}' +
    'table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #ddd;padding:7px 6px;vertical-align:top}' +
    'td.k{width:34%;color:#555;font-weight:bold}.pata{margin-top:28px;color:#888;font-size:9pt}' +
    '</style></head><body>' +
    '<h1>Registrace zájemce o dobrovolnictví</h1>' +
    '<p class="org">' + esc_(n.nazev_organizace) + '</p><table>' +
    radky.map(r => '<tr><td class="k">' + esc_(r[0]) + '</td><td>' + esc_(r[1]).replace(/\n/g, '<br>') + '</td></tr>').join('') +
    '</table><p class="pata">Dokument byl vytvořen automaticky z online registračního formuláře.</p></body></html>';

  const nazev = id + '_' + data.prijmeni + '_' + data.jmeno + '_registrace.pdf';
  const blob = Utilities.newBlob(html, MimeType.HTML, 'registrace.html').getAs(MimeType.PDF).setName(nazev);
  return slozka.createFile(blob);
}

function slozkaZNastaveni_(hodnota, klic) {
  const id = extrahujId_(hodnota);
  if (!id) throw new Error('V listu Nastavení chybí „' + klic + '“.');
  return DriveApp.getFolderById(id);
}

function extrahujId_(v) {
  const m = String(v || '').match(/[-\w]{25,}/);
  return m ? m[0] : '';
}

// ===== E-MAILY ================================================

function posliSablonu_(klic, komu, promenne, n) {
  const s = sablona_(klic);
  if (!s) throw new Error('Šablona „' + klic + '“ neexistuje.');
  const predmet = dosad_(s.predmet, promenne);
  const text = dosad_(s.text, promenne);
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#222">' +
    esc_(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>') + '</div>';
  const zprava = {
    to: komu, subject: predmet, body: text, htmlBody: html,
    name: String(n.nazev_organizace || 'Dobrovolnické centrum')
  };
  if (n.email_odpovedi) zprava.replyTo = String(n.email_odpovedi);
  MailApp.sendEmail(zprava);
}

function sablona_(klic) {
  const v = list_(LISTY.SABLONY).getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim() === klic) return { predmet: String(v[i][2]), text: String(v[i][3]) };
  }
  return null;
}

function dosad_(text, promenne) {
  return String(text).replace(/\{(\w+)\}/g, (cele, k) => promenne.hasOwnProperty(k) ? String(promenne[k]) : cele);
}

// ===== POMOCNÉ FUNKCE =========================================

function ss_() {
  if (MEMO.ss) return MEMO.ss;
  MEMO.ss = ss__();
  return MEMO.ss;
}

function ss__() {
  const id = PropertiesService.getScriptProperties().getProperty('SS_ID') || SS_ID_VYCHOZI;
  try { return SpreadsheetApp.openById(id); }
  catch (e) { return SpreadsheetApp.getActive(); }
}

function list_(nazev) {
  const sh = ss_().getSheetByName(nazev);
  if (!sh) throw new Error('Chybí list „' + nazev + '“. Spusťte prosím nastavTabulku().');
  return sh;
}

function hlavicky_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
}

function nastaveni_() {
  if (MEMO.nastaveni) return MEMO.nastaveni;
  const v = list_(LISTY.NASTAVENI).getDataRange().getValues();
  const o = {};
  for (let i = 1; i < v.length; i++) if (v[i][0] !== '') o[String(v[i][0]).trim()] = v[i][1];
  MEMO.nastaveni = o;
  return o;
}

function seznam_(nazevListu) {
  const sh = list_(nazevListu);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues()
    .filter(r => String(r[0]).trim() && String(r[1]).trim().toUpperCase() !== 'NE')
    .map(r => String(r[0]).trim());
}

function zapisDoRadku_(sh, radek, hlav, hodnoty) {
  Object.keys(hodnoty).forEach(k => {
    const i = hlav.indexOf(k);
    if (i >= 0) sh.getRange(radek, i + 1).setValue(bunka_(hodnoty[k]));
  });
}

// Ochrana proti vložení vzorce (=, +, -, @ na začátku)
function bunka_(v) {
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

// 'yyyy-mm-dd' → Date v poledne (poledne = žádný posun dne kvůli časovým pásmům)
function parsujDatum_(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

function platnyEmail_(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || ''));
}

function vek_(dn) {
  const d = new Date();
  let v = d.getFullYear() - dn.getFullYear();
  if (d.getMonth() < dn.getMonth() || (d.getMonth() === dn.getMonth() && d.getDate() < dn.getDate())) v--;
  return v;
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function log_(akce, id, detail) {
  try {
    const sh = ss_().getSheetByName(LISTY.LOG);
    if (!sh) return;
    const kdo = AKTUALNI_UZIVATEL || 'web';
    sh.appendRow([new Date(), kdo, akce, id || '', bunka_(String(detail || '').slice(0, 1000))]);
  } catch (e) { console.error(e); }
}

function upozorni_(text) {
  try { SpreadsheetApp.getUi().alert(text); } catch (e) { console.log(text); }
}

// ===== NÁSTROJE Z MENU ========================================

function zobrazOdkaz() {
  const web = webAdresa_(nastaveni_());
  let api = '';
  try { api = ScriptApp.getService().getUrl() || ''; } catch (e) { api = ''; }
  upozorni_(
    (web
      ? 'Registrační formulář (odkaz na web organizace):\n' + web + '\n\nZápis hodin pro dobrovolníky (odkaz na web organizace):\n' + web + 'hodiny.html\n\nDashboard:\n' + web + 'dashboard.html'
      : 'V listu Nastavení zatím chybí web_adresa (adresa GitHub Pages).') +
    '\n\nAdresa API (patří do config.js na GitHubu) najdete v Apps Scriptu:\nNasadit → Spravovat nasazení → Adresa URL webové aplikace' +
    (api ? '\n(Google uvádí: ' + api + ')' : ''));
}

function testovaciRegistrace() {
  const ja = Session.getEffectiveUser().getEmail();
  const vysledek = odeslatRegistraci({
    dobaVyplneni: 10000,
    jmeno: 'Testovací', prijmeni: 'Zájemce', datumNarozeni: '1990-05-15',
    email: ja, telefon: '+420 777 123 456', ulice: 'Pernštýnská 1', obec: 'Pardubice', psc: '530 02',
    zamestnani: 'Student', vzdelani: 'Středoškolské s maturitou',
    kontakt: 'E-mail', oblasti: [VYCHOZI_OBLASTI[0], VYCHOZI_OBLASTI[2]],
    mista: ['Pardubice'], dostupnost: ['Víkendy'], zkusenosti: 'Toto je testovací registrace.',
    zdroj: 'Web', gdpr: true
  });
  upozorni_('Testovací registrace vytvořena: ' + vysledek.id +
    '\n\nCo se odeslalo, uvidíte v listu „Log změn“ (poslední řádek).' +
    '\n\nPozor: e-maily, které účet posílá sám sobě, Gmail často zobrazí jen v Odeslané poště, ne v Doručené.');
}

function testNotifikace() {
  const n = nastaveni_();
  const ja = Session.getEffectiveUser().getEmail();
  const r = posliNotifikace_(n, {
    id: 'TEST-0000', jmeno: 'Test', prijmeni: 'Test',
    nazev_organizace: String(n.nazev_organizace || ''), odkaz_detail: odkazNaDetail_(n, 'TEST-0000')
  });
  if (!r.odeslano.length && !r.chyby.length) {
    return upozorni_('Notifikace nemá komu přijít. V listu Administrátoři nastavte u někoho Notifikace = ANO, nebo vyplňte email_notifikace v Nastavení.');
  }
  log_('Test notifikace', '', 'Odesláno na ' + r.odeslano.join(', ') + (r.chyby.length ? '; chyby: ' + r.chyby.join('; ') : ''));
  upozorni_('Testovací notifikace odeslána na:\n' + (r.odeslano.join('\n') || '–') +
    (r.chyby.length ? '\n\nChyby:\n' + r.chyby.join('\n') : '') +
    '\n\nOdesílá ji účet: ' + ja +
    '\nZbývající denní limit e-mailů: ' + MailApp.getRemainingDailyQuota() +
    '\n\nPokud nedorazí, zkontrolujte složku Spam.');
}

// Vynuluje počítadla ID a čísel smluv. Bezpečné: nové číslo nikdy nebude nižší
// než nejvyšší číslo, které v tabulce zůstalo, takže nevzniknou duplicity.
function vynulujCislovani() {
  const props = PropertiesService.getScriptProperties();
  const klice = Object.keys(props.getProperties()).filter(k => k.indexOf('SEQ_') === 0 || k.indexOf('ID_SEQ_') === 0);
  klice.forEach(k => props.deleteProperty(k));
  log_('Vynulováno číslování', '', klice.length + ' počítadel');
  const sh = list_(LISTY.DOBROVOLNICI);
  upozorni_('Číslování vynulováno.\n\n' + (sh.getLastRow() > 1
    ? 'V tabulce ještě jsou záznamy nebo hodiny – další ID naváže na nejvyšší z nich.'
    : 'Tabulka je prázdná – další registrace dostane číslo 0001.'));
}
