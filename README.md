# Dobrovolnický systém – Dobrovolnické centrum

Evidence zájemců o dobrovolnictví, dobrovolníků, schůzek, dokumentů a dobrovolnických hodin.

- **Registrační formulář:** https://thecodealloy.github.io/dobrokonep/
- **Dashboard:** https://thecodealloy.github.io/dobrokonep/dashboard.html
- **Zápis hodin pro dobrovolníky:** https://thecodealloy.github.io/dobrokonep/hodiny.html

## Jak je projekt uspořádaný

| Složka | Co obsahuje | Kam se nasazuje |
|---|---|---|
| `docs/` | webové stránky (formulář, dashboard, portál dobrovolníka) | GitHub Pages – automaticky po nahrání na GitHub |
| `apps-script/` | serverová část (práce s tabulkou, Diskem, e-maily, kalendářem) | Google Apps Script – příkazem `clasp` |
| `testy/` | automatické testy | – |
| `dokumentace/` | postup nasazení, plán dalšího vývoje, návod pro koordinátorky | – |

## Práce s AI nástroji

- **Claude Code** čte `CLAUDE.md`, **Codex** čte `AGENTS.md`. Oba soubory popisují systém a pravidla
  (v `CLAUDE.md` je jen odkaz na `AGENTS.md`), takže oba nástroje pracují podle stejných informací.
- Nepracujte v obou nástrojích současně na stejné věci. Každou změnu nejdřív dokončete, otestujte a nahrajte.

## Základní příkazy

```bash
npm install                 # jednou
npm test                    # rychlá kontrola serverové části
npm run test:prohlizec      # kontrola stránek v prohlížeči (potřebuje: npx playwright install chromium)
npx clasp push              # nahrát serverovou část do Apps Scriptu
npx clasp deploy -i <ID> -d "popis"   # zveřejnit novou verzi serveru (ID je v docs/config.js)
git push                    # nahrát web na GitHub (zveřejní se za 1–2 minuty)
```

Podrobný postup prvního nastavení: `dokumentace/NASAZENI.md`.

## Ochrana dat

Repozitář je veřejný. Nejsou v něm žádná osobní data ani ID tabulky či složek – vše je uložené v tabulce
Google a ve vlastnostech skriptu. Tabulku, složky na Disku a složku Zálohy sdílejte jen s administrátory.
