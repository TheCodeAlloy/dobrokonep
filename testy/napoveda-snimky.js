// Pořídí screenshoty pro stránku nápovědy na zkušebních (fiktivních) datech v napodobenině serveru.
// Spuštění: node testy/napoveda-snimky.js  (vyžaduje Chromium: npx playwright install chromium)
// Výstup: docs/napoveda/*.png
process.env.TZ = 'Europe/Prague';
const path = require('path');
const fs = require('fs');
const M = require('./gas-mock.js');
require('./nacti-kod.js')();
overAdmin_ = (t, r) => { AKTUALNI_UZIVATEL = 'a@b.cz'; return { email: 'koordinator@konep.cz', role: 'Hlavní admin' }; };
log_ = () => {};
console.log = (o => (...a) => { if (!String(a[0]).startsWith('Hotovo')) o(...a); })(console.log);

nastavTabulku();
const sh = M.sheets;
sh['Organizace'].appendRow(['ORG-001', 'Charita Pardubice', '', '', '', '', '', 'ANO', '']);
sh['Organizace'].appendRow(['ORG-002', 'Hospic Chrudim', '', '', '', '', '', 'ANO', '']);
const hd = hlavicky_(sh['Dobrovolníci']);
const row = o => hd.map(h => o[h] ?? '');
[['DC-2026-0001', 'Jan', 'Novák'], ['DC-2026-0002', 'Eva', 'Malá'], ['DC-2026-0003', 'Petr', 'Dlouhý'], ['DC-2026-0004', 'Marie', 'Krátká']].forEach(([id, j, p]) =>
  sh['Dobrovolníci'].appendRow(row({ ID: id, 'Jméno': j, 'Příjmení': p, 'Stav': 'Aktivní dobrovolník', 'Časové razítko': new Date(2026, 9, 1, 10) })));
pridejPrirazeni('t', 'DC-2026-0001', 'ORG-001', '2026-09-01', '');
pridejPrirazeni('t', 'DC-2026-0002', 'ORG-001', '2026-09-01', '');
pridejPrirazeni('t', 'DC-2026-0003', 'ORG-001', '2026-10-10', '');
ulozHodiny('t', { dobrovolnik: 'DC-2026-0002', orgId: 'ORG-001', datum: '2026-10-05', od: '10:00', do: '12:00', cinnost: 'Doučování' });
zmenStavHodin('t', [radkyHodin_().radky[0].id], 'Schváleno');
ulozHodiny('t', { dobrovolnik: 'DC-2026-0001', orgId: 'ORG-001', datum: '2026-10-07', od: '09:00', do: '11:30', cinnost: 'Pomoc na akci' });
zmenStavHodin('t', [radkyHodin_().radky[0].id], 'Ke schválení');

const { chromium } = require('playwright');
const OUT = path.join(__dirname, '..', 'docs', 'napoveda');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const errs = [];
  await ctx.route('https://fonts.googleapis.com/**', r => r.abort());
  await ctx.route('https://script.google.com/**', async r => {
    const out = doPost({ postData: { contents: r.request().postData() } });
    const j = JSON.parse(out); if (!j.ok) errs.push('API ' + JSON.parse(r.request().postData()).akce + ': ' + j.chyba);
    await r.fulfill({ contentType: 'application/json', body: out });
  });
  await ctx.route('http://web.test/**', r => r.fulfill({ path: path.join(require('./nacti-kod.js').WEB, new URL(r.request().url()).pathname.split('/').pop()) }));
  await ctx.addInitScript(() => { try { localStorage.setItem('dc_token', 'T'); } catch (e) { } });
  const p = await ctx.newPage(); p.setDefaultTimeout(8000);
  p.on('pageerror', e => errs.push('JS: ' + e.message));
  p.on('dialog', d => d.accept());
  const W = ms => p.waitForTimeout(ms || 400);
  const foto = async (jmeno, celaStranka) => p.screenshot({ path: path.join(OUT, jmeno), fullPage: !!celaStranka });

  await p.goto('http://web.test/dashboard.html'); await W(800);
  await foto('prehled.png');

  await p.evaluate(() => jdi('seznam')); await W(600);
  await foto('seznam.png');

  await p.evaluate(() => jdi('detail', { id: 'DC-2026-0001' })); await W(800);
  await foto('karta.png', true);

  await p.evaluate(() => { const el = document.querySelector('[data-gen="smlouva"]'); if (el) el.scrollIntoView({ block: 'center' }); }); await W(200);
  await p.click('[data-gen="smlouva"]'); await W(600);
  await foto('okno_smlouva.png');
  await p.click('#dlgNe'); await W(300);

  await p.evaluate(() => jdi('hodiny')); await W(800);
  await foto('hodiny.png');

  await p.evaluate(() => jdi('rocni', { rok: 2026 })); await W(1000);
  await foto('rocni_vykaz.png');

  await p.evaluate(() => jdi('admin')); await W(800);
  await foto('administrace.png');

  await p.evaluate(() => { document.documentElement.setAttribute('data-schema', 'modra'); jdi('prehled'); }); await W(600);
  await foto('barevne_schema.png');

  await ctx.clearCookies();
  const p2 = await ctx.newPage(); p2.setDefaultTimeout(8000);
  await p2.addInitScript(() => { try { localStorage.clear(); } catch (e) { } });
  await p2.goto('http://web.test/dashboard.html'); await p2.waitForTimeout(800);
  await p2.screenshot({ path: path.join(OUT, 'prihlaseni.png') });

  console.log('Snímky uloženy do: ' + OUT);
  if (errs.length) console.log('Chyby při snímání:\n' + errs.join('\n'));
  await b.close();
  process.exitCode = 0;
})().catch(e => { console.log('CHYBA ' + e.message); process.exitCode = 1; });
