// Fáze D1: portál organizace – přihlášení, viditelnost jen vlastních dat, zápis hodin, fotky, zámky
process.env.TZ = 'Europe/Prague';
const M = require('./gas-mock.js');
require('./nacti-kod.js')();
overAdmin_ = () => { AKTUALNI_UZIVATEL = 'k@k.cz'; return { email: 'k@k.cz', role: 'Hlavní admin' }; };
log_ = () => {};
const disk = {}; let cislo = 0;
ulozSouborFotky_ = (d, nazev, bajty) => { const id = 'S' + (++cislo); disk[id] = bajty; return id; };
nactiSouborFotky_ = id => 'data:image/jpeg;base64,' + Buffer.from(disk[id]).toString('base64');
smazSouborFotky_ = id => { delete disk[id]; };
console.log = (o => (...a) => { if (!String(a[0]).startsWith('Hotovo')) o(...a); })(console.log);
let chyby = 0;
const over = (popis, ok) => { console.log((ok ? 'OK    ' : 'CHYBA ') + popis); if (!ok) chyby++; };
const chyba = fn => { try { fn(); return ''; } catch (e) { return e.message; } };
const api = (akce, token, ...args) => JSON.parse(doPost({ postData: { contents: JSON.stringify({ akce, token, args }) } }));
nastavTabulku();
nastavHodnotu_('zamykani_mesicu', 'ANO');   // testy zámků běží se zapnutým zamykáním
nastavHodnotu_('web_adresa', 'https://x.github.io/dk/');
const sh = M.sheets;
const hdO = hlavicky_(sh['Organizace']);
['KAL:Kalyna', 'HOS:Hospic', 'DOM:Domov'].forEach(s => { const [i, n] = s.split(':'); sh['Organizace'].appendRow(hdO.map(h => ({ ID: i, 'Název': n, 'Aktivní': 'ANO' })[h] ?? '')); });
const hdD = hlavicky_(sh['Dobrovolníci']);
[['0001', 'Jan', 'Novák'], ['0002', 'Eva', 'Malá'], ['0003', 'Petr', 'Cizí']].forEach(([i, j, p]) => sh['Dobrovolníci'].appendRow(hdD.map(h => ({ ID: 'DC-2026-' + i, 'Jméno': j, 'Příjmení': p, 'E-mail': j.toLowerCase() + '@x.cz', 'Telefon': '777' + i, 'Datum narození': new Date(1990, 0, 1), 'Ulice a č.p.': 'Tajná 1', 'Stav': 'Aktivní dobrovolník' })[h] ?? '')));
pridejPrirazeni('T', 'DC-2026-0001', 'KAL', '', '');
pridejPrirazeni('T', 'DC-2026-0001', 'HOS', '', '');
pridejPrirazeni('T', 'DC-2026-0002', 'KAL', '', '');
pridejPrirazeni('T', 'DC-2026-0003', 'HOS', '', '');
const rok = ymd_(new Date()).slice(0, 4), mesic = rok + '-03';
['DC-2026-0001', 'DC-2026-0003'].forEach(d => ulozHodiny('T', { dobrovolnik: d, orgId: 'HOS', datum: mesic + '-05', od: '09:00', do: '10:00', cinnost: 'X' }));
ulozHodiny('T', { dobrovolnik: 'DC-2026-0001', orgId: 'KAL', datum: mesic + '-06', od: '09:00', do: '11:00', cinnost: 'X' });
ulozHodiny('T', { dobrovolnik: 'DC-2026-0002', orgId: 'KAL', datum: mesic + '-06', od: '09:00', do: '11:00', cinnost: 'X' });
// koordinátor Kalyny (Karel), koordinátor Kalyny i Domova (Dana), neaktivní, cizí
const hdK = hlavicky_(sh['Koordinátoři organizací']);
const kr = (e, j, o, a) => sh['Koordinátoři organizací'].appendRow(hdK.map(h => ({ 'E-mail': e, 'Jméno': j, 'ID organizace': o, 'Aktivní': a })[h] ?? ''));
kr('karel@kal.cz', 'Karel', 'KAL', 'ANO'); kr('dana@kal.cz', 'Dana', 'KAL', 'ANO'); kr('dana@kal.cz', 'Dana', 'DOM', 'ANO'); kr('bily@hos.cz', 'Bílý', 'HOS', 'NE');

