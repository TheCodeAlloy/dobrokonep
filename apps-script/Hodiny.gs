/**
 * DOBROVOLNICKÉ CENTRUM – DOBROVOLNICKÉ HODINY (fáze 1)
 * --------------------------------------------------------------
 * - přiřazení dobrovolníků k organizacím (dobrovolník může mít víc organizací)
 * - katalog činností (pro všechny organizace nebo pro konkrétní organizaci)
 * - zápis hodin v dashboardu: jednotlivě nebo za akci (více dobrovolníků); vždy od–do
 * - schvalování, mazání, uzávěrka měsíců
 *
 * Čas se ukládá v minutách (sloupec „Minut“), zaokrouhleno na 5 minut.
 * Sloupec „Počet hodin“ je jen pro čitelnost v tabulce (desetinné číslo).
 */

const SLOUPCE_HODINY = [
  'ID záznamu', 'ID dobrovolníka', 'Datum', 'Počet hodin', 'Organizace', 'Činnost',
  'Stav', 'Zapsal/a', 'Časové razítko', 'Potvrdila organizace', 'Potvrdil dobrovolník',
  'ID organizace', 'Čas od', 'Čas do', 'Minut', 'Poznámka', 'Zdroj', 'ID akce', 'Upraveno', 'Upravil/a', 'Role zapisujícího'
];
// Měsíc dobrovolníka u organizace: schválením se zamkne; odemknout smí jen Hlavní admin (řádek zůstane, stav „Odemčeno“)
const SLOUPCE_MESICE = ['ID dobrovolníka', 'ID organizace', 'Měsíc', 'Stav', 'Schválil/a', 'Schváleno', 'Odemkl/a', 'Odemčeno', 'Důvod odemčení', 'Minut'];
const SLOUPCE_HISTORIE = ['Čas', 'Kdo', 'Role', 'Akce', 'ID záznamu', 'ID dobrovolníka', 'Detail'];
// Fotky papírových výkazů: soubor je v osobní složce dobrovolníka (podsložka „Výkazy hodin“), zobrazuje se jen přes API s ověřením
const SLOUPCE_FOTKY = ['ID fotky', 'ID dobrovolníka', 'ID organizace', 'Měsíc', 'ID souboru', 'Nahrál/a', 'Role', 'Nahráno'];
const ZPUSOBY_VYKAZOVANI = ['Sám', 'Organizace podle papírového výkazu'];
const MAX_FOTEK_MESIC = 10;
const MAX_FOTKA_ZNAKU = 4500000;   // base64; klient fotku zmenší na cca 1600 px (JPEG, stovky kB)
const SLOUPCE_PRIRAZENI = [
  'ID přiřazení', 'ID dobrovolníka', 'ID organizace', 'Organizace', 'Od', 'Do', 'Aktivní',
  'Poznámka', 'Vytvořeno', 'Vytvořil/a', 'Způsob vykazování'
];
const SLOUPCE_CINNOSTI = ['Organizace', 'Činnost', 'Aktivní'];
const VSECHNY_ORGANIZACE = 'Všechny organizace';
const VYCHOZI_CINNOSTI = [
  'Pomoc na akci', 'Doprovod / návštěva', 'Doučování', 'Volnočasové aktivity',
  'Úklid / údržba', 'Administrativa', 'Pomoc v provozu'
];
const STAVY_HODIN = ['Ke schválení', 'Schváleno', 'Zamítnuto'];

// ===== NASTAVENÍ LISTŮ (volá nastavTabulku) ===================

function nastavListyHodin_(ss) {
  const shH = zajistiList_(ss, LISTY.HODINY, SLOUPCE_HODINY);
  const h = hlavicky_(shH);
  const maxR = shH.getMaxRows();
  const sl = n => shH.getRange(2, h.indexOf(n) + 1, maxR - 1, 1);
  sl('Datum').setNumberFormat('d. M. yyyy');
  sl('Časové razítko').setNumberFormat('d. M. yyyy H:mm');
  sl('Upraveno').setNumberFormat('d. M. yyyy H:mm');
  sl('Čas od').setNumberFormat('@');
  sl('Čas do').setNumberFormat('@');
  sl('Počet hodin').setNumberFormat('0.00');

  const shM = zajistiList_(ss, LISTY.MESICE, SLOUPCE_MESICE);
  shM.getRange(2, 3, shM.getMaxRows() - 1, 1).setNumberFormat('@');
  shM.getRange(2, 6, shM.getMaxRows() - 1, 1).setNumberFormat('d. M. yyyy H:mm');
  shM.getRange(2, 8, shM.getMaxRows() - 1, 1).setNumberFormat('d. M. yyyy H:mm');
  const shHi = zajistiList_(ss, LISTY.HISTORIE, SLOUPCE_HISTORIE);
  shHi.getRange(2, 1, shHi.getMaxRows() - 1, 1).setNumberFormat('d. M. yyyy H:mm:ss');

  const shKo = zajistiList_(ss, LISTY.KORDORG, SLOUPCE_KORDORG);
  shKo.getRange('D2:D').setDataValidation(seznamValidace_(['ANO', 'NE']));
  shKo.setColumnWidth(1, 240).setColumnWidth(2, 200).setColumnWidth(3, 160);

  prevedZpusobNaPrirazeni_();

  const shFo = zajistiList_(ss, LISTY.FOTKY, SLOUPCE_FOTKY);
  shFo.getRange(2, 4, shFo.getMaxRows() - 1, 1).setNumberFormat('@');
  shFo.getRange(2, 8, shFo.getMaxRows() - 1, 1).setNumberFormat('d. M. yyyy H:mm');

  const shP = zajistiList_(ss, LISTY.PRIRAZENI, SLOUPCE_PRIRAZENI);
  const hp = hlavicky_(shP);
  shP.getRange(2, hp.indexOf('Od') + 1, shP.getMaxRows() - 1, 2).setNumberFormat('d. M. yyyy');
  shP.getRange(2, hp.indexOf('Vytvořeno') + 1, shP.getMaxRows() - 1, 1).setNumberFormat('d. M. yyyy H:mm');

  const shC = zajistiList_(ss, LISTY.CINNOSTI, SLOUPCE_CINNOSTI);
  doplnChybejiciRadkyCinnosti_(shC);
  shC.getRange('C2:C').setDataValidation(seznamValidace_(['ANO', 'NE']));
  shC.setColumnWidth(1, 220).setColumnWidth(2, 280);

  doplnIdOrganizaci_();
  prevedStareOrganizace_();
}

// Jednorázově: dřívější „Způsob vykazování“ u dobrovolníka se přenese na jeho přiřazení (nově je u dvojice dobrovolník + organizace)
function prevedZpusobNaPrirazeni_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('ZPUSOB_PREVEDEN')) return;
  const shD = ss_().getSheetByName(LISTY.DOBROVOLNICI), shP = ss_().getSheetByName(LISTY.PRIRAZENI);
  if (shD && shP && shD.getLastRow() > 1 && shP.getLastRow() > 1) {
    const hd = hlavicky_(shD), iId = hd.indexOf('ID'), iZ = hd.indexOf('Způsob vykazování');
    const hp = hlavicky_(shP), jZ = hp.indexOf('Způsob vykazování');
    if (iZ >= 0 && jZ >= 0) {
      const papir = {};
      shD.getRange(2, 1, shD.getLastRow() - 1, hd.length).getValues().forEach(r => { if (String(r[iZ]).trim() === ZPUSOBY_VYKAZOVANI[1]) papir[String(r[iId]).trim()] = true; });
      const rng = shP.getRange(2, 1, shP.getLastRow() - 1, hp.length), v = rng.getValues();
      let zmena = false;
      v.forEach(r => { if (papir[String(r[1]).trim()] && !String(r[jZ]).trim()) { r[jZ] = ZPUSOBY_VYKAZOVANI[1]; zmena = true; } });
      if (zmena) rng.setValues(v);
    }
  }
  props.setProperty('ZPUSOB_PREVEDEN', 'ANO');
}

