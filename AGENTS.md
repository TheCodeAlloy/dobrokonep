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
| `Dashboard.gs` | přihlášení administrátorů (kód, odkaz, Google, osobní odkaz z notifikace), `nactiData`, úpravy dobrovolníka, schůzky + kalendář, výmaz (GDPR), generování smlouvy/docházky z šablon Google Docs, administrace číselníků |
| `Hodiny.gs` | přiřazení dobrovolník↔organizace, katalog činností, zápis hodin (jednotlivě, akce, měsíční výkaz), schvalování, mazání, uzávěrka |
| `Portal.gs` | portál dobrovolníka: přihlášení (kód, odkaz, pozvánka, Google), relace, vlastní hodiny |
| `Zalohy.gs` | denní zálohy tabulky (5 denních + 30 týdenních), spouštěč |
| `Api.gs` | `doPost`/`doGet`, mapy povolených akcí `API_VEREJNE`, `API_ADMIN`, `API_DOBROVOLNIK` |

### docs/ (GitHub Pages – web)
`index.html` (formulář), `dashboard.html`, `hodiny.html` (portál), `config.js` (adresa API + `volejApi`),
`logo.png`, `manifest.webmanifest` (přidání na plochu), `.nojekyll`.

### testy/ (Node.js, napodobenina Apps Scriptu)
`gas-mock.js` (SpreadsheetApp, PropertiesService, CacheService, MailApp… v paměti), `nacti-kod.js`,
`backend-*.js` (logika serveru), `prohlizec-*.js` (Playwright: dashboard a portál proti napodobenému serveru).

### dokumentace/
`NASAZENI.md` (postup pro člověka), `PLAN.md` (rozpracované a plánované věci), návod pro koordinátorky (`.docx` + generátor `navod.js`).

## 4. Datový model (Tabulka Google)

Listy (konstanta `LISTY` v `Kod.gs`): Dobrovolníci, Nastavení, Administrátoři, Oblasti zájmu, Místa,
Organizace, Šablony e-mailů, Hodiny, Přiřazení, Činnosti, Log změn.

- **Ke sloupcům se přistupuje podle názvu v záhlaví, nikdy podle pozice** (`hlavicky_(sh)` + `indexOf`).
  Nové sloupce přidává `zajistiList_` na konec listu – pořadí v tabulce se může lišit.
- **Dobrovolníci** – sloupce v `SLOUPCE_DOBROVOLNICI`. ID `DC-RRRR-0001` (`dalsiCislo_`). `Stav` ∈ `STAVY`.
  Sloupec `Organizace` je jen odvozený přehled aktivních přiřazení (`synchronizujOrganizace_`).
- **Hodiny** – `SLOUPCE_HODINY`. Pravdou je sloupec **`Minut`** (celé číslo, zaokrouhleno na 5 min);
  `Počet hodin` je jen pro čitelnost. `Stav` ∈ Ke schválení / Schváleno / Zamítnuto. `Zdroj` = Dashboard / Akce /
  Měsíční výkaz / Dobrovolník. `ID organizace` (ORG-001) je klíč, `Organizace` je název (snímek).
- **Přiřazení** – `SLOUPCE_PRIRAZENI`: dobrovolník ↔ organizace s obdobím Od–Do (prázdné = bez omezení).
- **Činnosti** – Organizace (název nebo „Všechny organizace“), Činnost, Aktivní.
- **Nastavení** – klíč/hodnota/popis; výchozí řádky ve `vychoziNastaveni_()`; čtení `nastaveni_()`.
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
   (Apps Script načítá soubory postupně). Proto jsou API mapy obalené `function () { return x.apply(null, arguments); }`.
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