// přihlášení
over('neznámý e-mail: stejná odpověď, žádný e-mail', api('oPosliKod', '', 'nikdo@x.cz').ok === true && MAILS.length === 0);
over('neaktivní koordinátor se nepřihlásí (a nic se nezjistí)', api('oPosliKod', '', 'bily@hos.cz').ok === true && MAILS.length === 0);
over('kód pro koordinátora odešel', api('oPosliKod', '', 'KAREL@kal.cz').ok === true && MAILS.length === 1);
const mail = MAILS.pop(); const kod = mail.subject.match(/(\d{6})/)[1];
over('e-mail obsahuje odkaz na organizace.html', /organizace\.html\?vstup=[a-f0-9]{64}/.test(mail.body));
over('špatný kód odmítnut', /Nesprávný/.test(api('oOverKod', '', 'karel@kal.cz', '000000').chyba));
const T = api('oOverKod', '', 'karel@kal.cz', kod).data.token;
over('přihlášení kódem', !!T);
const t2 = mail.body.match(/vstup=([a-f0-9]{64})/)[1];
over('přihlášení odkazem', !!api('oPrihlasitOdkazem', '', t2).data.token);
over('token koordinátora organizace nefunguje jako token dobrovolníka', !api('dMojeData', T).ok);
over('token dobrovolníka nefunguje v portálu organizace', !api('oMojeData', 'cokoli').ok);

// viditelnost
let d = api('oMojeData', T).data;
over('Karel vidí jen Kalynu', d.organizace.length === 1 && d.organizace[0].id === 'KAL');
over('vidí jen dobrovolníky Kalyny (Jan, Eva), ne Petra', d.dobrovolnici.map(x => x.id).sort().join() === 'DC-2026-0001,DC-2026-0002');
over('jen jméno a kontakt – žádná adresa ani datum narození', !JSON.stringify(d).includes('Tajná') && !JSON.stringify(d).includes('1990') && d.dobrovolnici.every(x => x.telefon && x.email));
over('hodiny jen Kalyny (2), ne Hospicu', d.hodiny.length === 2 && d.hodiny.every(h => h.orgId === 'KAL'));
over('Jan má u Karla jen přiřazení ke Kalyně', d.dobrovolnici.find(x => x.id === 'DC-2026-0001').prirazeni.every(p => p.orgId === 'KAL'));

// zápis hodin
const z = o => Object.assign({ dobrovolnik: 'DC-2026-0001', orgId: 'KAL', datum: mesic + '-10', od: '10:00', do: '12:00', cinnost: 'Doučování' }, o);
d = api('oUlozHodiny', T, z({})).data;
const novy = d.hodiny.find(h => h.datum === mesic + '-10');
over('organizace zapsala hodiny, čekají na schválení', !!novy && novy.stav === 'Ke schválení' && novy.zdroj === 'Organizace' && novy.minut === 120);
over('role v historii a v hodinách', radkyHodin_().radky.find(r => r.id === novy.id).role === 'Koordinátor organizace' && sh['Historie hodin'].getDataRange().getValues().some(r => r[2] === 'Koordinátor organizace' && r[3] === 'Zápis'));
over('za jinou organizaci zapsat nejde', /oprávnění/.test(api('oUlozHodiny', T, z({ orgId: 'HOS' })).chyba));
over('za dobrovolníka bez přiřazení ke své organizaci nejde', /není přiřazený/.test(api('oUlozHodiny', T, z({ dobrovolnik: 'DC-2026-0003' })).chyba));
over('úprava vlastního zápisu', api('oUlozHodiny', T, z({ id: novy.id, od: '10:00', do: '11:00' })).ok && api('oMojeData', T).data.hodiny.find(h => h.id === novy.id).minut === 60);
const cizi = radkyHodin_().radky.find(r => r.orgId === 'HOS').id;
over('cizí záznam (Hospic) nejde upravit ani smazat', /nebyl nalezen/.test(api('oUlozHodiny', T, z({ id: cizi })).chyba) && /nebyl nalezen/.test(api('oSmazHodiny', T, cizi).chyba));
over('minulý rok nejde zapsat', /minulého roku/.test(api('oUlozHodiny', T, z({ datum: (rok - 1) + '-12-20' })).chyba));
over('budoucnost nejde zapsat', /budoucnosti/.test(api('oUlozHodiny', T, z({ datum: '2099-01-01' })).chyba));