function doplnChybejiciRadkyCinnosti_(sh) {
  if (sh.getLastRow() > 1) return; // výchozí činnosti jen do prázdného listu
  sh.getRange(2, 1, VYCHOZI_CINNOSTI.length, 3).setValues(VYCHOZI_CINNOSTI.map(c => [VSECHNY_ORGANIZACE, c, 'ANO']));
}

// Organizace zadané ručně v tabulce nemusí mít ID – doplníme ORG-001…
function doplnIdOrganizaci_() {
  const sh = list_(LISTY.ORGANIZACE);
  if (sh.getLastRow() < 2) return;
  const hlav = hlavicky_(sh);
  const iI = hlav.indexOf('ID'), iN = hlav.indexOf('Název');
  if (iI < 0 || iN < 0) return;
  const r = sh.getRange(2, iI + 1, sh.getLastRow() - 1, 1);
  const ids = r.getValues();
  const nazvy = sh.getRange(2, iN + 1, sh.getLastRow() - 1, 1).getValues();
  let max = 0;
  ids.forEach(x => { const m = String(x[0]).match(/^ORG-(\d+)$/); if (m) max = Math.max(max, +m[1]); });
  let zmena = false;
  ids.forEach((x, i) => {
    if (String(nazvy[i][0]).trim() && !String(x[0]).trim()) { max++; x[0] = 'ORG-' + String(max).padStart(3, '0'); zmena = true; }
  });
  if (zmena) { r.setValues(ids); delete MEMO.organizace; }
}

// Dřívější jedno pole „Organizace“ u dobrovolníka převedeme na přiřazení
function prevedStareOrganizace_() {
  const sh = list_(LISTY.DOBROVOLNICI);
  if (sh.getLastRow() < 2) return;
  const hlav = hlavicky_(sh);
  const iId = hlav.indexOf('ID'), iOrg = hlav.indexOf('Organizace'), iOd = hlav.indexOf('Dobrovolníkem od');
  const orgs = organizace_();
  const pr = prirazeni_();
  const nove = [];
  sh.getRange(2, 1, sh.getLastRow() - 1, hlav.length).getValues().forEach(r => {
    const id = String(r[iId]).trim();
    String(r[iOrg] || '').split(',').map(s => s.trim()).filter(String).forEach(nazev => {
      const o = orgs.find(x => x.nazev === nazev);
      if (!o || !id) return;
      if (pr.some(p => p.dobrovolnik === id && p.orgId === o.id)) return;
      if (nove.some(p => p[1] === id && p[2] === o.id)) return;
      nove.push([novyKlic_('PR'), id, o.id, o.nazev, r[iOd] instanceof Date ? r[iOd] : '', '', 'ANO', 'převedeno z pole Organizace', new Date(), 'systém']);
    });
  });
  if (nove.length) {
    const shP = list_(LISTY.PRIRAZENI);
    shP.getRange(shP.getLastRow() + 1, 1, nove.length, nove[0].length).setValues(nove);
  }
}

// ===== POMOCNÉ FUNKCE =========================================

function novyKlic_(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + '-' +
    Utilities.getUuid().replace(/-/g, '').slice(0, 5).toUpperCase();
}

function ymd_(d) { return d instanceof Date ? Utilities.formatDate(d, TZ, 'yyyy-MM-dd') : String(d || '').slice(0, 10); }

// ===== ROČNÍ VÝKAZ (dobrovolníci × měsíce, jen schválené hodiny) =====
const MESICE_VYKAZU = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

function vykazHlavicky_() {
  return ['Jméno', 'Datum narození', 'Trvalé bydliště', 'E-mail', 'Telefon', 'Zákonný zástupce',
    'Organizace 1', 'Organizace 2', 'Organizace 3', 'Místo výkonu', 'Číslo smlouvy', 'Datum smlouvy']
    .concat(MESICE_VYKAZU.map(m => m + ' (h)'), ['Celkem (h)']);
}

function rocniVykaz(token, rok) {
  overAdmin_(token, 'Koordinátor');
  return { hlavicky: vykazHlavicky_(), radky: sestavRocniVykaz_(rok) };
}

// Vytvoří Google tabulku s výkazem ve složce „Výkazy“ vedle složky smluv
function exportujRocniVykaz(token, rok) {
  overAdmin_(token, 'Koordinátor');
  const data = [vykazHlavicky_()].concat(sestavRocniVykaz_(rok));
  const ss = SpreadsheetApp.create('Výkaz práce ' + rok + ' – dobrovolníci');
  const sh = ss.getSheets()[0];
  sh.getRange(1, 1, data.length, data[0].length).setValues(data);
  sh.getRange(1, 1, 1, data[0].length).setFontWeight('bold');
  sh.setFrozenRows(1);
  DriveApp.getFileById(ss.getId()).moveTo(slozkaVedle_(nastaveni_(), 'Výkazy'));
  log_('Exportován roční výkaz', '', String(rok));
  return { url: ss.getUrl() };
}

function sestavRocniVykaz_(rok) {
  const r = Number(rok);
  const shH = list_(LISTY.HODINY);
  const hlavH = hlavicky_(shH);
  const hod = shH.getLastRow() > 1 ? shH.getRange(2, 1, shH.getLastRow() - 1, hlavH.length).getValues() : [];
  const iDobr = hlavH.indexOf('ID dobrovolníka'), iDatum = hlavH.indexOf('Datum');
  const iMin = hlavH.indexOf('Minut'), iStav = hlavH.indexOf('Stav');
  const minutyPodle = {};
  hod.forEach(row => {
    if (String(row[iStav]).trim() !== 'Schváleno') return;
    const d = ymd_(row[iDatum]);
    if (Number(d.slice(0, 4)) !== r) return;
    const id = String(row[iDobr]).trim();
    if (!minutyPodle[id]) minutyPodle[id] = new Array(12).fill(0);
    minutyPodle[id][Number(d.slice(5, 7)) - 1] += Number(row[iMin]) || 0;
  });
  const sh = list_(LISTY.DOBROVOLNICI);
  const hlav = hlavicky_(sh);
  const dob = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, hlav.length).getValues() : [];
  const radky = [];
  dob.forEach(row => {
    const z = {};
    hlav.forEach((h, i) => { z[h] = row[i]; });
    const minuty = minutyPodle[String(z['ID']).trim()];
    if (!minuty) return;
    const orgy = String(z['Organizace'] || '').split(',').map(s => s.trim()).filter(Boolean);
    const celkem = minuty.reduce((a, b) => a + b, 0);
    radky.push([
      [z['Příjmení'], z['Jméno']].filter(String).join(' '),
      datumCz_(z['Datum narození']),
      [z['Ulice a č.p.'], [z['PSČ'], z['Obec']].filter(String).join(' ')].filter(String).join(', '),
      z['E-mail'] || '', z['Telefon'] || '',
      [z['Zástupce – jméno'], z['Zástupce – e-mail'], z['Zástupce – telefon']].filter(String).join(', '),
      orgy[0] || '', orgy[1] || '', orgy[2] || '',
      z['Místo působení'] || '',
      z['Číslo smlouvy'] || '', datumCz_(z['Datum smlouvy'])
    ].concat(minuty.map(m => Math.round(m / 60 * 100) / 100), [Math.round(celkem / 60 * 100) / 100]));
  });
  return radky;
}

function datumCz_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'd. M. yyyy');
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? (+m[3]) + '. ' + (+m[2]) + '. ' + m[1] : String(v || '');
}

