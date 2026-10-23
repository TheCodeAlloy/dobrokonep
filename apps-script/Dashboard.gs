/**
 * DOBROVOLNICKÉ CENTRUM – DASHBOARD
 * --------------------------------------------------------------
 * Přístup administrátorů, načítání a úpravy záznamů, schůzky v kalendáři,
 * generování smlouvy a docházkového listu, administrace číselníků a šablon.
 *
 * Volá se z dashboard.html na GitHub Pages přes Api.gs.
 * Každá funkce volaná z dashboardu nejdřív ověří přihlášení (token) a to,
 * že uživatel je aktivní v listu „Administrátoři“ a má potřebnou roli.
 */

const PORADI_ROLI = { 'Jen čtení': 0, 'Koordinátor': 1, 'Hlavní admin': 2 };

const POLE_EDITOVATELNA = [
  'Titul', 'Jméno', 'Příjmení', 'Datum narození', 'E-mail', 'Telefon', 'Ulice a č.p.', 'Obec', 'PSČ',
  'Preferovaný kontakt', 'Oblasti zájmu', 'Oblast – jiné', 'Preferované místo', 'Dostupnost',
  'Zkušenosti a dovednosti', 'Zaměstnání / studium', 'Vzdělání', 'Jak se o nás dozvěděl/a', 'Stav', 'Místo působení',
  'Dobrovolníkem od', 'Poznámky', 'Upozornění',
  'Služba do', 'Zástupce – jméno', 'Zástupce – adresa', 'Zástupce – datum narození', 'Zástupce – e-mail', 'Zástupce – telefon',
  'Činnosti ve smlouvě'
];

// Funkce, ne konstanta: LISTY je definováno v Kod.gs, který se načítá později.
function editovatelneListy_() {
  return {
    NASTAVENI: { list: LISTY.NASTAVENI, role: 'Hlavní admin', sloupce: [1] },
    ADMINI: { list: LISTY.ADMINI, role: 'Hlavní admin', sloupce: [0, 1, 2, 3, 4] },
    SABLONY: { list: LISTY.SABLONY, role: 'Hlavní admin', sloupce: [2, 3] },
    OBLASTI: { list: LISTY.OBLASTI, role: 'Koordinátor', sloupce: [0, 1] },
    MISTA: { list: LISTY.MISTA, role: 'Koordinátor', sloupce: [0, 1] },
    ORGANIZACE: { list: LISTY.ORGANIZACE, role: 'Koordinátor', sloupce: [1, 2, 3, 4, 5, 6, 7, 8] },
    CINNOSTI: { list: LISTY.CINNOSTI, role: 'Koordinátor', sloupce: [0, 1, 2] }
  };
}

const ZASTUPNE_DOKUMENTY = [
  ['id', 'ID dobrovolníka'], ['titul', 'Titul'], ['jmeno', 'Jméno'], ['prijmeni', 'Příjmení'], ['cele_jmeno', 'Titul, jméno a příjmení'],
  ['datum_narozeni', 'Datum narození'], ['email', 'E-mail'], ['telefon', 'Telefon'],
  ['ulice', 'Ulice a č.p.'], ['obec', 'Obec'], ['psc', 'PSČ'], ['adresa', 'Celá adresa'],
  ['zamestnani', 'Zaměstnání / studium'], ['vzdelani', 'Nejvyšší dokončené vzdělání'],
  ['oblasti_zajmu', 'Oblasti zájmu'], ['organizace', 'Přijímající organizace'],
  ['organizace_adresa', 'Adresa organizace'], ['organizace_kontakt', 'Kontaktní osoba organizace'],
  ['organizace_email', 'E-mail organizace'], ['organizace_telefon', 'Telefon organizace'],
  ['misto_pusobeni', 'Místo působení'], ['dobrovolnikem_od', 'Dobrovolníkem od'],
  ['cislo_smlouvy', 'Číslo smlouvy'], ['dnesni_datum', 'Dnešní datum'], ['nazev_organizace', 'Název vašeho centra']
];

// ===== PŘÍSTUP A PŘIHLÁŠENÍ ==================================
// Administrátor se přihlašuje jednorázovým kódem z e-mailu.
// Po přihlášení dostane prohlížeč token, který se posílá s každým požadavkem.

const DELKA_RELACE_HOD_VYCHOZI = 720;

function hash_(text) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text)));
}

function adminPodleEmailu_(email) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return null;
  const v = list_(LISTY.ADMINI).getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim().toLowerCase() === email && String(v[i][3]).trim().toUpperCase() !== 'NE') {
      const role = PORADI_ROLI.hasOwnProperty(String(v[i][2]).trim()) ? String(v[i][2]).trim() : 'Jen čtení';
      return { email: email, jmeno: String(v[i][1] || ''), role: role };
    }
  }
  return null;
}

function vytvorRelaci_(email) {
  const props = PropertiesService.getScriptProperties();
  const ted = Date.now();
  // úklid prošlých relací
  const vse = props.getProperties();
  Object.keys(vse).forEach(k => {
    if (k.indexOf('SES_') === 0) {
      try { if (JSON.parse(vse[k]).exp < ted) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
    }
  });
  const hod = Number(nastaveni_().delka_prihlaseni_hod) || DELKA_RELACE_HOD_VYCHOZI;
  const token = Utilities.getUuid() + Utilities.getUuid();
  props.setProperty('SES_' + hash_(token), JSON.stringify({ email: email, exp: ted + hod * 3600000 }));
  return token;
}

function emailRelace_(token) {
  if (!token) return '';
  const props = PropertiesService.getScriptProperties();
  const k = 'SES_' + hash_(token);
  const raw = props.getProperty(k);
  if (!raw) return '';
  try {
    const r = JSON.parse(raw);
    if (r.exp < Date.now()) { props.deleteProperty(k); return ''; }
    return r.email;
  } catch (e) { return ''; }
}

function aktualniAdmin_(token) {
  return adminPodleEmailu_(emailRelace_(token));
}

function overAdmin_(token, minRole) {
  const a = aktualniAdmin_(token);
  if (!a) throw new Error('PRIHLASENI: Přihlášení vypršelo. Přihlaste se prosím znovu.');
  AKTUALNI_UZIVATEL = a.email;
  if (PORADI_ROLI[a.role] < PORADI_ROLI[minRole]) {
    throw new Error('Na tuto akci nemáte oprávnění (potřebná role: ' + minRole + ').');
  }
  return a;
}

// Krok 1: odeslání kódu. Vždy vrací stejnou odpověď, aby nešlo zjistit, kdo je administrátor.
function posliPrihlasovaciKod(email, idDetailu) {
  email = String(email || '').trim().toLowerCase();
  const odpoved = { ok: true };
  if (!platnyEmail_(email)) throw new Error('Zadejte platný e-mail.');
  const admin = adminPodleEmailu_(email);
  if (!admin) { log_('Přihlášení – neznámý e-mail', '', email); return odpoved; }

  const cache = CacheService.getScriptCache();
  if (cache.get('KODT_' + email)) throw new Error('Kód jsme poslali před chvílí. Další můžete vyžádat za minutu.');
  const kod = String(parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 12), 16) % 1000000).padStart(6, '0');
  cache.put('KOD_' + email, JSON.stringify({ h: hash_(kod + email), pokusy: 0 }), 600);
  cache.put('KODT_' + email, '1', 60);

  // Jednorázový přihlašovací odkaz (pro mobil – stačí na něj klepnout)
  const n = nastaveni_();
  const web = webAdresa_(n);
  let odkaz = '';
  if (web) {
    const t = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    cache.put('ODKAZ_' + hash_(t), email, 600);
    const id = String(idDetailu || '').trim();
    odkaz = web + 'dashboard.html?prihlaseni=' + t + (/^[\w-]{1,40}$/.test(id) ? '&id=' + encodeURIComponent(id) : '');
  }

  const nazev = String(n.nazev_organizace || 'Dobrovolnické centrum');
  const s = sablona_('prihlasovaci_kod') || {
    predmet: 'Přihlašovací kód: {kod}',
    text: 'Váš kód pro přihlášení do dashboardu: {kod}\n\nKód platí 10 minut.\n\n{nazev_organizace}'
  };
  let text = s.text;
  if (odkaz && text.indexOf('{odkaz}') < 0) {
    text = text.replace(/(\{kod\}[^\n]*)/, '$1\n\nNebo se přihlaste jedním klepnutím:\n{odkaz}');
    if (text.indexOf('{odkaz}') < 0) text += '\n\nNebo se přihlaste jedním klepnutím:\n{odkaz}';
  }
  const prom = { kod: kod, nazev_organizace: nazev, odkaz: '\u0000ODKAZ\u0000' };
  const cisty = dosad_(text, prom);
  const tlacitko = '<a href="' + esc_(odkaz) + '" style="display:inline-block;background:#c4524e;color:#ffffff;' +
    'text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">Přihlásit se do dashboardu</a>';
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#222">' +
    esc_(cisty).replace(/\n/g, '<br>').replace('\u0000ODKAZ\u0000', odkaz ? tlacitko : '') + '</div>';
  const zprava = {
    to: email, subject: dosad_(s.predmet, prom), name: nazev,
    body: cisty.replace('\u0000ODKAZ\u0000', odkaz), htmlBody: html
  };
  MailApp.sendEmail(zprava);
  log_('Přihlášení – odeslán kód', '', email);
  return odpoved;
}