// fotky
const jpeg = 'data:image/jpeg;base64,' + Buffer.from('JPEG').toString('base64');
let f = api('oNahrajFotkuVykazu', T, 'DC-2026-0001', 'KAL', mesic, jpeg);
over('fotka nahrána a organizace ji vidí', f.ok && f.data.fotky.length === 1 && api('oNactiFotkuVykazu', T, f.data.fotky[0].id).data.dataUrl === jpeg);
over('fotka pro cizí organizaci nejde', /oprávnění/.test(api('oNahrajFotkuVykazu', T, 'DC-2026-0001', 'HOS', mesic, jpeg).chyba));
const fotkaHos = (() => { ulozSouborFotky_('x', 'n', [1]); pridejFotkuVnitrni_({ email: 'k', role: 'x' }, 'DC-2026-0003', 'HOS', mesic, jpeg); return fotkyRadky_().radky.find(r => r.orgId === 'HOS').id; })();
over('cizí fotku (Hospic) organizace nevidí ani nesmaže', /nebyla nalezena/.test(api('oNactiFotkuVykazu', T, fotkaHos).chyba) && /nebyla nalezena/.test(api('oSmazFotkuVykazu', T, fotkaHos).chyba));

// zámek po schválení KONEP
schvalMesice('T', [{ dobrovolnik: 'DC-2026-0001', orgId: 'KAL', mesic }]);
over('v zamčeném měsíci organizace nezapíše, neupraví, nesmaže', /zamčený/.test(api('oUlozHodiny', T, z({ datum: mesic + '-11' })).chyba) && /Schválený|zamčený/.test(api('oSmazHodiny', T, novy.id).chyba) && /Schválený|zamčený/.test(api('oUlozHodiny', T, z({ id: novy.id })).chyba));
over('v zamčeném měsíci nejde měnit fotky', /zamčený/.test(api('oNahrajFotkuVykazu', T, 'DC-2026-0001', 'KAL', mesic, jpeg).chyba) && /zamčený/.test(api('oSmazFotkuVykazu', T, f.data.fotky[0].id).chyba));
over('příznak zamceno je vidět', api('oMojeData', T).data.hodiny.some(h => h.zamceno));

// Dana má dvě organizace
const TD = api('oOverKod', '', 'x', 'x').ok === false && (() => { api('oPosliKod', '', 'dana@kal.cz'); const k2 = MAILS.pop().subject.match(/(\d{6})/)[1]; return api('oOverKod', '', 'dana@kal.cz', k2).data.token; })();
over('Dana (Kalyna + Domov) vidí obě organizace', api('oMojeData', TD).data.organizace.length === 2);

// odebrání přístupu platí okamžitě
sh['Koordinátoři organizací'].getRange(2, 4).setValue('NE');
over('po odebrání ze seznamu přístup končí hned', /PRIHLASENI/.test(api('oMojeData', T).chyba));
over('odhlášení', (() => { const r = api('oOdhlasit', '', TD); return r.ok && /PRIHLASENI/.test(api('oMojeData', TD).chyba); })());
over('nastavení: seznam Koordinátoři organizací vznikl a je v Administraci', !!sh['Koordinátoři organizací'] && !!editovatelneListy_().KORDORG);

console.log(chyby ? 'Portál organizace: CHYBY ' + chyby : 'Portál organizace: vše OK');
if (chyby) process.exitCode = 1;
