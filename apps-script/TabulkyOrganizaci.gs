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
    ['Opište do něj řádek za řádkem: datum (dvojklikem se otevře kalendář), čas od a do (výběr z nabídky 0:00 až 24:00 po 5 minutách; nabídku jde i psát), činnost z nabídky, případně poznámku.'],
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
  const casy = seznamCasu_();
  sez.getRange(1, 2, casy.length, 1).setNumberFormat('@').setValues(casy.map(c => [c]));
  const rozsahCasu = sez.getRange(1, 2, casy.length, 1);

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
      nastavVzorceAValidace_(sh, rozsahCinnosti, rozsahCasu);   // i u už existujících listů (kalendář, nabídka časů)
    } else {
      sh = ss.insertSheet(l.nazev);
      formatujListDobrovolnika_(sh, l, rozsahCinnosti, rozsahCasu);
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

// Nabídka časů: 0:00, 0:05 … 24:00 (minuty po 5, konec dne 24:00)
function seznamCasu_() {
  const c = [];
  for (let m = 0; m <= 24 * 60; m += 5) c.push(Math.floor(m / 60) + ':' + ('0' + (m % 60)).slice(-2));
  return c;
}

// Vzorec pro sloupec „Hodin“ (zápis ve skriptu je vždy s čárkami, bez ohledu na české nastavení tabulky) a výběry hodnot.
// Volá se při vzniku listu i při „Aktualizovat listy“, takže se opraví i už vytvořené listy.
function nastavVzorceAValidace_(sh, rozsahCinnosti, rozsahCasu) {
  const prvni = PRVNI_RADEK_TAB, n = POCET_RADKU_TAB;
  const min = (sl, r) => '(INT(LEFT(' + sl + r + ',FIND(":",' + sl + r + ')-1))*60+INT(MID(' + sl + r + ',FIND(":",' + sl + r + ')+1,2)))';
  const vzorce = [];
  for (let i = 0; i < n; i++) {
    const r = prvni + i;
    vzorce.push(['=IFERROR(IF(OR(B' + r + '="",C' + r + '=""),"",(' + min('C', r) + '-' + min('B', r) + ')/60),"")']);
  }
  sh.getRange(prvni, 4, n, 1).setFormulas(vzorce);
  // datum: dvojklikem se otevře kalendář
  sh.getRange(prvni, 1, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).setHelpText('Vyberte datum (dvojklikem se otevře kalendář).').build());
  // od a do: výběr z nabídky 0:00 až 24:00 po 5 minutách (jde i psát, nabídka se filtruje)
  sh.getRange(prvni, 2, n, 2).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(rozsahCasu, true).setAllowInvalid(false).setHelpText('Vyberte čas z nabídky (minuty po 5, konec dne je 24:00).').build());
  sh.getRange(prvni, 5, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(rozsahCinnosti, true).setAllowInvalid(true).build());
}

