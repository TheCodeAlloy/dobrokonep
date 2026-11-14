// Tabulky organizací (krok 2): načítání řádků z tabulky organizace do databáze (tabulka je nahrazena pamětí)
process.env.TZ = 'Europe/Prague';
const M = require('./gas-mock.js');
require('./nacti-kod.js')();
let role = 'Koordinátor';
const P = { 'Jen čtení': 0, 'Koordinátor': 1, 'Hlavní admin': 2 };
overAdmin_ = (t, r) => { if (P[role] < P[r]) throw new Error('Nedostatečná role'); AKTUALNI_UZIVATEL = 'k@k.cz'; return { email: 'k@k.cz', role }; };
log_ = () => {};
console.log = (o => (...a) => { if (!String(a[0]).startsWith('Hotovo')) o(...a); })(console.log);
let chyby = 0;
const over = (popis, ok) => { console.log((ok ? 'OK    ' : 'CHYBA ') + popis); if (!ok) chyby++; };
const chyba = fn => { try { fn(); return ''; } catch (e) { return e.message; } };

// ---- věrná náhrada tabulky: listy s řádky; čtení vrací kopie, zápis stavů mění „tabulku“
const TAB = { 'TAB1': { 'Novák Jan (DC-2026-0001)': { dobrovolnik: 'DC-2026-0001', radky: [] }, 'Malá Eva (DC-2026-0002)': { dobrovolnik: 'DC-2026-0002', radky: [] } } };
let cislo = 0;
tabOrgVytvor_ = () => 'TAB1';
tabOrgNastavListy_ = () => {};
tabOrgSdilej_ = () => {};
tabOrgPrectiListy_ = id => Object.keys(TAB[id]).map(n => ({ list: n, dobrovolnik: TAB[id][n].dobrovolnik, radky: TAB[id][n].radky.filter(r => r.datum || r.od || r.do || r.cinnost || r.poznamka).map(r => Object.assign({}, r)) }));   // prázdné řádky skutečná funkce přeskakuje
tabOrgZapisStavy_ = (id, list, zmeny) => zmeny.forEach(z => { const r = TAB[id][list].radky.find(x => x.r === z.r); r.stav = z.stav; if (z.id) r.id = z.id; });
let trigger = false;
spoustecNacitaniExistuje_ = () => trigger; spoustecNacitaniNastav_ = z => { trigger = z; };
const radek = (list, o) => { const L = TAB.TAB1[list]; L.radky.push(Object.assign({ r: 5 + L.radky.length, datum: '', od: '', do: '', cinnost: '', poznamka: '', zneplatnit: false, stav: '', id: '' }, o)); return L.radky[L.radky.length - 1]; };

nastavTabulku();
const hdO = hlavicky_(M.sheets['Organizace']);
['KAL:Kalyna', 'HOS:Hospic'].forEach(s => { const [i, n] = s.split(':'); M.sheets['Organizace'].appendRow(hdO.map(h => ({ ID: i, 'Název': n, 'Aktivní': 'ANO' })[h] ?? '')); });
const hdD = hlavicky_(M.sheets['Dobrovolníci']);
[['0001', 'Jan', 'Novák'], ['0002', 'Eva', 'Malá']].forEach(([i, j, p]) => M.sheets['Dobrovolníci'].appendRow(hdD.map(h => ({ ID: 'DC-2026-' + i, 'Jméno': j, 'Příjmení': p, 'E-mail': j.toLowerCase() + '@x.cz', 'Stav': 'Aktivní dobrovolník' })[h] ?? '')));
pridejPrirazeni('T', 'DC-2026-0001', 'KAL', '', ''); pridejPrirazeni('T', 'DC-2026-0002', 'KAL', '', '');
const PAPIR = 'Organizace podle papírového výkazu';
const prId = (d, o) => prirazeni_().find(p => p.dobrovolnik === d && p.orgId === o).id;
nastavZpusobPrirazeni('T', prId('DC-2026-0001', 'KAL'), PAPIR);
nastavZpusobPrirazeni('T', prId('DC-2026-0002', 'KAL'), PAPIR);
const rok = ymd_(new Date()).slice(0, 4);
const JAN = 'Novák Jan (DC-2026-0001)', EVA = 'Malá Eva (DC-2026-0002)';
const db = () => radkyHodin_().radky.filter(z => z.zdroj === 'Tabulka organizace');