// Přihlášení klepnutím na odkaz z e-mailu (odkaz platí 10 minut a jen jednou)
function overPrihlasovaciOdkaz(t) {
  t = String(t || '').trim();
  if (!/^[a-f0-9]{64}$/.test(t)) throw new Error('Přihlašovací odkaz je neplatný. Požádejte o nový kód.');
  const cache = CacheService.getScriptCache();
  const klic = 'ODKAZ_' + hash_(t);
  const email = cache.get(klic);
  if (!email) throw new Error('Přihlašovací odkaz vypršel nebo už byl použit. Požádejte o nový kód.');
  cache.remove(klic);
  cache.remove('KOD_' + email);
  const admin = adminPodleEmailu_(email);
  if (!admin) throw new Error('Tento účet nemá přístup.');
  AKTUALNI_UZIVATEL = email;
  log_('Přihlášení (odkaz)', '', email);
  return { token: vytvorRelaci_(email), admin: admin };
}

// Krok 2: ověření kódu a vytvoření přihlášení
function overPrihlasovaciKod(email, kod) {
  email = String(email || '').trim().toLowerCase();
  kod = String(kod || '').replace(/\s/g, '');
  const cache = CacheService.getScriptCache();
  const raw = cache.get('KOD_' + email);
  if (!raw) throw new Error('Kód vypršel nebo je neplatný. Požádejte o nový.');
  const z = JSON.parse(raw);
  if (z.h !== hash_(kod + email)) {
    z.pokusy++;
    if (z.pokusy >= 5) { cache.remove('KOD_' + email); throw new Error('Příliš mnoho pokusů. Požádejte o nový kód.'); }
    cache.put('KOD_' + email, JSON.stringify(z), 600);
    throw new Error('Nesprávný kód. Zbývá pokusů: ' + (5 - z.pokusy) + '.');
  }
  cache.remove('KOD_' + email);
  const admin = adminPodleEmailu_(email);
  if (!admin) throw new Error('Tento účet nemá přístup.');
  AKTUALNI_UZIVATEL = email;
  log_('Přihlášení', '', email);
  return { token: vytvorRelaci_(email), admin: admin };
}

// ===== OSOBNÍ ODKAZ V NOTIFIKACI ==============================
// Odkaz platí několik dní (platnost_odkazu_dni) a lze ho během platnosti použít
// opakovaně (mobil i počítač). Uložen je jen jeho otisk (hash), ne samotný odkaz.

function vytvorVstupniOdkaz_(email, dni) {
  const props = PropertiesService.getScriptProperties();
  const ted = Date.now();
  const vse = props.getProperties();
  Object.keys(vse).forEach(k => {
    if (k.indexOf('VSTUP_') === 0) {
      try { if (JSON.parse(vse[k]).exp < ted) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
    }
  });
  const t = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  props.setProperty('VSTUP_' + hash_(t), JSON.stringify({ email: email, exp: ted + (Number(dni) || 3) * 86400000 }));
  return t;
}

function prihlasitOdkazem(t) {
  t = String(t || '').trim();
  if (!/^[a-f0-9]{64}$/.test(t)) throw new Error('Odkaz je neplatný. Přihlaste se prosím jinak.');
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('VSTUP_' + hash_(t));
  if (!raw) throw new Error('Platnost odkazu z notifikace vypršela. Přihlaste se prosím jinak.');
  const z = JSON.parse(raw);
  if (z.exp < Date.now()) {
    props.deleteProperty('VSTUP_' + hash_(t));
    throw new Error('Platnost odkazu z notifikace vypršela. Přihlaste se prosím jinak.');
  }
  const admin = adminPodleEmailu_(z.email);
  if (!admin) throw new Error('Tento účet už nemá přístup.');
  AKTUALNI_UZIVATEL = z.email;
  log_('Přihlášení (odkaz z notifikace)', '', z.email);
  return { token: vytvorRelaci_(z.email), admin: admin };
}

// ===== PŘIHLÁŠENÍ ÚČTEM GOOGLE ================================
// Web pošle podepsaný „ID token“ od Google; ověříme ho u Google a zkontrolujeme,
// že patří našemu webu (Client ID) a že e-mail je v listu Administrátoři.

// Ověří ID token od Google a vrátí ověřený e-mail (používá dashboard i portál dobrovolníka)
function overGoogleEmail_(credential) {
  const n = nastaveni_();
  const clientId = String(n.google_client_id || '').trim();
  if (!clientId) throw new Error('Přihlášení přes Google není nastavené.');
  const cred = String(credential || '');
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(cred)) throw new Error('Neplatná odpověď od Google.');
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(cred), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('Google přihlášení neověřil. Zkuste to prosím znovu.');
  const info = JSON.parse(r.getContentText());
  const vydavatelOk = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
  if (info.aud !== clientId || !vydavatelOk || String(info.email_verified) !== 'true' || Number(info.exp) * 1000 < Date.now()) {
    throw new Error('Google přihlášení se nepodařilo ověřit.');
  }
  return String(info.email || '').toLowerCase();
}

function prihlasitGoogle(credential) {
  const email = overGoogleEmail_(credential);
  const admin = adminPodleEmailu_(email);
  if (!admin) {
    log_('Přihlášení Google – bez oprávnění', '', email);
    throw new Error('Účet ' + email + ' nemá přístup do dashboardu.');
  }
  AKTUALNI_UZIVATEL = email;
  log_('Přihlášení (Google)', '', email);
  return { token: vytvorRelaci_(email), admin: admin };
}

function odhlasit(token) {
  if (token) PropertiesService.getScriptProperties().deleteProperty('SES_' + hash_(token));
  return { ok: true };
}

// ===== NAČÍTÁNÍ DAT ===========================================

function nactiData(token) {
  const a = overAdmin_(token, 'Jen čtení');
  const sh = list_(LISTY.DOBROVOLNICI);
  const hlav = hlavicky_(sh);
  const si = hlav.indexOf('ID');
  const radky = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, hlav.length).getValues() : [];
  const n = nastaveni_();
  return {
    admin: a,
    dobrovolnici: radky.filter(r => String(r[si]).trim()).map(r => serializuj_(hlav, r)),
    stavy: STAVY,
    barvy: BARVY_STAVU,
    oblasti: seznam_(LISTY.OBLASTI),
    mista: seznam_(LISTY.MISTA),
    organizace: organizace_().filter(o => o.aktivni).map(o => o.nazev),
    organizaceVse: organizace_().map(o => ({ id: o.id, nazev: o.nazev, aktivni: o.aktivni })),
    prirazeni: prirazeni_(),
    cinnosti: cinnosti_(),
    hodiny: prehledHodin_(),
    uzavrenoDo: uzavrenoDo_(n),
    kontakty: KONTAKTY,
    zdroje: ZDROJE,
    vzdelani: VZDELANI,
    nastaveni: {
      misto_schuzky_vychozi: String(n.misto_schuzky_vychozi || ''),
      kontaktniOsoby: kontaktniOsoby_(n),
      cinnostiSmlouvy: String(n.cinnosti_smlouvy || ''),
      sablonaSmlouvy: !!extrahujId_(n.sablona_smlouvy_18) && !!extrahujId_(n.sablona_smlouvy_15_17),
      sablonaDochazky: !!extrahujId_(n.sablona_dochazky),
      sablonaPripravy: !!extrahujId_(n.sablona_pripravy),
      mistaSkoleni: mistaSkoleni_(n),
      skolitele: skolitele_(n),
      odkazTabulky: ss_().getUrl()
    },
    ted: Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm")
  };
}

