/**
 * DOBROVOLNICKÉ CENTRUM – PORTÁL DOBROVOLNÍKA (fáze 2)
 * --------------------------------------------------------------
 * Stránka hodiny.html na GitHubu. Dobrovolník se přihlásí bez hesla
 * (pozvánka, e-mail + kód/odkaz, nebo účet Google), vidí své hodiny
 * a zapisuje nové. Jeho zápisy čekají na schválení („Ke schválení“).
 *
 * Přístup má jen záznam ve stavu „Aktivní dobrovolník“ s e-mailem.
 * Změnou stavu (např. na Neaktivní) přístup okamžitě končí.
 */

const STAV_S_PORTALEM = 'Aktivní dobrovolník';

// ===== DOBROVOLNÍCI ===========================================

function dobrovolnikPodleId_(id) {
  const sh = list_(LISTY.DOBROVOLNICI);
  const hlav = hlavicky_(sh);
  try { return zaznamObjekt_(sh, hlav, najdiRadek_(sh, hlav, id)); } catch (e) { return null; }
}

function aktivniDobrovolnikPodleEmailu_(email) {
  email = String(email || '').trim().toLowerCase();
  if (!platnyEmail_(email)) return null;
  const sh = list_(LISTY.DOBROVOLNICI);
  if (sh.getLastRow() < 2) return null;
  const hlav = hlavicky_(sh);
  const i = n => hlav.indexOf(n);
  const nalez = sh.getRange(2, 1, sh.getLastRow() - 1, hlav.length).getValues()
    .filter(r => String(r[i('E-mail')]).trim().toLowerCase() === email && String(r[i('Stav')]).trim() === STAV_S_PORTALEM)
    .sort((a, b) => String(b[i('ID')]).localeCompare(String(a[i('ID')])));
  return nalez.length ? serializuj_(hlav, nalez[0]) : null;
}

// ===== RELACE (PŘIHLÁŠENÍ) ====================================

function vytvorRelaciD_(id, email) {
  const props = PropertiesService.getScriptProperties();
  const ted = Date.now();
  const vse = props.getProperties();
  Object.keys(vse).forEach(k => {
    if (k.indexOf('SESD_') === 0 || k.indexOf('DVSTUP_') === 0) {
      try { if (JSON.parse(vse[k]).exp < ted) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
    }
  });
  const dni = Number(nastaveni_().delka_prihlaseni_dobrovolnik_dni) || 365;
  const token = Utilities.getUuid() + Utilities.getUuid();
  props.setProperty('SESD_' + hash_(token), JSON.stringify({ id: id, email: email, exp: ted + dni * 86400000 }));
  return token;
}

function overDobrovolnik_(token) {
  const chyba = () => new Error('PRIHLASENI: Přihlášení vypršelo. Přihlaste se prosím znovu.');
  if (!token) throw chyba();
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('SESD_' + hash_(token));
  if (!raw) throw chyba();
  const s = JSON.parse(raw);
  if (s.exp < Date.now()) { props.deleteProperty('SESD_' + hash_(token)); throw chyba(); }
  const z = dobrovolnikPodleId_(s.id);
  if (!z || String(z['Stav']).trim() !== STAV_S_PORTALEM || String(z['E-mail']).trim().toLowerCase() !== s.email) {
    props.deleteProperty('SESD_' + hash_(token));
    throw new Error('PRIHLASENI: Váš přístup do portálu už není aktivní. Obraťte se prosím na koordinátora.');
  }
  AKTUALNI_UZIVATEL = s.email + ' (dobrovolník)';
  return { id: s.id, email: s.email, z: z, role: 'Dobrovolník' };
}

function prihlasDobrovolnika_(z, zpusob) {
  const email = String(z['E-mail']).trim().toLowerCase();
  AKTUALNI_UZIVATEL = email + ' (dobrovolník)';
  log_('Portál – přihlášení (' + zpusob + ')', z.ID, '');
  return { token: vytvorRelaciD_(z.ID, email) };
}

function dOdhlasit(token) {
  if (token) PropertiesService.getScriptProperties().deleteProperty('SESD_' + hash_(token));
  return { ok: true };
}

function dOdhlasitVsude(token) {
  const d = overDobrovolnik_(token);
  const props = PropertiesService.getScriptProperties();
  const vse = props.getProperties();
  let pocet = 0;
  Object.keys(vse).forEach(k => {
    if (k.indexOf('SESD_') !== 0) return;
    try { if (JSON.parse(vse[k]).id === d.id) { props.deleteProperty(k); pocet++; } } catch (e) { /* nic */ }
  });
  log_('Portál – odhlášení ze všech zařízení', d.id, pocet + ' zařízení');
  return { ok: true, pocet: pocet };
}

// ===== PŘIHLÁŠENÍ: E-MAIL + KÓD / ODKAZ =======================

function dPosliKod(email) {
  email = String(email || '').trim().toLowerCase();
  if (!platnyEmail_(email)) throw new Error('Zadejte platný e-mail.');
  const z = aktivniDobrovolnikPodleEmailu_(email);
  if (!z) { log_('Portál – neznámý e-mail', '', email); return { ok: true }; }

  const cache = CacheService.getScriptCache();
  if (cache.get('DKODT_' + email)) throw new Error('Kód jsme poslali před chvílí. Další můžete vyžádat za minutu.');
  const kod = String(parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 12), 16) % 1000000).padStart(6, '0');
  cache.put('DKOD_' + email, JSON.stringify({ h: hash_(kod + email), pokusy: 0 }), 600);
  cache.put('DKODT_' + email, '1', 60);

  // Odkaz platí 10 minut a lze ho během té doby použít opakovaně
  // (e-mailové aplikace si odkazy někdy načítají na pozadí)
  const n = nastaveni_();
  const web = webAdresa_(n);
  let odkaz = '';
  if (web) {
    const t = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    cache.put('DODKAZ_' + hash_(t), JSON.stringify({ id: z.ID, email: email }), 600);
    odkaz = web + 'hodiny.html?vstup=' + t;
  }
  posliEmailSTlacitkem_('prihlaseni_dobrovolnik', email, {
    kod: kod, jmeno: z['Jméno'], nazev_organizace: String(n.nazev_organizace || '')
  }, odkaz, 'Přihlásit se', n);
  log_('Portál – odeslán kód', z.ID, '');
  return { ok: true };
}