function slozkaVedle_(n, nazev) {
  const smlouvy = slozkaZNastaveni_(n.slozka_smlouvy, 'slozka_smlouvy');
  let rodic = smlouvy;
  try { const p = smlouvy.getParents(); if (p.hasNext()) rodic = p.next(); } catch (e) { rodic = smlouvy; }
  const it = rodic.getFoldersByName(nazev);
  return it.hasNext() ? it.next() : rodic.createFolder(nazev);
}

function hhmm_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'HH:mm');
  const m = String(v || '').trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? m[1].padStart(2, '0') + ':' + m[2] : '';
}

// Čas HH:MM → minuty od půlnoci; povolené jsou jen hodiny 0–24, minuty po 5 (24:00 je konec dne). Jinak null.
function minutyDne_(t) {
  const m = String(t == null ? '' : t).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 24 || mi > 55 || mi % 5 !== 0 || (h === 24 && mi !== 0)) return null;
  return h * 60 + mi;
}

// Délka v minutách z času od–do téhož dne (24:00 povoleno); chybně zadaný čas = výjimka s českou zprávou
function minutyZCasu_(od, doo) {
  const a = minutyDne_(od), b = minutyDne_(doo);
  if (a == null || b == null) throw new Error('Zadejte čas od i do (hodiny 0–24, minuty po 5).');
  if (b <= a) throw new Error('Čas „do“ musí být později než „od“ téhož dne (konec dne zadejte jako 24:00).');
  return b - a;
}

function zaokrouhli5_(m) { return Math.round(Number(m) / 5) * 5; }

function prirazeni_() {
  const sh = ss_().getSheetByName(LISTY.PRIRAZENI);
  if (!sh || sh.getLastRow() < 2) return [];
  const h = hlavicky_(sh), iZ = h.indexOf('Způsob vykazování');
  return sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues()
    .map((r, i) => ({
      radek: i + 2, id: String(r[0]), dobrovolnik: String(r[1]).trim(), orgId: String(r[2]).trim(), org: String(r[3]),
      od: ymd_(r[4]), do: ymd_(r[5]), aktivni: String(r[6]).trim().toUpperCase() !== 'NE', poznamka: String(r[7] || ''),
      zpusob: iZ >= 0 && String(r[iZ] || '').trim() === ZPUSOBY_VYKAZOVANI[1] ? ZPUSOBY_VYKAZOVANI[1] : ZPUSOBY_VYKAZOVANI[0],
      papir: iZ >= 0 && String(r[iZ] || '').trim() === ZPUSOBY_VYKAZOVANI[1]
    }))
    .filter(p => p.id && p.dobrovolnik);
}

function cinnosti_() {
  const sh = ss_().getSheetByName(LISTY.CINNOSTI);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues()
    .filter(r => String(r[1]).trim() && String(r[2]).trim().toUpperCase() !== 'NE')
    .map(r => ({ org: String(r[0]).trim() || VSECHNY_ORGANIZACE, cinnost: String(r[1]).trim() }));
}

function platnePrirazeni_(pr, dobrovolnik, orgId, datum) {
  return pr.some(p => p.dobrovolnik === dobrovolnik && p.orgId === orgId &&
    (!p.od || p.od <= datum) && (!p.do || datum <= p.do) && (p.aktivni || (p.do && datum <= p.do)));
}

function uzavrenoDo_(n) { return String(n.hodiny_uzavreno_do || '').trim().slice(0, 7); }

function overUzaverku_(a, n, datum) {
  const u = uzavrenoDo_(n);
  if (u && String(datum).slice(0, 7) <= u && a.role !== 'Hlavní admin') {
    throw new Error('Měsíc ' + String(datum).slice(0, 7) + ' je uzavřený. Změny může dělat jen hlavní admin.');
  }
}

function jmenaDobrovolniku_() {
  const sh = list_(LISTY.DOBROVOLNICI);
  const o = {};
  if (sh.getLastRow() < 2) return o;
  const h = hlavicky_(sh);
  const iId = h.indexOf('ID'), iT = h.indexOf('Titul'), iJ = h.indexOf('Jméno'), iP = h.indexOf('Příjmení');
  sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues().forEach(r => {
    const id = String(r[iId]).trim();
    if (id) o[id] = [iT >= 0 ? r[iT] : '', r[iJ], r[iP]].filter(String).join(' ');
  });
  return o;
}

// Sloupec „Organizace“ u dobrovolníka = názvy aktivních přiřazení (pro přehledy a smlouvu)
function synchronizujOrganizace_(idDobrovolnika) {
  const sh = list_(LISTY.DOBROVOLNICI);
  const hlav = hlavicky_(sh);
  let radek;
  try { radek = najdiRadek_(sh, hlav, idDobrovolnika); } catch (e) { return; }
  const dnes = ymd_(new Date());
  const nazvy = prirazeni_().filter(p => p.dobrovolnik === idDobrovolnika && p.aktivni && (!p.do || p.do >= dnes)).map(p => p.org);
  zapisDoRadku_(sh, radek, hlav, { 'Organizace': nazvy.filter((x, i) => nazvy.indexOf(x) === i).join(', ') });
}

// ===== PŘIŘAZENÍ K ORGANIZACÍM ================================

function pridejPrirazeni(token, idDobrovolnika, orgId, od, poznamka) {
  const a = overAdmin_(token, 'Koordinátor');
  const o = organizace_().find(x => x.id === String(orgId));
  if (!o) throw new Error('Organizace nebyla nalezena.');
  const odD = String(od || '').trim() ? parsujDatum_(od) : '';
  if (String(od || '').trim() && !odD) throw new Error('Neplatné datum.');
  return sZamkem_(() => {
    const sh = list_(LISTY.DOBROVOLNICI);
    najdiRadek_(sh, hlavicky_(sh), idDobrovolnika);
    const pr = prirazeni_();
    if (pr.some(p => p.dobrovolnik === idDobrovolnika && p.orgId === o.id && p.aktivni && !p.do)) {
      throw new Error('Dobrovolník už je k této organizaci přiřazený.');
    }
    list_(LISTY.PRIRAZENI).appendRow([novyKlic_('PR'), idDobrovolnika, o.id, bunka_(o.nazev), odD, '', 'ANO',
      bunka_(String(poznamka || '').slice(0, 300)), new Date(), a.email]);
    synchronizujOrganizace_(idDobrovolnika);
    log_('Přiřazení k organizaci', idDobrovolnika, o.nazev);
    return { prirazeni: prirazeni_() };
  });
}

function ukonciPrirazeni(token, idPrirazeni, datumDo) {
  const a = overAdmin_(token, 'Koordinátor');
  return sZamkem_(() => {
    const p = prirazeni_().find(x => x.id === String(idPrirazeni));
    if (!p) throw new Error('Přiřazení nebylo nalezeno.');
    const sh = list_(LISTY.PRIRAZENI);
    const doD = parsujDatum_(String(datumDo || ymd_(new Date())));
    if (!doD) throw new Error('Neplatné datum.');
    sh.getRange(p.radek, 6, 1, 2).setValues([[doD, 'NE']]);
    synchronizujOrganizace_(p.dobrovolnik);
    log_('Ukončeno přiřazení', p.dobrovolnik, p.org + ' k ' + ymd_(doD) + ' (' + a.email + ')');
    return { prirazeni: prirazeni_() };
  });
}

