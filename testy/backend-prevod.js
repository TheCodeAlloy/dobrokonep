// Fáze C3: převod dosavadního schvalování na měsíční zámky (náhled, záloha, provedení, opakování)
process.env.TZ = 'Europe/Prague';
const M = require('./gas-mock.js');
require('./nacti-kod.js')();
let role = 'Hlavní admin';
const P = { 'Jen čtení': 0, 'Koordinátor': 1, 'Hlavní admin': 2 };
overAdmin_ = (t, r) => { if (P[role] < P[r]) throw new Error('Nedostatečná role'); AKTUALNI_UZIVATEL = 'k@k.cz'; return { email: 'k@k.cz', role }; };
log_ = () => {};
let zalohaOk = true, zaloh = 0;
zalohaPredPrevodem_ = () => { if (!zalohaOk) throw new Error('Záloha se nepodařila'); zaloh++; return { nazev: 'Záloha test', url: 'https://drive/zaloha' }; };
let chyby = 0;
const over = (popis, ok) => { console.log((ok ? 'OK    ' : 'CHYBA ') + popis); if (!ok) chyby++; };
const chyba = fn => { try { fn(); return ''; } catch (e) { return e.message; } };
nastavTabulku();
const hdO = hlavicky_(M.sheets['Organizace']);
M.sheets['Organizace'].appendRow(hdO.map(h => ({ ID: 'KAL', 'Název': 'Kalyna', 'Aktivní': 'ANO' })[h] ?? ''));
const hdD = hlavicky_(M.sheets['Dobrovolníci']);
['0001:Jan:Novák', '0002:Eva:Malá'].forEach(s => { const [i, j, p] = s.split(':'); M.sheets['Dobrovolníci'].appendRow(hdD.map(h => ({ ID: 'DC-2026-' + i, 'Jméno': j, 'Příjmení': p, 'E-mail': j.toLowerCase() + '@x.cz', 'Stav': 'Aktivní dobrovolník' })[h] ?? '')); });
pridejPrirazeni('T', 'DC-2026-0001', 'KAL', '', '');
const hh = hlavicky_(M.sheets['Hodiny']);
let n = 0;
const radek = (d, org, datum, stav, extra) => M.sheets['Hodiny'].appendRow(hh.map(h => Object.assign({ 'ID záznamu': 'H' + (++n), 'ID dobrovolníka': d, 'Datum': new Date(+datum.slice(0, 4), +datum.slice(5, 7) - 1, +datum.slice(8, 10), 12), 'Organizace': 'Kalyna', 'ID organizace': org, 'Činnost': 'X', 'Stav': stav, 'Minut': 120, 'Počet hodin': 2, 'Potvrdila organizace': stav === 'Schváleno' ? 'stara@konep.cz – 5. 1. 2026 10:00' : '', 'Zapsal/a': 'z@z.cz' }, extra || {})[h] ?? ''));
const rok = ymd_(new Date()).slice(0, 4), dnesM = ymd_(new Date()).slice(0, 7);
// A: vše schváleno -> zamknout
radek('DC-2026-0001', 'KAL', rok + '-01-10', 'Schváleno'); radek('DC-2026-0001', 'KAL', rok + '-01-11', 'Schváleno');
// B: čeká na schválení -> otevřené
radek('DC-2026-0001', 'KAL', rok + '-02-10', 'Schváleno'); radek('DC-2026-0001', 'KAL', rok + '-02-11', 'Ke schválení');
// C: zamítnutý řádek -> otevřené a vypsat
radek('DC-2026-0002', 'KAL', rok + '-01-12', 'Schváleno'); radek('DC-2026-0002', 'KAL', rok + '-01-13', 'Zamítnuto');
// D: bez organizace
radek('DC-2026-0002', '', rok + '-01-20', 'Schváleno', { 'Organizace': 'Starý název' });
// E: probíhající měsíc všechno schváleno -> neuzamykat
radek('DC-2026-0002', 'KAL', dnesM + '-01', 'Schváleno');
// F: bez schvalovatele (zapsal/a) – jiný měsíc
radek('DC-2026-0002', 'KAL', (rok - 1) + '-11-05', 'Schváleno', { 'Potvrdila organizace': '' });