// 1) nové řádky
const r1 = radek(JAN, { datum: rok + '-02-10', od: '9:00', do: '11:30', cinnost: 'Doučování' });
const r2 = radek(JAN, { datum: rok + '-02-11', od: '13:00', do: '14:00', cinnost: 'Pomoc na akci', poznamka: 'výlet' });
const rChyba = radek(JAN, { datum: rok + '-02-12', od: '10:00', do: '09:00', cinnost: 'X' });
const rBezCinnosti = radek(JAN, { datum: rok + '-02-13', od: '10:00', do: '11:00', cinnost: '' });
const rBezCasu = radek(JAN, { datum: rok + '-02-14', cinnost: 'Doučování' });
const rBudoucnost = radek(JAN, { datum: '2099-01-01', od: '10:00', do: '11:00', cinnost: 'X' });
radek(JAN, {});   // prázdný řádek se přeskočí
const e1 = radek(EVA, { datum: rok + '-03-01', od: '8:00', do: '9:00', cinnost: 'Doučování' });
let s = nactiTabulkuOrganizace('T', 'KAL').souhrn;
over('načteny 4 nové řádky (Jan 3 včetně řádku bez činnosti, Eva 1), 3 chyby', s.novych === 4 && s.chyb === 3 && s.listu === 2);
over('v databázi 4 záznamy se zdrojem „Tabulka organizace“, čekají na schválení', db().length === 4 && db().every(z => z.stav === 'Ke schválení' && z.orgId === 'KAL'));
over('minuty a časy: 9:00–11:30 = 150 min', db().some(z => z.minut === 150 && z.od === '09:00' && z.do === '11:30'));
over('do tabulky se vrátil stav a ID záznamu', /^Načteno/.test(r1.stav) && r1.id.startsWith('H-') && /^Načteno/.test(e1.stav));
over('chybné řádky mají důvod ve sloupci Stav', /Chyba: .*později/.test(rChyba.stav) && /Chyba: .*čas/i.test(rBezCasu.stav) && /budoucnosti/.test(rBudoucnost.stav));
over('řádek bez činnosti se načetl (činnost není povinná)', /^Načteno/.test(rBezCinnosti.stav) && db().some(z => z.cinnost === '' && z.datum === rok + '-02-13'));
over('poznámka se přenesla', db().some(z => z.poznamka === 'výlet'));

// 2) opakované načtení nic nezdvojí
const pred = db().length;
s = nactiTabulkuOrganizace('T', 'KAL').souhrn;
over('druhé načtení: žádné nové, 4 beze změny, chyby zůstávají', s.novych === 0 && s.beze_zmeny === 4 && db().length === pred && s.chyb === 3);

// 3) změna řádku
r1.do = '12:00';
s = nactiTabulkuOrganizace('T', 'KAL').souhrn;
over('změna času se přenese do databáze (180 min) a záznam se vrátí ke schválení', s.zmenenych === 1 && db().find(z => z.id === r1.id).minut === 180);
// schválený a pak změněný záznam
const zapisStav = (id, st) => { const d = radkyHodin_(); const z = d.radky.find(q => q.id === id); zapisDoRadku_(d.sh, z.radek, d.hlav, { 'Stav': st }); };
zapisStav(r2.id, 'Schváleno');
r2.cinnost = 'Doučování';
nactiTabulkuOrganizace('T', 'KAL');
over('organizace ručí: změna schváleného řádku se zapíše a stav je znovu „Ke schválení“', db().find(z => z.id === r2.id).cinnost === 'Doučování' && db().find(z => z.id === r2.id).stav === 'Ke schválení');
over('v historii je zápis i úprava z tabulky', M.sheets['Historie hodin'].getDataRange().getValues().some(r => r[3] === 'Zápis z tabulky') && M.sheets['Historie hodin'].getDataRange().getValues().some(r => r[3] === 'Úprava z tabulky'));

// 4) zneplatnění řádku
r2.zneplatnit = true;
s = nactiTabulkuOrganizace('T', 'KAL').souhrn;
over('zneplatněný řádek: záznam je Zamítnuto (nezapočítává se), v tabulce stav „Zneplatněno“', s.zneplatnenych === 1 && db().find(z => z.id === r2.id).stav === 'Zamítnuto' && r2.stav === 'Zneplatněno');
over('zneplatněný řádek bez záznamu (chybný) nic nezpůsobí', (() => { rChyba.zneplatnit = true; const pr = db().length; nactiTabulkuOrganizace('T', 'KAL'); return db().length === pr && rChyba.stav === 'Zneplatněno'; })());
over('zneplatněný se příště nezapočítá ani se neobnoví', (() => { nactiTabulkuOrganizace('T', 'KAL'); return db().find(z => z.id === r2.id).stav === 'Zamítnuto'; })());