function serializuj_(hlav, r) {
  const o = {};
  hlav.forEach((h, i) => {
    const v = r[i];
    if (v instanceof Date) {
      o[h] = POLE_DATUM.indexOf(h) >= 0
        ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd')
        : Utilities.formatDate(v, TZ, "yyyy-MM-dd'T'HH:mm");
    } else {
      o[h] = v == null ? '' : String(v);
    }
  });
  return o;
}

function organizace_() {
  if (MEMO.organizace) return MEMO.organizace;
  const sh = list_(LISTY.ORGANIZACE);
  if (sh.getLastRow() < 2) return [];
  return MEMO.organizace = sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues()
    .filter(r => String(r[1]).trim())
    .map(r => ({
      id: String(r[0]), nazev: String(r[1]).trim(), kontakt: String(r[2]), email: String(r[3]),
      telefon: String(r[4]), adresa: String(r[5]), oblast: String(r[6]),
      aktivni: String(r[7]).trim().toUpperCase() !== 'NE'
    }));
}

function najdiRadek_(sh, hlav, id) {
  const si = hlav.indexOf('ID') + 1;
  if (sh.getLastRow() > 1) {
    const ids = sh.getRange(2, si, sh.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) if (String(ids[i][0]).trim() === String(id)) return i + 2;
  }
  throw new Error('Záznam ' + id + ' nebyl nalezen. Obnovte prosím data.');
}

function zaznamObjekt_(sh, hlav, radek) {
  return serializuj_(hlav, sh.getRange(radek, 1, 1, hlav.length).getValues()[0]);
}

function sZamkem_(fn) {
  const z = LockService.getScriptLock();
  z.waitLock(20000);
  try { return fn(); } finally { z.releaseLock(); }
}

function textem_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'd. M. yyyy H:mm');
  const s = String(v == null ? '' : v);
  return s.length > 80 ? s.slice(0, 80) + '…' : s;
}

// ===== ÚPRAVY ZÁZNAMU (PRŮBĚŽNÉ UKLÁDÁNÍ) ======================

function ulozPole(token, id, pole, hodnota) {
  const a = overAdmin_(token, 'Koordinátor');
  if (POLE_EDITOVATELNA.indexOf(pole) < 0) throw new Error('Pole „' + pole + '“ nelze upravovat.');

  let v;
  if (POLE_DATUM.indexOf(pole) >= 0) {
    const s = String(hodnota || '').trim();
    v = s ? parsujDatum_(s) : '';
    if (s && !v) throw new Error('Neplatné datum.');
  } else {
    v = String(hodnota == null ? '' : hodnota).trim().slice(0, 5000);
  }
  if (pole === 'Stav' && STAVY.indexOf(v) < 0) throw new Error('Neznámý stav.');
  if (pole === 'E-mail') { v = v.toLowerCase(); if (!platnyEmail_(v)) throw new Error('Neplatný e-mail.'); }
  if ((pole === 'Jméno' || pole === 'Příjmení') && !v) throw new Error('Jméno a příjmení nesmí být prázdné.');

  return sZamkem_(() => {
    const sh = list_(LISTY.DOBROVOLNICI);
    const hlav = hlavicky_(sh);
    const radek = najdiRadek_(sh, hlav, id);
    const stara = sh.getRange(radek, hlav.indexOf(pole) + 1).getValue();
    const zmeny = {};
    zmeny[pole] = v;
    if (pole === 'Stav' && v === 'Aktivní dobrovolník') {
      const od = sh.getRange(radek, hlav.indexOf('Dobrovolníkem od') + 1).getValue();
      if (!od) zmeny['Dobrovolníkem od'] = parsujDatum_(Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'));
    }
    zmeny['Naposledy upraveno'] = new Date();
    zmeny['Upravil/a'] = a.email;
    zapisDoRadku_(sh, radek, hlav, zmeny);
    log_('Úprava: ' + pole, id, textem_(stara) + ' → ' + textem_(v));
    return zaznamObjekt_(sh, hlav, radek);
  });
}

// ===== SCHŮZKY A KALENDÁŘ =====================================

function naplanujSchuzku(token, id, termin, misto, poslatEmail) {
  const a = overAdmin_(token, 'Koordinátor');
  const n = nastaveni_();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(termin || ''))) throw new Error('Zadejte datum a čas schůzky.');
  const start = Utilities.parseDate(termin, TZ, "yyyy-MM-dd'T'HH:mm");
  const konec = new Date(start.getTime() + (Number(n.delka_schuzky_min) || 60) * 60000);
  misto = String(misto || '').trim().slice(0, 300);

  return sZamkem_(() => {
    const sh = list_(LISTY.DOBROVOLNICI);
    const hlav = hlavicky_(sh);
    const radek = najdiRadek_(sh, hlav, id);
    const z = zaznamObjekt_(sh, hlav, radek);
    const cal = kalendar_(n);
    const bylTermin = !!z['Termín schůzky'];

    const nazevUd = 'Schůzka se zájemcem o dobrovolnictví: ' + z['Jméno'] + ' ' + z['Příjmení'] + ' (' + id + ')';
    const popis = 'Úvodní schůzka se zájemcem o dobrovolnictví.\n\nDetail v dashboardu: ' + odkazNaDetail_(n, id, sh, radek);

    let udalost = null;
    if (z['ID události kalendáře']) {
      try { udalost = cal.getEventById(z['ID události kalendáře']); } catch (e) { udalost = null; }
    }
    if (udalost) {
      udalost.setTime(start, konec);
      udalost.setTitle(nazevUd);
      udalost.setLocation(misto);
    } else {
      const moznosti = { description: popis, location: misto };
      if (cal.getId().toLowerCase() !== a.email) { moznosti.guests = a.email; moznosti.sendInvites = true; }
      udalost = cal.createEvent(nazevUd, start, konec, moznosti);
    }

    const zmeny = {
      'Termín schůzky': start,
      'Místo schůzky': misto,
      'ID události kalendáře': udalost.getId(),
      'Naposledy upraveno': new Date(),
      'Upravil/a': a.email
    };
    if (['Nový zájemce', 'Kontaktován', 'Schůzka domluvena'].indexOf(z['Stav']) >= 0 || !z['Stav']) {
      zmeny['Stav'] = 'Schůzka domluvena';
    }
    zapisDoRadku_(sh, radek, hlav, zmeny);

    let emailOdeslan = false, chybaEmailu = '';
    if (poslatEmail) {
      try {
        posliSablonu_(bylTermin ? 'zmena_schuzky' : 'potvrzeni_schuzky', z['E-mail'], {
          id: id, jmeno: z['Jméno'], prijmeni: z['Příjmení'], termin: terminCesky_(start),
          misto_schuzky: misto || 'upřesníme', nazev_organizace: String(n.nazev_organizace || '')
        }, n);
        emailOdeslan = true;
      } catch (e) { chybaEmailu = e.message; }
    }
    log_(bylTermin ? 'Změna schůzky' : 'Naplánována schůzka', id,
      terminCesky_(start) + (emailOdeslan ? '; e-mail odeslán' : '') + (chybaEmailu ? '; chyba e-mailu: ' + chybaEmailu : ''));
    return { zaznam: zaznamObjekt_(sh, hlav, radek), emailOdeslan: emailOdeslan, chybaEmailu: chybaEmailu };
  });
}

