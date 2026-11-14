// Fáze C2: fotky papírových výkazů (Disk je nahrazen pamětí), způsob vykazování
process.env.TZ = 'Europe/Prague';
const M = require('./gas-mock.js');
require('./nacti-kod.js')();
let role = 'Koordinátor';
const P = { 'Jen čtení': 0, 'Koordinátor': 1, 'Hlavní admin': 2 };
overAdmin_ = (t, r) => { if (P[role] < P[r]) throw new Error('Nedostatečná role'); AKTUALNI_UZIVATEL = 'k@k.cz'; return { email: 'k@k.cz', role }; };
let kdo = 'DC-2026-0001';
overDobrovolnik_ = () => ({ id: kdo, email: 'x@x.cz', z: { 'Jméno': 'Jan', 'Příjmení': 'Novák', 'Způsob vykazování': 'Organizace podle papírového výkazu' } });
log_ = () => {};
const disk = {}; let cislo = 0;
ulozSouborFotky_ = (d, nazev, bajty) => { const id = 'SOUBOR' + (++cislo); disk[id] = { d, nazev, bajty }; return id; };
nactiSouborFotky_ = id => { if (!disk[id]) throw new Error('není'); return 'data:image/jpeg;base64,' + Buffer.from(disk[id].bajty).toString('base64'); };
smazSouborFotky_ = id => { delete disk[id]; };
let chyby = 0;
const over = (popis, ok) => { console.log((ok ? 'OK    ' : 'CHYBA ') + popis); if (!ok) chyby++; };
const chyba = fn => { try { fn(); return ''; } catch (e) { return e.message; } };
nastavTabulku();
const hd = hlavicky_(M.sheets['Organizace']);
M.sheets['Organizace'].appendRow(hd.map(h => ({ ID: 'KAL', 'Název': 'Kalyna', 'Aktivní': 'ANO' })[h] ?? ''));
M.sheets['Organizace'].appendRow(hd.map(h => ({ ID: 'HOS', 'Název': 'Hospic', 'Aktivní': 'ANO' })[h] ?? ''));
const hdD = hlavicky_(M.sheets['Dobrovolníci']);
['0001:Jan:Novák', '0002:Eva:Malá'].forEach(s => { const [i, j, p] = s.split(':'); M.sheets['Dobrovolníci'].appendRow(hdD.map(h => ({ ID: 'DC-2026-' + i, 'Jméno': j, 'Příjmení': p, 'E-mail': j.toLowerCase() + '@x.cz', 'Stav': 'Aktivní dobrovolník', 'Způsob vykazování': i === '0001' ? 'Organizace podle papírového výkazu' : '' })[h] ?? '')); });
pridejPrirazeni('T', 'DC-2026-0001', 'KAL', '', '');
pridejPrirazeni('T', 'DC-2026-0002', 'KAL', '', '');
const rok = ymd_(new Date()).slice(0, 4), mesic = rok + '-02';
const jpeg = 'data:image/jpeg;base64,' + Buffer.from('JPEGDATA').toString('base64');
ulozHodiny('T', { dobrovolnik: 'DC-2026-0001', orgId: 'KAL', datum: mesic + '-10', od: '09:00', do: '11:00', cinnost: 'X' });
ulozHodiny('T', { dobrovolnik: 'DC-2026-0002', orgId: 'KAL', datum: mesic + '-10', od: '09:00', do: '11:00', cinnost: 'X' });

