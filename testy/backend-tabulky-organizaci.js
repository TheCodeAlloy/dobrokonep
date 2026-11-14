// Tabulky organizací (krok 1): způsob vykazování u dvojice dobrovolník + organizace, listy papírových dobrovolníků
process.env.TZ = 'Europe/Prague';
const M = require('./gas-mock.js');
require('./nacti-kod.js')();
let role = 'Koordinátor';
const P = { 'Jen čtení': 0, 'Koordinátor': 1, 'Hlavní admin': 2 };
overAdmin_ = (t, r) => { if (P[role] < P[r]) throw new Error('Nedostatečná role'); AKTUALNI_UZIVATEL = 'k@k.cz'; return { email: 'k@k.cz', role }; };
let kdo = 'DC-2026-0001';
overDobrovolnik_ = () => ({ id: kdo, email: 'x@x.cz', z: { 'Jméno': 'Jan', 'Příjmení': 'Novák' } });
log_ = () => {};
const vytvoreno = [], nastaveno = [], sdileno = [];
let selhani = false;
tabOrgVytvor_ = nazev => { if (selhani) throw new Error('Chybí oprávnění k Disku'); vytvoreno.push(nazev); return 'TAB' + vytvoreno.length; };
tabOrgNastavListy_ = (id, info) => { nastaveno.push({ id, listy: info.listy.map(l => l.nazev), cinnosti: info.cinnosti.length, org: info.orgNazev }); };
tabOrgSdilej_ = (id, emaily) => sdileno.push({ id, emaily });
let chyby = 0;
const over = (popis, ok) => { console.log((ok ? 'OK    ' : 'CHYBA ') + popis); if (!ok) chyby++; };
const chyba = fn => { try { fn(); return ''; } catch (e) { return e.message; } };
nastavTabulku();
const hdO = hlavicky_(M.sheets['Organizace']);
['KAL:Kalyna', 'HOS:Hospic'].forEach(s => { const [i, n] = s.split(':'); M.sheets['Organizace'].appendRow(hdO.map(h => ({ ID: i, 'Název': n, 'Aktivní': 'ANO' })[h] ?? '')); });
const hdD = hlavicky_(M.sheets['Dobrovolníci']);
[['0001', 'Jan', 'Novák'], ['0002', 'Eva', 'Malá'], ['0003', 'Petr', 'Cizí']].forEach(([i, j, p]) => M.sheets['Dobrovolníci'].appendRow(hdD.map(h => ({ ID: 'DC-2026-' + i, 'Jméno': j, 'Příjmení': p, 'E-mail': j.toLowerCase() + '@x.cz', 'Telefon': '777', 'Stav': 'Aktivní dobrovolník', 'Způsob vykazování': i === '0003' ? 'Organizace podle papírového výkazu' : '' })[h] ?? '')));
// přiřazení vznikla před zavedením volby u přiřazení: Petr byl dřív papírový na úrovni dobrovolníka
pridejPrirazeni('T', 'DC-2026-0001', 'KAL', '', ''); pridejPrirazeni('T', 'DC-2026-0001', 'HOS', '', '');
pridejPrirazeni('T', 'DC-2026-0002', 'KAL', '', ''); pridejPrirazeni('T', 'DC-2026-0003', 'KAL', '', '');
const pr = (d, o) => prirazeni_().find(p => p.dobrovolnik === d && p.orgId === o);
const PAPIR = 'Organizace podle papírového výkazu';

// migrace staré volby z dobrovolníka na přiřazení (jednorázově)
PropertiesService.getScriptProperties().deleteProperty('ZPUSOB_PREVEDEN');
prevedZpusobNaPrirazeni_();
over('migrace: Petr (dřív papírový) je papírový u svého přiřazení, ostatní sami', pr('DC-2026-0003', 'KAL').papir && !pr('DC-2026-0001', 'KAL').papir);

// nastavení způsobu u dvojice
let r = nastavZpusobPrirazeni('T', pr('DC-2026-0001', 'KAL').id, PAPIR);
over('Jan je papírový u Kalyny, ale u Hospice dál sám', pr('DC-2026-0001', 'KAL').papir && !pr('DC-2026-0001', 'HOS').papir);
over('tabulka Kalyny se vytvořila a má listy Jana a Petra (ne Evy)', vytvoreno.length === 1 && /Kalyna/.test(vytvoreno[0]) && nastaveno[0].listy.length === 2 && nastaveno[0].listy.some(n => /Novák Jan \(DC-2026-0001\)/.test(n)) && nastaveno[0].listy.some(n => /Cizí Petr/.test(n)) && !nastaveno[0].listy.some(n => /Malá/.test(n)));
over('odpověď obsahuje odkaz na tabulku, žádnou chybu', /docs\.google\.com\/spreadsheets\/d\/TAB1/.test(r.tabulka.url) && !r.tabulka.chyba);
over('nabídka činností je v tabulce', nastaveno[0].cinnosti > 0);
r = nastavZpusobPrirazeni('T', pr('DC-2026-0002', 'KAL').id, PAPIR);
over('další papírový dobrovolník: tabulka se nevytváří znovu, přibyl list', vytvoreno.length === 1 && nastaveno[1].listy.length === 3);
r = nastavZpusobPrirazeni('T', pr('DC-2026-0002', 'KAL').id, 'Sám');
over('přepnutí zpět na „Sám“: list se z tabulky vyřadí (skryje), nic se nemaže', nastaveno[2].listy.length === 2 && !nastaveno[2].listy.some(n => /Malá/.test(n)));
over('neznámý způsob odmítnut', /Neznámý/.test(chyba(() => nastavZpusobPrirazeni('T', pr('DC-2026-0002', 'KAL').id, 'blbost'))));
over('Hospic nemá žádnou tabulku (nemá papírové dobrovolníky)', !tabulkyOrganizaci('T').HOS && /TAB1/.test(tabulkyOrganizaci('T').KAL.url));

