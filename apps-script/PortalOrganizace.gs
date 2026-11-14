/**
 * DOBROVOLNICKÉ CENTRUM – PORTÁL ORGANIZACE (fáze D1)
 * --------------------------------------------------------------
 * Stránka organizace.html na GitHubu. Koordinátor přijímající organizace se přihlásí
 * stejně jako dobrovolník (e-mail + kód/odkaz, nebo účet Google) a vidí JEN dobrovolníky
 * a hodiny své organizace (vynucuje server). Jméno a kontakt dobrovolníka ano, další údaje ne.
 * Smí zapisovat a upravovat hodiny (čekají na schválení KONEP), dokud měsíc není schválený a zamčený,
 * a nahrávat fotky papírových výkazů. Schvaluje a odemyká jen KONEP.
 *
 * Koordinátory organizací spravuje KONEP v dashboardu (Administrace → Koordinátoři organizací);
 * jedna organizace jich může mít víc, jeden člověk může koordinovat víc organizací.
 */

const SLOUPCE_KORDORG = ['E-mail', 'Jméno', 'ID organizace', 'Aktivní'];
const ROLE_ORG = 'Koordinátor organizace';

// ===== KOORDINÁTOŘI ORGANIZACÍ ================================

// Aktivní řádky s tímto e-mailem u existujících aktivních organizací
function koordinatorOrgPodleEmailu_(email) {
  email = String(email || '').trim().toLowerCase();
  if (!platnyEmail_(email)) return null;
  const sh = ss_().getSheetByName(LISTY.KORDORG);
  if (!sh || sh.getLastRow() < 2) return null;
  const h = hlavicky_(sh), i = n => h.indexOf(n);
  const platne = organizace_().filter(o => o.aktivni !== false).map(o => o.id);
  const nalez = sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues().filter(r =>
    String(r[i('E-mail')]).trim().toLowerCase() === email && String(r[i('Aktivní')]).trim().toUpperCase() !== 'NE' &&
    platne.indexOf(String(r[i('ID organizace')]).trim()) >= 0);
  if (!nalez.length) return null;
  const orgIds = nalez.map(r => String(r[i('ID organizace')]).trim()).filter((x, k, a) => a.indexOf(x) === k);
  return { email: email, jmeno: String(nalez[0][i('Jméno')] || ''), orgIds: orgIds };
}

// ===== RELACE =================================================

function vytvorRelaciO_(email) {
  const props = PropertiesService.getScriptProperties();
  const ted = Date.now();
  const vse = props.getProperties();
  Object.keys(vse).forEach(k => {
    if (k.indexOf('SESO_') === 0 || k.indexOf('OVSTUP_') === 0) {
      try { if (JSON.parse(vse[k]).exp < ted) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
    }
  });
  const dni = Number(nastaveni_().delka_prihlaseni_dobrovolnik_dni) || 365;
  const token = Utilities.getUuid() + Utilities.getUuid();
  props.setProperty('SESO_' + hash_(token), JSON.stringify({ email: email, exp: ted + dni * 86400000 }));
  return token;
}

// Oprávnění se ověřuje při každém požadavku znovu (odebrání ze seznamu platí hned)
function overKoordinatorOrg_(token) {
  const chyba = () => new Error('PRIHLASENI: Přihlášení vypršelo. Přihlaste se prosím znovu.');
  if (!token) throw chyba();
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('SESO_' + hash_(token));
  if (!raw) throw chyba();
  const s = JSON.parse(raw);
  if (s.exp < Date.now()) { props.deleteProperty('SESO_' + hash_(token)); throw chyba(); }
  const k = koordinatorOrgPodleEmailu_(s.email);
  if (!k) {
    props.deleteProperty('SESO_' + hash_(token));
    throw new Error('PRIHLASENI: Váš přístup do portálu organizace už není aktivní. Obraťte se prosím na KONEP.');
  }
  AKTUALNI_UZIVATEL = s.email + ' (organizace)';
  return { email: k.email, jmeno: k.jmeno, orgIds: k.orgIds, role: ROLE_ORG };
}

function prihlasKoordinatoraOrg_(k, zpusob) {
  AKTUALNI_UZIVATEL = k.email + ' (organizace)';
  log_('Portál organizace – přihlášení (' + zpusob + ')', '', k.email);
  return { token: vytvorRelaciO_(k.email) };
}

function oOdhlasit(token) {
  if (token) PropertiesService.getScriptProperties().deleteProperty('SESO_' + hash_(token));
  return { ok: true };
}

// ===== PŘIHLÁŠENÍ: E-MAIL + KÓD / ODKAZ =======================

function oPosliKod(email) {
  email = String(email || '').trim().toLowerCase();
  if (!platnyEmail_(email)) throw new Error('Zadejte platný e-mail.');
  const k = koordinatorOrgPodleEmailu_(email);
  if (!k) { log_('Portál organizace – neznámý e-mail', '', email); return { ok: true }; }   // odpověď je stejná, nic se neodhalí

  const cache = CacheService.getScriptCache();
  if (cache.get('OKODT_' + email)) throw new Error('Kód jsme poslali před chvílí. Další můžete vyžádat za minutu.');
  const kod = String(parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 12), 16) % 1000000).padStart(6, '0');
  cache.put('OKOD_' + email, JSON.stringify({ h: hash_(kod + email), pokusy: 0 }), 600);
  cache.put('OKODT_' + email, '1', 60);

  const n = nastaveni_();
  const web = webAdresa_(n);
  let odkaz = '';
  if (web) {
    const t = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    cache.put('OODKAZ_' + hash_(t), JSON.stringify({ email: email }), 600);
    odkaz = web + 'organizace.html?vstup=' + t;
  }
  posliEmailSTlacitkem_('prihlaseni_organizace', email, {
    kod: kod, jmeno: k.jmeno || '', nazev_organizace: String(n.nazev_organizace || '')
  }, odkaz, 'Přihlásit se', n);
  log_('Portál organizace – odeslán kód', '', email);
  return { ok: true };
}

