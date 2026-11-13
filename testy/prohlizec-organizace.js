process.env.TZ='Europe/Prague';
const M = require('./gas-mock.js');
require('./nacti-kod.js')();
overAdmin_ = (t, r) => { AKTUALNI_UZIVATEL='a@b.cz'; return {email:'koordinator@konep.cz', role:'Hlavní admin'}; };
log_ = () => {};
console.log = (o => (...a) => { if (!String(a[0]).startsWith('Hotovo')) o(...a); })(console.log);
nastavTabulku();
const sh=M.sheets;
{ const h = hlavicky_(sh['Organizace']); sh['Organizace'].appendRow(h.map(x => ({ 'ID': 'ORG-001', 'Název': 'Charita Pardubice', 'Aktivní': 'ANO' })[x] ?? '')); }
{ const h = hlavicky_(sh['Organizace']); sh['Organizace'].appendRow(h.map(x => ({ 'ID': 'ORG-002', 'Název': 'Hospic Chrudim', 'Kontaktní osoba': 'Jana Nová', 'E-mail': 'j@h.cz', 'Aktivní': 'ANO' })[x] ?? '')); }
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
  const sel = n => '[data-l="ORGANIZACE"][data-r="2"][data-c="' + hlavicky_(M.sheets['Organizace']).indexOf(n) + '"]';
  // sloupce v tabulce přehodíme (obrátíme pořadí), dashboard to musí zvládnout
  { const sO = M.sheets['Organizace'], h0 = hlavicky_(sO), v0 = sO.getRange(1, 1, sO.getLastRow(), h0.length).getValues(); sO.getRange(1, 1, v0.length, h0.length).setValues(v0.map(r => r.slice().reverse())); MEMO = { ss: MEMO.ss }; }
  await p.goto('http://web.test/dc/dashboard.html'); await W(500);
  await p.goto('http://web.test/dc/dashboard.html'); await W(500);
  await p.evaluate(() => jdi('admin')); await W(700); await p.click('#tabs button[data-tab=ORGANIZACE]'); await W(400);
  console.log('obsah:', (await p.textContent('#obsah')).slice(0,200));
  const hl = await p.$$eval('table.adm thead tr:last-child th', t => t.map(x => x.textContent));
  console.log('sloupce:', hl.join(' | '));
  console.log('skupiny barev (3 nadpisy + 12 popisků = 15):', await p.$$eval('table.adm thead tr.skupiny th.g1, th.g2, th.g3', t => t.length));
  const bg = await p.$$eval('table.adm tbody tr:first-child td.g1, td.g2, td.g3', t => t.map(x => getComputedStyle(x).backgroundColor));
  console.log('pozadí buněk 1/2/3 (první řádek):', [bg[0], bg.find((x,i)=>i>=4&&i<8), bg[bg.length-1]].join(' ; '));
  // uložení kontaktní osoby 2 (sloupec 10) a 3 – e-mail (16)
  const inp = await p.$(sel('Kontaktní osoba 2'));
  await inp.fill('Petr Svoboda'); await inp.dispatchEvent('change'); await W(300);
  const ok = await p.$eval(sel('Kontaktní osoba 2'), e => e.classList.contains('saved'));
  console.log('uložení osoby 2:', ok, '| v tabulce:', M.sheets['Organizace'].getRange(2, hlavicky_(M.sheets['Organizace']).indexOf('Kontaktní osoba 2') + 1).getValue());
  const e3 = await p.$(sel('E-mail 3'));
  await e3.fill('spatny'); await e3.dispatchEvent('change'); await W(300);
  console.log('špatný e-mail osoby 3 odmítnut:', await p.$eval(sel('E-mail 3'), e => e.classList.contains('bad')));
  console.log('kontakty v organizace_():', JSON.stringify(organizace_().find(o=>o.id==='ORG-001').kontakty.map(k=>k.jmeno)));
  const nz = await p.$(sel('Název'));
  await nz.fill('Domov pro seniory a Centrum denních služeb města Pardubic, příspěvková organizace'); await nz.dispatchEvent('input'); await nz.dispatchEvent('change'); await W(300);
  const ul = await p.$(sel('Ulice'));
  await ul.fill('Generála Svobody 1234/56'); await ul.dispatchEvent('input'); await W(200);
  await p.evaluate(() => { document.querySelector('.scroll').scrollLeft = 0; });
  console.log('výška buňky názvu:', await nz.evaluate(e => e.offsetHeight), 'šířka:', await nz.evaluate(e => e.offsetWidth));
  await p.screenshot({path:__dirname+'/vystup/u11_organizace.png'});
  // okno s činnostmi u organizace
  await p.click('#tabs button[data-tab=ORGANIZACE]'); await W(300);
  await p.hover('.cinBtn >> nth=0'); await W(300);
  console.log('okno činností viditelné:', await p.$eval('#cinPop', e => !e.hidden), '| položek:', await p.$$eval('#cinPop li', l => l.length), '| věta:', (await p.textContent('#cinPop .pozn')).slice(0, 60));
  await p.screenshot({path:__dirname+'/vystup/u13_org_cinnosti.png'});
  await p.click('#cinPop [data-jdi-cinnosti]'); await W(500);
  console.log('odkaz otevře kartu Činnosti:', await p.$('table.mapa') !== null);
  // mapa činností
  await p.click('#tabs button[data-tab=CINNOSTI]'); await W(500);
  console.log('mapa – záhlaví:', (await p.$$eval('table.mapa thead th', t => t.map(x => x.textContent.trim()))).join(' | '));
  const rad = await p.$$eval('table.mapa tbody tr', t => t.length);
  console.log('mapa – řádků činností:', rad);
  const r1 = 'table.mapa tbody tr:first-child';
  const sedeVse = await p.$$eval(r1 + ' td.o', t => t.every(x => x.classList.contains('sede')));
  console.log('první činnost má zaškrtnuto „Všechny“ → ostatní zešedlé:', sedeVse);
  await p.screenshot({path:__dirname+'/vystup/u12_cinnosti_a.png'});
  await p.click(r1 + ' td.vse input'); await W(400);   // odškrtnout „Všechny“
  const odsedlo = await p.$$eval(r1 + ' td.o', t => t.every(x => !x.classList.contains('sede')));
  const dis = await p.$$eval(r1 + ' td.o input', t => t.some(x => x.disabled));
  console.log('po odškrtnutí „Všechny“ jsou ostatní použitelné:', odsedlo && !dis);
  await p.click(r1 + ' td.o:nth-child(3) input'); await W(400);
  console.log('v tabulce Činnosti:', JSON.stringify(cinnosti_().filter(c => c.org !== 'Všechny organizace').slice(0, 3)));
  await p.click(r1 + ' td.vse input'); await W(400);    // znovu zaškrtnout „Všechny“
  console.log('výběr organizace zůstal i po zašedlení:', await p.$eval(r1 + ' td.o:nth-child(3) input', x => x.checked));
  await p.screenshot({path:__dirname+'/vystup/u12_cinnosti_b.png'});
  const necekane = errs.filter(e => !/Neplatný e-mail/.test(e)); console.log('chyby:', necekane); if (necekane.length) process.exitCode = 1;
  await b.close();
})();
