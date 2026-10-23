process.env.TZ='Europe/Prague';
const M = require('./gas-mock.js');
require('./nacti-kod.js')();
overAdmin_ = (t, r) => { if (t!=='ADMIN') throw new Error('PRIHLASENI: x'); AKTUALNI_UZIVATEL='k@k.cz'; return {email:'k@k.cz', role:'Koordinátor'}; };
log_ = () => {};
const quiet = console.log; console.log = (...a) => { if (!String(a[0]).startsWith('Hotovo')) quiet(...a); }; console.error = () => {};
nastavTabulku();
nastavHodnotu_('web_adresa','http://web.test/dc/');
const sh=M.sheets;
sh['Organizace'].appendRow(['ORG-001', 'Charita Pardubice', '', '', '', '', '', 'ANO', '']);
sh['Organizace'].appendRow(['ORG-002', 'Hospic Chrudim', '', '', '', '', '', 'ANO', '']);
const hd = hlavicky_(sh['Dobrovolníci']); const row = o => hd.map(h => o[h] ?? '');
sh['Dobrovolníci'].appendRow(row({ID:'DC-2026-0001','Jméno':'Jan','Příjmení':'Novák','E-mail':'jan@x.cz','Stav':'Aktivní dobrovolník','Časové razítko':new Date(2026,8,1)}));
pridejPrirazeni('ADMIN','DC-2026-0001','ORG-001','','');
pridejPrirazeni('ADMIN','DC-2026-0001','ORG-002','2026-10-01','');
ulozHodiny('ADMIN',{dobrovolnik:'DC-2026-0001', orgId:'ORG-001', datum:'2025-11-12', minut:120, cinnost:'Pomoc na akci'});
ulozHodiny('ADMIN',{dobrovolnik:'DC-2026-0001', orgId:'ORG-002', datum:'2026-09-03', minut:90, cinnost:'Doprovod / návštěva'}); // admin zpětně před přiřazením
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--headless=new'] } : {});
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errs=[];
  await ctx.route('https://fonts.googleapis.com/**', r => r.abort());
  await ctx.route('https://script.google.com/**', async r => r.fulfill({ contentType:'application/json', body: doPost({postData:{contents: r.request().postData()}}) }));
  await ctx.route('http://web.test/**', r => r.fulfill({ path: require('path').join(require('./nacti-kod.js').WEB, new URL(r.request().url()).pathname.split('/').pop()) }));
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  p.on('pageerror', e => errs.push('JS: '+e.message)); p.on('dialog', d => d.accept());
  const W = ms => p.waitForTimeout(ms||300);
  // 1) pozvánka → klik na odkaz
  const pz = JSON.parse(doPost({postData:{contents: JSON.stringify({akce:'posliPozvankuPortal', token:'ADMIN', args:['DC-2026-0001']})}}));
  const odkaz = MAILS.pop().body.match(/http:\/\/web\.test\/dc\/hodiny\.html\?vstup=[a-f0-9]{64}/)[0];
  await p.goto(odkaz); await W(600);
  console.log('po pozvánce:', await p.textContent('#pozdrav'), '| adresa:', p.url());
  await p.screenshot({path:__dirname+'/vystup/p1_prehled.png', fullPage:true});
  // 2) zápis
  await p.click('#bNovy'); await W();
  await p.click('#fDny >> text=Včera');
  await p.click('#fOrg >> text=Charita Pardubice');
  await p.fill('#fOd','15:00'); await p.fill('#fDo','17:15'); await p.dispatchEvent('#fDo','input');
  console.log('výpočet:', await p.textContent('#fVysl'));
  await p.click('#fCin >> text=Pomoc na akci');
  await p.screenshot({path:__dirname+'/vystup/p2_form.png', fullPage:true});
  await p.click('#fUlozit'); await W(600);
  console.log('cekani:', await p.textContent('#cekani'));
  // 3) zopakovat poslední
  await p.click('#bZnovu'); await W();
  await p.click('#fDny >> text=Dnes');
  console.log('opakování předvyplněno:', await p.inputValue('#fOd'), await p.inputValue('#fDo'), await p.isChecked('input[name="cin"][value="Pomoc na akci"]'));
  await p.click('#fUlozit'); await W(600);
  // 4) úprava čekajícího zápisu
  await p.click('#seznam button.zapis >> nth=0'); await W();
  await p.click('#fCas ~ * >> nth=0').catch(()=>{});
  await p.click('text=Jen délka'); await p.click('#fRychle >> text=3 h');
  await p.click('#fUlozit'); await W(600);
  console.log('po úpravě:', (await p.textContent('#seznam')).replace(/\s+/g,' ').slice(0,160));
  // 5) zápis před 70 dny – nejde vybrat (min), zkusíme podvrhnout
  await p.click('#bNovy'); await W(); await p.click('#fDny >> text=Jiný den');
  const minAttr = await p.getAttribute('#fDatum','min'); console.log('min datum:', minAttr);
  await p.click('#fx');
  // 6) koordinátor schválí
  const ids = radkyHodin_().radky.filter(z=>z.stav==='Ke schválení').map(z=>z.id);
  zmenStavHodin('ADMIN', [ids[0]], 'Schváleno');
  await p.reload(); await W(600);
  console.log('po schválení:', await p.textContent('#stats'), '|', await p.textContent('#cekani'));
  await p.screenshot({path:__dirname+'/vystup/p3_po.png', fullPage:true});
  console.log('přehled:', (await p.textContent('#prehled')).replace(/\s+/g,' '));
  // 7) odhlášení a přihlášení kódem
  await p.click('#odhlasit'); await W(400);
  await p.fill('#email','jan@x.cz'); await p.click('#bPoslat'); await W(400);
  await p.screenshot({path:__dirname+'/vystup/p4_login.png'});
  // obnovení stránky si pamatuje čekání na kód
  await p.reload(); await W(400); console.log('po obnovení čeká na kód:', await p.isVisible('#fKod'));
  const kod = MAILS.pop().subject.match(/(\d{6})/)[1];
  await p.fill('#kod', kod); await p.click('#bKod'); await W(600);
  console.log('přihlášen kódem:', await p.textContent('#pozdrav'));
  // 8) deaktivace
  zapisDoRadku_(sh['Dobrovolníci'], 2, hlavicky_(sh['Dobrovolníci']), {'Stav':'Neaktivní'});
  await p.reload(); await W(600);
  console.log('po deaktivaci:', await p.isVisible('#login'), await p.textContent('#lChyba'));
  console.log('chyby:', errs); if (errs.length) process.exitCode = 1;
  await b.close();
})();