// koordinátor nahrává
const r = nahrajFotkuVykazu('T', 'DC-2026-0001', 'KAL', mesic, jpeg);
over('fotka nahrána, seznam neobsahuje odkazy na soubory', r.fotky.length === 1 && !JSON.stringify(r.fotky).includes('SOUBOR'));
over('soubor je na „Disku“', Object.keys(disk).length === 1);
const idF = r.fotky[0].id;
over('zobrazení fotky přes API vrací data', nactiFotkuVykazu('T', idF).dataUrl === jpeg);
over('jiný formát než JPEG odmítnut', /JPEG/.test(chyba(() => nahrajFotkuVykazu('T', 'DC-2026-0001', 'KAL', mesic, 'data:image/png;base64,AAAA'))));
over('obří fotka odmítnuta', /velká/.test(chyba(() => nahrajFotkuVykazu('T', 'DC-2026-0001', 'KAL', mesic, 'data:image/jpeg;base64,' + 'A'.repeat(MAX_FOTKA_ZNAKU + 4)))));
over('organizace, ke které není přiřazen, odmítnuta', /přiřazený/.test(chyba(() => nahrajFotkuVykazu('T', 'DC-2026-0001', 'HOS', mesic, jpeg))));
for (let i = 0; i < 9; i++) nahrajFotkuVykazu('T', 'DC-2026-0001', 'KAL', mesic, jpeg);
over('nejvýše 10 fotek za měsíc', /nejvýše 10/.test(chyba(() => nahrajFotkuVykazu('T', 'DC-2026-0001', 'KAL', mesic, jpeg))));
role = 'Jen čtení';
over('jen čtení nesmí nahrávat', /role/.test(chyba(() => nahrajFotkuVykazu('T', 'DC-2026-0001', 'KAL', rok + '-03', jpeg))));
over('jen čtení smí fotky číst', fotkyVykazu('T', 'DC-2026-0001').fotky.length === 10);
role = 'Koordinátor';

// přehled měsíců ukazuje fotky a způsob
const rad = nactiMesice('T', { rok }).radky;
const jan = rad.find(g => g.dobrovolnik === 'DC-2026-0001'), eva = rad.find(g => g.dobrovolnik === 'DC-2026-0002');
over('přehled: Jan má 10 fotek a papírový způsob, Eva 0 a sama', jan.fotek === 10 && jan.papir && eva.fotek === 0 && !eva.papir);

// dobrovolník: jen své
kdo = 'DC-2026-0002';
over('dobrovolník nevidí cizí fotku', /nebyla nalezena/.test(chyba(() => dNactiFotkuVykazu('T', idF))));
over('dobrovolník nesmaže cizí fotku', /nebyla nalezena/.test(chyba(() => dSmazFotkuVykazu('T', idF))));
kdo = 'DC-2026-0001';
over('dobrovolník vidí svou fotku', dNactiFotkuVykazu('T', idF).dataUrl === jpeg);
const rd = dNahrajFotkuVykazu('T', 'KAL', rok + '-04', jpeg);
over('dobrovolník nahraje fotku, portál ji vrací', rd.fotky.length === 11 && dMojeData('T').fotky.length === 11 && dMojeData('T').zpusob === 'Organizace podle papírového výkazu');
over('minulý rok dobrovolník nenahraje', /minulého roku/.test(chyba(() => dNahrajFotkuVykazu('T', 'KAL', (rok - 1) + '-12', jpeg))));

// zámek měsíce chrání i fotky
schvalMesice('T', [{ dobrovolnik: 'DC-2026-0001', orgId: 'KAL', mesic }]);
over('do zamčeného měsíce nejde přidat fotku', /zamčený/.test(chyba(() => nahrajFotkuVykazu('T', 'DC-2026-0001', 'KAL', mesic, jpeg))));
over('ze zamčeného měsíce nejde smazat fotku', /zamčený/.test(chyba(() => smazFotkuVykazu('T', idF))));
over('dobrovolník nesmaže fotku ze zamčeného měsíce', /zamčený/.test(chyba(() => dSmazFotkuVykazu('T', idF))));
const idDruha = fotkyVykazu('T', 'DC-2026-0001').fotky.find(f => f.mesic === rok + '-04').id;
smazFotkuVykazu('T', idDruha);
over('smazání fotky v otevřeném měsíci odstraní i soubor', fotkyVykazu('T', 'DC-2026-0001').fotky.length === 10 && Object.keys(disk).length === 10);
over('historie eviduje fotky', M.sheets['Historie hodin'].getDataRange().getValues().some(r => r[3] === 'Fotka výkazu smazána'));

// způsob vykazování se dá upravit jen na platnou hodnotu
over('platný způsob uložen', !chyba(() => ulozPole('T', 'DC-2026-0002', 'Způsob vykazování', 'Organizace podle papírového výkazu')));
over('neplatný způsob odmítnut', /způsob/.test(chyba(() => ulozPole('T', 'DC-2026-0002', 'Způsob vykazování', 'blbost'))));

console.log(chyby ? 'Fotky: CHYBY ' + chyby : 'Fotky: vše OK');
if (chyby) process.exitCode = 1;