function upravPrirazeni(token, idPrirazeni, od, doo) {
  overAdmin_(token, 'Koordinátor');
  const odD = String(od || '').trim() ? parsujDatum_(od) : '';
  const doD = String(doo || '').trim() ? parsujDatum_(doo) : '';
  if ((String(od || '').trim() && !odD) || (String(doo || '').trim() && !doD)) throw new Error('Neplatné datum.');
  if (odD && doD && doD < odD) throw new Error('Datum „do“ je dřív než „od“.');
  return sZamkem_(() => {
    const p = prirazeni_().find(x => x.id === String(idPrirazeni));
    if (!p) throw new Error('Přiřazení nebylo nalezeno.');
    list_(LISTY.PRIRAZENI).getRange(p.radek, 5, 1, 3).setValues([[odD, doD, doD && ymd_(doD) < ymd_(new Date()) ? 'NE' : 'ANO']]);
    synchronizujOrganizace_(p.dobrovolnik);
    log_('Úprava přiřazení', p.dobrovolnik, p.org + ': ' + (ymd_(odD) || 'od začátku') + ' – ' + (ymd_(doD) || 'dosud'));
    return { prirazeni: prirazeni_() };
  });
}

function obnovPrirazeni(token, idPrirazeni) {
  overAdmin_(token, 'Koordinátor');
  return sZamkem_(() => {
    const p = prirazeni_().find(x => x.id === String(idPrirazeni));
    if (!p) throw new Error('Přiřazení nebylo nalezeno.');
    list_(LISTY.PRIRAZENI).getRange(p.radek, 6, 1, 2).setValues([['', 'ANO']]);
    synchronizujOrganizace_(p.dobrovolnik);
    log_('Obnoveno přiřazení', p.dobrovolnik, p.org);
    return { prirazeni: prirazeni_() };
  });
}

// ===== MĚSÍČNÍ ZÁMKY A HISTORIE ===============================

// Zamykání měsíců je zatím vypnuté (Nastavení → zamykani_mesicu = ANO ho zapne). Prázdné nebo chybějící = vypnuto.
function zamykaniZapnuto_() { return String(nastaveni_().zamykani_mesicu || '').trim().toUpperCase() === 'ANO'; }

function klicMesice_(dobrovolnik, orgId, mesic) { return dobrovolnik + '|' + orgId + '|' + mesic; }

// Všechny řádky listu Měsíce podle klíče dobrovolník|organizace|měsíc (v rámci požadavku v MEMO)
function mesiceZamky_() {
  if (MEMO.zamky) return MEMO.zamky;
  const o = {};
  const sh = ss_().getSheetByName(LISTY.MESICE);
  if (sh && sh.getLastRow() > 1) {
    const h = hlavicky_(sh), i = n => h.indexOf(n);
    sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues().forEach((r, k) => {
      const d = String(r[i('ID dobrovolníka')]).trim(), og = String(r[i('ID organizace')]).trim(), m = String(r[i('Měsíc')]).trim().slice(0, 7);
      if (!d || !m) return;
      o[klicMesice_(d, og, m)] = {
        radek: k + 2, dobrovolnik: d, orgId: og, mesic: m, stav: String(r[i('Stav')]).trim(),
        schvalil: String(r[i('Schválil/a')] || ''), schvaleno: r[i('Schváleno')], odemkl: String(r[i('Odemkl/a')] || ''),
        odemceno: r[i('Odemčeno')], duvod: String(r[i('Důvod odemčení')] || ''), minut: Number(r[i('Minut')]) || 0
      };
    });
  }
  MEMO.zamky = o;
  return o;
}

function mesicZamcen_(dobrovolnik, orgId, datum) {
  if (!zamykaniZapnuto_()) return false;
  const z = mesiceZamky_()[klicMesice_(dobrovolnik, orgId, String(datum).slice(0, 7))];
  return !!z && z.stav === 'Schváleno';
}

function mesicCz_(mesic) { const p = String(mesic).split('-'); return Number(p[1]) + '/' + p[0]; }

function overZamek_(dobrovolnik, orgId, datum) {
  if (mesicZamcen_(dobrovolnik, orgId, datum)) {
    throw new Error('Měsíc ' + mesicCz_(String(datum).slice(0, 7)) + ' je schválený a zamčený. Odemknout ho může jen hlavní admin.');
  }
}

// Dobrovolník ani organizace nesmí měnit hodiny z minulých roků (koordinátor KONEP ano, dokud měsíc není schválený)
function overMinulyRok_(datum) {
  if (!zamykaniZapnuto_()) return;
  if (String(datum).slice(0, 4) < ymd_(new Date()).slice(0, 4)) {
    throw new Error('Hodiny z minulého roku už nelze měnit. Obraťte se prosím na koordinátora.');
  }
}

function popisZaznamu_(z) {
  return ymd_(z.datum) + ' ' + (z.od ? z.od + '–' + z.do : '') + ' ' + z.minut + ' min, ' + (z.orgId || z.org) + ', ' + z.cinnost;
}

// Záznam o změně hodin (bez IP adresy a bez jmen – jen ID)
function historie_(a, akce, idZaznamu, idDobrovolnika, detail) {
  try {
    const sh = ss_().getSheetByName(LISTY.HISTORIE);
    if (!sh) return;
    sh.appendRow([new Date(), a.email || '', a.role || 'Dobrovolník', akce, idZaznamu || '', idDobrovolnika || '', bunka_(String(detail || '').slice(0, 500))]);
  } catch (e) { console.error(e); }
}

function oznacZamceno_(zaznamy) {
  zaznamy.forEach(z => { z.zamceno = mesicZamcen_(z.dobrovolnik, z.orgId, z.datum); });
  return zaznamy;
}

// Přehled měsíců (dobrovolník × organizace × měsíc) pro schvalování
function nactiMesice(token, f) {
  overAdmin_(token, 'Jen čtení');
  f = f || {};
  const jmena = jmenaDobrovolniku_();
  const zamky = mesiceZamky_();
  const papirPar = {};
  prirazeni_().forEach(p => { if (p.aktivni && p.papir) papirPar[p.dobrovolnik + '|' + p.orgId] = true; });
  const fotky = fotkyRadky_().radky;
  const skup = {};
  radkyHodin_().radky.forEach(z => {
    if (!z.orgId) return;
    const m = z.datum.slice(0, 7);
    if (f.rok && m.slice(0, 4) !== String(f.rok)) return;
    if (f.org && z.orgId !== f.org) return;
    const k = klicMesice_(z.dobrovolnik, z.orgId, m);
    const g = skup[k] = skup[k] || { dobrovolnik: z.dobrovolnik, jmeno: jmena[z.dobrovolnik] || '(smazaný záznam)', orgId: z.orgId, org: z.org, mesic: m, minut: 0, pocet: 0, ke: 0, zamitnuto: 0 };
    g.pocet++;
    if (z.stav === 'Zamítnuto') g.zamitnuto++;
    else { g.minut += z.minut; if (z.stav === 'Ke schválení') g.ke++; }
  });
  const dnesM = ymd_(new Date()).slice(0, 7);
  const zam = zamykaniZapnuto_();
  let radky = Object.keys(skup).map(k => {
    const g = skup[k], z = zamky[k];
    g.zamceno = zam && !!z && z.stav === 'Schváleno';
    g.schvaleno = g.ke === 0 && g.pocet > g.zamitnuto;   // všechny započítané řádky jsou schválené
    g.schvalil = z ? z.schvalil : ''; g.odemkl = z ? z.odemkl : ''; g.duvod = z ? z.duvod : '';
    g.probiha = g.mesic === dnesM;
    g.fotek = fotky.filter(x => x.dobrovolnik === g.dobrovolnik && x.orgId === g.orgId && x.mesic === g.mesic).length;
    g.papir = !!papirPar[g.dobrovolnik + '|' + g.orgId];
    return g;
  });
  if (f.stav === 'ke') radky = radky.filter(g => zam ? (!g.zamceno && g.pocet > g.zamitnuto) : g.ke > 0);
  else if (f.stav === 'zamcene') radky = radky.filter(g => zam ? g.zamceno : g.schvaleno);
  radky.sort((a, b) => b.mesic.localeCompare(a.mesic) || a.jmeno.localeCompare(b.jmeno, 'cs'));
  return { radky: radky, zamykani: zam };
}