function zrusSchuzku(token, id, poslatEmail) {
  const a = overAdmin_(token, 'Koordinátor');
  const n = nastaveni_();
  return sZamkem_(() => {
    const sh = list_(LISTY.DOBROVOLNICI);
    const hlav = hlavicky_(sh);
    const radek = najdiRadek_(sh, hlav, id);
    const z = zaznamObjekt_(sh, hlav, radek);
    const puvodni = z['Termín schůzky'] ? Utilities.parseDate(z['Termín schůzky'], TZ, "yyyy-MM-dd'T'HH:mm") : null;

    if (z['ID události kalendáře']) {
      try {
        const u = kalendar_(n).getEventById(z['ID události kalendáře']);
        if (u) u.deleteEvent();
      } catch (e) { console.warn(e); }
    }
    const zmeny = {
      'Termín schůzky': '', 'Místo schůzky': '', 'ID události kalendáře': '',
      'Naposledy upraveno': new Date(), 'Upravil/a': a.email
    };
    if (z['Stav'] === 'Schůzka domluvena') zmeny['Stav'] = 'Kontaktován';
    zapisDoRadku_(sh, radek, hlav, zmeny);

    let emailOdeslan = false, chybaEmailu = '';
    if (poslatEmail && puvodni) {
      try {
        posliSablonu_('zruseni_schuzky', z['E-mail'], {
          id: id, jmeno: z['Jméno'], prijmeni: z['Příjmení'], termin: terminCesky_(puvodni),
          misto_schuzky: z['Místo schůzky'], nazev_organizace: String(n.nazev_organizace || '')
        }, n);
        emailOdeslan = true;
      } catch (e) { chybaEmailu = e.message; }
    }
    log_('Zrušena schůzka', id, (puvodni ? terminCesky_(puvodni) : '') + (emailOdeslan ? '; e-mail odeslán' : ''));
    return { zaznam: zaznamObjekt_(sh, hlav, radek), emailOdeslan: emailOdeslan, chybaEmailu: chybaEmailu };
  });
}

function kalendar_(n) {
  const id = String(n.kalendar_id || '').trim();
  const cal = id ? CalendarApp.getCalendarById(id) : CalendarApp.getDefaultCalendar();
  if (!cal) throw new Error('Kalendář „' + id + '“ nebyl nalezen. Zkontrolujte kalendar_id v Nastavení.');
  return cal;
}

function terminCesky_(d) {
  const dny = ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota', 'neděle'];
  let u = Number(Utilities.formatDate(d, TZ, 'u'));
  if (!(u >= 1 && u <= 7)) u = ((d.getDay() + 6) % 7) + 1;
  return dny[u - 1] + ' ' + Utilities.formatDate(d, TZ, 'd. M. yyyy') + ' v ' + Utilities.formatDate(d, TZ, 'H:mm');
}

// ===== VÝMAZ ZÁZNAMU (GDPR / TESTOVACÍ DATA) ==================
// Smaže řádek dobrovolníka a jeho událost v kalendáři. Zápisy hodin ponechá,
// ale anonymizuje je (zůstane jen ID, jméno a e-mail se z nich odstraní),
// volitelně přesune jeho dokumenty na Disku do koše (lze obnovit 30 dní)
// a z Log změn odstraní osobní údaje, které se ho týkají.

function jmeno_(z) { return String(z['Jméno'] || '') + ' ' + String(z['Příjmení'] || ''); }

