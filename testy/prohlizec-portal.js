process.env.TZ='Europe/Prague';
const M = require('./gas-mock.js');
require('./nacti-kod.js')();
overAdmin_ = (t, r) => { if (t!=='ADMIN') throw new Error('PRIHLASENI: x'); AKTUALNI_UZIVATEL='k@k.cz'; return {email:'k@k.cz', role:'Koordinátor'}; };
log_ = () => {};
const quiet = console.log; console.log = (...a) => { if (!String(a[0]).startsWith('Hotovo')) quiet(...a); }; console.error = () => {};
nastavTabulku();
const DISK = {}; let cisloS = 0;
ulozSouborFotky_ = (d, n, b) => { const id = 'S' + (++cisloS); DISK[id] = b; return id; };
nactiSouborFotky_ = id => 'data:image/jpeg;base64,' + Buffer.from(DISK[id]).toString('base64');
smazSouborFotky_ = id => { delete DISK[id]; };
nastavHodnotu_('web_adresa','http://web.test/dc/');
const sh=M.sheets;
sh['Organizace'].appendRow(['ORG-001', 'Charita Pardubice', '', '', '', '', '', 'ANO', '']);
sh['Organizace'].appendRow(['ORG-002', 'Hospic Chrudim', '', '', '', '', '', 'ANO', '']);
const hd = hlavicky_(sh['Dobrovolníci']); const row = o => hd.map(h => o[h] ?? '');
sh['Dobrovolníci'].appendRow(row({ID:'DC-2026-0001','Jméno':'Jan','Příjmení':'Novák','E-mail':'jan@x.cz','Stav':'Aktivní dobrovolník','Časové razítko':new Date(2026,8,1)}));
pridejPrirazeni('ADMIN','DC-2026-0001','ORG-001','','');
pridejPrirazeni('ADMIN','DC-2026-0001','ORG-002','2026-10-01','');
ulozHodiny('ADMIN',{dobrovolnik:'DC-2026-0001', orgId:'ORG-001', datum:'2025-11-12', od:'08:00', do:'10:00', cinnost:'Pomoc na akci'});
ulozHodiny('ADMIN',{dobrovolnik:'DC-2026-0001', orgId:'ORG-002', datum:'2026-09-03', od:'08:00', do:'09:30', cinnost:'Doprovod / návštěva'}); // admin zpětně před přiřazením
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
  // víc organizací → žádná není předvybraná a bez výběru se zápis neuloží
  console.log('předvybraná organizace:', await p.$$eval('#fOrg input:checked', l => l.length));
  await p.selectOption('#fOdH','15'); await p.selectOption('#fDoH','17'); await p.selectOption('#fDoM','15');
  await p.click('#fUlozit'); console.log('bez organizace:', await p.textContent('#fChyba'));
  await p.setViewportSize({width:360,height:800}); await p.screenshot({path:__dirname+'/vystup/p2_form_360.png'});
  console.log('vodorovný posun na 360 px:', await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
  await p.setViewportSize({width:1280,height:900});
  await p.click('#fOrg >> text=Charita Pardubice');
  console.log('výpočet:', await p.textContent('#fVysl'));
  await p.click('#fCin >> text=Pomoc na akci');
  await p.screenshot({path:__dirname+'/vystup/p2_form.png', fullPage:true});
  await p.click('#fUlozit'); await W(600);
  console.log('cekani:', await p.textContent('#cekani'));
  // 3) zopakovat poslední
  await p.click('#bZnovu'); await W();
  await p.click('#fDny >> text=Dnes');
  console.log('opakování předvyplněno:', await p.inputValue('#fOdH'), await p.inputValue('#fDoH'), await p.isChecked('input[name="cin"][value="Pomoc na akci"]'));
  await p.click('#fUlozit'); await W(600);
  // 4) úprava čekajícího zápisu
  console.log('ouška organizací:', (await p.$$eval('#seznam .rh-orgs .rh-tab', l => l.map(x => x.textContent))).join(' | '));
  console.log('ouška roků:', (await p.$$eval('#seznam .rh-roky .rh-tab', l => l.map(x => x.textContent))).join(' | '));
  await p.click('#seznam .rh-row button[data-a=upravit] >> nth=0'); await W();
  await p.selectOption('#seznam [data-k=odH]','9'); await p.selectOption('#seznam [data-k=doH]','12');
  await p.click('#seznam [data-a=ulozit]'); await W(600);
  console.log('po úpravě:', (await p.textContent('#seznam')).replace(/\s+/g,' ').slice(0,200));
  // nový řádek přímo v seznamu
  await p.click('#seznam [data-a=pridat]'); await W();
  await p.selectOption('#seznam [data-k=odH]','10'); await p.selectOption('#seznam [data-k=doH]','11');
  await p.click('#seznam [data-a=ulozit]'); await W(300);
  console.log('bez organizace v řádku:', await p.textContent('#seznam [data-k=chyba]'));
  await p.selectOption('#seznam [data-k=org]', { index: 1 });
  await p.selectOption('#seznam [data-k=cin]', { index: 1 });
  await p.click('#seznam [data-a=ulozit]'); await W(600);
  console.log('řádků po přidání:', await p.$$eval('#seznam .rh-row', l => l.length));
  // smazání řádku
  await p.click('#seznam .rh-row button[data-a=upravit] >> nth=0'); await W();
  await p.click('#seznam [data-a=smazat]'); await W(600);
  console.log('řádků po smazání:', await p.$$eval('#seznam .rh-row', l => l.length));
  await p.setViewportSize({width:360,height:800});
  await p.click('#seznam .rh-row button[data-a=upravit] >> nth=0'); await W();
  await p.screenshot({path:__dirname+'/vystup/p5_radek_360.png', fullPage:true});
  console.log('seznam – vodorovný posun na 360 px:', await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
  await p.click('#seznam [data-a=zrusit]'); await p.setViewportSize({width:1280,height:900});
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
  // fotka papírového výkazu (jen při způsobu „papírový výkaz“)
  console.log('tlačítko fotky bez papírového způsobu:', await p.isVisible('#bFotka'));
  zapisDoRadku_(sh['Dobrovolníci'], 2, hlavicky_(sh['Dobrovolníci']), {'Způsob vykazování':'Organizace podle papírového výkazu'});
  await p.reload(); await W(600);
  await p.setViewportSize({width:360,height:800});
  await p.click('#bFotka'); await W(300);
  const JPG = Buffer.from((await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; const x = c.getContext('2d'); x.fillStyle = '#36c'; x.fillRect(0, 0, 40, 30); return c.toDataURL('image/jpeg'); })).split(',')[1], 'base64');
  await p.selectOption('#fvOrg', { index: 0 });
  await p.setInputFiles('#fvMisto input[data-vstup=soubor]', { name: 'v.jpg', mimeType: 'image/jpeg', buffer: JPG }); await W(1200);
  console.log('fotek po nahrání:', await p.$$eval('#fvMisto .fv-it', l => l.length), '| na „Disku“:', Object.keys(DISK).length);
  await p.screenshot({path:__dirname+'/vystup/p6_fotka_360.png'});
  console.log('fotka – vodorovný posun na 360 px:', await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
  await p.click('#fvMisto .fv-x'); await W(300);
  console.log('po smazání fotek:', await p.$$eval('#fvMisto .fv-it', l => l.length), '| na „Disku“:', Object.keys(DISK).length);
  await p.click('#fx'); await p.setViewportSize({width:1280,height:900});
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
