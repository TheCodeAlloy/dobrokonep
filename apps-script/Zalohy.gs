/**
 * DOBROVOLNICKÉ CENTRUM – AUTOMATICKÉ ZÁLOHY TABULKY
 * --------------------------------------------------------------
 * Každý den v noci se vytvoří kopie celé tabulky do složky „Zálohy“.
 * Uchovává se posledních N denních záloh (výchozí 5) a jednou týdně
 * (v pondělí) se uloží týdenní záloha, kterých se drží M (výchozí 30).
 * Starší zálohy se přesunou do koše.
 *
 * Zapnutí: v tabulce menu Dobrovolnické centrum → Zapnout automatické zálohy.
 */

function zapnoutZalohy() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'zalohujTabulku')
    .forEach(t => ScriptApp.deleteTrigger(t));
  const n = nastaveni_();
  const hodina = Math.min(23, Math.max(0, Number(n.zalohy_hodina) || 2));
  ScriptApp.newTrigger('zalohujTabulku').timeBased().everyDays(1).atHour(hodina).inTimezone(TZ).create();
  const slozka = slozkaZaloh_();
  zalohujTabulku();
  log_('Zálohy zapnuty', '', 'denně kolem ' + hodina + ':00');
  upozorni_('Automatické zálohy jsou zapnuté.\n\nKaždý den kolem ' + hodina + ':00 se vytvoří kopie tabulky do složky:\n' + slozka.getUrl() +
    '\n\nPrvní záloha se právě vytvořila.');
}

function vypnoutZalohy() {
  let pocet = 0;
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'zalohujTabulku')
    .forEach(t => { ScriptApp.deleteTrigger(t); pocet++; });
  log_('Zálohy vypnuty', '', '');
  upozorni_(pocet ? 'Automatické zálohy jsou vypnuté. Stávající zálohy zůstaly ve složce.' : 'Automatické zálohy nebyly zapnuté.');
}

function zalohovatNyni() {
  const f = zalohujTabulku();
  upozorni_('Záloha vytvořena:\n' + f.getName() + '\n\n' + f.getUrl());
}

// Spouští se automaticky každý den
function zalohujTabulku() {
  const n = nastaveni_();
  const slozka = slozkaZaloh_();
  const ss = ss_();
  const ted = new Date();
  const den = Utilities.formatDate(ted, TZ, 'yyyy-MM-dd');
  const zaklad = 'Záloha ' + (ss.getName ? ss.getName() : 'tabulky');

  // denní záloha (jen jedna za den – případnou dřívější dnešní nahradí)
  const nazevDenni = zaklad + ' – denní ' + den;
  smazPodleNazvu_(slozka, nazevDenni);
  const soubor = DriveApp.getFileById(ss.getId()).makeCopy(nazevDenni, slozka);

  // týdenní záloha v pondělí (nebo když ještě žádná týdenní není)
  const pondeli = Utilities.formatDate(ted, TZ, 'u') === '1';
  const tydenni = soubory_(slozka, zaklad + ' – týdenní ');
  if (pondeli || !tydenni.length) {
    const nazevTyd = zaklad + ' – týdenní ' + den;
    smazPodleNazvu_(slozka, nazevTyd);
    DriveApp.getFileById(ss.getId()).makeCopy(nazevTyd, slozka);
  }

  // úklid starých záloh
  const kolikDenni = Math.max(1, Number(n.zalohy_denni_pocet) || 5);
  const kolikTydenni = Math.max(1, Number(n.zalohy_tydenni_pocet) || 30);
  uklid_(soubory_(slozka, zaklad + ' – denní '), kolikDenni);
  uklid_(soubory_(slozka, zaklad + ' – týdenní '), kolikTydenni);

  log_('Záloha tabulky', '', soubor.getName());
  return soubor;
}

function slozkaZaloh_() {
  const n = nastaveni_();
  const id = extrahujId_(n.slozka_zalohy);
  if (id) return DriveApp.getFolderById(id);
  // výchozí: složka „Zálohy“ vedle složky Registrace
  let rodic;
  try {
    const p = slozkaZNastaveni_(n.slozka_registrace, 'slozka_registrace').getParents();
    rodic = p.hasNext() ? p.next() : DriveApp.getRootFolder();
  } catch (e) { rodic = DriveApp.getRootFolder(); }
  const it = rodic.getFoldersByName('Zálohy');
  const slozka = it.hasNext() ? it.next() : rodic.createFolder('Zálohy');
  nastavHodnotu_('slozka_zalohy', slozka.getUrl());
  return slozka;
}

function soubory_(slozka, predpona) {
  const out = [];
  const it = slozka.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (f.getName().indexOf(predpona) === 0) out.push(f);
  }
  return out.sort((a, b) => b.getName().localeCompare(a.getName())); // nejnovější první (datum v názvu)
}

function smazPodleNazvu_(slozka, nazev) {
  const it = slozka.getFilesByName(nazev);
  while (it.hasNext()) it.next().setTrashed(true);
}

function uklid_(soubory, ponechat) {
  soubory.slice(ponechat).forEach(f => f.setTrashed(true));
}