function dOverKod(email, kod) {
  email = String(email || '').trim().toLowerCase();
  kod = String(kod || '').replace(/\s/g, '');
  const cache = CacheService.getScriptCache();
  const raw = cache.get('DKOD_' + email);
  if (!raw) throw new Error('Kód vypršel nebo je neplatný. Požádejte o nový.');
  const k = JSON.parse(raw);
  if (k.h !== hash_(kod + email)) {
    k.pokusy++;
    if (k.pokusy >= 5) { cache.remove('DKOD_' + email); throw new Error('Příliš mnoho pokusů. Požádejte o nový kód.'); }
    cache.put('DKOD_' + email, JSON.stringify(k), 600);
    throw new Error('Nesprávný kód. Zbývá pokusů: ' + (5 - k.pokusy) + '.');
  }
  cache.remove('DKOD_' + email);
  const z = aktivniDobrovolnikPodleEmailu_(email);
  if (!z) throw new Error('Tento e-mail nemá přístup do portálu.');
  return prihlasDobrovolnika_(z, 'kód');
}

// Odkaz z e-mailu s kódem (10 minut) nebo z pozvánky (několik dní)
function dPrihlasitOdkazem(t) {
  t = String(t || '').trim();
  if (!/^[a-f0-9]{64}$/.test(t)) throw new Error('Odkaz je neplatný. Přihlaste se prosím e-mailem.');
  const h = hash_(t);
  let info = null;
  const c = CacheService.getScriptCache().get('DODKAZ_' + h);
  if (c) info = JSON.parse(c);
  if (!info) {
    const p = PropertiesService.getScriptProperties().getProperty('DVSTUP_' + h);
    if (p) { const x = JSON.parse(p); if (x.exp >= Date.now()) info = x; }
  }
  if (!info) throw new Error('Platnost odkazu vypršela. Přihlaste se prosím e-mailem – pošleme vám nový.');
  const z = dobrovolnikPodleId_(info.id);
  if (!z || String(z['Stav']).trim() !== STAV_S_PORTALEM || String(z['E-mail']).trim().toLowerCase() !== info.email) {
    throw new Error('Váš přístup do portálu už není aktivní. Obraťte se prosím na koordinátora.');
  }
  return prihlasDobrovolnika_(z, 'odkaz');
}