// Schválí všechny čekající hodiny dvojice dobrovolník + organizace za měsíc a měsíc zamkne (volat uvnitř zámku)
function schvalMesicVnitrni_(a, dobrovolnik, orgId, mesic) {
  if (!/^\d{4}-\d{2}$/.test(String(mesic))) throw new Error('Neplatný měsíc.');
  if (mesicZamcen_(dobrovolnik, orgId, mesic)) throw new Error('Měsíc ' + mesicCz_(mesic) + ' je už schválený.');
  const data = radkyHodin_();
  const rel = data.radky.filter(z => z.dobrovolnik === dobrovolnik && z.orgId === orgId && z.datum.slice(0, 7) === mesic);
  if (!rel.filter(z => z.stav !== 'Zamítnuto').length) throw new Error('Za měsíc ' + mesicCz_(mesic) + ' nejsou žádné hodiny ke schválení.');
  const zamykat = zamykaniZapnuto_();
  if (!zamykat && !rel.some(z => z.stav === 'Ke schválení')) throw new Error('Měsíc ' + mesicCz_(mesic) + ' je už schválený.');
  const ted = new Date();
  const znak = a.email + ' – ' + Utilities.formatDate(ted, TZ, 'd. M. yyyy H:mm');
  rel.filter(z => z.stav === 'Ke schválení').forEach(z => {
    zapisDoRadku_(data.sh, z.radek, data.hlav, { 'Stav': 'Schváleno', 'Potvrdila organizace': znak, 'Upraveno': ted, 'Upravil/a': a.email });
  });
  const minut = rel.filter(z => z.stav !== 'Zamítnuto').reduce((s, z) => s + z.minut, 0);
  if (!zamykat) {   // bez zamykání se jen schválí hodiny
    historie_(a, 'Schválení měsíce', '', dobrovolnik, mesic + ', ' + orgId + ', ' + minut + ' min (bez zamykání)');
    log_('Měsíc schválen', dobrovolnik, mesic + ', ' + orgId + ', ' + minut + ' min');
    return minut;
  }
  const shM = list_(LISTY.MESICE), hm = hlavicky_(shM);
  const radek = { 'ID dobrovolníka': dobrovolnik, 'ID organizace': orgId, 'Měsíc': mesic, 'Stav': 'Schváleno', 'Schválil/a': a.email, 'Schváleno': ted, 'Minut': minut };
  const puv = mesiceZamky_()[klicMesice_(dobrovolnik, orgId, mesic)];
  if (puv) zapisDoRadku_(shM, puv.radek, hm, radek);
  else shM.getRange(shM.getLastRow() + 1, 1, 1, hm.length).setValues([hm.map(h => radek.hasOwnProperty(h) ? radek[h] : '')]);
  delete MEMO.zamky;
  historie_(a, 'Schválení měsíce', '', dobrovolnik, mesic + ', ' + orgId + ', ' + minut + ' min');
  log_('Měsíc schválen a zamčen', dobrovolnik, mesic + ', ' + orgId + ', ' + minut + ' min');
  return minut;
}

// polozky = [{ dobrovolnik, orgId, mesic }]; schvaluje Koordinátor i Hlavní admin
function schvalMesice(token, polozky) {
  const a = overAdmin_(token, 'Koordinátor');
  polozky = [].concat(polozky || []);
  if (!polozky.length) throw new Error('Nic není vybráno.');
  return sZamkem_(() => {
    let pocet = 0; const chyby = [];
    polozky.forEach(p => {
      try { schvalMesicVnitrni_(a, String(p.dobrovolnik || '').trim(), String(p.orgId || '').trim(), String(p.mesic || '').trim()); pocet++; }
      catch (e) { chyby.push(String(p.dobrovolnik) + ' ' + String(p.mesic) + ': ' + e.message); }
    });
    return { ok: true, pocet: pocet, chyby: chyby };
  });
}

// Odemknutí měsíce – jen Hlavní admin, s důvodem; zaznamená se do listů Měsíce, Historie hodin a Log změn
function odemkniMesic(token, dobrovolnik, orgId, mesic, duvod) {
  const a = overAdmin_(token, 'Hlavní admin');
  if (!zamykaniZapnuto_()) throw new Error('Zamykání měsíců je vypnuté, není co odemykat.');
  duvod = String(duvod || '').trim().slice(0, 300);
  if (duvod.length < 3) throw new Error('Napište důvod odemčení.');
  return sZamkem_(() => {
    const z = mesiceZamky_()[klicMesice_(dobrovolnik, orgId, String(mesic))];
    if (!z || z.stav !== 'Schváleno') throw new Error('Tento měsíc není zamčený.');
    const shM = list_(LISTY.MESICE);
    zapisDoRadku_(shM, z.radek, hlavicky_(shM), { 'Stav': 'Odemčeno', 'Odemkl/a': a.email, 'Odemčeno': new Date(), 'Důvod odemčení': duvod });
    delete MEMO.zamky;
    historie_(a, 'Odemčení měsíce', '', dobrovolnik, mesic + ', ' + orgId + ', důvod: ' + duvod);
    log_('Měsíc odemčen', dobrovolnik, mesic + ', ' + orgId + ', důvod: ' + duvod);
    return { ok: true };
  });
}

// ===== FOTKY PAPÍROVÝCH VÝKAZŮ ================================

// Jen tyto tři funkce sahají na Disk (testy je nahrazují)
function ulozSouborFotky_(idDobrovolnika, nazev, bajty) {
  const sh = list_(LISTY.DOBROVOLNICI), hlav = hlavicky_(sh), radek = najdiRadek_(sh, hlav, idDobrovolnika);
  const z = zaznamObjekt_(sh, hlav, radek);
  let osobni = null;
  const idS = extrahujId_(z['Složka']);
  if (idS) { try { osobni = DriveApp.getFolderById(idS); } catch (e) { osobni = null; } }
  if (!osobni) {
    osobni = vytvorOsobniSlozku_(nastaveni_(), idDobrovolnika, z['Jméno'], z['Příjmení']);
    zapisDoRadku_(sh, radek, hlav, { 'Složka': osobni.getUrl() });
  }
  const it = osobni.getFoldersByName('Výkazy hodin');
  const slozka = it.hasNext() ? it.next() : osobni.createFolder('Výkazy hodin');
  return slozka.createFile(Utilities.newBlob(bajty, 'image/jpeg', nazev)).getId();
}
function nactiSouborFotky_(idSouboru) {
  return 'data:image/jpeg;base64,' + Utilities.base64Encode(DriveApp.getFileById(idSouboru).getBlob().getBytes());
}
function smazSouborFotky_(idSouboru) {
  try { DriveApp.getFileById(idSouboru).setTrashed(true); } catch (e) { console.warn(e); }
}

function fotkyRadky_() {
  const sh = ss_().getSheetByName(LISTY.FOTKY);
  if (!sh || sh.getLastRow() < 2) return { sh: sh, radky: [] };
  const h = hlavicky_(sh), i = n => h.indexOf(n);
  const radky = sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues().map((r, k) => ({
    radek: k + 2, id: String(r[i('ID fotky')]), dobrovolnik: String(r[i('ID dobrovolníka')]).trim(), orgId: String(r[i('ID organizace')]).trim(),
    mesic: String(r[i('Měsíc')]).trim().slice(0, 7), soubor: String(r[i('ID souboru')]), nahral: String(r[i('Nahrál/a')] || ''),
    role: String(r[i('Role')] || ''), nahrano: r[i('Nahráno')] instanceof Date ? Utilities.formatDate(r[i('Nahráno')], TZ, 'yyyy-MM-dd HH:mm') : ''
  })).filter(f => f.id && f.dobrovolnik);
  return { sh: sh, radky: radky };
}