function smazZaznam(token, id, smazatSoubory) {
  const a = overAdmin_(token, 'Hlavní admin');
  const n = nastaveni_();
  return sZamkem_(() => {
    const sh = list_(LISTY.DOBROVOLNICI);
    const hlav = hlavicky_(sh);
    const radek = najdiRadek_(sh, hlav, id);
    const z = zaznamObjekt_(sh, hlav, radek);
    const souhrn = [];

    // Kalendář
    if (z['ID události kalendáře']) {
      try {
        const u = kalendar_(n).getEventById(z['ID události kalendáře']);
        if (u) { u.deleteEvent(); souhrn.push('událost v kalendáři'); }
      } catch (e) { console.warn(e); }
    }

    // Soubory na Disku → koš
    if (smazatSoubory) {
      let pocet = 0;
      const doKose = soubor => { try { soubor.setTrashed(true); pocet++; } catch (e) { console.warn(e); } };
      const idSouboru = url => extrahujId_(url);
      [z['Registrace (PDF)'], z['Smlouva (PDF)'], z['Docházkový list']].forEach(url => {
        const fid = idSouboru(url);
        if (fid) { try { doKose(DriveApp.getFileById(fid)); } catch (e) { console.warn(e); } }
      });
      // případné starší verze v centrálních složkách (podle ID a čísla smlouvy na začátku názvu)
      const vyhledej = (klicSlozky, predpona) => {
        if (!predpona) return;
        try {
          const slozka = slozkaZNastaveni_(n[klicSlozky], klicSlozky);
          const it = slozka.searchFiles("title contains '" + predpona.replace(/'/g, "\\'") + "' and trashed = false");
          while (it.hasNext()) {
            const f = it.next();
            if (f.getName().indexOf(predpona + '_') === 0) doKose(f);
          }
        } catch (e) { console.warn(e); }
      };
      vyhledej('slozka_registrace', id);
      vyhledej('slozka_smlouvy', z['Číslo smlouvy']);
      const fid = idSouboru(z['Složka']);
      if (fid) { try { DriveApp.getFolderById(fid).setTrashed(true); pocet++; } catch (e) { console.warn(e); } }
      souhrn.push('souborů/složek do koše: ' + pocet);
    }

    // Zápisy hodin – ponechat, ale anonymizovat (zůstane jen ID dobrovolníka)
    const shH = ss_().getSheetByName(LISTY.HODINY);
    if (shH && shH.getLastRow() > 1) {
      const rozsah = shH.getRange(2, 1, shH.getLastRow() - 1, shH.getLastColumn());
      const v = rozsah.getValues();
      const osobni = [z['E-mail'], jmeno_(z), z['Příjmení'] + ' ' + z['Jméno'], z['Telefon']]
        .map(x => String(x || '').trim()).filter(x => x.length > 3);
      let pocet = 0;
      v.forEach(r => {
        if (String(r[1]).trim() !== id) return;
        pocet++;
        for (let c = 0; c < r.length; c++) {
          if (c === 1 || typeof r[c] !== 'string') continue;
          let t = r[c];
          osobni.forEach(o => { t = t.split(o).join('(anonymizováno)'); });
          r[c] = t;
        }
      });
      if (pocet) { rozsah.setValues(v); souhrn.push('anonymizováno zápisů hodin: ' + pocet); }
    }

    // Přiřazení k organizacím
    const shP = ss_().getSheetByName(LISTY.PRIRAZENI);
    if (shP) prirazeni_().filter(p => p.dobrovolnik === id).sort((x, y) => y.radek - x.radek).forEach(p => shP.deleteRow(p.radek));

    // Osobní údaje v Log změn
    const shL = ss_().getSheetByName(LISTY.LOG);
    if (shL && shL.getLastRow() > 1) {
      const rozsah = shL.getRange(2, 4, shL.getLastRow() - 1, 2);
      const v = rozsah.getValues();
      let zmena = false;
      v.forEach(r => { if (String(r[0]).trim() === id && r[1] !== '(smazáno)') { r[1] = '(smazáno)'; zmena = true; } });
      if (zmena) rozsah.setValues(v);
    }

    // Řádek
    sh.deleteRow(radek);
    log_('Smazán záznam', id, souhrn.join('; ') || 'jen řádek v tabulce');
    return { ok: true, souhrn: souhrn };
  });
}

// ===== DOKUMENTY (SMLOUVA, DOCHÁZKOVÝ LIST) ===================

function generujDokument(token, id, typ, misto, skolitel, skolitelPraxe, udaje, kontakt, organizace) {
  const a = overAdmin_(token, 'Koordinátor');
  if (['smlouva', 'dochazka', 'priprava'].indexOf(typ) < 0) throw new Error('Neznámý typ dokumentu.');
  const n = nastaveni_();
  if (typ === 'priprava' && mistaSkoleni_(n).indexOf(misto) < 0) throw new Error('Vyberte místo školení ze seznamu.');
  if (typ === 'priprava' && skolitele_(n).indexOf(skolitel) < 0) throw new Error('Vyberte školitele ze seznamu.');
  if (typ === 'priprava' && skolitele_(n).indexOf(skolitelPraxe) < 0) throw new Error('Vyberte školitele pro praktickou část.');

  return sZamkem_(() => {
    const sh = list_(LISTY.DOBROVOLNICI);
    const hlav = hlavicky_(sh);
    const radek = najdiRadek_(sh, hlav, id);
    // Údaje, které doplnil koordinátor v okně před generováním, se uloží do karty
    if (typ === 'smlouva' && udaje) ulozUdajeDobrovolnika_(sh, hlav, radek, udaje);
    const z = zaznamObjekt_(sh, hlav, radek);

    // Smlouva: verze podle věku dobrovolníka k dnešnímu dni (pod 18 let = verze pro 15–17 let)
    const vek = vekKDatu_(z['Datum narození'], new Date());
    if (typ === 'smlouva') {
      const chybi = chybejiciUdajeSmlouvy_(z, vek);
      if (chybi.length) throw new Error('Doplňte prosím: ' + chybi.join(', ') + '.');
      if (kontaktniOsoby_(n).indexOf(kontakt) < 0) throw new Error('Vyberte kontaktní osobu.');
      if (String(z['Organizace'] || '').split(',').map(s => s.trim()).indexOf(String(organizace || '').trim()) < 0) {
        throw new Error('Vyberte přijímající organizaci, ke které je dobrovolník přiřazený.');
      }
    }
    const klic = typ === 'smlouva'
      ? (vek < 18 ? 'sablona_smlouvy_15_17' : 'sablona_smlouvy_18')
      : { dochazka: 'sablona_dochazky', priprava: 'sablona_pripravy' }[typ];
    const nazevSablony = {
      sablona_smlouvy_15_17: 'smlouvy pro 15–17 let', sablona_smlouvy_18: 'smlouvy pro dobrovolníky od 18 let',
      sablona_dochazky: 'docházkového listu', sablona_pripravy: 'záznamu o přípravě'
    }[klic];
    const sablonaId = extrahujId_(n[klic]);
    if (!sablonaId) throw new Error('Chybí šablona ' + nazevSablony + '. Nastavte ji v Administraci → Šablony dokumentů.');

    let osobni = null;
    const idSlozky = extrahujId_(z['Složka']);
    if (idSlozky) { try { osobni = DriveApp.getFolderById(idSlozky); } catch (e) { osobni = null; } }
    if (!osobni) osobni = vytvorOsobniSlozku_(n, id, z['Jméno'], z['Příjmení']);

    let cislo = z['Číslo smlouvy'];
    if (typ === 'smlouva' && !cislo) cislo = dalsiCislo_(String(n.prefix_smlouvy || 'SM'), sh, hlav, 'Číslo smlouvy');

    const dnes = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    const nazev = typ === 'smlouva'
      ? cislo + '_' + z['Příjmení'] + '_' + z['Jméno'] + '_smlouva'
      : typ === 'priprava'
        ? id + '_' + z['Příjmení'] + '_' + z['Jméno'] + '_priprava_' + dnes
        : id + '_' + z['Příjmení'] + '_' + z['Jméno'] + '_dochazkovy_list_' + dnes;

    // Smlouva a záznam o přípravě se ukládají jako Dokumenty Google do jedné společné složky (u dobrovolníka jen zástupce).
    // Docházkový list: kopie šablony zůstane v osobní složce pro případné úpravy.
    const spolecnaSlozka = typ === 'priprava' ? slozkaZNastaveni_(n.slozka_pripravy, 'slozka_pripravy')
      : typ === 'smlouva' ? slozkaZNastaveni_(n.slozka_smlouvy, 'slozka_smlouvy') : null;
    const kopie = DriveApp.getFileById(sablonaId).makeCopy(nazev, spolecnaSlozka || osobni);
    const doc = DocumentApp.openById(kopie.getId());
    const hodnoty = promenneDokumentu_(n, z, cislo || '', misto || '', skolitel || '', skolitelPraxe || '', kontakt || '', organizace || '');
    if (typ === 'smlouva') hodnoty.datum_smlouvy = hodnoty.dnesni_datum; // datum smlouvy = den vytvoření
    [doc.getBody(), doc.getHeader(), doc.getFooter()].forEach(sekce => {
      if (!sekce) return;
      Object.keys(hodnoty).forEach(k => sekce.replaceText('\\{\\{\\s*' + k + '\\s*\\}\\}', hodnoty[k]));
    });
    if (typ === 'smlouva') vlozCinnosti_(doc.getBody(), z['Činnosti ve smlouvě'] || n.cinnosti_smlouvy || '');
    doc.saveAndClose();

    // Všechny dokumenty zůstávají Dokumenty Google (editovatelné před tiskem a pro pozdější elektronický podpis).
    // U dobrovolníka je v osobní složce vždy aspoň zástupce.
    try { osobni.createShortcut(kopie.getId()); } catch (e) { console.warn(e); }
    const zmeny = { 'Složka': osobni.getUrl(), 'Naposledy upraveno': new Date(), 'Upravil/a': a.email };
    if (typ === 'priprava') {
      zmeny['Záznam o přípravě'] = kopie.getUrl();
      log_('Vytvořen záznam o přípravě', id, nazev);
    } else if (typ === 'smlouva') {
      zmeny['Číslo smlouvy'] = cislo;
      zmeny['Smlouva (PDF)'] = kopie.getUrl(); // sloupec má historický název; ukládá se odkaz na Dokument Google
      zmeny['Datum smlouvy'] = parsujDatum_(dnes);
      log_('Vygenerována smlouva', id, nazev);
    } else {
      zmeny['Docházkový list'] = kopie.getUrl();
      log_('Vygenerován docházkový list', id, nazev);
    }
    zapisDoRadku_(sh, radek, hlav, zmeny);
    return { docUrl: kopie.getUrl(), zaznam: zaznamObjekt_(sh, hlav, radek) };
  });
}

// Údaje, které se doplňují v okně před generováním smlouvy: název sloupce → typ hodnoty
const UDAJE_SMLOUVY = {
  'Služba do': 'datum', 'Datum narození': 'datum', 'Ulice a č.p.': 'text', 'PSČ': 'text', 'Obec': 'text',
  'E-mail': 'text', 'Telefon': 'text',
  'Zástupce – jméno': 'text', 'Zástupce – adresa': 'text', 'Zástupce – datum narození': 'datum',
  'Zástupce – e-mail': 'text', 'Zástupce – telefon': 'text',
  'Činnosti ve smlouvě': 'text'
};

function ulozUdajeDobrovolnika_(sh, hlav, radek, udaje) {
  const zmeny = {};
  Object.keys(udaje).forEach(k => {
    if (!UDAJE_SMLOUVY[k]) return;
    const v = String(udaje[k] == null ? '' : udaje[k]).trim().slice(0, 300);
    zmeny[k] = UDAJE_SMLOUVY[k] === 'datum' ? (parsujDatum_(v) || '') : v;
  });
  zapisDoRadku_(sh, radek, hlav, zmeny);
}

// Co chybí pro smlouvu: konec služby, základní údaje a u dobrovolníka do 18 let zástupce
function chybejiciUdajeSmlouvy_(z, vek) {
  const chybi = [];
  if (!z['Služba do']) chybi.push('konec služby');
  if (!z['Organizace']) chybi.push('přiřazení k přijímající organizaci');
  if (!z['Datum narození']) chybi.push('datum narození');
  if (!z['Ulice a č.p.'] || !z['Obec'] || !z['PSČ']) chybi.push('trvalé bydliště');
  if (!z['E-mail']) chybi.push('e-mail');
  if (!z['Telefon']) chybi.push('telefon');
  if (vek !== null && vek < 18) {
    if (!z['Zástupce – jméno']) chybi.push('jméno zástupce');
    if (!z['Zástupce – adresa']) chybi.push('adresa zástupce');
    if (!z['Zástupce – datum narození']) chybi.push('datum narození zástupce');
    if (!z['Zástupce – e-mail']) chybi.push('e-mail zástupce');
    if (!z['Zástupce – telefon']) chybi.push('telefon zástupce');
  }
  return chybi;
}

// Smazání dokumentu z karty: dokument i jeho zástupce se přesunou do koše na Disku (lze obnovit 30 dní)
// a v tabulce se vymaže odkaz (u smlouvy i číslo a datum).
function smazDokument(token, id, typ) {
  const a = overAdmin_(token, 'Koordinátor');
  const sloupec = { smlouva: 'Smlouva (PDF)', dochazka: 'Docházkový list', priprava: 'Záznam o přípravě' }[typ];
  if (!sloupec) throw new Error('Neznámý typ dokumentu.');
  return sZamkem_(() => {
    const sh = list_(LISTY.DOBROVOLNICI);
    const hlav = hlavicky_(sh);
    const radek = najdiRadek_(sh, hlav, id);
    const z = zaznamObjekt_(sh, hlav, radek);
    const fid = extrahujId_(z[sloupec]);
    if (!fid) throw new Error('Tento dokument už v kartě není.');
    try { DriveApp.getFileById(fid).setTrashed(true); } catch (e) { console.warn(e); }
    const idSlozky = extrahujId_(z['Složka']);
    if (idSlozky) {
      try {
        const it = DriveApp.getFolderById(idSlozky).getFiles();
        while (it.hasNext()) {
          const f = it.next();
          if (f.getMimeType() === MimeType.SHORTCUT && f.getTargetId() === fid) f.setTrashed(true);
        }
      } catch (e) { console.warn(e); }
    }
    const zmeny = { 'Naposledy upraveno': new Date(), 'Upravil/a': a.email };
    zmeny[sloupec] = '';
    if (typ === 'smlouva') { zmeny['Číslo smlouvy'] = ''; zmeny['Datum smlouvy'] = ''; }
    zapisDoRadku_(sh, radek, hlav, zmeny);
    log_('Smazán dokument (' + sloupec + ')', id, '');
    return { zaznam: zaznamObjekt_(sh, hlav, radek) };
  });
}

// Místa školení z Nastavení (oddělená čárkou), např. „Pardubice, Chrudim“
function mistaSkoleni_(n) {
  return String(n.mista_skoleni || '').split(',').map(s => s.trim()).filter(Boolean);
}

// Věk v letech k danému datu (null, pokud chybí datum narození)
function vekKDatu_(narozeni, kDatu) {
  if (!narozeni) return null;
  const d = new Date(narozeni);
  let vek = kDatu.getFullYear() - d.getFullYear();
  if (kDatu.getMonth() < d.getMonth() || (kDatu.getMonth() === d.getMonth() && kDatu.getDate() < d.getDate())) vek--;
  return vek;
}

// Kontaktní osoby pro smlouvu z Nastavení (oddělené středníkem)
function kontaktniOsoby_(n) {
  return String(n.kontaktni_osoby || '').split(';').map(s => s.trim()).filter(Boolean);
}

// Činnosti v článku III: první řádek nahradí zástupný znak, další se vloží jako nové odrážky
// (stejný typ odrážky a odsazení jako v šabloně)
function vlozCinnosti_(body, text) {
  const hit = body.findText('\\{\\{\\s*cinnosti\\s*\\}\\}');
  if (!hit) return;
  const radky = String(text || '').split('\n').map(s => s.trim()).filter(Boolean);
  const prvek = hit.getElement().getParent();
  const jeSeznam = prvek.getType() === DocumentApp.ElementType.LIST_ITEM;
  const odrazka = jeSeznam ? prvek.asListItem().getGlyphType() : null;
  const uroven = jeSeznam ? prvek.asListItem().getNestingLevel() : 0;
  (jeSeznam ? prvek.asListItem() : prvek.asParagraph()).setText(radky[0] || '');
  let index = body.getChildIndex(prvek) + 1;
  radky.slice(1).forEach(r => {
    if (jeSeznam) body.insertListItem(index++, r).setGlyphType(odrazka).setNestingLevel(uroven);
    else body.insertParagraph(index++, r);
  });
}

// Školitelé z Nastavení (oddělení středníkem, protože jména obsahují čárky)
function skolitele_(n) {
  return String(n.skolitele_skoleni || '').split(';').map(s => s.trim()).filter(Boolean);
}

function promenneDokumentu_(n, z, cislo, misto, skolitel, skolitelPraxe, kontakt, organizace) {
  const d = s => {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? (+m[3]) + '. ' + (+m[2]) + '. ' + m[1] : String(s || '');
  };
  const prvniOrg = String(z['Organizace'] || '').split(',')[0].trim();
  const vybranaOrg = String(organizace || '').trim() || prvniOrg; // ve smlouvě ta, kterou vybere koordinátor
  const org = organizace_().find(o => o.nazev === vybranaOrg) || {};
  const tecky = '……………………';
  const nebo = v => String(v || '').trim() || tecky;
  return {
    id: z['ID'],
    titul: z['Titul'] || '',
    jmeno: z['Jméno'],
    prijmeni: z['Příjmení'],
    cele_jmeno: [z['Titul'], z['Jméno'], z['Příjmení']].filter(String).join(' '),
    zamestnani: nebo(z['Zaměstnání / studium']),
    vzdelani: nebo(z['Vzdělání']),
    datum_narozeni: nebo(d(z['Datum narození'])),
    email: nebo(z['E-mail']),
    telefon: nebo(z['Telefon']),
    ulice: nebo(z['Ulice a č.p.']),
    obec: nebo(z['Obec']),
    psc: nebo(z['PSČ']),
    adresa: nebo([z['Ulice a č.p.'], [z['PSČ'], z['Obec']].filter(String).join(' ')].filter(String).join(', ')),
    oblasti_zajmu: nebo([z['Oblasti zájmu'], z['Oblast – jiné']].filter(String).join(' – ')),
    organizace: nebo(z['Organizace']),
    organizace_adresa: nebo(org.adresa),
    organizace_kontakt: nebo(org.kontakt),
    organizace_email: nebo(org.email),
    organizace_telefon: nebo(org.telefon),
    misto_pusobeni: nebo(z['Místo působení']),
    misto_vykonu: String(z['Místo působení'] || ''), // u docházkového listu; prázdné = nic se nedoplní
    dobrovolnikem_od: nebo(d(z['Dobrovolníkem od'])),
    cislo_smlouvy: nebo(cislo),
    datum_smlouvy: nebo(d(z['Datum smlouvy'])),
    sluzba_od: nebo(d(z['Dobrovolníkem od'])),
    sluzba_do: nebo(d(z['Služba do'])),
    zastupce_jmeno: nebo(z['Zástupce – jméno']),
    zastupce_adresa: nebo(z['Zástupce – adresa']),
    zastupce_datum_narozeni: nebo(d(z['Zástupce – datum narození'])),
    zastupce_email: nebo(z['Zástupce – e-mail']),
    zastupce_telefon: nebo(z['Zástupce – telefon']),
    misto_skoleni: nebo(misto),
    skolitel: nebo(skolitel),
    skolitel_praxe: nebo(skolitelPraxe),
    kontakt_osoba: nebo(kontakt),
    prijimajici_organizace: nebo(vybranaOrg),
    prijimajici_adresa: nebo(org.adresa),
    dnesni_datum: Utilities.formatDate(new Date(), TZ, 'd. M. yyyy'),
    nazev_organizace: String(n.nazev_organizace || '')
  };
}

// ===== UKÁZKOVÉ ŠABLONY DOKUMENTŮ =============================

function vytvorUkazkoveSablony(token) {
  overAdmin_(token, 'Hlavní admin');
  const n = nastaveni_();
  const slozka = slozkaSablon_(n);

  const smlouva = vytvorSablonuSmlouvy_();
  const dochazka = vytvorSablonuDochazky_();
  DriveApp.getFileById(smlouva.getId()).moveTo(slozka);
  DriveApp.getFileById(dochazka.getId()).moveTo(slozka);

  nastavHodnotu_('sablona_smlouvy_18', smlouva.getUrl());
  nastavHodnotu_('sablona_smlouvy_15_17', smlouva.getUrl());
  nastavHodnotu_('sablona_dochazky', dochazka.getUrl());
  log_('Vytvořeny ukázkové šablony', '', slozka.getName());
  return { smlouva: smlouva.getUrl(), dochazka: dochazka.getUrl(), slozka: slozka.getUrl() };
}

function slozkaSablon_(n) {
  const smlouvy = slozkaZNastaveni_(n.slozka_smlouvy, 'slozka_smlouvy');
  let rodic = smlouvy;
  try { const p = smlouvy.getParents(); if (p.hasNext()) rodic = p.next(); } catch (e) { rodic = smlouvy; }
  const it = rodic.getFoldersByName('Šablony dokumentů');
  return it.hasNext() ? it.next() : rodic.createFolder('Šablony dokumentů');
}

function nastavHodnotu_(klic, hodnota) {
  delete MEMO.nastaveni;
  const sh = list_(LISTY.NASTAVENI);
  const v = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim() === klic) { sh.getRange(i + 1, 2).setValue(hodnota); return; }
  }
  sh.appendRow([klic, hodnota, '']);
}

