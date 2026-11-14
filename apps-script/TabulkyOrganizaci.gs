/**
 * DOBROVOLNICKÉ CENTRUM – TABULKY ORGANIZACÍ (papírové výkazy)
 * --------------------------------------------------------------
 * Dobrovolník je u organizace buď „Sám“ (zapisuje přes web), nebo „Organizace podle papírového výkazu“.
 * Pro každou organizaci, která má aspoň jednoho papírového dobrovolníka, vzniká jedna Google tabulka
 * na sdíleném disku KONEP; každý papírový dobrovolník v ní má svůj list. Organizace do ní opisuje
 * papírové výkazy a systém řádky načítá do centrální databáze (krok 2, načítání).
 *
 * Do tabulky patří jen jména, ID a hodiny (žádné kontakty ani adresy). Dobrovolníci k tabulce přístup nemají.
 * ID tabulky je v Script Properties (TABORG_<ID organizace>), nikdy ne v kódu ani v repozitáři.
 *
 * Na Disk a do cizích tabulek sahají jen funkce slozkaTabulekOrg_, tabOrgVytvor_, tabOrgNastavListy_,
 * tabOrgSdilej_ (testy je nahrazují); skutečné chování ověří správce po nasazení ručně.
 */

const HLAVICKA_TAB_DOBROVOLNIK = ['Datum', 'Od', 'Do', 'Hodin', 'Činnost', 'Poznámka', 'Zneplatnit řádek', 'Stav', 'ID záznamu'];
const RADEK_HLAVICKY_TAB = 4;
const POCET_RADKU_TAB = 1000;

// ===== POMOCNÉ ================================================

function tabulkaOrgId_(orgId) { return PropertiesService.getScriptProperties().getProperty('TABORG_' + orgId) || ''; }
function tabulkaOrgUrl_(id) { return id ? 'https://docs.google.com/spreadsheets/d/' + id + '/edit' : ''; }

function nazevListuDobrovolnika_(d) { return (d.prijmeni + ' ' + d.jmeno).trim().slice(0, 80) + ' (' + d.id + ')'; }

// ===== DISK A TABULKY (jen zde se sahá na cizí soubory) =======

function slozkaTabulekOrg_() {
  const id = extrahujId_(nastaveni_().slozka_tabulek_organizaci);
  if (id) return DriveApp.getFolderById(id);
  // výchozí: složka „Tabulky organizací“ vedle složky Zálohy
  const p = slozkaZaloh_().getParents();
  const rodic = p.hasNext() ? p.next() : DriveApp.getRootFolder();
  const it = rodic.getFoldersByName('Tabulky organizací');
  const slozka = it.hasNext() ? it.next() : rodic.createFolder('Tabulky organizací');
  nastavHodnotu_('slozka_tabulek_organizaci', slozka.getUrl());
  return slozka;
}

function tabOrgVytvor_(nazev) {
  const ss = SpreadsheetApp.create(nazev);
  DriveApp.getFileById(ss.getId()).moveTo(slozkaTabulekOrg_());
  return ss.getId();
}

// info = { orgNazev, cinnosti: [..], listy: [{ id, nazev, jmeno }] }
function tabOrgNastavListy_(idTab, info) {
  const ss = SpreadsheetApp.openById(idTab);
  const ctiId = nazev => { const m = String(nazev).match(/\((DC-\d{4}-\d+)\)$/); return m ? m[1] : ''; };

  // Návod
  let navod = ss.getSheetByName('Návod');
  if (!navod) navod = ss.insertSheet('Návod', 0);
  navod.clear();
  const text = [
    ['Hodiny dobrovolníků – ' + info.orgNazev],
    [''],
    ['Každý dobrovolník, kterému vykazujete hodiny podle papírového výkazu, má v této tabulce svůj list.'],
    ['Opište do něj řádek za řádkem: datum, čas od a do (např. 9:00 a 11:30, minuty po 5, konec dne zapište jako 24:00), činnost z nabídky, případně poznámku.'],
    ['Sloupec „Hodin“ se spočítá sám. Šedé sloupce „Stav“ a „ID záznamu“ vyplňuje systém – nepřepisujte je.'],
    ['Chybně zapsaný řádek nemažte: zaškrtněte „Zneplatnit řádek“. Řádek zešedne, přeškrtne se a systém ho přestane započítávat.'],
    ['Systém řádky načítá do centrální databáze jednou týdně a po klepnutí na „Načíst teď“ v portálu organizace.'],
    ['Do tabulky nepatří žádné osobní údaje kromě jména dobrovolníka.']
  ];
  navod.getRange(1, 1, text.length, 1).setValues(text);
  navod.getRange('A1').setFontWeight('bold').setFontSize(14);
  navod.setColumnWidth(1, 900);
  navod.getRange(1, 1, text.length, 1).setWrap(true);

  // Seznamy (skrytý list s nabídkou činností)
  let sez = ss.getSheetByName('Seznamy');
  if (!sez) sez = ss.insertSheet('Seznamy');
  sez.clear();
  const cin = info.cinnosti.length ? info.cinnosti : [''];
  sez.getRange(1, 1, cin.length, 1).setValues(cin.map(c => [c]));
  if (!sez.isSheetHidden()) sez.hideSheet();
  const rozsahCinnosti = sez.getRange(1, 1, cin.length, 1);

  // Listy dobrovolníků: najdi podle ID v názvu, přejmenuj, nebo založ
  const existujici = {};
  ss.getSheets().forEach(sh => { const id = ctiId(sh.getName()); if (id) existujici[id] = sh; });
  const chtene = {};
  info.listy.forEach(l => {
    chtene[l.id] = true;
    let sh = existujici[l.id];
    if (sh) {
      if (sh.getName() !== l.nazev) sh.setName(l.nazev);
      if (sh.isSheetHidden()) sh.showSheet();
    } else {
      sh = ss.insertSheet(l.nazev);
      formatujListDobrovolnika_(sh, l, rozsahCinnosti);
    }
  });
  // dobrovolníci, kteří už papírově nevykazují: list se jen skryje (nic se nemaže)
  Object.keys(existujici).forEach(id => { if (!chtene[id] && !existujici[id].isSheetHidden()) existujici[id].hideSheet(); });
  // výchozí prázdný list z vytvoření tabulky
  ['List1', 'Sheet1', 'Sheet 1', 'List 1'].forEach(n => {
    const sh = ss.getSheetByName(n);
    if (sh && ss.getSheets().length > 1 && sh.getLastRow() === 0) ss.deleteSheet(sh);
  });
  ss.setActiveSheet(navod);
}

