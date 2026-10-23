// Kontrola: všechny soubory apps-script/ se dají načíst ve stejném pořadí jako v Apps Scriptu
// a kód na nejvyšší úrovni nesahá na věci z jiných souborů dřív, než jsou načtené.
// Chrání před chybou „LISTY is not defined“ (Dashboard.gs čte LISTY z Kod.gs, který se načítá později).
const nactiKod = require('./nacti-kod');

let chyby = 0;
try {
  nactiKod();
  if (typeof LISTY === 'undefined' || !LISTY.NASTAVENI) throw new Error('LISTY se nenačetlo');
  if (typeof editovatelneListy_ !== 'function') throw new Error('editovatelneListy_ chybí');
  console.log('Pořadí souborů: OK');
} catch (e) {
  chyby++;
  console.log('CHYBA pořadí souborů: ' + e.message);
}
process.exitCode = chyby ? 1 : 0;
