// Organizace: úprava ID (s přepisem v Hodinách a Přiřazeních), IČ, adresa, kontaktní osoby
process.env.TZ = 'Europe/Prague';
const M = require('./gas-mock.js');
require('./nacti-kod.js')();
overAdmin_ = () => { AKTUALNI_UZIVATEL = 'k@k.cz'; return { email: 'k@k.cz', role: 'Hlavní admin' }; };
log_ = () => {};
let chyby = 0;
const over = (popis, ok) => { console.log((ok ? 'OK    ' : 'CHYBA ') + popis); if (!ok) chyby++; };
const chyba = fn => { try { fn(); return ''; } catch (e) { return e.message; } };
// stará tabulka: jen 9 sloupců, adresa v jednom sloupci
nastavTabulku();
const sh = M.sheets['Organizace'];
const hd = hlavicky_(sh);
const radek = o => hd.map(h => o[h] ?? '');
sh.appendRow(radek({ ID: 'ORG-001', 'Název': 'Kalyna', 'Kontaktní osoba': 'Petra', 'Adresa': 'Hlavní 5, Pardubice', 'Aktivní': 'ANO' }));
sh.appendRow(radek({ ID: 'ORG-002', 'Název': 'KONEP', 'Aktivní': 'ANO', 'Ulice': 'Sladkovského 1', 'Město': 'Pardubice', 'PSČ': '53002' }));
migrace_(M.ss || ss_());
over('migrace: stará Adresa → Ulice', String(sh.getRange(2, hd.indexOf('Ulice') + 1).getValue()) === 'Hlavní 5, Pardubice');
MEMO = { ss: MEMO.ss };
over('adresa z Ulice/PSČ/Město', organizace_().find(o => o.id === 'ORG-002').adresa === 'Sladkovského 1, 53002 Pardubice');
// hodiny a přiřazení s ORG-001
const hh = hlavicky_(M.sheets['Hodiny']), hp = hlavicky_(M.sheets['Přiřazení']);
M.sheets['Hodiny'].appendRow(hh.map(h => h === 'ID organizace' ? 'ORG-001' : h === 'ID' ? 'H1' : ''));
M.sheets['Přiřazení'].appendRow(hp.map(h => h === 'ID organizace' ? 'ORG-001' : h === 'ID přiřazení' ? 'P1' : ''));
const ulozit = (c, v, klic) => ulozBunkuListu('T', 'ORGANIZACE', 2, c, v, klic);
over('prázdné ID odmítnuto', /prázdné/.test(chyba(() => ulozit(0, '', 'ORG-001'))));
over('ID s mezerou odmítnuto', /mezer/.test(chyba(() => ulozit(0, 'MOJE ZKR', 'ORG-001'))));
over('duplicitní ID odmítnuto', /už má/.test(chyba(() => ulozit(0, 'org-002', 'ORG-001'))));
ulozit(0, 'KAL', 'ORG-001');
over('ID změněno v listu Organizace', String(sh.getRange(2, 1).getValue()) === 'KAL');
over('ID změněno v Hodinách', String(M.sheets['Hodiny'].getRange(2, hh.indexOf('ID organizace') + 1).getValue()) === 'KAL');
over('ID změněno v Přiřazeních', String(M.sheets['Přiřazení'].getRange(2, hp.indexOf('ID organizace') + 1).getValue()) === 'KAL');
MEMO = { ss: MEMO.ss };
over('organizace_() vrací nové ID', organizace_().some(o => o.id === 'KAL') && !organizace_().some(o => o.id === 'ORG-001'));
// IČ
over('IČ s 5 číslicemi odmítnuto', /8 číslic/.test(chyba(() => ulozit(18, '12345', 'KAL'))));
ulozit(18, '123 456 78', 'KAL');
over('IČ uloženo bez mezer', String(sh.getRange(2, hd.indexOf('IČ') + 1).getValue()) === '12345678');
// přidání
const pr = pridejRadekListu('T', 'ORGANIZACE', { id: 'CEDR', nazev: 'CEDR', ic: '87654321', mesto: 'Chrudim', ulice: 'Nová 2', psc: '53701', kontakt: 'Jana', funkce: 'ředitelka' });
over('přidání s vlastním ID', pr.listy.ORGANIZACE.radky.some(r => r.v[0] === 'CEDR' && r.v[hd.indexOf('Funkce / pozice')] === 'ředitelka' && r.v[hd.indexOf('Město')] === 'Chrudim'));
over('přidání bez ID → ORG-003', (() => { const p = pridejRadekListu('T', 'ORGANIZACE', { nazev: 'Další' }); return p.listy.ORGANIZACE.radky.some(r => r.v[0] === 'ORG-003'); })());
over('přidání s duplicitním ID odmítnuto', /už má/.test(chyba(() => pridejRadekListu('T', 'ORGANIZACE', { id: 'CEDR', nazev: 'X' }))));
console.log(chyby ? 'CHYBA: ' + chyby : 'Organizace: vše OK');
process.exit(chyby ? 1 : 0);
