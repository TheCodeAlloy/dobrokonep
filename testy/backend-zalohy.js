process.env.TZ='Europe/Prague';
const M = require('./gas-mock.js');
// jednoduchá napodobenina Disku: složky mají vlastní soubory a podsložky
function slozka(nazev) {
  const f = { nazev, files: [], slozky: [],
    getUrl: () => 'https://drive/' + nazev,
    getFiles() { const a = f.files.filter(x => !x.t); let i = 0; return { hasNext: () => i < a.length, next: () => a[i++] }; },
    getFilesByName(n) { const a = f.files.filter(x => !x.t && x.n === n); let i = 0; return { hasNext: () => i < a.length, next: () => a[i++] }; },
    getFoldersByName(n) { const a = f.slozky.filter(x => x.nazev === n); let i = 0; return { hasNext: () => i < a.length, next: () => a[i++] }; },
    createFolder(n) { const s = slozka(n); f.slozky.push(s); return s; } };
  return f;
}
const korenZaloh = slozka('zalohy');
global.DriveApp = { getFileById: id => ({ makeCopy: (n, f) => { const x = { n, t: false, zdroj: id, getName() { return this.n; }, setTrashed(v) { this.t = v; }, getUrl: () => 'u' }; f.files.push(x); return x; } }),
  getFolderById: () => korenZaloh, getRootFolder: () => korenZaloh };
require('./nacti-kod.js')();
log_ = () => {}; console.log = (o => (...a) => { if (!String(a[0]).startsWith('Hotovo')) o(...a); })(console.log);
let chyby = 0;
const over = (popis, ok) => { console.log((ok ? 'OK    ' : 'CHYBA ') + popis); if (!ok) chyby++; };
nastavTabulku(); nastavHodnotu_('slozka_zalohy', 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345');
// dvě organizace s tabulkou a jedna bez
const hdO = hlavicky_(M.sheets['Organizace']);
['KAL:Kalyna', 'HOS:Hospic', 'DOM:Domov'].forEach(s => { const [i, n] = s.split(':'); M.sheets['Organizace'].appendRow(hdO.map(h => ({ ID: i, 'Název': n, 'Aktivní': 'ANO' })[h] ?? '')); });
PropertiesService.getScriptProperties().setProperty('TABORG_KAL', 'TABULKA_KAL');
PropertiesService.getScriptProperties().setProperty('TABORG_HOS', 'TABULKA_HOS');
const RealDate = Date; let den = new RealDate(2026, 8, 1, 2, 0);
for (let i = 0; i < 300; i++) { global.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(den.getTime()); } static now() { return den.getTime(); } }; zalohujTabulku(); den = new RealDate(den.getTime() + 86400000); }
global.Date = RealDate;
const zivych = f => f.files.filter(x => !x.t).map(x => x.n);
const live = zivych(korenZaloh);
console.log('hlavní tabulka – denní:', live.filter(n => n.includes('– denní')).length, '| týdenní:', live.filter(n => n.includes('týdenní')).length);
over('hlavní tabulka: 5 denních a 30 týdenních záloh', live.filter(n => n.includes('– denní')).length === 5 && live.filter(n => n.includes('týdenní')).length === 30);
const podsl = korenZaloh.slozky.find(s => s.nazev === 'Tabulky organizací');
over('vznikla podsložka „Tabulky organizací“ (jen jednou)', !!podsl && korenZaloh.slozky.filter(s => s.nazev === 'Tabulky organizací').length === 1);
const o = id => zivych(podsl).filter(n => n.includes('organizace ' + id + ' –'));
for (const id of ['KAL', 'HOS']) {
  const d = o(id).filter(n => n.includes('– denní')), t = o(id).filter(n => n.includes('– týdenní'));
  console.log(id + ' – denní:', d.length, '| týdenní:', t.length);
  over(id + ': 5 denních a 30 týdenních záloh tabulky organizace', d.length === 5 && t.length === 30);
}
over('organizace bez tabulky (Domov) se nezálohuje', o('DOM').length === 0);
over('zálohy se dělají kopií správné tabulky', podsl.files.filter(x => !x.t && x.n.includes('organizace KAL')).every(x => x.zdroj === 'TABULKA_KAL') && podsl.files.filter(x => !x.t && x.n.includes('organizace HOS')).every(x => x.zdroj === 'TABULKA_HOS'));
over('názvy mají ID organizace, datum a název (nejnovější první při třídění)', /^Záloha tabulky organizace KAL – denní \d{4}-\d{2}-\d{2} – Kalyna$/.test(o('KAL').find(n => n.includes('– denní'))));
// týdenní zálohy dělané v pondělí
over('týdenní zálohy jsou z pondělí', o('KAL').filter(n => n.includes('týdenní')).every(n => { const m = n.match(/(\d{4})-(\d{2})-(\d{2})/); return new Date(+m[1], +m[2] - 1, +m[3]).getDay() === 1; }));
// chyba u jedné organizace nezastaví zálohu ostatních ani hlavní tabulky
const puvodni = DriveApp.getFileById;
DriveApp.getFileById = id => { if (id === 'TABULKA_KAL') throw new Error('tabulka byla smazána'); return puvodni(id); };
const predHos = o('HOS').length, predHlavni = zivych(korenZaloh).length;
global.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(den.getTime()); } static now() { return den.getTime(); } };
zalohujTabulku();
global.Date = RealDate;
over('smazaná tabulka jedné organizace nezastaví zálohu ostatních ani hlavní tabulky', zivych(korenZaloh).length >= predHlavni && o('HOS').filter(n => n.includes('– denní')).length === 5);
DriveApp.getFileById = puvodni;
console.log(chyby ? 'Zálohy: CHYBY ' + chyby : 'Zálohy: vše OK');
if (chyby) process.exitCode = 1;
