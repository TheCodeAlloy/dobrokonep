# První nastavení projektu na počítači

Tento postup se dělá jednou. Většinu kroků za vás může udělat Claude Code nebo Codex –
stačí mu dát úvodní pokyn (viz konec dokumentu).

## 1. Programy, které potřebujete

| Program | K čemu | Kde ho získat |
|---|---|---|
| **Node.js** (verze 20 nebo novější) | spouští testy a nástroj clasp | nodejs.org → LTS |
| **Git** | propojení s GitHubem | git-scm.com |
| **Claude Code** a/nebo **Codex** | AI vývoj | podle návodu výrobce |

## 2. Složka projektu

1. Rozbalte balíček `dobrokonep.zip` třeba do `Dokumenty\dobrokonep`.
2. Otevřete v té složce Claude Code (nebo Codex).

## 3. Propojení s GitHubem (repozitář thecodealloy/dobrokonep)

Dosud jsou na GitHubu jen webové soubory v kořeni repozitáře. Nově budou ve složce `docs/`
a vedle nich celý projekt. Postup (zvládne ho AI nástroj):

1. Složku inicializovat jako git repozitář a propojit s `https://github.com/thecodealloy/dobrokonep`.
2. Stáhnout aktuální stav z GitHubu a porovnat ho se soubory v `docs/` (měly by být stejné nebo novější).
3. Staré webové soubory z kořene repozitáře přesunout/odstranit – nově žijí jen v `docs/`.
4. Vše nahrát do větve `main`.
5. **Ručně na GitHubu:** Settings → Pages → Branch: `main`, složka **`/docs`** → Save.
   Adresa webu zůstane stejná. Po 1–2 minutách ověřte, že web funguje.

Mezi kroky 4 a 5 může být web pár minut nedostupný – udělejte je hned po sobě.

## 4. Propojení s Apps Scriptem (nástroj clasp)

1. Na https://script.google.com/home/usersettings zapněte **Google Apps Script API**.
2. V editoru Apps Script: Nastavení projektu (ozubené kolečko) → zkopírujte **ID skriptu**.
3. Zkopírujte `.clasp.json.priklad` jako `.clasp.json` a vložte do něj ID skriptu.
4. `npx clasp login` – přihlaste se účtem, pod kterým skript běží (admin@konep.cz).
5. **Nejdřív porovnání:** `npx clasp pull` do dočasné složky a porovnat s `apps-script/`.
   Kód v Apps Scriptu by měl odpovídat tomuto projektu. Pokud se liší, rozhodněte, která verze platí.
6. Od teď se server nasazuje:
   `npx clasp push` a pak `npx clasp deploy -i <ID nasazení> -d "popis"`.
   ID nasazení je řetězec `AKfy…` z adresy v `docs/config.js`. **Vždy s `-i`**, jinak vznikne nové
   nasazení s jinou adresou a web přestane fungovat.

## 5. Ověření

- `npm install` a `npm test` – musí proběhnout bez řádku „CHYBA“.
- Otevřete formulář, dashboard a portál a zkuste jednu akci v každém.

## Úvodní pokyn pro AI nástroj

> Přečti AGENTS.md a dokumentace/NASAZENI.md. Pomoz mi krok za krokem propojit tuto složku
> s GitHub repozitářem thecodealloy/dobrokonep (web přesunout do složky docs/) a s Apps Scriptem přes clasp.
> Před každým krokem, který mění GitHub nebo Apps Script, mi řekni, co uděláš, a počkej na souhlas.