function vytvorSablonuSmlouvy_() {
  const doc = DocumentApp.create('Šablona – Dohoda o dobrovolnické činnosti');
  const b = doc.getBody();
  const H = DocumentApp.ParagraphHeading;
  const C = DocumentApp.HorizontalAlignment.CENTER;
  const odst = t => b.appendParagraph(t).setHeading(H.NORMAL);
  const nadpis = t => b.appendParagraph(t).setHeading(H.HEADING2);

  const vzor = b.getParagraphs()[0];
  vzor.setText('VZOR – před použitím text upravte podle svých potřeb a tento řádek smažte.');

  b.appendParagraph('DOHODA O DOBROVOLNICKÉ ČINNOSTI').setHeading(H.TITLE).setAlignment(C);
  b.appendParagraph('č. {{cislo_smlouvy}}').setHeading(H.NORMAL).setAlignment(C);

  nadpis('Smluvní strany');
  odst('{{nazev_organizace}}');
  odst('se sídlem: ……………………………………………');
  odst('IČO: ……………………');
  odst('zastoupená: ……………………………………………');
  odst('(dále jen „organizace“)');
  odst('a');
  odst('{{cele_jmeno}}').editAsText().setBold(true);
  odst('datum narození: {{datum_narozeni}}').editAsText().setBold(false);
  odst('bydliště: {{adresa}}');
  odst('e-mail: {{email}}, telefon: {{telefon}}');
  odst('(dále jen „dobrovolník“)');

  nadpis('I. Předmět dohody');
  odst('1. Dobrovolník se zavazuje bez nároku na odměnu vykonávat dobrovolnickou činnost v oblasti: {{oblasti_zajmu}}.');
  odst('2. Přijímající organizace: {{organizace}}, {{organizace_adresa}}. Místo výkonu činnosti: {{misto_pusobeni}}.');
  odst('3. Konkrétní náplň, rozsah a časový harmonogram činnosti dohodne dobrovolník s koordinátorem přijímající organizace.');

  nadpis('II. Doba trvání');
  odst('1. Dohoda se uzavírá na dobu neurčitou s účinností od {{dobrovolnikem_od}}.');
  odst('2. Každá ze stran může dohodu kdykoli ukončit písemnou výpovědí, i bez udání důvodu.');

  nadpis('III. Povinnosti organizace');
  odst('1. Seznámit dobrovolníka s náplní činnosti, s podmínkami jejího výkonu a s pravidly bezpečnosti a ochrany zdraví.');
  odst('2. Zajistit dobrovolníkovi koordinátora, na kterého se může obracet.');
  odst('3. Zajistit pojištění odpovědnosti za škodu a pojištění pro případ úrazu dobrovolníka, pokud to vyžadují podmínky projektu.');
  odst('4. Na žádost dobrovolníka vydat potvrzení o vykonané dobrovolnické činnosti.');

  nadpis('IV. Povinnosti dobrovolníka');
  odst('1. Vykonávat dobrovolnickou činnost svědomitě a podle pokynů koordinátora.');
  odst('2. Zachovávat mlčenlivost o skutečnostech, o kterých se dozví při výkonu činnosti, zejména o osobních údajích klientů, a to i po skončení dohody.');
  odst('3. Včas oznámit koordinátorovi, že se nemůže dostavit k dohodnuté činnosti.');
  odst('4. Vést evidenci odpracovaných hodin a předávat ji organizaci.');

  nadpis('V. Ochrana osobních údajů');
  odst('Organizace zpracovává osobní údaje dobrovolníka v rozsahu nezbytném pro plnění této dohody a pro evidenci dobrovolnické činnosti, v souladu s nařízením (EU) 2016/679 (GDPR). Podrobné informace o zpracování jsou dobrovolníkovi k dispozici u organizace.');

  nadpis('VI. Závěrečná ustanovení');
  odst('1. Dohoda je vyhotovena ve dvou stejnopisech, z nichž každá strana obdrží jeden.');
  odst('2. Strany prohlašují, že si dohodu přečetly, jejímu obsahu rozumějí a na důkaz souhlasu ji podepisují.');
  odst('');
  odst('V ………………………… dne {{dnesni_datum}}');
  odst('');
  const t = b.appendTable([['……………………………………', '……………………………………'], ['za organizaci', 'dobrovolník']]);
  t.setBorderWidth(0);

  vzor.editAsText().setItalic(true).setForegroundColor('#888888');
  doc.saveAndClose();
  return DriveApp.getFileById(doc.getId());
}

