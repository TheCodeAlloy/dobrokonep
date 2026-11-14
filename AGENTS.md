# AGENTS.md – Dobrovolnický systém (Dobrovolnické centrum, KONEP)

Tento soubor čtou AI nástroje (Codex, Claude Code). Popisuje, jak systém funguje,
jak ho měnit a nasazovat. **Před každou úpravou si ho přečti celý.**
Uživatel (správce systému) komunikuje česky a není programátor – vysvětluj
srozumitelně, bez žargonu, a před riskantními kroky (mazání dat, změna nasazení)
se zeptej.

## 1. Co systém dělá

Evidence zájemců o dobrovolnictví, dobrovolníků, schůzek, dokumentů a
odpracovaných dobrovolnických hodin pro Dobrovolnické centrum
(Koalice nevládek Pardubicka).

| Část | Soubor | Kdo používá |
|---|---|---|
| Registrační formulář | `docs/index.html` | veřejnost |
| Dashboard | `docs/dashboard.html` | koordinátorky, správci |
| Portál dobrovolníka (zápis hodin) | `docs/hodiny.html` | aktivní dobrovolníci |
| Portál organizace | `docs/organizace.html` | koordinátoři přijímajících organizací |
| Server (API) | `apps-script/*.gs` | volají ho všechny stránky |

## 2. Architektura

```
prohlížeč (GitHub Pages)                       Google
docs/index.html      ──┐                ┌── Apps Script webová aplikace (apps-script/)
docs/dashboard.html  ──┼─ fetch POST ──>│     doPost → API mapy (Api.gs)
docs/hodiny.html     ──┘  (JSON)        │     ├─ Tabulka Google (data)
                                        │     ├─ Disk (PDF, smlouvy, zálohy)
                                        │     ├─ Gmail (MailApp)
                                        │     └─ Kalendář (schůzky)
```

- **Proč stránky na GitHubu a ne v Apps Scriptu:** HtmlService stránky v Apps Scriptu
  padaly při více přihlášených účtech Google v prohlížeči („soubor nelze otevřít“,
  přepisování domény v URL). Stránky na github.io tento problém nemají. **Nevracet zpět.**
- Komunikace: `fetch(API_URL, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON})`.
  `text/plain` je záměr – vyhne se CORS preflightu, který Apps Script neumí.
  Společná funkce `volejApi(akce, args, token)` je v `docs/config.js`.
- Požadavek: `{ akce, token, args: [...] }`, odpověď `{ ok: true, data }` nebo `{ ok: false, chyba }`.
- Chyba začínající `PRIHLASENI:` = neplatné/vypršelé přihlášení → stránka ukáže přihlášení.
- Žádný build, žádný framework: čisté HTML/CSS/JS v jednom souboru na stránku.

## 3. Soubory

### apps-script/ (Google Apps Script, V8; všechny soubory sdílejí jeden globální prostor)
| Soubor | Obsah |
|---|---|
| `Kod.gs` | konstanty (LISTY, sloupce, stavy, výchozí nastavení a šablony e-mailů), `nastavTabulku()` (idempotentní nastavení/migrace tabulky), registrace z formuláře, PDF, e-maily, pomocné funkce (`ss_`, `list_`, `nastaveni_`, `zapisDoRadku_`, `bunka_`, `log_`…), menu v tabulce |
| `Dashboard.gs` | přihlášení administrátorů (kód, odkaz, Google, osobní odkaz z notifikace), `nactiData`, úpravy dobrovolníka, schůzky + kalendář (osobní i online se stálým odkazem `odkaz_online_schuzky`; HTML e-mail s tlačítkem `posliEmailSchuzky_`, zástupný znak `{odkaz_schuzky}`), výmaz (GDPR), generování smlouvy/docházky z šablon Google Docs, administrace číselníků |
| `Hodiny.gs` | přiřazení dobrovolník↔organizace, katalog činností, zápis hodin (jednotlivě nebo akce; vždy od–do), schvalování (po řádcích i po měsících se zámkem), historie změn, mazání, uzávěrka |
| `Portal.gs` | portál dobrovolníka: přihlášení (kód, odkaz, pozvánka, Google), relace, vlastní hodiny |
| `TabulkyOrganizaci.gs` | tabulky organizací pro papírové výkazy (vytvoření tabulky, listy dobrovolníků, sdílení; Disk izolovaný v pár funkcích) |
| `PortalOrganizace.gs` | portál organizace: koordinátoři organizací (list `Koordinátoři organizací`), přihlášení (kód, odkaz, Google; relace `SESO_`, ověření `overKoordinatorOrg_`), data jen vlastních organizací, zápis/úprava/mazání hodin, fotky výkazů |
| `Zalohy.gs` | denní zálohy tabulky (5 denních + 30 týdenních), spouštěč |
| `Api.gs` | `doPost`/`doGet`, mapy povolených akcí `API_VEREJNE`, `API_ADMIN`, `API_DOBROVOLNIK` |