function oOverKod(email, kod) {
  email = String(email || '').trim().toLowerCase();
  kod = String(kod || '').replace(/\s/g, '');
  const cache = CacheService.getScriptCache();
  const raw = cache.get('OKOD_' + email);
  if (!raw) throw new Error('Kód vypršel nebo je neplatný. Požádejte o nový.');
  const k = JSON.parse(raw);
  if (k.h !== hash_(kod + email)) {
    k.pokusy++;
    if (k.pokusy >= 5) { cache.remove('OKOD_' + email); throw new Error('Příliš mnoho pokusů. Požádejte o nový kód.'); }
    cache.put('OKOD_' + email, JSON.stringify(k), 600);
    throw new Error('Nesprávný kód. Zbývá pokusů: ' + (5 - k.pokusy) + '.');
  }
  cache.remove('OKOD_' + email);
  const kk = koordinatorOrgPodleEmailu_(email);
  if (!kk) throw new Error('Tento e-mail nemá přístup do portálu organizace.');
  return prihlasKoordinatoraOrg_(kk, 'kód');
}

function oPrihlasitOdkazem(t) {
  t = String(t || '').trim();
  if (!/^[a-f0-9]{64}$/.test(t)) throw new Error('Odkaz je neplatný. Přihlaste se prosím e-mailem.');
  const c = CacheService.getScriptCache().get('OODKAZ_' + hash_(t));
  if (!c) throw new Error('Platnost odkazu vypršela. Přihlaste se prosím e-mailem – pošleme vám nový.');
  const k = koordinatorOrgPodleEmailu_(JSON.parse(c).email);
  if (!k) throw new Error('Váš přístup do portálu organizace už není aktivní. Obraťte se prosím na KONEP.');
  return prihlasKoordinatoraOrg_(k, 'odkaz');
}

function oPrihlasitGoogle(credential) {
  const email = overGoogleEmail_(credential);
  const k = koordinatorOrgPodleEmailu_(email);
  if (!k) {
    log_('Portál organizace – Google bez přístupu', '', email);
    throw new Error('Účet ' + email + ' nemá přístup do portálu organizace. Použijte e-mail, který KONEP zadal pro vaši organizaci.');
  }
  return prihlasKoordinatoraOrg_(k, 'Google');
}

// ===== DATA ORGANIZACE ========================================

