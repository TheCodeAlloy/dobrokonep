// Fáze C1: měsíční schvalování, zámky měsíců, historie změn, minulé roky pro dobrovolníky
process.env.TZ = 'Europe/Prague';
const M = require('./gas-mock.js');
require('./nacti-kod.js')();
let role = 'Koordinátor';
const P = { 'Jen čtení': 0, 'Koordinátor': 1, 'Hlavní admin': 2 };
overAdmin_ = (t, r) => { if (P[role] < P[r]) throw new Error('Nedostatečná role'); AKTUALNI_UZIVATEL = 'k@k.cz'; return { email: 'k@k.cz', role }; };
overDobrovolnik_ = () => ({ id: 'DC-2026-0001', email: 'jan@x.cz', z: { 'Jméno': 'Jan', 'Příjmení': 'Novák' } });
log_ = () => {};
let chyby = 0;
const over = (popis, ok) => { console.log((ok ? 'OK    ' : 'CHYBA ') + popis); if (!ok) chyby++; };
const chyba = fn => { try { fn(); return ''; } catch (e) { return e.message; } };
nastavTabulku();
nastavHodnotu_('zamykani_mesicu', 'ANO');   // testy zámků běží se zapnutým zamykáním
const hd = hlavicky_(M.sheets['Organizace']);
M.sheets['Organizace'].appendRow(hd.map(h => ({ ID: 'KAL', 'Název': 'Kalyna', 'Aktivní': 'ANO' })[h] ?? ''));
M.sheets['Organizace'].appendRow(hd.map(h => ({ ID: 'HOS', 'Název': 'Hospic', 'Aktivní': 'ANO' })[h] ?? ''));
const hdD = hlavicky_(M.sheets['Dobrovolníci']);
['0001:Jan:Novák', '0002:Eva:Malá'].forEach(s => { const [i, j, p] = s.split(':'); M.sheets['Dobrovolníci'].appendRow(hdD.map(h => ({ ID: 'DC-2026-' + i, 'Jméno': j, 'Příjmení': p, 'E-mail': j.toLowerCase() + '@x.cz', 'Stav': 'Aktivní dobrovolník' })[h] ?? '')); });
['DC-2026-0001', 'DC-2026-0002'].forEach(d => { pridejPrirazeni('T', d, 'KAL', '', ''); });
pridejPrirazeni('T', 'DC-2026-0001', 'HOS', '', '');
const dnes = ymd_(new Date()), rok = dnes.slice(0, 4);
const z = o => Object.assign({ dobrovolnik: 'DC-2026-0001', orgId: 'KAL', datum: rok + '-02-10', od: '09:00', do: '11:00', cinnost: 'Doučování' }, o);
const hod = () => radkyHodin_().radky;

// zápis, historie, role zapisujícího
ulozHodiny('T', z({}));
ulozHodiny('T', z({ datum: rok + '-02-11' }));
ulozHodiny('T', z({ orgId: 'HOS', datum: rok + '-02-12' }));
ulozHodiny('T', z({ dobrovolnik: 'DC-2026-0002', datum: rok + '-02-10' }));
over('zápis uložen s rolí zapisujícího', hod().length === 4 && hod().every(r => r.role === 'Koordinátor'));
const hist = () => M.sheets['Historie hodin'].getDataRange().getValues().slice(1);
over('historie: 4 zápisy', hist().length === 4 && hist().every(r => r[3] === 'Zápis' && r[2] === 'Koordinátor'));

// přehled měsíců
let pr = nactiMesice('T', { stav: 'ke', rok });
over('přehled: 3 dvojice dobrovolník+organizace za únor', pr.radky.length === 3 && pr.radky.every(r => r.mesic === rok + '-02' && !r.zamceno));
const jan = pr.radky.find(r => r.dobrovolnik === 'DC-2026-0001' && r.orgId === 'KAL');
over('Jan u Kalyny: 2 záznamy, 240 min', jan.pocet === 2 && jan.minut === 240);

// schválení měsíce
const v = schvalMesice('T', [{ dobrovolnik: 'DC-2026-0001', orgId: 'KAL', mesic: rok + '-02' }]);
over('schválení měsíce prošlo', v.pocet === 1 && !v.chyby.length);
over('druhé schválení téhož měsíce odmítnuto', schvalMesice('T', [{ dobrovolnik: 'DC-2026-0001', orgId: 'KAL', mesic: rok + '-02' }]).chyby.length === 1);
over('list Měsíce má řádek se stavem Schváleno a 240 min', (() => { const r = M.sheets['Měsíce'].getDataRange().getValues()[1]; return r[3] === 'Schváleno' && r[9] === 240; })());
over('záznamy v zamčeném měsíci mají příznak zamceno', nactiHodiny('T', { dobrovolnik: 'DC-2026-0001' }).zaznamy.filter(r => r.zamceno).length === 2);