### docs/ (GitHub Pages – web)
`index.html` (formulář), `dashboard.html`, `hodiny.html` (portál), `config.js` (adresa API + `volejApi`),
`organizace.html` (portál organizace) + `manifest-organizace.webmanifest`, `fotka-vykazu.js` (sdílené nahrávání/zobrazení fotek výkazu; načítat s `?v=`), `rocni-hodiny.js` (sdílená roční stránka hodin dobrovolníka: ouška roků a organizací, měsíce, přidání/úprava řádku přímo v seznamu; načítá se s `?v=RRRR-MM-DD` – při změně souboru číslo zvyš; používá ji detail dobrovolníka v dashboardu i portál, později portál organizace; stránka jen kreslí, pravidla vždy ověřuje server), `logo.png`, `manifest.webmanifest` (přidání na plochu), `.nojekyll`.

### testy/ (Node.js, napodobenina Apps Scriptu)
`gas-mock.js` (SpreadsheetApp, PropertiesService, CacheService, MailApp… v paměti), `nacti-kod.js`,
`backend-*.js` (logika serveru), `prohlizec-*.js` (Playwright: dashboard a portál proti napodobenému serveru).

### dokumentace/
`NASAZENI.md` (postup pro člověka), `PLAN.md` (rozpracované a plánované věci), návod pro koordinátorky (`.docx` + generátor `navod.js`).

## 4. Datový model (Tabulka Google)

Listy (konstanta `LISTY` v `Kod.gs`): Dobrovolníci, Nastavení, Administrátoři, Oblasti zájmu, Místa,
Organizace, Šablony e-mailů, Hodiny, Přiřazení, Činnosti, Měsíce, Historie hodin, Fotky výkazů, Koordinátoři organizací, Log změn (+ samostatné tabulky organizací na sdíleném disku, viz níže).

- **Ke sloupcům se přistupuje podle názvu v záhlaví, nikdy podle pozice** (`hlavicky_(sh)` + `indexOf`).
  Nové sloupce přidává `zajistiList_` na konec listu – pořadí v tabulce se může lišit.
- **Dobrovolníci** – sloupce v `SLOUPCE_DOBROVOLNICI`. ID `DC-RRRR-0001` (`dalsiCislo_`). `Stav` ∈ `STAVY`.
  Sloupec `Organizace` je jen odvozený přehled aktivních přiřazení (`synchronizujOrganizace_`).
- **Pravidla zápisu hodin (od fáze A):** čas se zadává vždy jako od–do (hodiny 0–24, minuty po 5, „do“ po „od“ téhož dne, 24:00 povoleno); volba „jen délka“ a Měsíční výkaz zrušeny. Starší záznamy bez od–do platí dál, jejich úprava vyžaduje od–do. Má-li dobrovolník víc organizací, organizace se nepředvyplňuje a bez výběru se zápis neuloží; s jednou je předvyplněná. Validace je v `pripravZapis_` / `minutyZCasu_` (Hodiny.gs). Plán celé přestavby: `dokumentace/PLAN-HODINY.md`.
- **Hodiny** – `SLOUPCE_HODINY`. Pravdou je sloupec **`Minut`** (celé číslo, zaokrouhleno na 5 min);
  `Počet hodin` je jen pro čitelnost. `Stav` ∈ Ke schválení / Schváleno / Zamítnuto. `Zdroj` = Dashboard / Akce /
  Starý měsíční výkaz (jen u starých záznamů) / Dobrovolník. `ID organizace` (ORG-001) je klíč, `Organizace` je název (snímek).