function formatujListDobrovolnika_(sh, l, rozsahCinnosti) {
  const H = HLAVICKA_TAB_DOBROVOLNIK, r0 = RADEK_HLAVICKY_TAB, prvni = r0 + 1, n = POCET_RADKU_TAB;
  sh.getRange('A1').setValue('Dobrovolník: ' + l.jmeno).setFontWeight('bold').setFontSize(13);
  sh.getRange('A2').setValue(l.id).setFontColor('#999999');   // ID dobrovolníka – podle něj systém list pozná
  sh.getRange(r0, 1, 1, H.length).setValues([H]).setFontWeight('bold').setBackground('#1f5c45').setFontColor('#ffffff').setWrap(true);
  sh.setFrozenRows(r0);
  sh.getRange(prvni, 1, n, 1).setNumberFormat('d. M. yyyy');
  sh.getRange(prvni, 2, n, 2).setNumberFormat('@');
  sh.getRange(prvni, 4, n, 1).setNumberFormat('0.00');
  const vzorce = [];
  for (let i = 0; i < n; i++) {
    const r = prvni + i;
    vzorce.push(['=IFERROR(IF(OR(B' + r + '="";C' + r + '="");"";(HOUR(TIMEVALUE(C' + r + '))*60+MINUTE(TIMEVALUE(C' + r + '))-HOUR(TIMEVALUE(B' + r + '))*60-MINUTE(TIMEVALUE(B' + r + ')))/60);"")']);
  }
  sh.getRange(prvni, 4, n, 1).setFormulas(vzorce);
  sh.getRange(prvni, 7, n, 1).insertCheckboxes();
  sh.getRange(prvni, 5, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(rozsahCinnosti, true).setAllowInvalid(true).build());
  sh.getRange(prvni, 8, n, 2).setBackground('#f1f1f1');                 // systémové sloupce Stav a ID záznamu
  sh.hideColumns(9);                                                    // ID záznamu je skryté
  sh.getRange(prvni, 8, n, 2).protect().setWarningOnly(true);           // jen upozornění při pokusu o přepsání
  // zneplatněný řádek: šedě a přeškrtnutě
  const pravidlo = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$G' + prvni + '=TRUE')
    .setFontColor('#999999').setStrikethrough(true).setBackground('#eeeeee')
    .setRanges([sh.getRange(prvni, 1, n, 8)]).build();
  sh.setConditionalFormatRules([pravidlo]);
  [90, 70, 70, 70, 220, 260, 120, 260].forEach((w, i) => sh.setColumnWidth(i + 1, w));
}

function tabOrgSdilej_(idTab, emaily) {
  const f = DriveApp.getFileById(idTab);
  emaily.forEach(e => f.addEditor(e));
  try { f.setShareableByEditors(false); } catch (e) { console.warn(e); }
}

// ===== LOGIKA =================================================

// Papírový dobrovolník u organizace (aktivní přiřazení se způsobem „Organizace podle papírového výkazu“)
function papirPrirazeni_(dobrovolnik, orgId) {
  return prirazeni_().some(p => p.dobrovolnik === dobrovolnik && p.orgId === orgId && p.aktivni && p.papir);
}

