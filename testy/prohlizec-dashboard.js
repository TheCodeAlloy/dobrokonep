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
  await p.fill('#zOd','08:00'); await p.fill('#zDo','10:35'); await p.dispatchEvent('#zDo','input');
  console.log('výpočet:', await p.textContent('#zVysl'));
  await p.click('#zCin label:nth-child(2)');
  await p.screenshot({path:__dirname+'/vystup/u2_zapis.png'});
  await p.click('#zUlozit'); await W(600);
  console.log('detail souhrn:', (await p.textContent('#hodSouhrn')).replace(/\s+/g,' ').slice(0,120));
  console.log('výchozí volba organizace:', await p.$eval('#noveOrg', s => s.options[s.selectedIndex].text));
  await p.click('#pridatOrg'); await W(100);
  // Jan má 2 organizace -> přepínač
  await p.evaluate(() => jdi('detail',{id:'DC-2026-0001'})); await W(600);
  console.log('Jan přepínač:', (await p.textContent('#souhrnOrg').catch(()=> 'není')).replace(/\s+/g,' '));
  await p.screenshot({path:__dirname+'/vystup/u3_detail.png', fullPage:true});
  // akce
  await p.evaluate(() => jdi('hodiny')); await W(500);
  await p.click('#hAkce'); await W();
  await p.fill('#aDatum','2026-10-15'); await p.dispatchEvent('#aDatum','change'); await W(100);
  console.log('akce seznam:', (await p.textContent('#aSeznam')).replace(/\s+/g,' '));
  await p.click('#aRezim >> text=Jen délka'); await p.selectOption('#aH','3'); await p.selectOption('#aM','30');
  await p.click('#aVse'); await p.click('#aCin label:first-child');
  await p.screenshot({path:__dirname+'/vystup/u4_akce.png'});
  await p.click('#aUlozit'); await W(600);
  await p.screenshot({path:__dirname+'/vystup/u5_hodiny.png'});
  console.log('souhrn hodin:', await p.textContent('#hSouhrn'));
  // schválit ke schválení
  await p.click('tr:has(.badge:text("Ke schválení")) button[data-a="schvalit"]'); await W(500);
  console.log('po schválení:', await p.textContent('#hSouhrn'));
  // hromadné smazání 1
  await p.click('.hSel >> nth=0'); await W(100);
  console.log('bulk:', await p.textContent('#hHromadne'));
  // výkaz
  console.log('výběr po schválení:', await p.textContent('#hSouhrn'));
  await p.click('#hVykaz'); await W(600);
  await p.fill('.bunka[data-z="DC-2026-0001"][data-d="2"]','2');
  await p.fill('.bunka[data-z="DC-2026-0001"][data-d="3"]','1:30');
  await p.fill('.bunka[data-z="DC-2026-0002"][data-d="2"]','abc');
  console.log('výkaz celkem:', await p.textContent('#vCelkem'));
  await p.screenshot({path:__dirname+'/vystup/u6_vykaz.png', fullPage:true});
  await p.click('#vUlozit'); await W(200);
  console.log('výkaz chyba:', await p.textContent('#vChyba'));
  await p.fill('.bunka[data-z="DC-2026-0002"][data-d="2"]','45m');
  await p.click('#vUlozit'); await W(800);
  console.log('Petr 5.10 políčko existuje?', await p.$('.bunka[data-z="DC-2026-0003"][data-d="5"]') ? 'ano (CHYBA)' : 'ne (správně, přiřazen od 10.)');
  // admin činnosti
  await p.evaluate(() => { stav.tab='CINNOSTI'; jdi('admin'); }); await W(600);
  await p.screenshot({path:__dirname+'/vystup/u7_cinnosti.png'});
  // seznam hodin – celé období
  await p.evaluate(() => { H.filtr={mesic:'',org:'',dobrovolnik:'',stav:''}; jdi('hodiny'); }); await W(500);
  await p.fill('#hMesic',''); await p.dispatchEvent('#hMesic','change'); await W(500);
  console.log('vše:', await p.textContent('#hSouhrn'));
  // mobil
  await p.setViewportSize({width:390,height:844}); await W(200);
  await p.screenshot({path:__dirname+'/vystup/u8_mobil.png'});
  await p.click('#hNovy'); await W(); await p.screenshot({path:__dirname+'/vystup/u9_mobil_form.png'});
  // Jan detail po zápisech – přepínač organizací
  await p.keyboard.press('Escape'); await p.setViewportSize({width:1280,height:900});
  await p.evaluate(() => jdi('detail',{id:'DC-2026-0001'})); await W(800);
  console.log('Jan přepínač:', (await p.textContent('#souhrnOrg').catch(()=> 'není')).replace(/\s+/g,' '));
  await p.click('#souhrnOrg >> text=Hospic Chrudim').catch(e=>console.log('klik selhal', e.message.slice(0,1500))); await W(100);
  console.log('checked:', await p.$eval('#souhrnOrg input:checked', i=>i.value).catch(()=>'?'));
  console.log('Jan jen Hospic:', (await p.textContent('#hodSouhrn .stats')).replace(/\s+/g,' '));
  await p.click('#souhrnOrg >> text=Všechny organizace').catch(()=>{}); await W(100);
  await p.screenshot({path:__dirname+'/vystup/u10_jan.png'});
  console.log('chyby:', errs); if (errs.length) process.exitCode = 1;
  console.log('Hodiny v tabulce:', radkyHodin_().radky.map(z=>z.dobrovolnik+' '+z.datum+' '+z.minut+' '+z.stav+' '+z.zdroj).join(' | '));
  await b.close();
})();