- **Zamykání je zatím VYPNUTÉ** (Nastavení `zamykani_mesicu` = NE; prázdné/chybějící = vypnuto; `zamykaniZapnuto_()`). Při vypnutí `mesicZamcen_`/`overZamek_`/`overMinulyRok_` nic neblokují, schvalování měsíců jen označí čekající hodiny jako Schváleno (list `Měsíce` se nezapisuje), odemykání a převod jsou zablokované a portály dostávají `zamykani: false`. Kód zámků zůstává; zapnutí = `zamykani_mesicu` ANO. Rozhodnutí uživatele: zámky vrátit až bude celý tok fungovat (portál i tabulky organizací), zamykat bude jen KONEP, a to jak v tabulce, tak v systému. Starší globální `hodiny_uzavreno_do` je samostatné a prázdné = nic.
- **Měsíce a zámky (fáze C1; platí jen při zapnutém zamykání)** – list `Měsíce` (`SLOUPCE_MESICE`): řádek dobrovolník + organizace + měsíc (RRRR-MM), `Stav` = Schváleno (zamčeno) / Odemčeno (kdo, kdy, proč). Schválení (`schvalMesice`, Koordinátor i Hlavní admin) schválí všechny čekající hodiny dvojice za měsíc a zamkne ho; `odemkniMesic` jen Hlavní admin s důvodem. V zamčeném měsíci nejde zapsat, upravit, smazat ani změnit stav (`overZamek_` v `pripravZapis_`, `ulozHodiny`, `smazHodiny`, `zmenStavHodin`, portálu; akce: nic se neuloží a vypíše se, u koho). Dobrovolník nesmí měnit hodiny z minulého roku (`overMinulyRok_`), koordinátor ano, dokud měsíc není schválený. List `Historie hodin` (`historie_`) eviduje zápis/úpravu/smazání/změnu stavu/schválení/odemčení bez IP adres; u hodin je sloupec `Role zapisujícího`. Hodiny se schvalují jen po celých měsících (`zmenStavHodin` už neumí „Schváleno“, jen Zamítnuto / Ke schválení). Globální `hodiny_uzavreno_do` platí dál vedle zámků, dokud ho správce neodstraní z Nastavení. **Převod dosavadního schvalování (fáze C3):** `nahledPrevoduSchvalovani` (nic nemění) a `provedPrevodSchvalovani` (jen Hlavní admin; nejdřív záloha tabulky `zalohaPredPrevodem_`, při chybě nic nezmění; zamkne měsíce dvojice dobrovolník+organizace, kde je vše Schváleno; neuzamyká probíhající měsíc, měsíc se Ke schválení/Zamítnuto ani záměrně odemčený měsíc; zamítnuté řádky a řádky bez ID organizace vypíše). V dashboardu: Schvalování měsíců → Převod dosavadního schvalování. Záznamy z API nesou příznak `zamceno`. V dashboardu: Hodiny → Schvalování měsíců.
- **Fotky papírových výkazů (fáze C2)** – list `Fotky výkazů` (`SLOUPCE_FOTKY`): dobrovolník + organizace + měsíc → soubor v osobní složce dobrovolníka (podsložka „Výkazy hodin“). Na Disk sahají jen `ulozSouborFotky_`, `nactiSouborFotky_`, `smazSouborFotky_` (testy je nahrazují pamětí). Fotka se zobrazuje jen přes API s ověřením (`nactiFotkuVykazu` / `dNactiFotkuVykazu` – dobrovolník vidí jen své); do tabulky ani na web se nedávají odkazy na soubory. Klient (`docs/fotka-vykazu.js`) zmenší fotku na cca 1600 px (JPEG); server přijme jen JPEG do `MAX_FOTKA_ZNAKU`, nejvýše 10 za měsíc. Zamčený měsíc chrání i fotky (`overZamek_`); dobrovolník nemění minulý rok. U dobrovolníka sloupec `Způsob vykazování` (Sám / Organizace podle papírového výkazu, zatím jeden na dobrovolníka): u „papírového“ měsíce bez fotky jen upozorní při schválení. Výmaz dobrovolníka (GDPR) smaže i řádky fotek (soubory mizí s osobní složkou).
- **Portál organizace (fáze D1)** – list `Koordinátoři organizací` (`SLOUPCE_KORDORG`: E-mail, Jméno, ID organizace, Aktivní; více řádků = více organizací nebo více koordinátorů; spravuje KONEP v Administraci). Přihlášení stejně jako u dobrovolníků (`oPosliKod`/`oOverKod`/`oPrihlasitOdkazem`/`oPrihlasitGoogle`, e-mail `prihlaseni_organizace`, odpověď na neznámý e-mail je stejná). Oprávnění se při každém požadavku čte znovu ze seznamu, takže odebrání platí hned. **Viditelnost vynucuje server** (`oMojeData`): jen dobrovolníci přiřazení k organizacím koordinátora (jen titul, jméno, e-mail, telefon, stav – žádná adresa ani datum narození), jen hodiny a fotky těchto organizací. Zápis (`oUlozHodiny`, Zdroj „Organizace“, Stav „Ke schválení“, role „Koordinátor organizace“) a mazání jen u vlastní organizace a neschválených řádků; zamčený měsíc (`overZamek_`) a minulý rok (`overMinulyRok_`) jsou zamčené; schvaluje a odemyká jen KONEP. Žádné e-maily o nových zápisech. Dosud nehotové: pozvánka nového dobrovolníka od organizace (D2).
- **Přiřazení** – `SLOUPCE_PRIRAZENI`: dobrovolník ↔ organizace s obdobím Od–Do (prázdné = bez omezení) a `Způsob vykazování` **u této dvojice** (Sám / Organizace podle papírového výkazu; `prirazeni_()` vrací `zpusob` a `papir`; dřívější volba u dobrovolníka se jednorázově převedla – `prevedZpusobNaPrirazeni_`).
- **Tabulky organizací (papírové výkazy) – krok 1** (`TabulkyOrganizaci.gs`): organizace s aspoň jedním aktivním „papírovým“ přiřazením má jednu Google tabulku na sdíleném disku KONEP (složka v Nastavení `slozka_tabulek_organizaci`, výchozí „Tabulky organizací“ vedle Záloh); ID tabulky je jen v Script Properties `TABORG_<ID organizace>` (nikdy v repozitáři). Tabulka má list Návod, skrytý list Seznamy (činnosti) a list pro každého papírového dobrovolníka („Příjmení Jméno (ID)“; sloupce Datum, Od, Do, Hodin, Činnost, Poznámka, Zneplatnit řádek [zaškrtnutí = šedě a přeškrtnutě], Stav, skryté ID záznamu). Při přepnutí na „Sám“ se list jen skryje. Na Disk a cizí tabulky sahají jen `slozkaTabulekOrg_`, `tabOrgVytvor_`, `tabOrgNastavListy_`, `tabOrgSdilej_` (testy je nahrazují; skutečné chování ověří správce ručně). `nastavZpusobPrirazeni` volbu uloží a tabulku založí/upraví (chyba Disku volbu neblokuje); `tabulkaOrganizace`, `sdilejTabulkuOrganizace` (jen aktivní koordinátoři organizace dostanou právo úprav, sdílení dál se zakáže), `tabulkyOrganizaci`. Papírový dobrovolník v portálu nezapisuje (`dZapisHodiny` odmítne). Portál organizace ukáže odkaz na tabulku. **Zbývá krok 2:** načítání řádků z tabulek do databáze (kontrola jako na webu, zdroj „Tabulka organizace“, zneplatnění řádku, zpětný zápis stavu, „Načíst teď“ + týdenní spouštěč).
- **Organizace** – čte se **podle názvů sloupců**, takže je lze v tabulce libovolně přesouvat (`PORADI_ORGANIZACE` v `Kod.gs`; při prvním `nastavTabulku` se sloupce jednorázově seřadí, příznak `ORG_SERAZENO` v Script Properties, ruční pořadí se pak nepřepisuje). Přiřazení a Hodiny se zatím čtou podle pozice. sloupce ID, Název, Kontaktní osoba, E-mail, Telefon, Adresa, Oblast, Aktivní, Poznámky + (přidané na konec) `Funkce / pozice`, `Kontaktní osoba 2/3`, `Funkce / pozice 2/3`, `E-mail 2/3`, `Telefon 2/3`, `IČ`, `Město`, `Ulice`, `PSČ`, `Titul`/`Titul 2`/`Titul 3` (adresa se skládá z nich; starý sloupec Adresa se při `nastavTabulku` jednorázově přesune do Ulice). ID organizace je v dashboardu editovatelné (zkratka); přejmenování přepíše `ID organizace` i v Hodinách a Přiřazeních (`prejmenujIdOrganizace_`). Kontaktní osoba 1 = původní sloupce. V dashboardu (Administrace → Organizace) jsou osoby 1–3 seskupené a barevně odlišené (`KONF.ORGANIZACE.zobraz`); do smluv jde osoba 1 (`organizace_kontakt`, `organizace_funkce`). `organizace_()` vrací i pole `kontakty`.
- **Činnosti** – Organizace (název nebo „Všechny organizace“), Činnost, Aktivní. V dashboardu je to křížová mapa činnost × organizace (`admCinnosti`; server `nastavCinnost`, `pridejCinnost`, `prejmenujCinnost`, `smazCinnost`). Zaškrtnutí = Aktivní ANO; odškrtnutí jen přepne na NE (výběr jde vrátit). „Všechny organizace“ zešedí jednotlivé sloupce, ale jejich výběr se nemaže.
- **Nastavení** – klíč/hodnota/popis; výchozí řádky ve `vychoziNastaveni_()`; čtení `nastaveni_()`.
- **Online schůzky** – stálý odkaz (Meet/Zoom/Teams) je v Nastavení `odkaz_online_schuzky` (nikdy v kódu, repozitář je veřejný). U dobrovolníka sloupec `Online schůzka` (ANO/NE). V dashboardu tlačítko „Připojit se k online schůzce“ v menu a v kartě Schůzka.
- **Šablony e-mailů** – klíč/popis/předmět/text se zástupnými znaky `{jmeno}` apod. (`dosad_`).
- Datumy: `parsujDatum_('RRRR-MM-DD')` vytváří Date v poledne (kvůli časovým pásmům). Časová zóna `Europe/Prague`.