let r = nahledPrevoduSchvalovani('T');
const klic = g => g.dobrovolnik + g.mesic;
over('náhled: zamknou se 2 měsíce (leden Jan, listopad minulého roku Eva)', r.zamknout.length === 2 && r.zamknout.some(g => klic(g) === 'DC-2026-0001' + rok + '-01') && r.zamknout.some(g => klic(g) === 'DC-2026-0002' + (rok - 1) + '-11'));
over('náhled: schvalovatel z původních dat, jinak kdo zapsal', r.zamknout.find(g => g.mesic === rok + '-01').schvalil === 'stara@konep.cz' && r.zamknout.find(g => g.mesic === (rok - 1) + '-11').schvalil === 'z@z.cz');
over('náhled: leden Jan = 240 min', r.zamknout.find(g => g.mesic === rok + '-01').minut === 240);
over('náhled: otevřené jsou únor (čeká), leden Evy (zamítnuto) a probíhající měsíc', r.otevrene.length === 3 && r.otevrene.some(g => /čeká/.test(g.duvody)) && r.otevrene.some(g => /zamítnuto/.test(g.duvody)) && r.otevrene.some(g => /probíhá/.test(g.duvody)));
over('náhled: zamítnutý řádek vypsán', r.zamitnute.length === 1);
over('náhled: řádek bez organizace vypsán', r.bezOrganizace.length === 1 && r.bezOrganizace[0].org === 'Starý název');
over('náhled nic nezměnil', M.sheets['Měsíce'].getLastRow() <= 1 && zaloh === 0);

role = 'Koordinátor';
over('převod smí jen hlavní admin', /role/.test(chyba(() => provedPrevodSchvalovani('T'))) && /role/.test(chyba(() => nahledPrevoduSchvalovani('T'))));
role = 'Hlavní admin';
zalohaOk = false;
over('nepodaří-li se záloha, nic se nezmění', /Záloha/.test(chyba(() => provedPrevodSchvalovani('T'))) && M.sheets['Měsíce'].getLastRow() <= 1);
zalohaOk = true;
const v = provedPrevodSchvalovani('T');
over('převod: zamčeno 2, otevřených 3, záloha vytvořena', v.zamceno === 2 && v.otevrene === 3 && zaloh === 1);
over('list Měsíce má 2 zamčené řádky', M.sheets['Měsíce'].getLastRow() === 3 && M.sheets['Měsíce'].getDataRange().getValues().slice(1).every(rw => rw[3] === 'Schváleno'));
over('zamčené měsíce nejdou měnit', /zamčený/.test(chyba(() => ulozHodiny('T', { dobrovolnik: 'DC-2026-0001', orgId: 'KAL', datum: rok + '-01-15', od: '09:00', do: '10:00', cinnost: 'X' }))));
over('otevřený měsíc jde měnit', !chyba(() => ulozHodiny('T', { dobrovolnik: 'DC-2026-0001', orgId: 'KAL', datum: rok + '-02-15', od: '09:00', do: '10:00', cinnost: 'X' })));
over('opakování převodu nic nezdvojí', provedPrevodSchvalovani('T').zamceno === 0 && M.sheets['Měsíce'].getLastRow() === 3);
odemkniMesic('T', 'DC-2026-0001', 'KAL', rok + '-01', 'test');
over('odemčený měsíc se převodem znovu nezamkne', provedPrevodSchvalovani('T').zamceno === 0 && !mesicZamcen_('DC-2026-0001', 'KAL', rok + '-01-10'));
over('schválení jednotlivého řádku je zrušeno', /po celých měsících/.test(chyba(() => zmenStavHodin('T', ['H3'], 'Schváleno'))));
over('zamítnutí řádku dál funguje', !chyba(() => zmenStavHodin('T', ['H3'], 'Zamítnuto')));

console.log(chyby ? 'Převod: CHYBY ' + chyby : 'Převod: vše OK');
if (chyby) process.exitCode = 1;
