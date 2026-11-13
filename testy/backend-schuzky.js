// Schůzky: osobní a online (stálý odkaz), e-maily s tlačítkem, kalendář (napodobenina)
process.env.TZ = 'Europe/Prague';
const M = require('./gas-mock.js');
require('./nacti-kod.js')();
overAdmin_ = () => { AKTUALNI_UZIVATEL = 'k@k.cz'; return { email: 'k@k.cz', role: 'Koordinátor' }; };
log_ = () => {};
const udalosti = {};
let cislo = 0;
CalendarApp = {
  getDefaultCalendar: () => ({
    getId: () => 'k@k.cz',
    getEventById: id => udalosti[id] || null,
    createEvent: (nazev, start, konec, o) => {
      const u = { id: 'E' + (++cislo), popis: o.description, misto: o.location, smazana: false,
        getId() { return this.id; }, setTime() {}, setTitle() {}, setLocation(m) { this.misto = m; },
        setDescription(p) { this.popis = p; }, deleteEvent() { this.smazana = true; } };
      udalosti[u.id] = u; return u;
    }
  })
};
let chyby = 0;
const over = (popis, ok) => { console.log((ok ? 'OK    ' : 'CHYBA ') + popis); if (!ok) chyby++; };
nastavTabulku();
nastavHodnotu_('web_adresa', 'https://x.github.io/dk/');
const sh = M.sheets;
const hd = hlavicky_(sh['Dobrovolníci']);
sh['Dobrovolníci'].appendRow(hd.map(h => ({ ID: 'DC-2026-0001', 'Jméno': 'Jan', 'Příjmení': 'Novák', 'E-mail': 'jan@x.cz', 'Stav': 'Nový zájemce' })[h] ?? ''));
const ODKAZ = 'https://meet.google.com/aaa-bbbb-ccc';

// bez odkazu v Nastavení nelze online schůzku naplánovat
let chyba = ''; try { naplanujSchuzku('T', 'DC-2026-0001', '2026-11-20T10:00', 'Online', true, true); } catch (e) { chyba = e.message; }
over('online bez odkazu v Nastavení → chyba', /odkaz_online_schuzky/.test(chyba));

// osobní schůzka: žádný odkaz ani tlačítko
MAILS.length = 0;
let r = naplanujSchuzku('T', 'DC-2026-0001', '2026-11-20T10:00', 'Kancelář', true, false);
let m = MAILS.pop();
over('osobní: sloupec Online schůzka = NE', r.zaznam['Online schůzka'] === 'NE');
over('osobní: e-mail bez tlačítka', m && !m.htmlBody.includes('Připojit se ke schůzce') && !m.body.includes('{odkaz_schuzky}') && !/\n{3}/.test(m.body));

// online schůzka
nastavHodnotu_('odkaz_online_schuzky', ODKAZ); delete MEMO.nastaveni;
r = naplanujSchuzku('T', 'DC-2026-0001', '2026-11-21T10:00', 'Online', true, true);
m = MAILS.pop();
over('online: sloupec = ANO', r.zaznam['Online schůzka'] === 'ANO');
over('online: HTML tlačítko s odkazem', m.htmlBody.includes('href="' + ODKAZ + '"') && m.htmlBody.includes('Připojit se ke schůzce</a>'));
over('online: textová verze obsahuje odkaz', m.body.includes(ODKAZ));
over('online: odkaz v popisu události', Object.values(udalosti)[0].popis.includes(ODKAZ));
over('dashboard dostane odkaz', nactiData('T').nastaveni.odkazOnline === ODKAZ);

// šablona s {odkaz_schuzky} – tlačítko na tom místě, ne duplicitně
const ssab = sh['Šablony e-mailů']; const v = ssab.getDataRange().getValues();
over('šablona potvrzení obsahuje {odkaz_schuzky}', v.some(x => x[0] === 'potvrzeni_schuzky' && String(x[3]).includes('{odkaz_schuzky}')));
over('tlačítko jen jednou', (m.htmlBody.match(/Připojit se ke schůzce<\/a>/g) || []).length === 1);

// zrušení vymaže příznak
r = zrusSchuzku('T', 'DC-2026-0001', false);
over('zrušení: příznak vymazán', r.zaznam['Online schůzka'] === '');
console.log(chyby ? 'CHYBA: ' + chyby + ' neúspěšných kontrol' : 'Schůzky: vše OK');
process.exit(chyby ? 1 : 0);