## 5. Přihlášení a oprávnění

| Kdo | Jak | Relace (Script Properties) | Ověření |
|---|---|---|---|
| Administrátor (list Administrátoři, Aktivní=ANO) | kód e-mailem / odkaz v e-mailu s kódem / Google / osobní odkaz v notifikaci (3 dny) | `SES_<hash>` | `overAdmin_(token, minRole)` |
| Dobrovolník (stav „Aktivní dobrovolník“ + e-mail) | pozvánka (14 dní) / kód / odkaz / Google | `SESD_<hash>` | `overDobrovolnik_(token)` |

- Role administrátorů: `Jen čtení` < `Koordinátor` < `Hlavní admin` (`PORADI_ROLI`). Každá serverová funkce
  si roli ověřuje sama na prvním řádku. **Nová akce = nový řádek v API mapě + kontrola oprávnění.**
- Tokeny se ukládají jen jako SHA-256 otisk. Jednorázové kódy a krátké odkazy v `CacheService` (10 min).
- Odkazy v e-mailech nesmí být „spotřebovány“ pouhým načtením (e-mailové aplikace v mobilu stránky
  přednačítají) – proto jsou odkazy v rámci platnosti znovupoužitelné, nebo vyžadují klepnutí.
- Na neznámý e-mail se nic neposílá, ale odpověď je stejná (nezjistí se, kdo je v systému).
- Dobrovolník: zápis max. `hodiny_zpetne_dni` (60) dní zpět, jen k platnému přiřazení, zápisy čekají na schválení,
  schválené nemůže měnit. Administrátor smí zapisovat zpětně bez omezení (stačí existující přiřazení).
