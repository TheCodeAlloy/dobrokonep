process.env.TZ='Europe/Prague';
const M = require('./gas-mock.js');
require('./nacti-kod.js')();
overAdmin_ = (t, r) => { AKTUALNI_UZIVATEL='a@b.cz'; return {email:'koordinator@konep.cz', role:'Hlavní admin'}; };
log_ = () => {};
console.log = (o => (...a) => { if (!String(a[0]).startsWith('Hotovo')) o(...a); })(console.log);
nastavTabulku();
const sh=M.sheets;
sh['Organizace'].appendRow(['ORG-001', 'Charita Pardubice', '', '', '', '', '', 'ANO', '']);
sh['Organizace'].appendRow(['ORG-002', 'Hospic Chrudim', '', '', '', '', '', 'ANO', '']);
const hd = hlavicky_(sh['Dobrovolníci']);
const row = o => hd.map(h => o[h] ?? '');
[['DC-2026-0001','Jan','Novák'],['DC-2026-0002','Eva','Malá'],['DC-2026-0003','Petr','Dlouhý'],['DC-2026-0004','Marie','Krátká']].forEach(([id,j,p])=>
  sh['Dobrovolníci'].appendRow(row({ID:id,'Jméno':j,'Příjmení':p,'Stav':'Aktivní dobrovolník','Časové razítko':new Date(2026,9,1,10)})));
pridejPrirazeni('t','DC-2026-0001','ORG-001','2026-09-01','');
pridejPrirazeni('t','DC-2026-0002','ORG-001','2026-09-01','');
pridejPrirazeni('t','DC-2026-0003','ORG-001','2026-10-10','');
pridejPrirazeni('t','DC-2026-0001','ORG-002','2026-09-01','');
// jeden zápis „ke schválení“
ulozHodiny('t',{dobrovolnik:'DC-2026-0002', orgId:'ORG-001', datum:'2026-10-05', od:'10:00', do:'12:00', cinnost:'Doučování'});
zmenStavHodin('t',[radkyHodin_().radky[0].id],'Ke schválení');

const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--headless=new'] } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const errs=[];
  await ctx.route('https://fonts.googleapis.com/**', r => r.abort());
  await ctx.route('https://script.google.com/**', async r => {
    const out = doPost({postData:{contents: r.request().postData()}});
    const j = JSON.parse(out); if (!j.ok) errs.push('API '+JSON.parse(r.request().postData()).akce+': '+j.chyba);
    await r.fulfill({ contentType:'application/json', body: out });
  });
  await ctx.route('http://web.test/**', r => r.fulfill({ path: require('path').join(require('./nacti-kod.js').WEB, new URL(r.request().url()).pathname.split('/').pop()) }));
  await ctx.addInitScript(() => { try { localStorage.setItem('dc_token','T'); } catch(e){} });
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  p.on('pageerror', e => errs.push('JS: '+e.message));
  p.on('dialog', d => d.accept());
  const W = ms => p.waitForTimeout(ms||300);
  await p.goto('http://web.test/dc/dashboard.html'); await W(500);
  await p.screenshot({path:__dirname+'/vystup/u1_prehled.png'});
  // detail – přiřazení Marie
  await p.evaluate(() => jdi('detail',{id:'DC-2026-0004'})); await W();
  await p.selectOption('#noveOrg','ORG-002'); await p.fill('#noveOd','2026-10-01'); await p.click('#pridatOrg'); await W();
  console.log('přiřazení Marie:', (await p.textContent('#orgSeznam')).replace(/\s+/g,' ').slice(0,80));
  await p.click('#dZapsat'); await W();
  await p.fill('#zDatum','2026-10-20'); await p.dispatchEvent('#zDatum','change'); await W(100);
  await p.selectOption('#zOdH','8'); await p.selectOption('#zDoH','7');
  await p.click('#zUlozit'); console.log('do před od:', await p.textContent('#zChyba'));
  await p.selectOption('#zDoH','24'); console.log('24:00 → minuty zamčené na 00:', await p.$eval('#zDoM', e => e.disabled + ' ' + e.value));
  await p.selectOption('#zDoH','10'); await p.selectOption('#zDoM','35');
  console.log('výpočet:', await p.textContent('#zVysl'));
  await p.click('#zCin label:nth-child(2)');
  await p.screenshot({path:__dirname+'/vystup/u2_zapis.png'});
  await p.click('#zUlozit'); await W(600);
  console.log('detail souhrn:', (await p.textContent('#hodSouhrn')).replace(/\s+/g,' ').slice(0,120));
  console.log('výchozí volba organizace:', await p.$eval('#noveOrg', s => s.options[s.selectedIndex].text));
  await p.click('#pridatOrg'); await W(100);
  // Jan má 2 organizace -> přepínač
  await p.evaluate(() => jdi('detail',{id:'DC-2026-0001'})); await W(600);
  console.log('Jan ouška:', (await p.$$eval('#rocniHod .rh-orgs .rh-tab', l => l.map(x => x.textContent))).join(' | '));
  const radkuVse = await p.$$eval('#rocniHod .rh-row', l => l.length);
  await p.click('#rocniHod .rh-orgs >> text=Hospic Chrudim'); await W(100);
  const radkuHospic = await p.$$eval('#rocniHod .rh-row', l => l.length);
  console.log('řádků všechny/Hospic:', radkuVse, radkuHospic, radkuHospic < radkuVse);
  // přidání řádku přímo v seznamu (koordinátor)
  await p.click('#rocniHod [data-a=pridat]'); await W(100);
  await p.selectOption('#rocniHod [data-k=odH]','8'); await p.selectOption('#rocniHod [data-k=doH]','9'); await p.selectOption('#rocniHod [data-k=doM]','30');
  console.log('organizace předvyplněna:', await p.$eval('#rocniHod [data-k=org]', e => e.value));
  await p.selectOption('#rocniHod [data-k=cin]', { index: 1 });
  await p.click('#rocniHod [data-a=ulozit]'); await W(700);
  console.log('řádků po přidání:', await p.$$eval('#rocniHod .rh-row', l => l.length), '| v tabulce Jan:', radkyHodin_().radky.filter(z=>z.dobrovolnik==='DC-2026-0001').length);
  console.log('Jan jen Hospic:', (await p.textContent('#hodSouhrn .stats')).replace(/\s+/g,' '));
  await p.screenshot({path:__dirname+'/vystup/u10_jan.png'});
  console.log('chyby:', errs); if (errs.length) process.exitCode = 1;
  console.log('Hodiny v tabulce:', radkyHodin_().radky.map(z=>z.dobrovolnik+' '+z.datum+' '+z.minut+' '+z.stav+' '+z.zdroj).join(' | '));
  await b.close();
})();
