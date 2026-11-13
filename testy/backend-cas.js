// Fáze A: pravidla zápisu hodin (čas vždy od–do, minuty po 5, 0–24, „do“ po „od“, organizace povinná)
process.env.TZ = 'Europe/Prague';
const M = require('./gas-mock.js');
require('./nacti-kod.js')();
overAdmin_ = () => { AKTUALNI_UZIVATEL = 'k@k.cz'; return { email: 'k@k.cz', role: 'Koordinátor' }; };
log_ = () => {};
let chyby = 0;
const over = (popis, ok) => { console.log((ok ? 'OK    ' : 'CHYBA ') + popis); if (!ok) chyby++; };
const chyba = fn => { try { fn(); return ''; } catch (e) { return e.message; } };
nastavTabulku();
const hd = hlavicky_(M.sheets['Organizace']);
M.sheets['Organizace'].appendRow(hd.map(h => ({ ID: 'KAL', 'Název': 'Kalyna', 'Aktivní': 'ANO' })[h] ?? ''));
M.sheets['Organizace'].appendRow(hd.map(h => ({ ID: 'KONEP', 'Název': 'KONEP', 'Aktivní': 'ANO' })[h] ?? ''));
const hdD = hlavicky_(M.sheets['Dobrovolníci']);
M.sheets['Dobrovolníci'].appendRow(hdD.map(h => ({ ID: 'DC-2026-0001', 'Jméno': 'Jan', 'Příjmení': 'Novák', 'E-mail': 'jan@x.cz', 'Stav': 'Aktivní dobrovolník' })[h] ?? ''));
pridejPrirazeni('T', 'DC-2026-0001', 'KAL', '', '');
const z = o => Object.assign({ dobrovolnik: 'DC-2026-0001', orgId: 'KAL', datum: '2026-10-10', cinnost: 'Doučování' }, o);
const uloz = o => ulozHodiny('T', z(o));
const minut = () => radkyHodin_().radky.map(r => r.minut);

over('od–do v pořádku (9:00–11:25 = 145 min)', !chyba(() => uloz({ od: '09:00', do: '11:25' })) && minut().includes(145));
over('0:00–24:00 = 1440 min', !chyba(() => uloz({ datum: '2026-10-11', od: '00:00', do: '24:00' })) && minut().includes(1440));
over('jen délka (bez od–do) odmítnuta', /od i do/.test(chyba(() => uloz({ minut: 60 }))));
over('chybí „do“', /od i do/.test(chyba(() => uloz({ od: '09:00' }))));
over('minuty ne po 5 odmítnuty', /po 5/.test(chyba(() => uloz({ od: '09:00', do: '11:23' }))));
over('hodina 25 odmítnuta', /od i do/.test(chyba(() => uloz({ od: '09:00', do: '25:00' }))));
over('24:30 odmítnuto', /od i do/.test(chyba(() => uloz({ od: '09:00', do: '24:30' }))));
over('do = od odmítnuto', /později/.test(chyba(() => uloz({ od: '09:00', do: '09:00' }))));
over('do před od (přes půlnoc) odmítnuto', /později/.test(chyba(() => uloz({ od: '22:00', do: '01:00' }))));
over('organizace povinná', /pro kterou organizaci/.test(chyba(() => uloz({ orgId: '', od: '09:00', do: '10:00' }))));
// akce používá stejná pravidla
over('akce bez od–do odmítnuta', /od i do/.test(chyba(() => ulozAkci('T', { orgId: 'KAL', datum: '2026-10-12', minut: 60, cinnost: 'X', dobrovolnici: ['DC-2026-0001'] }))));
// stará data bez od–do zůstávají platná, ale úprava vyžaduje od–do
const sh = M.sheets['Hodiny'], hh = hlavicky_(sh);
sh.appendRow(hh.map(h => ({ 'ID záznamu': 'H-STARY', 'ID dobrovolníka': 'DC-2026-0001', 'Datum': new Date(2026, 8, 5, 12), 'Počet hodin': 2, 'Organizace': 'Kalyna', 'ID organizace': 'KAL', 'Činnost': 'Staré', 'Stav': 'Schváleno', 'Minut': 120, 'Zdroj': 'Měsíční výkaz' })[h] ?? ''));
const stary = radkyHodin_().radky.find(r => r.id === 'H-STARY');
over('starý záznam bez od–do se čte (120 min)', stary && stary.minut === 120);
over('úprava starého záznamu bez od–do odmítnuta', /od i do/.test(chyba(() => uloz({ id: 'H-STARY', datum: '2026-09-05', cinnost: 'Staré' }))));
over('úprava starého záznamu s od–do projde', !chyba(() => uloz({ id: 'H-STARY', datum: '2026-09-05', od: '10:00', do: '12:30', cinnost: 'Staré' })) && radkyHodin_().radky.find(r => r.id === 'H-STARY').minut === 150);
over('akce „ulozVykaz“ už neexistuje v API', JSON.parse(doPost({ postData: { contents: JSON.stringify({ akce: 'ulozVykaz', token: 'T', args: [{}] }) } })).chyba === 'Neznámá akce.');
console.log(chyby ? 'CHYBA: ' + chyby : 'Čas hodin: vše OK');
process.exit(chyby ? 1 : 0);
