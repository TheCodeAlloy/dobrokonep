// Načte všechny soubory z apps-script/ do globálního kontextu Node.js
// (Apps Script má všechny soubory ve společném globálním prostoru).
const fs = require('fs'), path = require('path'), vm = require('vm');
// Pořadí jako v Apps Scriptu (abecedně). Kód na nejvyšší úrovni, který čte něco z pozdějšího souboru
// (např. LISTY z Kod.gs), tak spadne už při načítání – přesně jako na ostrém serveru.
const SOUBORY = ['Api.gs', 'Dashboard.gs', 'Hodiny.gs', 'Kod.gs', 'Portal.gs', 'Zalohy.gs'];
module.exports = function nactiKod() {
  const kod = SOUBORY.map(f => fs.readFileSync(path.join(__dirname, '..', 'apps-script', f), 'utf8')).join('\n');
  // const/let → var, aby byly proměnné dostupné i z testu (v Apps Scriptu jsou globální)
  vm.runInThisContext(kod.replace(/^const /gm, 'var ').replace(/^let /gm, 'var '));
};
module.exports.WEB = path.join(__dirname, '..', 'docs');