function dPrihlasitGoogle(credential) {
  const email = overGoogleEmail_(credential);
  const z = aktivniDobrovolnikPodleEmailu_(email);
  if (!z) {
    log_('Portál – Google bez přístupu', '', email);
    throw new Error('Účet ' + email + ' nemá přístup do portálu. Použijte e-mail, který jste uvedli při registraci.');
  }
  return prihlasDobrovolnika_(z, 'Google');
}

// ===== POZVÁNKA DO PORTÁLU (z dashboardu) =====================

function posliPozvankuPortal(token, id) {
  const a = overAdmin_(token, 'Koordinátor');
  const n = nastaveni_();
  const web = webAdresa_(n);
  if (!web) throw new Error('V Nastavení chybí web_adresa (adresa webu na GitHubu).');
  return sZamkem_(() => {
    const sh = list_(LISTY.DOBROVOLNICI);
    const hlav = hlavicky_(sh);
    const radek = najdiRadek_(sh, hlav, id);
    const z = zaznamObjekt_(sh, hlav, radek);
    const email = String(z['E-mail'] || '').trim().toLowerCase();
    if (!platnyEmail_(email)) throw new Error('Dobrovolník nemá vyplněný platný e-mail.');
    if (String(z['Stav']).trim() !== STAV_S_PORTALEM) throw new Error('Pozvánku lze poslat jen ve stavu „' + STAV_S_PORTALEM + '“.');
    const dni = Number(n.platnost_pozvanky_dni) || 14;
    const t = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    PropertiesService.getScriptProperties().setProperty('DVSTUP_' + hash_(t),
      JSON.stringify({ id: z.ID, email: email, exp: Date.now() + dni * 86400000 }));
    posliEmailSTlacitkem_('pozvanka_portal', email, {
      jmeno: z['Jméno'], prijmeni: z['Příjmení'], id: z.ID, platnost_dni: dni,
      adresa_portalu: web + 'hodiny.html', nazev_organizace: String(n.nazev_organizace || '')
    }, web + 'hodiny.html?vstup=' + t, 'Otevřít moje dobrovolnické hodiny', n);
    zapisDoRadku_(sh, radek, hlav, { 'Pozvánka do portálu': new Date(), 'Naposledy upraveno': new Date(), 'Upravil/a': a.email });
    log_('Portál – odeslána pozvánka', z.ID, email);
    return { zaznam: zaznamObjekt_(sh, hlav, radek) };
  });
}

// Šablona e-mailu, kde {odkaz} se v HTML verzi zobrazí jako tlačítko
function posliEmailSTlacitkem_(klic, komu, prom, odkaz, textTlacitka, n) {
  const s = sablona_(klic);
  if (!s) throw new Error('Chybí šablona e-mailu „' + klic + '“. Spusťte prosím nastavTabulku.');
  let text = s.text;
  if (odkaz && text.indexOf('{odkaz}') < 0) text += '\n\n{odkaz}';
  const ZNACKA = '\u0000ODKAZ\u0000';
  const p = Object.assign({}, prom, { odkaz: ZNACKA });
  const cisty = dosad_(text, p);
  const tlacitko = '<a href="' + esc_(odkaz) + '" style="display:inline-block;background:#c4524e;color:#ffffff;' +
    'text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">' + esc_(textTlacitka) + '</a>';
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#222">' +
    esc_(cisty).replace(/\n/g, '<br>').split(ZNACKA).join(odkaz ? tlacitko : '') + '</div>';
  const zprava = {
    to: komu, subject: dosad_(s.predmet, p), name: String(n.nazev_organizace || 'Dobrovolnické centrum'),
    body: cisty.split(ZNACKA).join(odkaz), htmlBody: html
  };
  if (n.email_odpovedi) zprava.replyTo = String(n.email_odpovedi);
  MailApp.sendEmail(zprava);
}

// ===== DATA DOBROVOLNÍKA ======================================