function formatujListDobrovolnika_(sh, l, rozsahCinnosti, rozsahCasu) {
  const H = HLAVICKA_TAB_DOBROVOLNIK, r0 = RADEK_HLAVICKY_TAB, prvni = r0 + 1, n = POCET_RADKU_TAB;
  sh.getRange('A1').setValue('Dobrovolník: ' + l.jmeno).setFontWeight('bold').setFontSize(13);
  sh.getRange('A2').setValue(l.id).setFontColor('#999999');   // ID dobrovolníka – podle něj systém list pozná
  sh.getRange(r0, 1, 1, H.length).setValues([H]).setFontWeight('bold').setBackground('#1f5c45').setFontColor('#ffffff').setWrap(true);
  sh.setFrozenRows(r0);
  sh.getRange(prvni, 1, n, 1).setNumberFormat('d. M. yyyy');
  sh.getRange(prvni, 2, n, 2).setNumberFormat('@');
  sh.getRange(prvni, 4, n, 1).setNumberFormat('0.00');
  nastavVzorceAValidace_(sh, rozsahCinnosti, rozsahCasu);
  sh.getRange(prvni, 7, n, 1).insertCheckboxes();
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

// ID organizace → { url, naposledy, souhrn } (jen pro přihlášené administrátory)
function tabulkyOrganizaci(token) {
  overAdmin_(token, 'Jen čtení');
  const o = {};
  organizace_().forEach(x => { const id = tabulkaOrgId_(x.id); if (id) o[x.id] = Object.assign({ url: tabulkaOrgUrl_(id) }, poslednihNacteni_(x.id)); });
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

// ===== NAČÍTÁNÍ ŘÁDKŮ Z TABULKY DO DATABÁZE =====================

const ZDROJ_TABULKA = 'Tabulka organizace';
const PRVNI_RADEK_TAB = RADEK_HLAVICKY_TAB + 1;

// --- cizí tabulky (jen tyto dvě funkce; testy je nahrazují)

// Řádky všech viditelných listů dobrovolníků: [{ list, dobrovolnik, radky: [{ r, datum, od, do, cinnost, poznamka, zneplatnit, stav, id }] }]
function tabOrgPrectiListy_(idTab) {
  const ss = SpreadsheetApp.openById(idTab), out = [];
  const datumZ = (v, zobr) => {
    if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
    const t = String(zobr || v || '').trim();
    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    m = t.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
    return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : t;
  };
  ss.getSheets().forEach(sh => {
    const nazev = sh.getName(), m = nazev.match(/\((DC-\d{4}-\d+)\)$/);
    if (!m || sh.isSheetHidden()) return;   // skryté listy = dobrovolník už není papírový
    const posl = sh.getLastRow();
    const radky = [];
    if (posl >= PRVNI_RADEK_TAB) {
      const rozsah = sh.getRange(PRVNI_RADEK_TAB, 1, posl - PRVNI_RADEK_TAB + 1, 9);
      const h = rozsah.getValues(), d = rozsah.getDisplayValues();
      h.forEach((r, i) => {
        const x = {
          r: PRVNI_RADEK_TAB + i, datum: datumZ(r[0], d[i][0]), od: String(d[i][1]).trim(), do: String(d[i][2]).trim(),
          cinnost: String(r[4] || '').trim(), poznamka: String(r[5] || '').trim(), zneplatnit: r[6] === true,
          stav: String(r[7] || '').trim(), id: String(r[8] || '').trim()
        };
        if (x.datum || x.od || x.do || x.cinnost || x.poznamka) radky.push(x);
      });
    }
    out.push({ list: nazev, dobrovolnik: m[1], radky: radky });
  });
  return out;
}

// Zapíše do sloupců Stav a ID záznamu: zmeny = [{ r, stav, id? }]
function tabOrgZapisStavy_(idTab, nazevListu, zmeny) {
  if (!zmeny.length) return;
  const sh = SpreadsheetApp.openById(idTab).getSheetByName(nazevListu);
  if (!sh) return;
  const posl = Math.max.apply(null, zmeny.map(z => z.r));
  const rozsah = sh.getRange(PRVNI_RADEK_TAB, 8, posl - PRVNI_RADEK_TAB + 1, 2), v = rozsah.getValues();
  zmeny.forEach(z => { const i = z.r - PRVNI_RADEK_TAB; v[i][0] = z.stav; if (z.id) v[i][1] = z.id; });
  rozsah.setValues(v);
}

// --- logika

function poslednihNacteni_(orgId) {
  const raw = PropertiesService.getScriptProperties().getProperty('TABORG_POSLEDNI_' + orgId);
  if (!raw) return { naposledy: '', souhrn: null };
  try { const x = JSON.parse(raw); return { naposledy: x.kdy, souhrn: x.souhrn }; } catch (e) { return { naposledy: '', souhrn: null }; }
}

// Načte tabulku jedné organizace. Pravidla jsou stejná jako při zápisu na webu (pripravZapis_).
// Řádek bez ID = nový zápis; řádek s ID = případná změna; „Zneplatnit řádek“ = zápis se přestane započítávat (stav Zamítnuto).
// Systém do tabulky zapíše stav řádku a ID. Smazané řádky systém nemaže, jen je započítá do „chybí v tabulce“.
function nactiTabulkuOrganizaceVnitrni_(orgId, a) {
  const idTab = tabulkaOrgId_(orgId);
  if (!idTab) throw new Error('Tabulka této organizace ještě neexistuje.');
  const n = nastaveni_(), orgs = organizace_(), pr = prirazeni_();
  const ted = new Date(), znak = Utilities.formatDate(ted, TZ, 'd. M. yyyy H:mm');
  const sou = { novych: 0, zmenenych: 0, zneplatnenych: 0, beze_zmeny: 0, chyb: 0, chybiVTabulce: 0, listu: 0 };
  const videneId = {};
  const listy = tabOrgPrectiListy_(idTab);
  listy.forEach(l => {
    sou.listu++;
    const zmeny = [];
    const papirOk = papirPrirazeni_(l.dobrovolnik, orgId);
    const data = radkyHodin_();
    const mojeDb = {};
    data.radky.filter(z => z.dobrovolnik === l.dobrovolnik && z.orgId === orgId && z.zdroj === ZDROJ_TABULKA).forEach(z => { mojeDb[z.id] = z; });
    l.radky.forEach(x => {
      if (x.id) videneId[x.id] = true;
      const stavZapis = (stav, id) => zmeny.push({ r: x.r, stav: String(stav).slice(0, 250), id: id });
      try {
        if (!papirOk) { sou.chyb++; return stavZapis('Chyba: dobrovolník už u této organizace nevykazuje podle papírového výkazu'); }
        const puv = x.id ? mojeDb[x.id] : null;
        if (x.id && !puv) { sou.chyb++; return stavZapis('Záznam byl v systému odstraněn, řádek se nenačítá'); }
        if (x.zneplatnit) {
          if (puv && puv.stav !== 'Zamítnuto') {
            overZamek_(puv.dobrovolnik, puv.orgId, puv.datum);
            const dd = radkyHodin_(), z2 = dd.radky.find(q => q.id === puv.id);
            zapisDoRadku_(dd.sh, z2.radek, dd.hlav, { 'Stav': 'Zamítnuto', 'Upraveno': ted, 'Upravil/a': a.email });
            historie_(a, 'Zneplatnění řádku v tabulce', puv.id, puv.dobrovolnik, popisZaznamu_(puv));
            sou.zneplatnenych++;
          }
          return stavZapis('Zneplatněno');
        }
        const z = { dobrovolnik: l.dobrovolnik, orgId: orgId, datum: x.datum, od: x.od, do: x.do, cinnost: x.cinnost, poznamka: x.poznamka };
        const p = pripravZapis_(z, pr, orgs, n, a, false);
        const popis = { datum: p.datum, od: p.od, do: p.do, minut: p.minut, orgId: p.org.id, cinnost: p.cinnost };
        if (puv) {
          const stejne = ymd_(puv.datum) === ymd_(p.datum) && puv.od === p.od && puv.do === p.do && puv.cinnost === p.cinnost && puv.poznamka === p.poznamka && puv.stav !== 'Zamítnuto';
          if (stejne) { sou.beze_zmeny++; return stavZapis('Načteno', puv.id); }
          overZamek_(puv.dobrovolnik, puv.orgId, puv.datum);
          const dd = radkyHodin_(), z2 = dd.radky.find(q => q.id === puv.id);
          zapisDoRadku_(dd.sh, z2.radek, dd.hlav, {
            'Datum': p.datum, 'Počet hodin': Math.round(p.minut / 60 * 100) / 100, 'Činnost': p.cinnost, 'Čas od': p.od, 'Čas do': p.do,
            'Minut': p.minut, 'Poznámka': p.poznamka, 'Stav': 'Ke schválení', 'Upraveno': ted, 'Upravil/a': a.email
          });
          historie_(a, 'Úprava z tabulky', puv.id, puv.dobrovolnik, popisZaznamu_(puv) + ' → ' + popisZaznamu_(popis));
          sou.zmenenych++;
          return stavZapis('Načteno (změna ' + znak + ')', puv.id);
        }
        const zaznam = novyZaznamHodin_(p, a, ZDROJ_TABULKA, '');
        zaznam['Stav'] = 'Ke schválení';
        zapisRadkyHodin_([zaznam]);
        historie_(a, 'Zápis z tabulky', zaznam['ID záznamu'], p.dobrovolnik, popisZaznamu_(popis));
        sou.novych++;
        videneId[zaznam['ID záznamu']] = true;
        return stavZapis('Načteno ' + znak, zaznam['ID záznamu']);
      } catch (e) {
        sou.chyb++;
        stavZapis('Chyba: ' + e.message);
      }
    });
    tabOrgZapisStavy_(idTab, l.list, zmeny);
  });
  // záznamy z tabulky, které v ní už nejsou (řádek byl smazán): jen se spočítají, nic se nemaže
  radkyHodin_().radky.filter(z => z.orgId === orgId && z.zdroj === ZDROJ_TABULKA && !videneId[z.id] && papirPrirazeni_(z.dobrovolnik, orgId)).forEach(() => { sou.chybiVTabulce++; });
  PropertiesService.getScriptProperties().setProperty('TABORG_POSLEDNI_' + orgId, JSON.stringify({ kdy: Utilities.formatDate(ted, TZ, 'yyyy-MM-dd HH:mm'), souhrn: sou }));
  log_('Načtena tabulka organizace', '', orgId + ': nových ' + sou.novych + ', změn ' + sou.zmenenych + ', chyb ' + sou.chyb);
  return sou;
}

const SYSTEM_TABULKA = { email: 'tabulka organizace', role: 'Koordinátor organizace' };

// Načíst teď (dashboard)
function nactiTabulkuOrganizace(token, orgId) {
  const a = overAdmin_(token, 'Koordinátor');
  orgId = String(orgId || '').trim();
  return sZamkem_(() => ({ souhrn: nactiTabulkuOrganizaceVnitrni_(orgId, SYSTEM_TABULKA) }));
}

// Načíst tabulky všech organizací (dashboard, před schvalováním měsíce)
function nactiVsechnyTabulkyOrganizaci(token) {
  overAdmin_(token, 'Koordinátor');
  return sZamkem_(() => nactiVsechnyVnitrni_());
}

function nactiVsechnyVnitrni_() {
  const vys = { organizaci: 0, novych: 0, zmenenych: 0, chyb: 0, selhalo: [] };
  organizace_().forEach(o => {
    if (!tabulkaOrgId_(o.id)) return;
    try {
      const s = nactiTabulkuOrganizaceVnitrni_(o.id, SYSTEM_TABULKA);
      vys.organizaci++; vys.novych += s.novych; vys.zmenenych += s.zmenenych; vys.chyb += s.chyb;
    } catch (e) { vys.selhalo.push(o.nazev + ': ' + e.message); }
  });
  return vys;
}

// Načíst teď (portál organizace; nejvýše jednou za minutu u jedné organizace)
function oNactiTabulkuTed(token, orgId) {
  const k = overKoordinatorOrg_(token);
  orgId = String(orgId || '').trim();
  if (k.orgIds.indexOf(orgId) < 0) throw new Error('Pro tuto organizaci nemáte oprávnění.');
  const cache = CacheService.getScriptCache();
  if (cache.get('TABNACTI_' + orgId)) throw new Error('Tabulka se právě načítala. Zkuste to za minutu.');
  cache.put('TABNACTI_' + orgId, '1', 60);
  return sZamkem_(() => ({ souhrn: nactiTabulkuOrganizaceVnitrni_(orgId, SYSTEM_TABULKA) }));
}

// Spouští se jednou týdně (viz zapnoutTydenniNacitani)
function nactiTabulkyOrganizaciSpoustec() {
  AKTUALNI_UZIVATEL = 'týdenní načtení tabulek';
  MEMO = {};
  sZamkem_(() => { const v = nactiVsechnyVnitrni_(); log_('Týdenní načtení tabulek organizací', '', 'organizací ' + v.organizaci + ', nových ' + v.novych + ', změn ' + v.zmenenych + ', chyb ' + v.chyb + (v.selhalo.length ? ', selhalo: ' + v.selhalo.join('; ') : '')); });
}

// --- týdenní spouštěč (jen tyto funkce sahají na ScriptApp; testy je nahrazují)
function spoustecNacitaniExistuje_() { return ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'nactiTabulkyOrganizaciSpoustec'); }
function spoustecNacitaniNastav_(zapnout) {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'nactiTabulkyOrganizaciSpoustec').forEach(t => ScriptApp.deleteTrigger(t));
  if (zapnout) ScriptApp.newTrigger('nactiTabulkyOrganizaciSpoustec').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(5).inTimezone(TZ).create();
}

function stavTydenniNacitani(token) {
  overAdmin_(token, 'Jen čtení');
  return { zapnuto: spoustecNacitaniExistuje_() };
}

function nastavTydenniNacitani(token, zapnout) {
  overAdmin_(token, 'Hlavní admin');
  spoustecNacitaniNastav_(!!zapnout);
  log_('Týdenní načítání tabulek organizací', '', zapnout ? 'zapnuto (pondělí kolem 5:00)' : 'vypnuto');
  return { zapnuto: !!zapnout };
}

// Pro ruční spuštění z menu tabulky
function zapnoutTydenniNacitani() {
  spoustecNacitaniNastav_(true);
  upozorni_('Týdenní načítání tabulek organizací je zapnuté (pondělí kolem 5:00).');
}