// Bez odkazů na soubory – ty zůstávají jen na serveru
function fotkyVykazuDobrovolnika_(dobrovolnik) {
  return fotkyRadky_().radky.filter(f => f.dobrovolnik === dobrovolnik)
    .map(f => ({ id: f.id, orgId: f.orgId, mesic: f.mesic, nahrano: f.nahrano, nahral: f.nahral }))
    .sort((a, b) => b.mesic.localeCompare(a.mesic) || a.nahrano.localeCompare(b.nahrano));
}

function fotkaBajty_(dataUrl) {
  const m = String(dataUrl || '').match(/^data:image\/jpeg;base64,([A-Za-z0-9+\/=]+)$/);
  if (!m) throw new Error('Fotka musí být obrázek JPEG.');
  if (m[1].length > MAX_FOTKA_ZNAKU) throw new Error('Fotka je příliš velká.');
  return Utilities.base64Decode(m[1]);
}

function pridejFotkuVnitrni_(a, dobrovolnik, orgId, mesic, dataUrl) {
  if (!/^\d{4}-\d{2}$/.test(String(mesic))) throw new Error('Neplatný měsíc.');
  if (!organizace_().some(o => o.id === orgId)) throw new Error('Vyberte organizaci.');
  if (!prirazeni_().some(p => p.dobrovolnik === dobrovolnik && p.orgId === orgId)) throw new Error('Dobrovolník není přiřazený k této organizaci.');
  overZamek_(dobrovolnik, orgId, mesic + '-01');
  const f = fotkyRadky_();
  if (f.radky.filter(x => x.dobrovolnik === dobrovolnik && x.orgId === orgId && x.mesic === mesic).length >= MAX_FOTEK_MESIC) {
    throw new Error('Za jeden měsíc lze nahrát nejvýše ' + MAX_FOTEK_MESIC + ' fotek.');
  }
  const bajty = fotkaBajty_(dataUrl);
  const idFotky = novyKlic_('F');
  const soubor = ulozSouborFotky_(dobrovolnik, 'vykaz_' + orgId + '_' + mesic + '_' + idFotky + '.jpg', bajty);
  const sh = f.sh || list_(LISTY.FOTKY);
  const hl = hlavicky_(sh);
  const radek = { 'ID fotky': idFotky, 'ID dobrovolníka': dobrovolnik, 'ID organizace': orgId, 'Měsíc': mesic, 'ID souboru': soubor, 'Nahrál/a': a.email, 'Role': a.role || 'Dobrovolník', 'Nahráno': new Date() };
  sh.getRange(sh.getLastRow() + 1, 1, 1, hl.length).setValues([hl.map(h => radek.hasOwnProperty(h) ? radek[h] : '')]);
  historie_(a, 'Fotka výkazu přidána', idFotky, dobrovolnik, mesic + ', ' + orgId);
  return idFotky;
}

function smazFotkuVnitrni_(a, f) {
  overZamek_(f.dobrovolnik, f.orgId, f.mesic + '-01');
  smazSouborFotky_(f.soubor);
  fotkyRadky_().sh.deleteRow(f.radek);
  historie_(a, 'Fotka výkazu smazána', f.id, f.dobrovolnik, f.mesic + ', ' + f.orgId);
}

function fotkyVykazu(token, dobrovolnik) {
  overAdmin_(token, 'Jen čtení');
  return { fotky: fotkyVykazuDobrovolnika_(String(dobrovolnik || '')) };
}

function nactiFotkuVykazu(token, idFotky) {
  overAdmin_(token, 'Jen čtení');
  const f = fotkyRadky_().radky.find(x => x.id === String(idFotky));
  if (!f) throw new Error('Fotka nebyla nalezena.');
  return { dataUrl: nactiSouborFotky_(f.soubor) };
}

function nahrajFotkuVykazu(token, dobrovolnik, orgId, mesic, dataUrl) {
  const a = overAdmin_(token, 'Koordinátor');
  dobrovolnik = String(dobrovolnik || '').trim();
  return sZamkem_(() => {
    pridejFotkuVnitrni_(a, dobrovolnik, String(orgId || '').trim(), String(mesic || '').trim(), dataUrl);
    return { fotky: fotkyVykazuDobrovolnika_(dobrovolnik) };
  });
}

function smazFotkuVykazu(token, idFotky) {
  const a = overAdmin_(token, 'Koordinátor');
  return sZamkem_(() => {
    const f = fotkyRadky_().radky.find(x => x.id === String(idFotky));
    if (!f) throw new Error('Fotka nebyla nalezena.');
    smazFotkuVnitrni_(a, f);
    return { fotky: fotkyVykazuDobrovolnika_(f.dobrovolnik) };
  });
}

// ===== PŘEVOD STÁVAJÍCÍHO SCHVALOVÁNÍ NA MĚSÍČNÍ ZÁMKY ==========

function zalohaPredPrevodem_() {
  const ss = ss_();
  const nazev = 'Záloha před převodem schvalování hodin – ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH-mm');
  const soubor = DriveApp.getFileById(ss.getId()).makeCopy(nazev, slozkaZaloh_());
  return { nazev: nazev, url: soubor.getUrl() };
}

// Kdo měsíc dříve schválil: e-mail z pole „Potvrdila organizace“ („e-mail – datum“), jinak kdo zapsal
function puvodniSchvalovatel_(radky) {
  for (let i = 0; i < radky.length; i++) {
    const m = String(radky[i].potvrdil || '').match(/^(\S+@\S+?)\s+–/);
    if (m) return m[1];
  }
  const z = radky.map(r => r.zapsal).filter(String)[0];
  return z || 'původní schválení';
}

// Co by se převodem zamklo a co zůstane otevřené; nic nemění
function analyzaPrevodu_() {
  const jm = jmenaDobrovolniku_(), zamky = mesiceZamky_(), dnesM = ymd_(new Date()).slice(0, 7);
  const skup = {}, bez = [], zamit = [];
  radkyHodin_().radky.forEach(z => {
    const popis = { id: z.id, datum: z.datum, dobrovolnik: z.dobrovolnik, jmeno: jm[z.dobrovolnik] || '(smazaný záznam)', org: z.org, minut: z.minut, cinnost: z.cinnost, stav: z.stav };
    if (z.stav === 'Zamítnuto') zamit.push(popis);
    if (!z.orgId) { bez.push(popis); return; }
    const m = z.datum.slice(0, 7), k = klicMesice_(z.dobrovolnik, z.orgId, m);
    const g = skup[k] = skup[k] || { dobrovolnik: z.dobrovolnik, jmeno: popis.jmeno, orgId: z.orgId, org: z.org, mesic: m, minut: 0, pocet: 0, ke: 0, zam: 0, schv: 0, radky: [] };
    g.pocet++; g.radky.push(z);
    if (z.stav === 'Zamítnuto') g.zam++;
    else { g.minut += z.minut; if (z.stav === 'Ke schválení') g.ke++; else g.schv++; }
  });
  const zamknout = [], otevrene = [];
  Object.keys(skup).forEach(k => {
    const g = skup[k], z = zamky[k];
    if (z && z.stav === 'Schváleno') return;   // už zamčeno
    const duvody = [];
    if (z && z.stav === 'Odemčeno') duvody.push('byl záměrně odemčen');
    if (g.mesic >= dnesM) duvody.push('měsíc ještě probíhá');
    if (g.ke) duvody.push('čeká na schválení: ' + g.ke);
    if (g.zam) duvody.push('zamítnuto: ' + g.zam);
    if (!g.schv) duvody.push('žádný schválený záznam');
    const vystup = { dobrovolnik: g.dobrovolnik, jmeno: g.jmeno, orgId: g.orgId, org: g.org, mesic: g.mesic, minut: g.minut, pocet: g.pocet };
    if (duvody.length) { vystup.duvody = duvody.join('; '); otevrene.push(vystup); }
    else { vystup.schvalil = puvodniSchvalovatel_(g.radky); zamknout.push(vystup); }
  });
  const rad = (a, b) => b.mesic.localeCompare(a.mesic) || a.jmeno.localeCompare(b.jmeno, 'cs');
  zamknout.sort(rad); otevrene.sort(rad);
  zamit.sort((a, b) => b.datum.localeCompare(a.datum));
  return { zamknout: zamknout, otevrene: otevrene, zamitnute: zamit, bezOrganizace: bez, uzavrenoDo: uzavrenoDo_(nastaveni_()) };
}