function vytvorSablonuDochazky_() {
  const doc = DocumentApp.create('Šablona – Docházkový list dobrovolníka');
  const b = doc.getBody();
  const H = DocumentApp.ParagraphHeading;
  b.getParagraphs()[0].setText('DOCHÁZKOVÝ LIST DOBROVOLNÍKA').setHeading(H.TITLE);
  const odst = t => b.appendParagraph(t).setHeading(H.NORMAL);
  odst('Dobrovolník: {{cele_jmeno}} (ID {{id}})');
  odst('Organizace: {{organizace}}');
  odst('Místo působení: {{misto_pusobeni}}');
  odst('Období: ……………………………………');
  odst('');

  const radky = [['Datum', 'Činnost', 'Od', 'Do', 'Hodin', 'Podpis koordinátora']];
  for (let i = 0; i < 15; i++) radky.push(['', '', '', '', '', '']);
  const t = b.appendTable(radky);
  const hlav = t.getRow(0);
  for (let c = 0; c < hlav.getNumCells(); c++) {
    hlav.getCell(c).setBackgroundColor('#e8f3ee').editAsText().setBold(true);
  }
  for (let r = 1; r < t.getNumRows(); r++) t.getRow(r).setMinimumHeight(26);

  odst('');
  odst('Celkem hodin: …………').editAsText().setBold(true);
  odst('Potvrzuji správnost uvedených údajů.').editAsText().setBold(false);
  odst('');
  const p = b.appendTable([['……………………………………', '……………………………………'], ['dobrovolník', 'koordinátor']]);
  p.setBorderWidth(0);
  doc.saveAndClose();
  return DriveApp.getFileById(doc.getId());
}

// ===== ADMINISTRACE ===========================================