function dMojeData(token) {
  const d = overDobrovolnik_(token);
  const n = nastaveni_();
  const z = d.z;
  const pr = prirazeni_().filter(p => p.dobrovolnik === d.id);
  const orgs = organizace_();
  const cin = cinnosti_();
  const organizace = pr.map(p => {
    const o = orgs.find(x => x.id === p.orgId) || { nazev: p.org };
    const c = cin.filter(x => x.org === VSECHNY_ORGANIZACE || x.org === o.nazev).map(x => x.cinnost);
    return { id: p.orgId, nazev: o.nazev, od: p.od, do: p.do, aktivni: p.aktivni, cinnosti: c.filter((x, i) => c.indexOf(x) === i) };
  });
  const hodiny = radkyHodin_().radky.filter(x => x.dobrovolnik === d.id).map(x => ({
    id: x.id, datum: x.datum, orgId: x.orgId, org: x.org, od: x.od, do: x.do, minut: x.minut,
    cinnost: x.cinnost, poznamka: x.poznamka, stav: x.stav, zdroj: x.zdroj
  })).sort((a, b) => (b.datum + b.od).localeCompare(a.datum + a.od));
  return {
    dobrovolnik: {
      id: d.id, titul: z['Titul'] || '', jmeno: z['Jméno'], prijmeni: z['Příjmení'], email: d.email,
      od: z['Dobrovolníkem od'] || ''
    },
    organizace: organizace,
    hodiny: hodiny,
    zpetneDni: Number(n.hodiny_zpetne_dni) || 60,
    uzavrenoDo: uzavrenoDo_(n),
    nazev: String(n.nazev_organizace || ''),
    dnes: ymd_(new Date())
  };
}

function overZpetnyZapis_(n, datum) {
  const dni = Number(n.hodiny_zpetne_dni) || 60;
  const hranice = ymd_(new Date(Date.now() - dni * 86400000));
  if (String(datum) < hranice) {
    throw new Error('Sami můžete zapisovat nejvýše ' + dni + ' dní zpětně. Starší hodiny vám zapíše koordinátor.');
  }
}

// Nový zápis, nebo úprava vlastního zápisu, který ještě nebyl schválen
function dZapisHodiny(token, z) {
  const d = overDobrovolnik_(token);
  const n = nastaveni_();
  z = Object.assign({}, z || {}, { dobrovolnik: d.id });
  overZpetnyZapis_(n, z.datum);
  return sZamkem_(() => {
    const p = pripravZapis_(z, prirazeni_(), organizace_(), n, d, true);
    const ted = new Date();
    if (z.id) {
      const data = radkyHodin_();
      const puv = data.radky.find(x => x.id === String(z.id) && x.dobrovolnik === d.id);
      if (!puv) throw new Error('Zápis nebyl nalezen.');
      if (puv.stav === 'Schváleno') throw new Error('Schválený zápis už nelze měnit. Obraťte se prosím na koordinátora.');
      zapisDoRadku_(data.sh, puv.radek, data.hlav, {
        'Datum': p.datum, 'Počet hodin': Math.round(p.minut / 60 * 100) / 100, 'Organizace': p.org.nazev,
        'ID organizace': p.org.id, 'Činnost': p.cinnost, 'Čas od': p.od, 'Čas do': p.do, 'Minut': p.minut,
        'Poznámka': p.poznamka, 'Stav': 'Ke schválení', 'Potvrdila organizace': '', 'Upraveno': ted, 'Upravil/a': d.email
      });
      log_('Portál – úprava hodin', d.id, z.id + ': ' + p.minut + ' min');
    } else {
      const zaznam = novyZaznamHodin_(p, d, 'Dobrovolník', '');
      zaznam['Stav'] = 'Ke schválení';
      zaznam['Potvrdila organizace'] = '';
      zapisRadkyHodin_([zaznam]);
      log_('Portál – zápis hodin', d.id, ymd_(p.datum) + ', ' + p.minut + ' min, ' + p.org.nazev);
    }
    return dMojeData(token);
  });
}

function dSmazHodiny(token, id) {
  const d = overDobrovolnik_(token);
  const n = nastaveni_();
  return sZamkem_(() => {
    const data = radkyHodin_();
    const z = data.radky.find(x => x.id === String(id) && x.dobrovolnik === d.id);
    if (!z) throw new Error('Zápis nebyl nalezen.');
    if (z.stav === 'Schváleno') throw new Error('Schválený zápis už nelze smazat. Obraťte se prosím na koordinátora.');
    overUzaverku_(d, n, z.datum);
    data.sh.deleteRow(z.radek);
    log_('Portál – smazání hodin', d.id, z.datum + ', ' + z.minut + ' min');
    return dMojeData(token);
  });
}