function nahledPrevoduSchvalovani(token) {
  overAdmin_(token, 'Hlavní admin');
  return analyzaPrevodu_();
}

// Provede převod: nejdřív záloha tabulky (nepodaří-li se, nic se nezmění), potom se vytvoří měsíční zámky
function provedPrevodSchvalovani(token) {
  const a = overAdmin_(token, 'Hlavní admin');
  if (!zamykaniZapnuto_()) throw new Error('Zamykání měsíců je vypnuté. Převod dává smysl až po jeho zapnutí (Nastavení → zamykani_mesicu).');
  return sZamkem_(() => {
    const zaloha = zalohaPredPrevodem_();
    delete MEMO.zamky;
    const an = analyzaPrevodu_();
    const shM = list_(LISTY.MESICE), hm = hlavicky_(shM);
    const ted = new Date();
    const radky = an.zamknout.map(g => {
      const r = { 'ID dobrovolníka': g.dobrovolnik, 'ID organizace': g.orgId, 'Měsíc': g.mesic, 'Stav': 'Schváleno', 'Schválil/a': g.schvalil + ' (převod původního schvalování)', 'Schváleno': ted, 'Minut': g.minut };
      return hm.map(h => r.hasOwnProperty(h) ? r[h] : '');
    });
    // měsíce, které už mají řádek (byly odemčené) se tu nezamykají, takže stačí připsat nové řádky
    if (radky.length) shM.getRange(shM.getLastRow() + 1, 1, radky.length, hm.length).setValues(radky);
    delete MEMO.zamky;
    historie_(a, 'Převod schvalování', '', '', 'zamčeno měsíců: ' + radky.length + ', ponecháno otevřených: ' + an.otevrene.length);
    log_('Převod schvalování hodin', '', 'zamčeno měsíců: ' + radky.length + ', záloha: ' + zaloha.nazev);
    return { ok: true, zamceno: radky.length, otevrene: an.otevrene.length, zaloha: zaloha.nazev, zalohaUrl: zaloha.url };
  });
}

// ===== NAČÍTÁNÍ HODIN =========================================

function radkyHodin_() {
  const sh = list_(LISTY.HODINY);
  if (sh.getLastRow() < 2) return { sh: sh, hlav: hlavicky_(sh), radky: [] };
  const hlav = hlavicky_(sh);
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, hlav.length).getValues();
  const i = n => hlav.indexOf(n);
  const radky = v.map((r, k) => ({
    radek: k + 2,
    id: String(r[i('ID záznamu')]),
    dobrovolnik: String(r[i('ID dobrovolníka')]).trim(),
    datum: ymd_(r[i('Datum')]),
    orgId: String(r[i('ID organizace')] || '').trim(),
    org: String(r[i('Organizace')] || ''),
    od: hhmm_(r[i('Čas od')]),
    do: hhmm_(r[i('Čas do')]),
    minut: Number(r[i('Minut')]) || Math.round((Number(r[i('Počet hodin')]) || 0) * 60),
    cinnost: String(r[i('Činnost')] || ''),
    poznamka: String(r[i('Poznámka')] || ''),
    stav: String(r[i('Stav')] || '') || 'Schváleno',
    zdroj: String(r[i('Zdroj')] || ''),
    akce: String(r[i('ID akce')] || ''),
    zapsal: String(r[i('Zapsal/a')] || ''),
    potvrdil: String(r[i('Potvrdila organizace')] || ''),
    role: String(r[i('Role zapisujícího')] || '')
  })).filter(z => z.id && z.dobrovolnik);
  return { sh: sh, hlav: hlav, radky: radky };
}

function nactiHodiny(token, f) {
  overAdmin_(token, 'Jen čtení');
  f = f || {};
  const od = String(f.od || '0000-00-00'), doo = String(f.do || '9999-99-99');
  const jmena = jmenaDobrovolniku_();
  const zaznamy = radkyHodin_().radky.filter(z =>
    z.datum >= od && z.datum <= doo &&
    (!f.org || z.orgId === f.org) &&
    (!f.dobrovolnik || z.dobrovolnik === f.dobrovolnik) &&
    (!f.stav || z.stav === f.stav)
  ).map(z => Object.assign(z, { jmeno: jmena[z.dobrovolnik] || '(smazaný záznam)' }));
  zaznamy.sort((a, b) => (b.datum + b.od).localeCompare(a.datum + a.od));
  oznacZamceno_(zaznamy);
  return { zaznamy: zaznamy, uzavrenoDo: uzavrenoDo_(nastaveni_()) };
}

// Krátký přehled pro dlaždice v Přehledu
function prehledHodin_() {
  const mesic = Utilities.formatDate(new Date(), TZ, 'yyyy-MM');
  let keSchvaleni = 0, minutMesic = 0;
  radkyHodin_().radky.forEach(z => {
    if (z.stav === 'Ke schválení') keSchvaleni++;
    if (z.datum.slice(0, 7) === mesic && z.stav === 'Schváleno') minutMesic += z.minut;
  });
  return { keSchvaleni: keSchvaleni, minutMesic: minutMesic };
}

// ===== ZÁPIS HODIN ============================================

// Ověří a připraví jeden zápis; vrací objekt pro uložení
// prisne = true pro zápis dobrovolníkem (musí platit přiřazení k danému datu);
// administrátor/koordinátor může zapisovat zpětně – stačí, že přiřazení existuje.
function pripravZapis_(z, pr, orgs, n, a, prisne) {
  const dobrovolnik = String(z.dobrovolnik || '').trim();
  const org = orgs.find(o => o.id === String(z.orgId || ''));
  if (!dobrovolnik) throw new Error('Vyberte dobrovolníka.');
  if (!org) throw new Error('Vyberte, pro kterou organizaci hodiny zapisujete.');
  const datum = String(z.datum || '').trim();
  const dD = parsujDatum_(datum);
  if (!dD) throw new Error('Zadejte datum.');
  if (datum > ymd_(new Date())) throw new Error('Hodiny nelze zapsat do budoucnosti.');
  overUzaverku_(a, n, datum);
  overZamek_(dobrovolnik, org.id, datum);
  if (prisne) {
    if (!platnePrirazeni_(pr, dobrovolnik, org.id, datum)) {
      throw new Error('K datu ' + datum.split('-').reverse().map(Number).join('. ') + ' nejste přiřazen/a k organizaci ' + org.nazev + '.');
    }
  } else if (!pr.some(p => p.dobrovolnik === dobrovolnik && p.orgId === org.id)) {
    throw new Error('Dobrovolník ' + dobrovolnik + ' není přiřazený k organizaci ' + org.nazev + '. Přiřaďte ho v jeho detailu.');
  }
  // čas se zadává vždy jako od–do (volba „jen délka“ zrušena); hodiny vzniknou výpočtem
  let od = String(z.od || '').trim(), doo = String(z.do || '').trim();
  const minut = minutyZCasu_(od, doo);
  od = ('0' + od).slice(-5); doo = ('0' + doo).slice(-5);
  const cinnost = String(z.cinnost || '').trim().slice(0, 200);
  if (!cinnost) throw new Error('Vyberte nebo napište činnost.');
  return {
    dobrovolnik: dobrovolnik, org: org, datum: dD, od: od, do: doo, minut: minut,
    cinnost: cinnost, poznamka: String(z.poznamka || '').trim().slice(0, 1000)
  };
}

