// Načte všechny soubory z apps-script/ do globálního kontextu Node.js
// (Apps Script má všechny soubory ve společném globálním prostoru).
const fs = require('fs'), path = require('path'), vm = require('vm');
const SOUBORY = ['Kod.gs', 'Dashboard.gs', 'Hodiny.gs', 'Portal.gs', 'Zalohy.gs', 'Api.gs'];
module.exports = function nactiKod() {
  const kod = SOUBORY.map(f => fs.readFileSync(path.join(__dirname, '..', 'apps-script', f), 'utf8')).join('\n');
  // const/let → var, aby byly proměnné dostupné i z testu (v Apps Scriptu jsou globální)
  vm.runInThisContext(kod.replace(/^const /gm, 'var ').replace(/^let /gm, 'var '));
};
module.exports.WEB = path.join(__dirname, '..', 'docs');