// ruční vytvoření, sdílení
over('ruční aktualizace listů', tabulkaOrganizace('T', 'KAL').nova === false);
over('sdílení bez koordinátorů odmítnuto', /žádného aktivního koordinátora/.test(chyba(() => sdilejTabulkuOrganizace('T', 'KAL'))));
const hdK = hlavicky_(M.sheets['Koordinátoři organizací']);
const kr = (e, o, a) => M.sheets['Koordinátoři organizací'].appendRow(hdK.map(h => ({ 'E-mail': e, 'Jméno': 'K', 'ID organizace': o, 'Aktivní': a })[h] ?? ''));
kr('karel@kal.cz', 'KAL', 'ANO'); kr('neaktivni@kal.cz', 'KAL', 'NE'); kr('jiny@hos.cz', 'HOS', 'ANO');
over('sdílení jen s aktivními koordinátory této organizace', sdilejTabulkuOrganizace('T', 'KAL').pocet === 1 && sdileno[0].emaily.join() === 'karel@kal.cz');
over('Hospic bez tabulky: sdílení odmítnuto', /ještě neexistuje/.test(chyba(() => sdilejTabulkuOrganizace('T', 'HOS'))));

// papírový dobrovolník nezapisuje v portálu
kdo = 'DC-2026-0001';
over('papírový dobrovolník (Jan u Kalyny) v portálu nezapíše', /zapisuje organizace/.test(chyba(() => dZapisHodiny('T', { orgId: 'KAL', datum: ymd_(new Date()), od: '09:00', do: '10:00', cinnost: 'X' }))));
over('u Hospice (sám) zapíše', !chyba(() => dZapisHodiny('T', { orgId: 'HOS', datum: ymd_(new Date()), od: '09:00', do: '10:00', cinnost: 'X' })));
over('portál: organizace u dobrovolníka nese příznak papir', dMojeData('T').organizace.find(o => o.id === 'KAL').papir === true && dMojeData('T').organizace.find(o => o.id === 'HOS').papir === false);
over('Eva (už zase sama) v portálu zapíše', (kdo = 'DC-2026-0002', !chyba(() => dZapisHodiny('T', { orgId: 'KAL', datum: ymd_(new Date()), od: '09:00', do: '10:00', cinnost: 'X' }))));

// přehled měsíců ví o papírové dvojici
ulozHodiny('T', { dobrovolnik: 'DC-2026-0001', orgId: 'KAL', datum: ymd_(new Date()).slice(0, 4) + '-02-10', od: '09:00', do: '10:00', cinnost: 'X' });
ulozHodiny('T', { dobrovolnik: 'DC-2026-0001', orgId: 'HOS', datum: ymd_(new Date()).slice(0, 4) + '-02-10', od: '09:00', do: '10:00', cinnost: 'X' });
const rad = nactiMesice('T', { rok: ymd_(new Date()).slice(0, 4) }).radky.filter(g => g.dobrovolnik === 'DC-2026-0001' && g.mesic.endsWith('-02'));
over('přehled měsíců: papír jen u Kalyny, ne u Hospice', rad.find(g => g.orgId === 'KAL').papir === true && rad.find(g => g.orgId === 'HOS').papir === false);

// organizace v portálu vidí odkaz na svou tabulku (a jen na svou)
kdo = 'DC-2026-0001';
const hdKo = hlavicky_(M.sheets['Koordinátoři organizací']);
const tokenO = (() => { const t = 'tokenO'; PropertiesService.getScriptProperties().setProperty('SESO_' + hash_(t), JSON.stringify({ email: 'karel@kal.cz', exp: Date.now() + 1e9 })); return t; })();
const od = oMojeData(tokenO);
over('portál organizace: odkaz na tabulku Kalyny', Object.keys(od.tabulky).join() === 'KAL' && /TAB1/.test(od.tabulky.KAL.url));
over('portál organizace: ví, kdo je papírový', od.dobrovolnici.find(d => d.id === 'DC-2026-0001').prirazeni[0].papir === true);

// selhání Disku nebrání uložení volby
selhani = true;
M.sheets['Dobrovolníci'].appendRow(hdD.map(h => ({ ID: 'DC-2026-0004', 'Jméno': 'Nový', 'Příjmení': 'Test', 'E-mail': 'n@x.cz', 'Stav': 'Aktivní dobrovolník' })[h] ?? ''));
pridejPrirazeni('T', 'DC-2026-0004', 'HOS', '', '');
r = nastavZpusobPrirazeni('T', pr('DC-2026-0004', 'HOS').id, PAPIR);
over('při chybě Disku se volba uloží a chyba se vrátí', pr('DC-2026-0004', 'HOS').papir && /oprávnění/.test(r.tabulka.chyba) && !r.tabulka.url);
role = 'Jen čtení';
over('jen čtení nesmí měnit způsob ani vytvářet tabulky', /role/.test(chyba(() => nastavZpusobPrirazeni('T', pr('DC-2026-0001', 'KAL').id, 'Sám'))) && /role/.test(chyba(() => tabulkaOrganizace('T', 'KAL'))));
over('jen čtení smí vidět odkazy', !!tabulkyOrganizaci('T').KAL);

console.log(chyby ? 'Tabulky organizací: CHYBY ' + chyby : 'Tabulky organizací: vše OK');
if (chyby) process.exitCode = 1;
