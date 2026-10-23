process.env.TZ='Europe/Prague';
const M = require('./gas-mock.js');
require('./nacti-kod.js')();
let role='Hlavní admin';
overAdmin_ = (t, r) => { const P={'Jen čtení':0,'Koordinátor':1,'Hlavní admin':2}; if (P[role]<P[r]) throw new Error('role'); AKTUALNI_UZIVATEL='a@b.cz'; return {email:'a@b.cz', role}; };
log_ = () => {};
nastavTabulku();
const sh=M.sheets;
// organizace + dobrovolníci
sh['Organizace'].appendRow(['', 'Charita Pardubice', '', '', '', '', '', 'ANO', '']);
sh['Organizace'].appendRow(['ORG-005', 'Hospic Chrudim', '', '', '', '', '', 'ANO', '']);
const hd = hlavicky_(sh['Dobrovolníci']);
const row = o => hd.map(h => o[h] ?? '');
sh['Dobrovolníci'].appendRow(row({ID:'DC-2026-0001', 'Jméno':'Jan','Příjmení':'Novák','Organizace':'Hospic Chrudim','Dobrovolníkem od': new Date(2026,0,1,12)}));
sh['Dobrovolníci'].appendRow(row({ID:'DC-2026-0002', 'Jméno':'Eva','Příjmení':'Malá'}));
nastavTabulku(); // znovu – doplní ID organizací a převede staré pole Organizace
const org = organizace_(); console.log('orgs', org.map(o=>o.id+' '+o.nazev));
console.log('převedeno', prirazeni_().map(p=>p.dobrovolnik+'→'+p.org+' od '+p.od));
console.log('činnosti', cinnosti_().length);
pridejPrirazeni('t','DC-2026-0002', org[0].id, '2026-09-01', '');
pridejPrirazeni('t','DC-2026-0001', org[0].id, '', '');
try { pridejPrirazeni('t','DC-2026-0001', org[0].id, '', ''); } catch(e){ console.log('dup ok:', e.message); }
console.log('Organizace pole:', zaznamObjekt_(sh['Dobrovolníci'], hd, 2)['Organizace']);
ulozHodiny('t', {dobrovolnik:'DC-2026-0001', orgId:'ORG-005', datum:'2026-10-10', od:'09:00', do:'11:23', cinnost:'Doprovod'});
ulozHodiny('t', {dobrovolnik:'DC-2026-0001', orgId:'ORG-005', datum:'2026-10-11', od:'22:00', do:'01:00', cinnost:'Noční'});
ulozHodiny('t', {dobrovolnik:'DC-2026-0001', orgId:'ORG-005', datum:'2026-10-12', minut:93, cinnost:'X'});
for (const bad of [{dobrovolnik:'DC-2026-0002', orgId:'ORG-005', datum:'2026-10-10', minut:60, cinnost:'X'}, {dobrovolnik:'DC-2026-0002', orgId:org[0].id, datum:'2099-01-01', minut:60, cinnost:'X'}, {dobrovolnik:'DC-2026-0002', orgId:org[0].id, datum:'2026-10-01', minut:0, cinnost:'X'}])
  try { ulozHodiny('t', bad); console.log('CHYBA: prošlo', bad); process.exitCode = 1; } catch(e){ console.log('odmítnuto:', e.message); }
console.log(ulozAkci('t', {orgId: org[0].id, datum:'2026-10-15', od:'14:00', do:'17:30', cinnost:'Pomoc na akci', dobrovolnici:['DC-2026-0001','DC-2026-0002']}));
console.log(ulozVykaz('t', {orgId: org[0].id, mesic:'2026-10', cinnost:'Pomoc v provozu', polozky:[{dobrovolnik:'DC-2026-0002', den:3, minut:120},{dobrovolnik:'DC-2026-0002', den:4, minut:0}]}));
let h = nactiHodiny('t', {od:'2026-10-01', do:'2026-10-31'});
console.log(h.zaznamy.map(z=>[z.datum,z.jmeno,z.org,z.od+'-'+z.do,z.minut,z.cinnost,z.stav,z.zdroj].join(' | ')).join('\n'));
const id1 = h.zaznamy.find(z=>z.cinnost==='X').id;
ulozHodiny('t', {id:id1, dobrovolnik:'DC-2026-0001', orgId:'ORG-005', datum:'2026-10-12', minut:47, cinnost:'X upraveno'});
zmenStavHodin('t', [id1], 'Ke schválení');
console.log('přehled', prehledHodin_());
// uzávěrka
nastavHodnotu_('hodiny_uzavreno_do','2026-10'); role='Koordinátor';
try { smazHodiny('t',[id1]); console.log('CHYBA uzávěrka'); process.exitCode = 1; } catch(e){ console.log('uzávěrka ok:', e.message); }
role='Hlavní admin'; console.log('smazáno', smazHodiny('t',[id1]));
// ukončení přiřazení
const pr = prirazeni_().find(p=>p.dobrovolnik==='DC-2026-0002');
ukonciPrirazeni('t', pr.id, '2026-10-20');
nastavHodnotu_('hodiny_uzavreno_do','');
// administrátor smí zapisovat zpětně i mimo období přiřazení (přiřazení musí existovat)
ulozHodiny('t',{dobrovolnik:'DC-2026-0002', orgId:org[0].id, datum:'2026-10-21', minut:60, cinnost:'X'}); console.log('admin po ukončení přiřazení: ok');
ulozHodiny('t',{dobrovolnik:'DC-2026-0002', orgId:org[0].id, datum:'2026-10-19', minut:60, cinnost:'před ukončením'}); console.log('před ukončením ok');
console.log('Organizace pole DC2:', JSON.stringify(zaznamObjekt_(sh['Dobrovolníci'], hd, 3)['Organizace']));
// výmaz dobrovolníka anonymizuje hodiny a maže přiřazení
smazZaznam('t','DC-2026-0002', false);
console.log('přiřazení po výmazu', prirazeni_().filter(p=>p.dobrovolnik==='DC-2026-0002').length, '| hodiny zůstaly', radkyHodin_().radky.filter(z=>z.dobrovolnik==='DC-2026-0002').length, '| jméno', nactiHodiny('t',{dobrovolnik:'DC-2026-0002'}).zaznamy[0].jmeno);
console.log('Hodiny hlavičky', hlavicky_(sh['Hodiny']).join(','));
// API
const r = doPost({postData:{contents: JSON.stringify({akce:'nactiHodiny', token:'t', args:[{od:'2026-10-01'}]})}});
console.log('API', JSON.parse(r).ok, JSON.parse(r).data.zaznamy.length);