function nactiAdministraci(token) {
  const a = overAdmin_(token, 'Koordinátor');
  const vysledek = { role: a.role, zastupne: ZASTUPNE_DOKUMENTY, listy: {} };
  const listy = editovatelneListy_();
  Object.keys(listy).forEach(k => {
    const cfg = listy[k];
    if (PORADI_ROLI[a.role] < PORADI_ROLI[cfg.role]) return;
    const sh = list_(cfg.list);
    const hlav = hlavicky_(sh);
    const radky = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, hlav.length).getValues() : [];
    vysledek.listy[k] = {
      hlavicky: hlav,
      sloupce: cfg.sloupce,
      radky: radky.map((r, i) => ({ r: i + 2, v: r.map(x => x instanceof Date ? Utilities.formatDate(x, TZ, 'd. M. yyyy H:mm') : String(x)) }))
        .filter(x => String(x.v[0]).trim() || x.v.some(String))
    };
  });
  return vysledek;
}

function ulozBunkuListu(token, klic, radek, sloupec, hodnota, puvodniKlic) {
  const cfg = editovatelneListy_()[klic];
  if (!cfg) throw new Error('Neznámý list.');
  const a = overAdmin_(token, cfg.role);
  radek = Number(radek); sloupec = Number(sloupec);
  if (cfg.sloupce.indexOf(sloupec) < 0) throw new Error('Tento údaj nelze upravovat.');

  let v = String(hodnota == null ? '' : hodnota).trim().slice(0, 5000);
  const anoNe = (klic === 'OBLASTI' || klic === 'MISTA') && sloupec === 1 || klic === 'CINNOSTI' && sloupec === 2 ||
    klic === 'ORGANIZACE' && sloupec === 7 || klic === 'ADMINI' && (sloupec === 3 || sloupec === 4);
  if (anoNe && ['ANO', 'NE'].indexOf(v) < 0) throw new Error('Povolené hodnoty jsou ANO / NE.');
  if (klic === 'ADMINI' && sloupec === 0) { v = v.toLowerCase(); if (!platnyEmail_(v)) throw new Error('Neplatný e-mail.'); }
  if (klic === 'ADMINI' && sloupec === 2 && ROLE.indexOf(v) < 0) throw new Error('Neznámá role.');
  if (klic === 'ORGANIZACE' && sloupec === 3 && v && !platnyEmail_(v)) throw new Error('Neplatný e-mail.');
  if (klic === 'ORGANIZACE' && sloupec === 1 && !v) throw new Error('Název organizace nesmí být prázdný.');
  if ((klic === 'OBLASTI' || klic === 'MISTA') && sloupec === 0 && !v) throw new Error('Název nesmí být prázdný.');
  if (klic === 'CINNOSTI' && sloupec === 1 && !v) throw new Error('Název činnosti nesmí být prázdný.');
  if (klic === 'CINNOSTI' && sloupec === 0 && v !== VSECHNY_ORGANIZACE && !organizace_().some(o => o.nazev === v)) throw new Error('Neznámá organizace.');

  return sZamkem_(() => {
    const sh = list_(cfg.list);
    if (radek < 2 || radek > sh.getLastRow()) throw new Error('Řádek neexistuje. Obnovte prosím stránku.');
    const vsechny = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    if (String(vsechny[radek - 1][0]).trim() !== String(puvodniKlic).trim()) {
      throw new Error('Data se mezitím změnila. Obnovte prosím stránku.');
    }
    if (klic === 'ADMINI') {
      const kopie = vsechny.map(r => r.slice());
      kopie[radek - 1][sloupec] = v;
      const hlavni = kopie.slice(1).filter(r => String(r[2]).trim() === 'Hlavní admin' && String(r[3]).trim().toUpperCase() !== 'NE');
      if (!hlavni.length) throw new Error('V systému musí zůstat alespoň jeden aktivní hlavní admin.');
      if (sloupec === 0 && kopie.slice(1).filter(r => String(r[0]).trim().toLowerCase() === v).length > 1) {
        throw new Error('Tento e-mail už v seznamu je.');
      }
    }
    const stara = vsechny[radek - 1][sloupec];
    let zapis = bunka_(v);
    if (klic === 'NASTAVENI' && v !== '' && !isNaN(Number(v)) && /^(minimalni_vek|delka_schuzky_min|hodiny_zpetne_dni|platnost_odkazu_dni|delka_prihlaseni_hod)$/.test(String(puvodniKlic))) {
      zapis = Number(v);
    }
    sh.getRange(radek, sloupec + 1).setValue(zapis);
    MEMO = { ss: MEMO.ss };
    const sablonaText = klic === 'SABLONY' && sloupec === 3;
    log_('Administrace: ' + cfg.list, String(puvodniKlic),
      hlavicky_(sh)[sloupec] + ': ' + (sablonaText ? '(upraven text šablony)' : textem_(stara) + ' → ' + textem_(v)));
    return { ok: true, klic: sloupec === 0 ? v : String(puvodniKlic), kdo: a.email };
  });
}

function pridejRadekListu(token, klic, d) {
  const cfg = editovatelneListy_()[klic];
  if (!cfg || ['OBLASTI', 'MISTA', 'ORGANIZACE', 'ADMINI', 'CINNOSTI'].indexOf(klic) < 0) throw new Error('Do tohoto listu nelze přidávat.');
  overAdmin_(token, cfg.role);
  d = d || {};
  const t = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 300);

  sZamkem_(() => {
    const sh = list_(cfg.list);
    const prvni = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues() : [];
    let radek;
    if (klic === 'OBLASTI' || klic === 'MISTA') {
      const nazev = t(d.nazev, 200);
      if (!nazev) throw new Error('Zadejte název.');
      if (prvni.some(r => String(r[0]).trim().toLowerCase() === nazev.toLowerCase())) throw new Error('Tato položka už v seznamu je.');
      radek = [bunka_(nazev), 'ANO'];
    } else if (klic === 'CINNOSTI') {
      const nazev = t(d.nazev, 200);
      const org = t(d.organizace, 200) || VSECHNY_ORGANIZACE;
      if (!nazev) throw new Error('Zadejte název činnosti.');
      if (org !== VSECHNY_ORGANIZACE && !organizace_().some(o => o.nazev === org)) throw new Error('Neznámá organizace.');
      const vse = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues() : [];
      if (vse.some(r => String(r[0]).trim() === org && String(r[1]).trim().toLowerCase() === nazev.toLowerCase())) throw new Error('Tato činnost už v seznamu je.');
      radek = [bunka_(org), bunka_(nazev), 'ANO'];
    } else if (klic === 'ORGANIZACE') {
      const nazev = t(d.nazev, 200);
      if (!nazev) throw new Error('Zadejte název organizace.');
      if (prvni.some(r => String(r[1]).trim().toLowerCase() === nazev.toLowerCase())) throw new Error('Organizace už v seznamu je.');
      const email = t(d.email, 200);
      if (email && !platnyEmail_(email)) throw new Error('Neplatný e-mail organizace.');
      let max = 0;
      prvni.forEach(r => { const m = String(r[0]).match(/^ORG-(\d+)$/); if (m) max = Math.max(max, +m[1]); });
      radek = ['ORG-' + String(max + 1).padStart(3, '0'), nazev, t(d.kontakt), email, t(d.telefon, 40),
        t(d.adresa), t(d.oblast), 'ANO', t(d.poznamky, 1000)].map(bunka_);
    } else {
      const email = t(d.email, 200).toLowerCase();
      if (!platnyEmail_(email)) throw new Error('Zadejte platný e-mail.');
      if (prvni.some(r => String(r[0]).trim().toLowerCase() === email)) throw new Error('Tento administrátor už v seznamu je.');
      const role = ROLE.indexOf(d.role) >= 0 ? d.role : 'Koordinátor';
      radek = [email, bunka_(t(d.jmeno, 100)), role, 'ANO', d.notifikace === 'NE' ? 'NE' : 'ANO'];
    }
    sh.appendRow(radek);
    MEMO = { ss: MEMO.ss };
    log_('Administrace: přidáno do ' + cfg.list, '', radek.slice(0, 2).join(' | '));
  });
  return nactiAdministraci(token);
}