// 5) smazaný řádek v tabulce – nic se nemaže, jen se spočítá
TAB.TAB1[EVA].radky.length = 0;
s = nactiTabulkuOrganizace('T', 'KAL').souhrn;
over('smazaný řádek: záznam zůstává v databázi, počítá se „chybí v tabulce“', s.chybiVTabulce === 1 && db().some(z => z.id === e1.id));

// 6) dobrovolník už není papírový: řádky se nenačítají
nastavZpusobPrirazeni('T', prId('DC-2026-0002', 'KAL'), 'Sám');
const e2 = radek(EVA, { datum: rok + '-03-05', od: '8:00', do: '9:00', cinnost: 'Doučování' });
const prDb = db().length;
nactiTabulkuOrganizace('T', 'KAL');
over('nepapírový dobrovolník: řádek se nenačte a má vysvětlení', db().length === prDb && /nevykazuje podle papírového/.test(e2.stav));
// odstraněný záznam
const d = radkyHodin_(); const smaz = d.radky.find(z => z.id === r1.id); d.sh.deleteRow(smaz.radek);
nactiTabulkuOrganizace('T', 'KAL');
over('záznam odstraněný v systému se z tabulky znovu nevytvoří', !db().some(z => z.id === r1.id) && /odstraněn/.test(r1.stav));

// 7) poslední načtení a oprávnění
over('stav posledního načtení je vidět v přehledu', !!tabulkyOrganizaci('T').KAL.naposledy && tabulkyOrganizaci('T').KAL.souhrn.listu === 2);
role = 'Jen čtení';
over('jen čtení nesmí načítat', /role/.test(chyba(() => nactiTabulkuOrganizace('T', 'KAL'))) && /role/.test(chyba(() => nactiVsechnyTabulkyOrganizaci('T'))));
role = 'Koordinátor';
over('organizace bez tabulky: srozumitelná chyba', /ještě neexistuje/.test(chyba(() => nactiTabulkuOrganizace('T', 'HOS'))));
const v = nactiVsechnyTabulkyOrganizaci('T');
over('načtení všech tabulek (jen organizace, které tabulku mají)', v.organizaci === 1 && v.selhalo.length === 0);

// 8) portál organizace: Načíst teď jen u své organizace + limit
const hdK = hlavicky_(M.sheets['Koordinátoři organizací']);
M.sheets['Koordinátoři organizací'].appendRow(hdK.map(h => ({ 'E-mail': 'karel@kal.cz', 'Jméno': 'Karel', 'ID organizace': 'KAL', 'Aktivní': 'ANO' })[h] ?? ''));
const tok = 'tokO'; PropertiesService.getScriptProperties().setProperty('SESO_' + hash_(tok), JSON.stringify({ email: 'karel@kal.cz', exp: Date.now() + 1e9 }));
radek(JAN, { datum: rok + '-04-01', od: '9:00', do: '10:00', cinnost: 'Doučování' });
over('koordinátor organizace načte svou tabulku', oNactiTabulkuTed(tok, 'KAL').souhrn.novych === 1);
over('druhé klepnutí hned po prvním je omezené (1× za minutu)', /za minutu/.test(chyba(() => oNactiTabulkuTed(tok, 'KAL'))));
over('cizí organizace nejde', /oprávnění/.test(chyba(() => oNactiTabulkuTed(tok, 'HOS'))));
over('portál organizace vidí poslední načtení', !!oMojeData(tok).tabulky.KAL.naposledy);
over('hodiny z tabulky jsou vidět v portálu organizace se zdrojem', oMojeData(tok).hodiny.some(h => h.zdroj === 'Tabulka organizace'));

// 9) týdenní spouštěč
over('týdenní načítání je ve výchozím stavu vypnuté', stavTydenniNacitani('T').zapnuto === false);
role = 'Koordinátor';
over('zapnout smí jen hlavní admin', /role/.test(chyba(() => nastavTydenniNacitani('T', true))));
role = 'Hlavní admin';
over('zapnutí a vypnutí', nastavTydenniNacitani('T', true).zapnuto && stavTydenniNacitani('T').zapnuto && !nastavTydenniNacitani('T', false).zapnuto);
radek(JAN, { datum: rok + '-04-02', od: '9:00', do: '10:00', cinnost: 'Doučování' });
const predSp = db().length;
nactiTabulkyOrganizaciSpoustec();
over('spouštěč načte tabulky bez přihlášení', db().length === predSp + 1);

console.log(chyby ? 'Načítání tabulek: CHYBY ' + chyby : 'Načítání tabulek: vše OK');
if (chyby) process.exitCode = 1;
