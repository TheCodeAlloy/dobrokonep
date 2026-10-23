/**
 * DOBROVOLNICKÉ CENTRUM – API PRO WEBOVÉ STRÁNKY
 * --------------------------------------------------------------
 * Webové stránky na GitHub Pages posílají požadavky metodou POST
 * ve tvaru { akce: 'nazevAkce', token: '…', args: [...] }.
 * Odpověď je JSON { ok: true, data: … } nebo { ok: false, chyba: '…' }.
 *
 * Nasazení: Nasadit → Nové nasazení → Webová aplikace,
 *           Spustit jako: Já, Kdo má přístup: Kdokoli.
 */

// Akce dostupné bez přihlášení
const API_VEREJNE = {
  konfigurace: () => konfiguraceFormulare_(),
  odeslatRegistraci: d => odeslatRegistraci(d),
  posliPrihlasovaciKod: (email, id) => posliPrihlasovaciKod(email, id),
  overPrihlasovaciOdkaz: t => overPrihlasovaciOdkaz(t),
  prihlasitOdkazem: t => prihlasitOdkazem(t),
  prihlasitGoogle: c => prihlasitGoogle(c),
  overPrihlasovaciKod: (email, kod) => overPrihlasovaciKod(email, kod),
  odhlasit: token => odhlasit(token),
  // portál dobrovolníka – přihlášení
  dPosliKod: email => dPosliKod(email),
  dOverKod: (email, kod) => dOverKod(email, kod),
  dPrihlasitOdkazem: t => dPrihlasitOdkazem(t),
  dPrihlasitGoogle: c => dPrihlasitGoogle(c),
  dOdhlasit: token => dOdhlasit(token)
};

// Akce pro přihlášeného dobrovolníka (token se doplní jako první argument)
const API_DOBROVOLNIK = {
  dMojeData: function () { return dMojeData.apply(null, arguments); },
  dZapisHodiny: function () { return dZapisHodiny.apply(null, arguments); },
  dSmazHodiny: function () { return dSmazHodiny.apply(null, arguments); },
  dOdhlasitVsude: function () { return dOdhlasitVsude.apply(null, arguments); }
};

// Akce pro přihlášené administrátory (token se doplní jako první argument,
// oprávnění si každá funkce ověřuje sama přes overAdmin_).
// Funkce se volají až za běhu, takže nezáleží na pořadí souborů v projektu.
const API_ADMIN = {
  nactiData: function () { return nactiData.apply(null, arguments); },
  ulozPole: function () { return ulozPole.apply(null, arguments); },
  naplanujSchuzku: function () { return naplanujSchuzku.apply(null, arguments); },
  zrusSchuzku: function () { return zrusSchuzku.apply(null, arguments); },
  generujDokument: function () { return generujDokument.apply(null, arguments); },
  smazDokument: function () { return smazDokument.apply(null, arguments); },
  rocniVykaz: function () { return rocniVykaz.apply(null, arguments); },
  exportujRocniVykaz: function () { return exportujRocniVykaz.apply(null, arguments); },
  vytvorUkazkoveSablony: function () { return vytvorUkazkoveSablony.apply(null, arguments); },
  nactiAdministraci: function () { return nactiAdministraci.apply(null, arguments); },
  ulozBunkuListu: function () { return ulozBunkuListu.apply(null, arguments); },
  pridejRadekListu: function () { return pridejRadekListu.apply(null, arguments); },
  smazZaznam: function () { return smazZaznam.apply(null, arguments); },
  nactiHodiny: function () { return nactiHodiny.apply(null, arguments); },
  ulozHodiny: function () { return ulozHodiny.apply(null, arguments); },
  ulozAkci: function () { return ulozAkci.apply(null, arguments); },
  ulozVykaz: function () { return ulozVykaz.apply(null, arguments); },
  zmenStavHodin: function () { return zmenStavHodin.apply(null, arguments); },
  smazHodiny: function () { return smazHodiny.apply(null, arguments); },
  pridejPrirazeni: function () { return pridejPrirazeni.apply(null, arguments); },
  ukonciPrirazeni: function () { return ukonciPrirazeni.apply(null, arguments); },
  obnovPrirazeni: function () { return obnovPrirazeni.apply(null, arguments); },
  upravPrirazeni: function () { return upravPrirazeni.apply(null, arguments); },
  posliPozvankuPortal: function () { return posliPozvankuPortal.apply(null, arguments); }
};

function doPost(e) {
  let pozadavek;
  try {
    pozadavek = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, chyba: 'Neplatný požadavek.' });
  }
  const akce = String(pozadavek.akce || '');
  const args = Array.isArray(pozadavek.args) ? pozadavek.args : [];
  AKTUALNI_UZIVATEL = '';
  MEMO = {};
  try {
    let data;
    if (API_VEREJNE.hasOwnProperty(akce)) {
      data = API_VEREJNE[akce].apply(null, args);
    } else if (API_ADMIN.hasOwnProperty(akce) || API_DOBROVOLNIK.hasOwnProperty(akce)) {
      const mapa = API_ADMIN.hasOwnProperty(akce) ? API_ADMIN : API_DOBROVOLNIK;
      data = mapa[akce].apply(null, [String(pozadavek.token || '')].concat(args));
    } else {
      return json_({ ok: false, chyba: 'Neznámá akce.' });
    }
    return json_({ ok: true, data: data === undefined ? null : data });
  } catch (err) {
    const zprava = String(err && err.message ? err.message : err);
    if (!/^PRIHLASENI/.test(zprava)) console.error(akce + ': ' + zprava);
    return json_({ ok: false, chyba: zprava });
  }
}

// Otevření adresy API v prohlížeči jen ukáže, že běží
function doGet() {
  return json_({ ok: true, sluzba: 'Dobrovolnické centrum API', cas: new Date().toISOString() });
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