- Uzávěrka `hodiny_uzavreno_do` (RRRR-MM): starší hodiny mění jen Hlavní admin.

## 6. Pravidla pro úpravy

1. **Jazyk:** veškeré texty pro uživatele česky, srozumitelně, bez technických termínů. Názvy funkcí a proměnných
   jsou česky bez diakritiky (`ulozHodiny`, `nactiData`); dodržuj to.
2. **Osobní údaje (GDPR):** nikdy neposílej osobní údaje e-mailem administrátorům (jen ID + odkaz),
   nepiš je do logů zbytečně, nepřidávej externí služby, které by data dostaly mimo Google.
   Repozitář je **veřejný** – nikdy do něj nedávej ID tabulky, složek, e-maily lidí ani jiná data.
3. **Bezpečnost:** každý zápis z veřejného formuláře prochází `bunka_()` (ochrana proti vzorcům) a validací.
   HTML výstupy escapuj (`esc` / `esc_`). Nové serverové akce vždy s ověřením role.
4. **Pořadí souborů v Apps Scriptu:** na nejvyšší úrovni souboru neodkazuj na funkce z jiných souborů
   (Apps Script načítá soubory postupně, podle abecedy: Api, Dashboard, Hodiny, Kod, Portal, Zalohy). Proto jsou API mapy obalené `function () { return x.apply(null, arguments); }`.
   Konstanty z `Kod.gs` (např. `LISTY`) proto nepoužívej na nejvyšší úrovni jiných souborů, jen uvnitř funkcí.
   Hlídá to `testy/poradi-souboru.js` (spouští se v `npm test`), který načítá soubory ve stejném pořadí.
