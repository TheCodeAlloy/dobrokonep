// Mapa činností (činnost × organizace)
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
const mapa = () => cinnosti_().map(c => c.org + '|' + c.cinnost);
const VSE = 'Všechny organizace';
pridejCinnost('T', 'Pomoc na akcích');
over('nová činnost: nabízí se u všech', mapa().includes(VSE + '|Pomoc na akcích'));
over('duplicitní činnost odmítnuta', /už v seznamu/.test(chyba(() => pridejCinnost('T', 'pomoc na akcích'))));
// odškrtnout „Všechny“ a zaškrtnout jen Kalynu
nastavCinnost('T', 'Pomoc na akcích', VSE, false);
nastavCinnost('T', 'Pomoc na akcích', 'Kalyna', true);
over('jen Kalyna po odškrtnutí „Všechny“', mapa().includes('Kalyna|Pomoc na akcích') && !mapa().includes(VSE + '|Pomoc na akcích') && !mapa().includes('KONEP|Pomoc na akcích'));
// výběr zůstává po zaškrtnutí/odškrtnutí „Všechny“ (nic se nemaže)
nastavCinnost('T', 'Pomoc na akcích', VSE, true);
nastavCinnost('T', 'Pomoc na akcích', VSE, false);
over('výběr Kalyny přežil přepnutí „Všechny“', mapa().includes('Kalyna|Pomoc na akcích'));
over('neznámá organizace odmítnuta', /Neznámá/.test(chyba(() => nastavCinnost('T', 'Pomoc na akcích', 'Neexistuje', true))));
// přejmenování
prejmenujCinnost('T', 'Pomoc na akcích', 'Pomoc při akcích');
over('přejmenování', mapa().includes('Kalyna|Pomoc při akcích') && !mapa().some(x => x.endsWith('|Pomoc na akcích')));
// smazání
smazCinnost('T', 'Pomoc při akcích');
over('smazání odstraní všechny řádky činnosti', !mapa().some(x => x.endsWith('|Pomoc při akcích')));
over('ostatní činnosti zůstaly', mapa().length > 0);
console.log(chyby ? 'CHYBA: ' + chyby : 'Činnosti: vše OK');
process.exit(chyby ? 1 : 0);