function infoTabulkyOrg_(orgId) {
  const o = organizace_().find(x => x.id === orgId);
  if (!o) throw new Error('Organizace nebyla nalezena.');
  const mapa = dobrovolniciMapa_(), lide = {};
  prirazeni_().filter(p => p.orgId === orgId && p.aktivni && p.papir).forEach(p => { if (mapa[p.dobrovolnik]) lide[p.dobrovolnik] = mapa[p.dobrovolnik]; });
  const listy = Object.keys(lide).map(id => lide[id]).sort((a, b) => (a.prijmeni + a.jmeno).localeCompare(b.prijmeni + b.jmeno, 'cs'))
    .map(d => ({ id: d.id, nazev: nazevListuDobrovolnika_(d), jmeno: [d.titul, d.jmeno, d.prijmeni].filter(Boolean).join(' ') }));
  const c = cinnosti_().filter(x => x.org === VSECHNY_ORGANIZACE || x.org === o.nazev).map(x => x.cinnost);
  return { org: o, orgNazev: o.nazev, cinnosti: c.filter((x, i) => c.indexOf(x) === i), listy: listy };
}

// Vytvoří tabulku organizace (je-li třeba) a sladí její listy s papírovými dobrovolníky
function zajistiTabulkuOrganizace_(orgId) {
  const info = infoTabulkyOrg_(orgId);
  const props = PropertiesService.getScriptProperties();
  let id = tabulkaOrgId_(orgId), nova = false;
  if (!id) {
    id = tabOrgVytvor_('Hodiny dobrovolníků – ' + info.orgNazev);
    props.setProperty('TABORG_' + orgId, id);
    nova = true;
  }
  tabOrgNastavListy_(id, info);
  return { id: id, url: tabulkaOrgUrl_(id), nova: nova, pocetListu: info.listy.length };
}

function tabulkaOrganizace(token, orgId) {
  overAdmin_(token, 'Koordinátor');
  orgId = String(orgId || '').trim();
  return sZamkem_(() => {
    const r = zajistiTabulkuOrganizace_(orgId);
    log_('Tabulka organizace' + (r.nova ? ' vytvořena' : ' aktualizována'), '', orgId + ', listů: ' + r.pocetListu);
    return { url: r.url, nova: r.nova, pocetListu: r.pocetListu };
  });
}

function sdilejTabulkuOrganizace(token, orgId) {
  overAdmin_(token, 'Koordinátor');
  orgId = String(orgId || '').trim();
  const id = tabulkaOrgId_(orgId);
  if (!id) throw new Error('Tabulka této organizace ještě neexistuje. Nejdřív ji vytvořte.');
  const sh = ss_().getSheetByName(LISTY.KORDORG);
  const emaily = [];
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues().forEach(r => {
      const e = String(r[0]).trim().toLowerCase();
      if (platnyEmail_(e) && String(r[2]).trim() === orgId && String(r[3]).trim().toUpperCase() !== 'NE' && emaily.indexOf(e) < 0) emaily.push(e);
    });
  }
  if (!emaily.length) throw new Error('Organizace nemá žádného aktivního koordinátora (Administrace → Koordinátoři organizací).');
  tabOrgSdilej_(id, emaily);
  log_('Tabulka organizace sdílena', '', orgId + ': ' + emaily.length + ' koordinátorů');
  return { pocet: emaily.length };
}

// ID organizace → odkaz na její tabulku (jen pro přihlášené administrátory)
function tabulkyOrganizaci(token) {
  overAdmin_(token, 'Jen čtení');
  const o = {};
  organizace_().forEach(x => { const id = tabulkaOrgId_(x.id); if (id) o[x.id] = tabulkaOrgUrl_(id); });
  return o;
}

// Způsob vykazování u dvojice dobrovolník + organizace; při papírovém se postará o tabulku organizace
function nastavZpusobPrirazeni(token, idPrirazeni, zpusob) {
  overAdmin_(token, 'Koordinátor');
  zpusob = String(zpusob || '').trim() || ZPUSOBY_VYKAZOVANI[0];
  if (ZPUSOBY_VYKAZOVANI.indexOf(zpusob) < 0) throw new Error('Neznámý způsob vykazování.');
  return sZamkem_(() => {
    const p = prirazeni_().find(x => x.id === String(idPrirazeni));
    if (!p) throw new Error('Přiřazení nebylo nalezeno.');
    const sh = list_(LISTY.PRIRAZENI);
    zapisDoRadku_(sh, p.radek, hlavicky_(sh), { 'Způsob vykazování': zpusob });
    log_('Způsob vykazování', p.dobrovolnik, p.org + ': ' + zpusob);
    // tabulka organizace se založí / upraví; selhání (např. chybějící oprávnění) nebrání uložení volby
    let tabulka = { url: '', chyba: '' };
    if (zpusob === ZPUSOBY_VYKAZOVANI[1] || tabulkaOrgId_(p.orgId)) {
      try { tabulka.url = zajistiTabulkuOrganizace_(p.orgId).url; }
      catch (e) { tabulka.chyba = e.message; console.error('Tabulka organizace: ' + e.message); }
    }
    return { prirazeni: prirazeni_(), tabulka: tabulka };
  });
}