function dobrovolniciMapa_() {
  const sh = list_(LISTY.DOBROVOLNICI), o = {};
  if (sh.getLastRow() < 2) return o;
  const h = hlavicky_(sh), i = n => h.indexOf(n);
  sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues().forEach(r => {
    const id = String(r[i('ID')]).trim();
    if (id) o[id] = { id: id, titul: String(r[i('Titul')] || ''), jmeno: String(r[i('Jméno')] || ''), prijmeni: String(r[i('Příjmení')] || ''), email: String(r[i('E-mail')] || ''), telefon: String(r[i('Telefon')] || ''), stav: String(r[i('Stav')] || '') };
  });
  return o;
}

function oFotky_(k) {
  return fotkyRadky_().radky.filter(f => k.orgIds.indexOf(f.orgId) >= 0)
    .map(f => ({ id: f.id, dobrovolnik: f.dobrovolnik, orgId: f.orgId, mesic: f.mesic, nahrano: f.nahrano }));
}

function oMojeData(token) {
  const k = overKoordinatorOrg_(token);
  const n = nastaveni_();
  const orgs = organizace_(), cin = cinnosti_();
  const moje = prirazeni_().filter(p => k.orgIds.indexOf(p.orgId) >= 0);
  const mapa = dobrovolniciMapa_();
  const lide = {};
  moje.forEach(p => {
    const d = mapa[p.dobrovolnik]; if (!d) return;
    const x = lide[p.dobrovolnik] = lide[p.dobrovolnik] || Object.assign({}, d, { prirazeni: [] });   // jen jméno a kontakt
    x.prirazeni.push({ orgId: p.orgId, od: p.od, do: p.do, aktivni: p.aktivni });
  });
  const hodiny = radkyHodin_().radky.filter(x => k.orgIds.indexOf(x.orgId) >= 0).map(x => ({
    id: x.id, dobrovolnik: x.dobrovolnik, datum: x.datum, orgId: x.orgId, org: x.org, od: x.od, do: x.do, minut: x.minut,
    cinnost: x.cinnost, poznamka: x.poznamka, stav: x.stav, zdroj: x.zdroj, zamceno: mesicZamcen_(x.dobrovolnik, x.orgId, x.datum)
  })).sort((a, b) => (b.datum + b.od).localeCompare(a.datum + a.od));
  return {
    koordinator: { email: k.email, jmeno: k.jmeno },
    organizace: k.orgIds.map(id => {
      const o = orgs.find(x => x.id === id) || { nazev: id };
      const c = cin.filter(x => x.org === VSECHNY_ORGANIZACE || x.org === o.nazev).map(x => x.cinnost);
      return { id: id, nazev: o.nazev, cinnosti: c.filter((x, i) => c.indexOf(x) === i) };
    }),
    dobrovolnici: Object.keys(lide).map(id => lide[id]).sort((a, b) => (a.prijmeni + a.jmeno).localeCompare(b.prijmeni + b.jmeno, 'cs')),
    hodiny: hodiny,
    fotky: oFotky_(k),
    nazev: String(n.nazev_organizace || ''),
    dnes: ymd_(new Date())
  };
}

// ===== ZÁPIS HODIN ZA ORGANIZACI ==============================

