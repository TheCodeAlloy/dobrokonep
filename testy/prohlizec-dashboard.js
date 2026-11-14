process.env.TZ='Europe/Prague';
const M = require('./gas-mock.js');
require('./nacti-kod.js')();
overAdmin_ = (t, r) => { AKTUALNI_UZIVATEL='a@b.cz'; return {email:'koordinator@konep.cz', role:'Hlavní admin'}; };
log_ = () => {};
console.log = (o => (...a) => { if (!String(a[0]).startsWith('Hotovo')) o(...a); })(console.log);
nastavTabulku();
nastavHodnotu_('zamykani_mesicu', 'ANO');   // testy zámků běží se zapnutým zamykáním
const DISK = {}; let cisloS = 0;
let TAB = 0; tabOrgVytvor_ = () => 'TAB' + (++TAB); tabOrgNastavListy_ = () => {}; tabOrgSdilej_ = () => {};
ulozSouborFotky_ = (d, n, b) => { const id = 'S' + (++cisloS); DISK[id] = b; return id; };
nactiSouborFotky_ = id => 'data:image/jpeg;base64,' + Buffer.from(DISK[id]).toString('base64');
smazSouborFotky_ = id => { delete DISK[id]; };
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
  // fotky papírového výkazu v okně u měsíce
  const JPG = Buffer.from((await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 40, 30); return c.toDataURL('image/jpeg'); })).split(',')[1], 'base64');
  await p.evaluate(() => jdi('hodiny')); await W(300);
  await p.click('#hMesice'); await W(600); await p.selectOption('#mRok', ''); await W(600);
  await p.click('#mTab tbody tr >> nth=0 >> .mFotka'); await W(400);
  await p.setInputFiles('#fvMisto input[data-vstup=soubor]', { name: 'v.jpg', mimeType: 'image/jpeg', buffer: JPG }); await W(1200);
  console.log('fotek v okně po nahrání:', await p.$$eval('#fvMisto .fv-it', l => l.length), '| souborů na „Disku“:', Object.keys(DISK).length);
  await p.waitForSelector('#fvMisto .fv-it img', { timeout: 4000 });
  console.log('náhled fotky se načetl:', await p.$$eval('#fvMisto .fv-it img', l => l.length));
  await p.click('#fvMisto .fv-x'); await W(300); await p.click('#dlgAno'); await W(800);
  console.log('po smazání fotek:', await p.$$eval('#fvMisto .fv-it', l => l.length), '| souborů:', Object.keys(DISK).length);
  await p.click('#fvZavrit'); await W(600);
  // fotka z detailu dobrovolníka a přímo ve formuláři zápisu hodin
  await p.evaluate(() => jdi('detail',{id:'DC-2026-0001'})); await W(800);
  await p.click('#dFotka'); await W(400);
  await p.setInputFiles('#fvMisto input[data-vstup=soubor]', { name: 'v.jpg', mimeType: 'image/jpeg', buffer: JPG }); await W(1200);
  console.log('detail: fotek po nahrání:', await p.$$eval('#fvMisto .fv-it', l => l.length));
  await p.click('#fvZavrit'); await W(300);
  await p.click('#dZapsat'); await W(500);
  console.log('formulář: fotky vidět (org předvyplněna?):', await p.isVisible('#zFotky'), '|', (await p.textContent('#zFotky')).replace(/\s+/g, ' ').slice(0, 80));
  await p.selectOption('#zOrg', { index: 1 }).catch(() => {}); await W(500);
  console.log('formulář: tlačítko přidat fotku:', await p.isVisible('#zFotky [data-pridat=soubor]'));
  await p.click('#zZpet'); await W(300);
  // papírový výkaz u přiřazení + tabulky organizací
  await p.evaluate(() => jdi('detail',{id:'DC-2026-0001'})); await W(800);
  await p.selectOption('#orgSeznam .zpusobPr >> nth=0', 'Organizace podle papírového výkazu'); await W(800);
  console.log('papírový způsob uložen u přiřazení:', prirazeni_().filter(x => x.dobrovolnik === 'DC-2026-0001').some(x => x.papir), '| tabulek vytvořeno:', TAB);
  await p.evaluate(() => jdi('admin', { tab: 'KORDORG' })); await W(900);
  console.log('karta tabulek organizací:', (await p.textContent('#tabOrg')).replace(/\s+/g, ' ').slice(0, 120));
  // schvalování měsíců
  await p.evaluate(() => jdi('hodiny')); await W(300);
  await p.click('#hMesice'); await W(600);
  await p.selectOption('#mRok', ''); await W(600);
  const radkuM = await p.$$eval('#mTab tbody tr', l => l.length);
  console.log('měsíců ke schválení:', radkuM);
  await p.screenshot({path:__dirname+'/vystup/u11_mesice.png', fullPage:true});
  await p.click('#mTab tbody tr >> nth=0 >> button[data-a=schvalit]'); await W(300);
  await p.click('#dlgAno'); await W(800);
  console.log('po schválení ke schválení:', await p.$$eval('#mTab tbody tr', l => l.length), '| zamčených v listu Měsíce:', (M.sheets['Měsíce'].getLastRow() - 1));
  await p.selectOption('#mStav', 'zamcene'); await W(600);
  console.log('zamčené viditelné:', (await p.textContent('#mTab')).includes('schváleno'));
  await p.click('#mTab tbody tr >> nth=0 >> button[data-a=odemknout]'); await W(300);
  await p.fill('#dlgVyber [data-udaj=duvod]', 'oprava překlepu'); await p.click('#dlgAno'); await W(800);
  console.log('po odemčení: ', M.sheets['Měsíce'].getDataRange().getValues()[1].slice(3,9).join(' | '));
  // správa koordinátorů organizací
  await p.evaluate(() => jdi('admin', { tab: 'KORDORG' })); await W(800);
  await p.fill('#pridat input[name=email]', 'karel@kal.cz'); await p.fill('#pridat input[name=jmeno]', 'Karel');
  await p.click('#pridat button[type=submit]'); await W(800);
  console.log('koordinátor organizace přidán:', sh['Koordinátoři organizací'].getLastRow() - 1, '|', sh['Koordinátoři organizací'].getDataRange().getValues()[1].join(' | '));
  // náhled převodu schvalování
  zalohaPredPrevodem_ = () => ({ nazev: 'Záloha test', url: 'https://drive/zaloha' });
  await p.evaluate(() => jdi('mesice')); await W(400);
  await p.click('#mPrevod'); await W(700);
  console.log('převod – náhled:', (await p.textContent('#pvObsah')).replace(/\s+/g, ' ').slice(0, 110));
  await p.screenshot({path:__dirname+'/vystup/u12_prevod.png', fullPage:true});
  // vypnuté zamykání: stránka schvalování to ukáže a nenabízí převod/odemykání
  nastavHodnotu_('zamykani_mesicu', 'NE'); delete MEMO.nastaveni;
  await p.evaluate(() => { CACHE.clear(); jdi('mesice'); }); await W(800);
  console.log('zamykání vypnuté – popis:', (await p.textContent('#mPopis')).slice(-45), '| převod viditelný:', await p.isVisible('#mPrevod'));
  console.log('chyby:', errs); if (errs.length) process.exitCode = 1;
  console.log('Hodiny v tabulce:', radkyHodin_().radky.map(z=>z.dobrovolnik+' '+z.datum+' '+z.minut+' '+z.stav+' '+z.zdroj).join(' | '));
  await b.close();
})();