5. **Mezipaměť serveru:** `MEMO` (v rámci jednoho požadavku) drží `nastaveni_()`, `organizace_()`, `ss_()`.
   Po zápisu do Nastavení/Organizací ji zneplatni (`delete MEMO.nastaveni` apod.). `doPost` ji nuluje.
6. **Schéma tabulky:** změny sloupců/listů/nastavení/šablon dělej v konstantách v `Kod.gs`/`Hodiny.gs`
   a v `nastavTabulku()` / `migrace_()` – musí být **idempotentní** (opakované spuštění nic nerozbije a
   nepřepíše uživatelská data). Po nasazení je potřeba v Apps Scriptu spustit `nastavTabulku`.
7. **Frontend:** dashboard kreslí obrazovky okamžitě z mezipaměti (`CACHE`, `D`) a data obnovuje na pozadí
   (`obnovNaPozadi`, `nactiTabHodin`). Ukládání formulářů probíhá na pozadí; při chybě se formulář znovu otevře.
   Zachovej tento vzor – uživatel chce svižný systém.
8. **Verze stránky:** po každé změně `docs/dashboard.html` zvyš text `verze RRRR-MM-DD?` v přihlašovacím okně
   (podle něj se ověřuje, že GitHub Pages už nasadil novou verzi).
9. **Mobil:** formulář a portál musí fungovat na telefonu (od šířky 360 px). Ověř testem v prohlížeči.
10. Nedělej velké přestavby bez domluvy. Menší, ověřené kroky.

## 7. Testy

```bash
npm install            # jednou (Playwright, clasp)
npm test               # syntaxe Apps Scriptu + testy logiky serveru (rychlé, bez internetu)
npx playwright install chromium   # jednou, pro testy v prohlížeči
npm run test:prohlizec # dashboard a portál v prohlížeči proti napodobenému serveru
```
Testy vypisují průběh; řádek `CHYBA` nebo nenulový návratový kód znamená problém. Snímky obrazovky
z prohlížečových testů se ukládají do `testy/vystup/`. Při nové funkci přidej odpovídající kontrolu.
Napodobenina (`gas-mock.js`) nepokrývá DriveApp/CalendarApp/DocumentApp/UrlFetchApp – tyto části ověř
po nasazení ručně a řekni to uživateli.

## 8. Nasazení

### Server (Apps Script) – přes clasp
```bash
npx clasp login                      # jednou
npx clasp push                       # nahraje apps-script/ do projektu Apps Script
npx clasp deploy -i <ID_NASAZENI> -d "popis změny"
```
- `<ID_NASAZENI>` = stávající nasazení webové aplikace (řetězec `AKfy…`, je i v `docs/config.js` v `API_URL`).
  **Nikdy nevytvářej nové nasazení bez `-i`** – změnila by se adresa API a web by přestal fungovat.
- Nasazení: Spustit jako „Já“, přístup „Kdokoli“ (nutné pro formulář a portál; oprávnění řeší kód).
- Po změně schématu: uživatel musí v Apps Scriptu spustit funkci `nastavTabulku` (nebo v tabulce menu
  Dobrovolnické centrum → Nastavit / aktualizovat tabulku).
- Nová oprávnění Google (nová služba) vyžadují jednorázové schválení uživatelem v editoru Apps Script.

### Web (GitHub Pages)
- Pages publikuje složku `docs/` z větve `main`. Commit + push do `main` → za 1–2 min je web aktualizovaný.
- Adresa: `https://thecodealloy.github.io/dobrokonep/` (`index.html`, `dashboard.html`, `hodiny.html`).
- GitHub Pages i prohlížeče cachují ~10 min; ověřuj podle textu verze.

### Pořadí při změně, která se týká obojího
Nejdřív server (zpětně kompatibilně), potom web.

## 9. Rozpracované a plánované

Viz `dokumentace/PLAN.md` (portál organizace – čeká na rozhodnutí uživatele, statistiky, motivační modul,
podpis na tabletu, vlastní doména).