// Nový zápis, nebo úprava zápisu své organizace, který ještě není schválený. Čeká na schválení KONEP.
function oUlozHodiny(token, z) {
  const k = overKoordinatorOrg_(token);
  z = z || {};
  const orgId = String(z.orgId || '').trim();
  if (k.orgIds.indexOf(orgId) < 0) throw new Error('Pro tuto organizaci nemáte oprávnění.');
  overMinulyRok_(z.datum);
  const a = { email: k.email, role: ROLE_ORG };
  return sZamkem_(() => {
    const p = pripravZapis_(z, prirazeni_(), organizace_(), nastaveni_(), a, false);
    const ted = new Date();
    const popis = { datum: p.datum, od: p.od, do: p.do, minut: p.minut, orgId: p.org.id, cinnost: p.cinnost };
    if (z.id) {
      const data = radkyHodin_();
      const puv = data.radky.find(x => x.id === String(z.id));
      if (!puv || k.orgIds.indexOf(puv.orgId) < 0) throw new Error('Zápis nebyl nalezen. Obnovte prosím stránku.');
      if (puv.dobrovolnik !== p.dobrovolnik) throw new Error('Zápis nepatří tomuto dobrovolníkovi.');
      if (puv.stav === 'Schváleno') throw new Error('Schválený zápis už nelze měnit. Obraťte se prosím na KONEP.');
      overMinulyRok_(puv.datum);
      overZamek_(puv.dobrovolnik, puv.orgId, puv.datum);
      zapisDoRadku_(data.sh, puv.radek, data.hlav, {
        'Datum': p.datum, 'Počet hodin': Math.round(p.minut / 60 * 100) / 100, 'Organizace': p.org.nazev, 'ID organizace': p.org.id,
        'Činnost': p.cinnost, 'Čas od': p.od, 'Čas do': p.do, 'Minut': p.minut, 'Poznámka': p.poznamka,
        'Stav': 'Ke schválení', 'Upraveno': ted, 'Upravil/a': a.email
      });
      historie_(a, 'Úprava', z.id, p.dobrovolnik, popisZaznamu_(puv) + ' → ' + popisZaznamu_(popis));
      log_('Portál organizace – úprava hodin', p.dobrovolnik, z.id + ': ' + p.minut + ' min');
    } else {
      const zaznam = novyZaznamHodin_(p, a, 'Organizace', '');
      zaznam['Stav'] = 'Ke schválení';
      zapisRadkyHodin_([zaznam]);
      historie_(a, 'Zápis', zaznam['ID záznamu'], p.dobrovolnik, popisZaznamu_(popis));
      log_('Portál organizace – zápis hodin', p.dobrovolnik, ymd_(p.datum) + ', ' + p.minut + ' min, ' + p.org.nazev);
    }
    return oMojeData(token);
  });
}

function oSmazHodiny(token, id) {
  const k = overKoordinatorOrg_(token);
  const a = { email: k.email, role: ROLE_ORG };
  return sZamkem_(() => {
    const data = radkyHodin_();
    const z = data.radky.find(x => x.id === String(id));
    if (!z || k.orgIds.indexOf(z.orgId) < 0) throw new Error('Zápis nebyl nalezen.');
    if (z.stav === 'Schváleno') throw new Error('Schválený zápis už nelze smazat. Obraťte se prosím na KONEP.');
    overUzaverku_(a, nastaveni_(), z.datum);
    overMinulyRok_(z.datum);
    overZamek_(z.dobrovolnik, z.orgId, z.datum);
    data.sh.deleteRow(z.radek);
    historie_(a, 'Smazání', z.id, z.dobrovolnik, popisZaznamu_(z));
    log_('Portál organizace – smazání hodin', z.dobrovolnik, z.datum + ', ' + z.minut + ' min');
    return oMojeData(token);
  });
}

// ===== FOTKY PAPÍROVÝCH VÝKAZŮ (organizace) ===================

function oNahrajFotkuVykazu(token, dobrovolnik, orgId, mesic, dataUrl) {
  const k = overKoordinatorOrg_(token);
  orgId = String(orgId || '').trim(); mesic = String(mesic || '').trim();
  if (k.orgIds.indexOf(orgId) < 0) throw new Error('Pro tuto organizaci nemáte oprávnění.');
  overMinulyRok_(mesic + '-01');
  return sZamkem_(() => {
    pridejFotkuVnitrni_({ email: k.email, role: ROLE_ORG }, String(dobrovolnik || '').trim(), orgId, mesic, dataUrl);
    return { fotky: oFotky_(k) };
  });
}

function oSmazFotkuVykazu(token, idFotky) {
  const k = overKoordinatorOrg_(token);
  return sZamkem_(() => {
    const f = fotkyRadky_().radky.find(x => x.id === String(idFotky) && k.orgIds.indexOf(x.orgId) >= 0);
    if (!f) throw new Error('Fotka nebyla nalezena.');
    overMinulyRok_(f.mesic + '-01');
    smazFotkuVnitrni_({ email: k.email, role: ROLE_ORG }, f);
    return { fotky: oFotky_(k) };
  });
}

function oNactiFotkuVykazu(token, idFotky) {
  const k = overKoordinatorOrg_(token);
  const f = fotkyRadky_().radky.find(x => x.id === String(idFotky) && k.orgIds.indexOf(x.orgId) >= 0);
  if (!f) throw new Error('Fotka nebyla nalezena.');
  return { dataUrl: nactiSouborFotky_(f.soubor) };
}
