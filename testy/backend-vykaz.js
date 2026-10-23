// Test ročního výkazu: počítají se jen schválené hodiny daného roku, měsíce a celkem sedí
process.env.TZ = 'Europe/Prague';
const M = require('./gas-mock.js');
require('./nacti-kod.js')();
let chyby = 0;
const over = (ok, popis) => { if (!ok) chyby++; console.log((ok ? 'OK ' : 'CHYBA ') + popis); };

nastavTabulku();
const shD = list_(LISTY.DOBROVOLNICI);
const hD = hlavicky_(shD);
shD.appendRow(hD.map(h => ({ 'ID': 'DC-2026-0001', 'Jméno': 'Eva', 'Příjmení': 'Testová', 'Organizace': 'ZOO, Naděje', 'Stav': 'Aktivní dobrovolník' }[h] || '')));
shD.appendRow(hD.map(h => ({ 'ID': 'DC-2026-0002', 'Jméno': 'Bez', 'Příjmení': 'Hodin', 'Stav': 'Aktivní dobrovolník' }[h] || '')));

const shH = list_(LISTY.HODINY);
const hH = hlavicky_(shH);
const zapis = (o) => shH.appendRow(hH.map(h => o[h] || ''));
zapis({ 'ID záznamu': 'H1', 'ID dobrovolníka': 'DC-2026-0001', 'Datum': new Date(2026, 2, 10, 12), 'Minut': 120, 'Stav': 'Schváleno' });
zapis({ 'ID záznamu': 'H2', 'ID dobrovolníka': 'DC-2026-0001', 'Datum': '2026-03-20', 'Minut': 90, 'Stav': 'Schváleno' });
zapis({ 'ID záznamu': 'H3', 'ID dobrovolníka': 'DC-2026-0001', 'Datum': '2026-05-02', 'Minut': 60, 'Stav': 'Ke schválení' });
zapis({ 'ID záznamu': 'H4', 'ID dobrovolníka': 'DC-2026-0001', 'Datum': '2025-12-30', 'Minut': 300, 'Stav': 'Schváleno' });

const radky = sestavRocniVykaz_(2026);
over(radky.length === 1, 'výkaz obsahuje jen dobrovolníka s hodinami v roce 2026 (' + radky.length + ')');
const hlav = vykazHlavicky_();
const r = radky[0];
over(r[0] === 'Testová Eva', 'jméno ve formátu Příjmení Jméno');
over(r[hlav.indexOf('Organizace 1')] === 'ZOO' && r[hlav.indexOf('Organizace 2')] === 'Naděje', 'organizace rozdělené podle čárky');
over(r[hlav.indexOf('Březen (h)')] === 3.5, 'březen = 120 + 90 min = 3,5 h (' + r[hlav.indexOf('Březen (h)')] + ')');
over(r[hlav.indexOf('Květen (h)')] === 0, 'neschválený zápis se nepočítá');
over(r[r.length - 1] === 3.5, 'celkem = 3,5 h (' + r[r.length - 1] + ')');
over(r.length === hlav.length, 'počet sloupců odpovídá hlavičce');

console.log(chyby ? 'Výkaz: CHYB ' + chyby : 'Výkaz: OK');
process.exitCode = chyby ? 1 : 0;
