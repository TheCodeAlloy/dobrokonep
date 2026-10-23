process.env.TZ='Europe/Prague';
const M = require('./gas-mock.js');
require('./nacti-kod.js')();
const adminTok = 'ADMIN';
const realOver = overAdmin_;
overAdmin_ = (t, r) => { if (t!==adminTok) throw new Error('PRIHLASENI: x'); AKTUALNI_UZIVATEL='k@k.cz'; return {email:'k@k.cz', role:'Koordinátor'}; };
log_ = () => {};
const api = (akce, token, ...args) => JSON.parse(doPost({postData:{contents: JSON.stringify({akce, token, args})}}));
console.log = (o => (...a) => { if (!String(a[0]).startsWith('Hotovo')) o(...a); })(console.log);
nastavTabulku();
nastavHodnotu_('web_adresa','https://x.github.io/dk/');
const sh=M.sheets;
sh['Organizace'].appendRow(['ORG-001', 'Charita', '', '', '', '', '', 'ANO', '']);
sh['Organizace'].appendRow(['ORG-002', 'Hospic', '', '', '', '', '', 'ANO', '']);
const hd = hlavicky_(sh['Dobrovolníci']); const row = o => hd.map(h => o[h] ?? '');
sh['Dobrovolníci'].appendRow(row({ID:'DC-2026-0001','Jméno':'Jan','Příjmení':'Novák','E-mail':'jan@x.cz','Stav':'Aktivní dobrovolník'}));
sh['Dobrovolníci'].appendRow(row({ID:'DC-2026-0002','Jméno':'Eva','Příjmení':'Malá','E-mail':'eva@x.cz','Stav':'Nový zájemce'}));
pridejPrirazeni(adminTok,'DC-2026-0001','ORG-001','','');
pridejPrirazeni(adminTok,'DC-2026-0001','ORG-002','2026-10-15','');
// admin zpětně – i před datem přiřazení k ORG-002
console.log('admin zpětně:', api('ulozHodiny', adminTok, {dobrovolnik:'DC-2026-0001', orgId:'ORG-002', datum:'2025-03-01', minut:60, cinnost:'X'}).ok);
// kód
console.log('kód pro nového zájemce (bez přístupu):', api('dPosliKod','', 'eva@x.cz').ok, 'mailů:', MAILS.length);
console.log('kód:', api('dPosliKod','', 'JAN@x.cz').ok, MAILS.length);
const m = MAILS.pop(); const kod = m.subject.match(/(\d{6})/)[1];
console.log('předmět:', m.subject, '| odkaz v textu:', /hodiny\.html\?vstup=[a-f0-9]{64}/.test(m.body), '| tlačítko v HTML:', m.htmlBody.includes('Přihlásit se</a>'));
console.log('špatný kód:', api('dOverKod','', 'jan@x.cz','000000').chyba);
const r = api('dOverKod','', 'jan@x.cz', kod); const T = r.data.token; console.log('přihlášen:', !!T);
// odkaz z e-mailu funguje opakovaně (10 min)
const t = m.body.match(/vstup=([a-f0-9]{64})/)[1];
console.log('odkaz 1×:', !!api('dPrihlasitOdkazem','',t).data.token, '2×:', !!api('dPrihlasitOdkazem','',t).data.token);
let d = api('dMojeData', T).data;
console.log('moje data:', d.dobrovolnik.jmeno, d.organizace.map(o=>o.nazev+'('+o.cinnosti.length+')'), 'hodin:', d.hodiny.length, 'zpětně', d.zpetneDni);
const dnes = d.dnes;
const minus = n => { const x=new Date(); x.setDate(x.getDate()-n); return x.toISOString().slice(0,10); };
for (const [popis, z] of [['před přiřazením ORG-002', {orgId:'ORG-002', datum:'2026-10-01', minut:60, cinnost:'A'}], ['>60 dní', {orgId:'ORG-001', datum:minus(70), minut:60, cinnost:'A'}], ['budoucnost', {orgId:'ORG-001', datum:'2099-01-01', minut:60, cinnost:'A'}], ['cizí dobrovolník', {orgId:'ORG-001', datum:dnes, minut:60, cinnost:'A', dobrovolnik:'DC-2026-0002'}]]) {
  const x = api('dZapisHodiny', T, z); console.log(popis+':', x.ok ? 'PROŠLO' + (popis==='cizí dobrovolník' ? ' (zapsáno pod '+x.data.hodiny[0].id+' vlastní ID ok)' : ' CHYBA') : x.chyba);
}
d = api('dZapisHodiny', T, {orgId:'ORG-001', datum:minus(3), od:'09:00', do:'11:30', cinnost:'Pomoc na akci'}).data;
const moje = d.hodiny.find(h=>h.cinnost==='Pomoc na akci');
console.log('zápis:', moje.minut, moje.stav, moje.zdroj, '| vlastník', radkyHodin_().radky.find(x=>x.id===moje.id).dobrovolnik);
d = api('dZapisHodiny', T, Object.assign({}, moje, {minut:0, od:'09:00', do:'12:00'})).data;
console.log('úprava:', d.hodiny.find(h=>h.id===moje.id).minut);
// admin schválí → dobrovolník nemůže měnit
api('zmenStavHodin', adminTok, [moje.id], 'Schváleno');
console.log('změna schváleného:', api('dZapisHodiny', T, Object.assign({}, moje)).chyba);
console.log('smazání schváleného:', api('dSmazHodiny', T, moje.id).chyba);
// admin data – přehled ke schválení
const ke = api('dMojeData', T).data.hodiny.filter(h=>h.stav==='Ke schválení'); console.log('ke schválení u dobrovolníka:', ke.length);
console.log('smazání neschváleného:', api('dSmazHodiny', T, ke[0].id).ok);
// pozvánka
MAILS.length = 0;
console.log('pozvánka Eva (není aktivní):', api('posliPozvankuPortal', adminTok, 'DC-2026-0002').chyba);
const pz = api('posliPozvankuPortal', adminTok, 'DC-2026-0001'); console.log('pozvánka Jan:', pz.ok, '| sloupec:', pz.data.zaznam['Pozvánka do portálu'] ? 'vyplněn' : 'prázdný');
const pm = MAILS.pop(); console.log('pozvánka předmět:', pm.subject, '| tlačítko:', pm.htmlBody.includes('Otevřít moje dobrovolnické hodiny</a>'));
const pt = pm.body.match(/vstup=([a-f0-9]{64})/)[1];
const T2 = api('dPrihlasitOdkazem','',pt).data.token; console.log('pozvánka přihlásí:', !!T2, 'znovu:', !!api('dPrihlasitOdkazem','',pt).data.token);
// odhlásit všude
console.log('odhlásit všude:', api('dOdhlasitVsude', T2).data.pocet, '| starý token:', api('dMojeData', T).chyba);
// deaktivace
const T3 = api('dOverKod','', 'jan@x.cz', (api('dPosliKod','', 'jan@x.cz'), CacheService)) ; // jen kvůli throttlingu
const hdr = hlavicky_(sh['Dobrovolníci']);
const T4 = api('dPrihlasitOdkazem','',pt).data.token;
zapisDoRadku_(sh['Dobrovolníci'], 2, hdr, {'Stav':'Neaktivní'});
console.log('po deaktivaci:', api('dMojeData', T4).chyba);
console.log('odkaz po deaktivaci:', api('dPrihlasitOdkazem','',pt).chyba);
console.log('admin akce s tokenem dobrovolníka:', api('nactiData', T4).chyba);
