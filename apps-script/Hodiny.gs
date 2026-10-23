/**
 * DOBROVOLNICKÉ CENTRUM – DOBROVOLNICKÉ HODINY (fáze 1)
 * --------------------------------------------------------------
 * - přiřazení dobrovolníků k organizacím (dobrovolník může mít víc organizací)
 * - katalog činností (pro všechny organizace nebo pro konkrétní organizaci)
 * - zápis hodin v dashboardu: jednotlivě, za akci (více dobrovolníků), měsíční výkaz
 * - schvalování, mazání, uzávěrka měsíců
 *
 * Čas se ukládá v minutách (sloupec „Minut“), zaokrouhleno na 5 minut.
 * Sloupec „Počet hodin“ je jen pro čitelnost v tabulce (desetinné číslo).
 */

const SLOUPCE_HODINY = [
  'ID záznamu', 'ID dobrovolníka', 'Datum', 'Počet hodin', 'Organizace', 'Činnost',
  'Stav', 'Zapsal/a', 'Časové razítko', 'Potvrdila organizace', 'Potvrdil dobrovolník',
  'ID organizace', 'Čas od', 'Čas do', 'Minut', 'Poznámka', 'Zdroj', 'ID akce', 'Upraveno', 'Upravil/a'
];
const SLOUPCE_PRIRAZENI = [
  'ID přiřazení', 'ID dobrovolníka', 'ID organizace', 'Organizace', 'Od', 'Do', 'Aktivní',
  'Poznámka', 'Vytvořeno', 'Vytvořil/a'
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

function doplnChybejiciRadkyCinnosti_(sh) {
  if (sh.getLastRow() > 1) return; // výchozí činnosti jen do prázdného listu
  sh.getRange(2, 1, VYCHOZI_CINNOSTI.length, 3).setValues(VYCHOZI_CINNOSTI.map(c => [VSECHNY_ORGANIZACE, c, 'ANO']));
}

// Organizace zadané ručně v tabulce nemusí mít ID – doplníme ORG-001…
function doplnIdOrganizaci_() {
  const sh = list_(LISTY.ORGANIZACE);
  if (sh.getLastRow() < 2) return;
  const r = sh.getRange(2, 1, sh.getLastRow() - 1, 2);
  const v = r.getValues();
  let max = 0;
  v.forEach(x => { const m = String(x[0]).match(/^ORG-(\d+)$/); if (m) max = Math.max(max, +m[1]); });
  let zmena = false;
  v.forEach(x => {
    if (String(x[1]).trim() && !String(x[0]).trim()) { max++; x[0] = 'ORG-' + String(max).padStart(3, '0'); zmena = true; }
  });
  if (zmena) { r.setValues(v); delete MEMO.organizace; }
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

function minutyZCasu_(od, doo) {
  const a = String(od).match(/^(\d{2}):(\d{2})$/), b = String(doo).match(/^(\d{2}):(\d{2})$/);
  if (!a || !b) return 0;
  let m = (+b[1] * 60 + +b[2]) - (+a[1] * 60 + +a[2]);
  if (m <= 0) m += 24 * 60; // přes půlnoc
  return m;
}

function zaokrouhli5_(m) { return Math.round(Number(m) / 5) * 5; }

function prirazeni_() {
  const sh = ss_().getSheetByName(LISTY.PRIRAZENI);
  if (!sh || sh.getLastRow() < 2) return [];
  const h = hlavicky_(sh);
  return sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues()
    .map((r, i) => ({
      radek: i + 2, id: String(r[0]), dobrovolnik: String(r[1]).trim(), orgId: String(r[2]).trim(), org: String(r[3]),
      od: ymd_(r[4]), do: ymd_(r[5]), aktivni: String(r[6]).trim().toUpperCase() !== 'NE', poznamka: String(r[7] || '')
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
    potvrdil: String(r[i('Potvrdila organizace')] || '')
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
  if (!org) throw new Error('Vyberte organizaci.');
  const datum = String(z.datum || '').trim();
  const dD = parsujDatum_(datum);
  if (!dD) throw new Error('Zadejte datum.');
  if (datum > ymd_(new Date())) throw new Error('Hodiny nelze zapsat do budoucnosti.');
  overUzaverku_(a, n, datum);
  if (prisne) {
    if (!platnePrirazeni_(pr, dobrovolnik, org.id, datum)) {
      throw new Error('K datu ' + datum.split('-').reverse().map(Number).join('. ') + ' nejste přiřazen/a k organizaci ' + org.nazev + '.');
    }
  } else if (!pr.some(p => p.dobrovolnik === dobrovolnik && p.orgId === org.id)) {
    throw new Error('Dobrovolník ' + dobrovolnik + ' není přiřazený k organizaci ' + org.nazev + '. Přiřaďte ho v jeho detailu.');
  }
  let od = String(z.od || '').trim(), doo = String(z.do || '').trim(), minut;
  if (od || doo) {
    if (!/^\d{2}:\d{2}$/.test(od) || !/^\d{2}:\d{2}$/.test(doo)) throw new Error('Zadejte čas od i do.');
    minut = minutyZCasu_(od, doo);
  } else {
    minut = Number(z.minut);
  }
  minut = zaokrouhli5_(minut);
  if (!(minut >= 5 && minut <= 24 * 60)) throw new Error('Délka musí být mezi 5 minutami a 24 hodinami.');
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
    'ID akce': idAkce || ''
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
      const zmeny = {
        'ID dobrovolníka': p.dobrovolnik, 'Datum': p.datum, 'Počet hodin': Math.round(p.minut / 60 * 100) / 100,
        'Organizace': p.org.nazev, 'ID organizace': p.org.id, 'Činnost': p.cinnost, 'Čas od': p.od, 'Čas do': p.do,
        'Minut': p.minut, 'Poznámka': p.poznamka, 'Upraveno': new Date(), 'Upravil/a': a.email
      };
      zapisDoRadku_(data.sh, puv.radek, data.hlav, zmeny);
      log_('Úprava hodin', p.dobrovolnik, z.id + ': ' + puv.minut + ' → ' + p.minut + ' min');
    } else {
      zapisRadkyHodin_([novyZaznamHodin_(p, a, 'Dashboard', '')]);
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
    const idAkce = novyKlic_('AK');
    const radky = ids.map(id => novyZaznamHodin_(pripravZapis_(Object.assign({}, d, { dobrovolnik: id }), pr, orgs, n, a), a, 'Akce', idAkce));
    zapisRadkyHodin_(radky);
    log_('Zápis hodin – akce', '', idAkce + ': ' + radky.length + ' dobrovolníků, ' + String(d.datum));
    return { ok: true, pocet: radky.length };
  });
}

// Měsíční výkaz: položky [{dobrovolnik, den, minut}]
function ulozVykaz(token, d) {
  const a = overAdmin_(token, 'Koordinátor');
  const n = nastaveni_();
  d = d || {};
  const mesic = String(d.mesic || '');
  if (!/^\d{4}-\d{2}$/.test(mesic)) throw new Error('Vyberte měsíc.');
  const polozky = [].concat(d.polozky || []).filter(x => Number(x.minut) > 0);
  if (!polozky.length) throw new Error('Výkaz neobsahuje žádné hodiny.');
  return sZamkem_(() => {
    const pr = prirazeni_(), orgs = organizace_();
    const idAkce = novyKlic_('VY');
    const radky = polozky.map(x => {
      const datum = mesic + '-' + String(Number(x.den)).padStart(2, '0');
      try {
        return novyZaznamHodin_(pripravZapis_({
          dobrovolnik: x.dobrovolnik, orgId: d.orgId, datum: datum, minut: x.minut,
          cinnost: d.cinnost, poznamka: d.poznamka
        }, pr, orgs, n, a), a, 'Měsíční výkaz', idAkce);
      } catch (e) {
        throw new Error(x.dobrovolnik + ', ' + Number(x.den) + '. den: ' + e.message);
      }
    });
    zapisRadkyHodin_(radky);
    log_('Zápis hodin – měsíční výkaz', '', idAkce + ': ' + radky.length + ' zápisů, ' + mesic);
    return { ok: true, pocet: radky.length };
  });
}

function zmenStavHodin(token, ids, stav) {
  const a = overAdmin_(token, 'Koordinátor');
  if (STAVY_HODIN.indexOf(stav) < 0) throw new Error('Neznámý stav.');
  const n = nastaveni_();
  ids = [].concat(ids || []).map(String);
  return sZamkem_(() => {
    const data = radkyHodin_();
    let pocet = 0;
    data.radky.filter(z => ids.indexOf(z.id) >= 0).forEach(z => {
      overUzaverku_(a, n, z.datum);
      const zmeny = { 'Stav': stav, 'Upraveno': new Date(), 'Upravil/a': a.email };
      if (stav === 'Schváleno') zmeny['Potvrdila organizace'] = a.email + ' – ' + Utilities.formatDate(new Date(), TZ, 'd. M. yyyy H:mm');
      zapisDoRadku_(data.sh, z.radek, data.hlav, zmeny);
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
    mazat.forEach(z => overUzaverku_(a, n, z.datum));
    mazat.sort((x, y) => y.radek - x.radek).forEach(z => data.sh.deleteRow(z.radek));
    log_('Smazání hodin', '', mazat.map(z => z.dobrovolnik + ' ' + z.datum + ' ' + z.minut + ' min').join('; ').slice(0, 900));
    return { ok: true, pocet: mazat.length };
  });
}