// zámek
const idZ = hod().find(r => r.dobrovolnik === 'DC-2026-0001' && r.orgId === 'KAL').id;
over('úprava v zamčeném měsíci odmítnuta', /zamčený/.test(chyba(() => ulozHodiny('T', z({ id: idZ, od: '09:00', do: '10:00' })))));
over('nový zápis do zamčeného měsíce odmítnut', /zamčený/.test(chyba(() => ulozHodiny('T', z({ datum: rok + '-02-20' })))));
over('smazání v zamčeném měsíci odmítnuto', /zamčený/.test(chyba(() => smazHodiny('T', [idZ]))));
over('změna stavu v zamčeném měsíci odmítnuta', /zamčený/.test(chyba(() => zmenStavHodin('T', [idZ], 'Zamítnuto'))));
over('zápis do jiného měsíce téhož dobrovolníka projde', !chyba(() => ulozHodiny('T', z({ datum: rok + '-03-05' }))));
over('zámek se nepřenáší na jinou organizaci', !chyba(() => ulozHodiny('T', z({ orgId: 'HOS', datum: rok + '-02-14' }))));

// akce: je-li měsíc zamčený u kohokoli, nic se neuloží
const pred = hod().length;
const e = chyba(() => ulozAkci('T', { orgId: 'KAL', datum: rok + '-02-15', od: '10:00', do: '12:00', cinnost: 'Akce', dobrovolnici: ['DC-2026-0001', 'DC-2026-0002'] }));
over('akce: nic se neuložilo a je vypsáno, u koho', /Nic se neuložilo/.test(e) && /Jan Novák/.test(e) && !/Eva/.test(e) && hod().length === pred);
over('akce bez zamčených projde', !chyba(() => ulozAkci('T', { orgId: 'KAL', datum: rok + '-02-15', od: '10:00', do: '12:00', cinnost: 'Akce', dobrovolnici: ['DC-2026-0002'] })));

// odemčení
role = 'Koordinátor';
over('odemknout nesmí koordinátor', /role/.test(chyba(() => odemkniMesic('T', 'DC-2026-0001', 'KAL', rok + '-02', 'oprava'))));
role = 'Hlavní admin';
over('odemčení bez důvodu odmítnuto', /důvod/.test(chyba(() => odemkniMesic('T', 'DC-2026-0001', 'KAL', rok + '-02', ''))));
odemkniMesic('T', 'DC-2026-0001', 'KAL', rok + '-02', 'překlep v čase');
const rm = M.sheets['Měsíce'].getDataRange().getValues()[1];
over('odemčení se zaznamená (stav, kdo, důvod)', rm[3] === 'Odemčeno' && rm[6] === 'k@k.cz' && rm[8] === 'překlep v čase');
over('po odemčení jde měsíc upravit', !chyba(() => ulozHodiny('T', z({ id: idZ, od: '09:00', do: '10:00' }))));
over('historie obsahuje odemčení a schválení', hist().some(r => r[3] === 'Odemčení měsíce') && hist().some(r => r[3] === 'Schválení měsíce'));
role = 'Koordinátor';
over('měsíc lze znovu schválit (znovu jen jeden řádek v listu)', schvalMesice('T', [{ dobrovolnik: 'DC-2026-0001', orgId: 'KAL', mesic: rok + '-02' }]).pocet === 1 && M.sheets['Měsíce'].getLastRow() === 2);

// portál: minulý rok a zámek
const ulozP = o => dZapisHodiny('T', Object.assign({ orgId: 'KAL', od: '09:00', do: '10:00', cinnost: 'X', datum: dnes }, o));
over('portál: zápis dnes projde', !chyba(() => ulozP({})));
over('portál: minulý rok odmítnut', /minulého roku|zpětně/.test(chyba(() => ulozP({ datum: (rok - 1) + '-12-20' }))));
const idP = hod().find(r => r.zdroj === 'Dobrovolník').id;
over('portál: dnešní zápis jde smazat', !chyba(() => dSmazHodiny('T', idP)));
ulozHodiny('T', { dobrovolnik: 'DC-2026-0001', orgId: 'KAL', datum: (rok - 1) + '-12-20', od: '09:00', do: '10:00', cinnost: 'Starý' });
const idStary = hod().find(r => r.datum === (rok - 1) + '-12-20').id;
over('koordinátor smí zapsat do minulého roku (KONEP)', !!idStary);
over('portál: smazání zápisu z minulého roku odmítnuto', /minulého roku|Schválený/.test(chyba(() => dSmazHodiny('T', idStary))));
over('portál vrací příznak zamceno', dMojeData('T').hodiny.every(h => typeof h.zamceno === 'boolean'));
M.sheets['Historie hodin'].getDataRange().getValues().slice(1).forEach(r => { if (/\d+\.\d+\.\d+\.\d+/.test(r.join(' '))) { console.log('CHYBA: IP adresa v historii'); chyby++; } });

console.log(chyby ? 'Měsíce: CHYBY ' + chyby : 'Měsíce: vše OK');
if (chyby) process.exitCode = 1;