function radekHodin_(hlav, o) {
  return hlav.map(h => bunka_(o.hasOwnProperty(h) ? o[h] : ''));
}

function novyZaznamHodin_(p, a, zdroj, idAkce) {
  const ted = new Date();
  return {
    'ID záznamu': novyKlic_('H'),
    'ID dobrovolníka': p.dobrovolnik,
    'Datum': p.datum,
    'Počet hodin': Math.round(p.minut / 60 * 100) / 100,
    'Organizace': p.org.nazev,
    'ID organizace': p.org.id,
    'Činnost': p.cinnost,
    'Čas od': p.od,
    'Čas do': p.do,
    'Minut': p.minut,
    'Poznámka': p.poznamka,
    'Stav': 'Schváleno',
    'Potvrdila organizace': a.email + ' – ' + Utilities.formatDate(ted, TZ, 'd. M. yyyy H:mm'),
    'Zapsal/a': a.email,
    'Časové razítko': ted,
    'Zdroj': zdroj,
    'ID akce': idAkce || '',
    'Role zapisujícího': a.role || 'Dobrovolník'
  };
}

function zapisRadkyHodin_(radky) {
  if (!radky.length) return;
  const sh = list_(LISTY.HODINY);
  const hlav = hlavicky_(sh);
  const data = radky.map(o => radekHodin_(hlav, o));
  sh.getRange(sh.getLastRow() + 1, 1, data.length, hlav.length).setValues(data);
}

// Jeden zápis – nový, nebo úprava existujícího (z.id)
function ulozHodiny(token, z) {
  const a = overAdmin_(token, 'Koordinátor');
  const n = nastaveni_();
  return sZamkem_(() => {
    const p = pripravZapis_(z || {}, prirazeni_(), organizace_(), n, a);
    if (z.id) {
      const data = radkyHodin_();
      const puv = data.radky.find(x => x.id === String(z.id));
      if (!puv) throw new Error('Záznam nebyl nalezen. Obnovte prosím stránku.');
      overUzaverku_(a, n, puv.datum);
      overZamek_(puv.dobrovolnik, puv.orgId, puv.datum);
      const zmeny = {
        'ID dobrovolníka': p.dobrovolnik, 'Datum': p.datum, 'Počet hodin': Math.round(p.minut / 60 * 100) / 100,
        'Organizace': p.org.nazev, 'ID organizace': p.org.id, 'Činnost': p.cinnost, 'Čas od': p.od, 'Čas do': p.do,
        'Minut': p.minut, 'Poznámka': p.poznamka, 'Upraveno': new Date(), 'Upravil/a': a.email
      };
      zapisDoRadku_(data.sh, puv.radek, data.hlav, zmeny);
      log_('Úprava hodin', p.dobrovolnik, z.id + ': ' + puv.minut + ' → ' + p.minut + ' min');
      historie_(a, 'Úprava', z.id, p.dobrovolnik, popisZaznamu_(puv) + ' → ' + popisZaznamu_({ datum: p.datum, od: p.od, do: p.do, minut: p.minut, orgId: p.org.id, cinnost: p.cinnost }));
    } else {
      const novy = novyZaznamHodin_(p, a, 'Dashboard', '');
      zapisRadkyHodin_([novy]);
      historie_(a, 'Zápis', novy['ID záznamu'], p.dobrovolnik, popisZaznamu_({ datum: p.datum, od: p.od, do: p.do, minut: p.minut, orgId: p.org.id, cinnost: p.cinnost }));
      log_('Zápis hodin', p.dobrovolnik, ymd_(p.datum) + ', ' + p.minut + ' min, ' + p.org.nazev);
    }
    return { ok: true };
  });
}

// Akce / směna: stejné datum, čas a činnost pro více dobrovolníků
function ulozAkci(token, d) {
  const a = overAdmin_(token, 'Koordinátor');
  const n = nastaveni_();
  d = d || {};
  const ids = [].concat(d.dobrovolnici || []).map(String).filter(String);
  if (!ids.length) throw new Error('Zaškrtněte alespoň jednoho dobrovolníka.');
  return sZamkem_(() => {
    const pr = prirazeni_(), orgs = organizace_();
    // je-li měsíc zamčený u kohokoli z vybraných, nic se neuloží a vypíše se, u koho
    const zamcene = ids.filter(id => mesicZamcen_(id, String(d.orgId || ''), String(d.datum || '')));
    if (zamcene.length) {
      const jm = jmenaDobrovolniku_();
      throw new Error('Nic se neuložilo. Měsíc ' + mesicCz_(String(d.datum).slice(0, 7)) + ' je u těchto dobrovolníků už schválený a zamčený: ' + zamcene.map(id => jm[id] || id).join(', ') + '.');
    }
    const idAkce = novyKlic_('AK');
    const radky = ids.map(id => novyZaznamHodin_(pripravZapis_(Object.assign({}, d, { dobrovolnik: id }), pr, orgs, n, a), a, 'Akce', idAkce));
    zapisRadkyHodin_(radky);
    radky.forEach(r => historie_(a, 'Zápis (akce)', r['ID záznamu'], r['ID dobrovolníka'], idAkce + ', ' + ymd_(r['Datum']) + ' ' + r['Čas od'] + '–' + r['Čas do'] + ' ' + r['Minut'] + ' min'));
    log_('Zápis hodin – akce', '', idAkce + ': ' + radky.length + ' dobrovolníků, ' + String(d.datum));
    return { ok: true, pocet: radky.length };
  });
}

function zmenStavHodin(token, ids, stav) {
  const a = overAdmin_(token, 'Koordinátor');
  if (STAVY_HODIN.indexOf(stav) < 0) throw new Error('Neznámý stav.');
  if (stav === 'Schváleno') throw new Error('Hodiny se schvalují po celých měsících: Hodiny → Schvalování měsíců.');
  const n = nastaveni_();
  ids = [].concat(ids || []).map(String);
  return sZamkem_(() => {
    const data = radkyHodin_();
    let pocet = 0;
    data.radky.filter(z => ids.indexOf(z.id) >= 0).forEach(z => {
      overUzaverku_(a, n, z.datum);
      overZamek_(z.dobrovolnik, z.orgId, z.datum);
      const zmeny = { 'Stav': stav, 'Upraveno': new Date(), 'Upravil/a': a.email };
      if (stav === 'Schváleno') zmeny['Potvrdila organizace'] = a.email + ' – ' + Utilities.formatDate(new Date(), TZ, 'd. M. yyyy H:mm');
      zapisDoRadku_(data.sh, z.radek, data.hlav, zmeny);
      historie_(a, 'Změna stavu', z.id, z.dobrovolnik, z.stav + ' → ' + stav);
      pocet++;
    });
    log_('Hodiny: ' + stav, '', pocet + ' zápisů');
    return { ok: true, pocet: pocet };
  });
}

function smazHodiny(token, ids) {
  const a = overAdmin_(token, 'Koordinátor');
  const n = nastaveni_();
  ids = [].concat(ids || []).map(String);
  return sZamkem_(() => {
    const data = radkyHodin_();
    const mazat = data.radky.filter(z => ids.indexOf(z.id) >= 0);
    mazat.forEach(z => { overUzaverku_(a, n, z.datum); overZamek_(z.dobrovolnik, z.orgId, z.datum); });
    mazat.sort((x, y) => y.radek - x.radek).forEach(z => { data.sh.deleteRow(z.radek); historie_(a, 'Smazání', z.id, z.dobrovolnik, popisZaznamu_(z)); });
    log_('Smazání hodin', '', mazat.map(z => z.dobrovolnik + ' ' + z.datum + ' ' + z.minut + ' min').join('; ').slice(0, 900));
    return { ok: true, pocet: mazat.length };
  });
}
