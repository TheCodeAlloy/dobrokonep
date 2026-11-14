# Přestavba zápisu dobrovolnických hodin – schválený plán

Stav: **fáze A hotová a nasazená**, **fáze B hotová a nasazená**, fáze C se dělá ve třech krocích: **C1 (měsíční schvalování, zámky, historie) hotové a nasazené**, **C2 (fotky výkazů, Způsob vykazování) hotové, čeká na nasazení**, C3 (převod stávajícího schvalování + odstranění schvalování po řádcích a globální uzávěrky) čekají; D čeká. Každou fázi: otestovat, nasadit, nechat uživatele
vyzkoušet, teprve pak další. Na konci fáze aktualizovat AGENTS.md.

## Hierarchie a viditelnost
KONEP je nadřazená organizace. Přímí dobrovolníci KONEP jsou přiřazení k organizaci „KONEP“ (hromadně jen dobrovolníci ve
stavu Aktivní dobrovolník bez organizace, až po odkliknutí náhledu). Dobrovolník může být u více organizací. Dobrovolník
a KONEP vidí všechny hodiny, organizace jen hodiny pro sebe (vynucuje server).

## Fáze A – pravidla zápisu (HOTOVO)
Čas vždy od–do (hodiny 0–24, minuty po 5, výchozí 00), „do“ po „od“ téhož dne, 24:00 povoleno. Zrušena volba „jen délka“
i Měsíční výkaz. Staré záznamy bez od–do platí dál; úprava vyžaduje od–do. Jedna organizace = předvyplněná; víc = bez
výběru a bez výběru se neuloží.

## Fáze B – roční stránka hodin dobrovolníka (HOTOVO)
Sdílený soubor `docs/rocni-hodiny.js` (načítat s číslem verze v adrese, např. `rocni-hodiny.js?v=2026-11-14`), použije
dashboard, portál dobrovolníka a později portál organizace. Ouška roků (minulé roky jen ke čtení pro dobrovolníky
a organizace), pod nimi ouška organizací („Všechny“ + každá organizace; u jediné organizace se podouška nezobrazí),
rolovací stránka po měsících, jen dny se záznamem, součty měsíců, „+ Přidat řádek“ přímo v seznamu
(datum, od, do, hodiny, organizace, činnost), úprava/mazání v nezamčených měsících.

## Fáze C – schvalování, zamykání, průkaznost
- Schvaluje jen KONEP (Koordinátor i Hlavní admin), vždy celý měsíc za dvojici dobrovolník + organizace. Schválení měsíc
  zamkne (včetně fotek). Odemknout smí jen Hlavní admin, odemčení se zaznamená.
- **Minulé roky jsou zamčené jen pro dobrovolníky a organizace.** KONEP do nich smí zapisovat, dokud měsíc neschválí.
- Pro dobrovolníky dál platí limit `hodiny_zpetne_dni` (60 dní).
- **Akce:** má-li některý z vybraných dobrovolníků daný měsíc zamčený, nic se neuloží a vypíše se, u koho to nejde.
- **Výmaz dobrovolníka (GDPR)** smí anonymizovat hodiny i v zamčených měsících – jediná výjimka ze zámku.
- Nové listy: `Měsíce` (dobrovolník+organizace+měsíc, stav, kdo/kdy schválil, kdo/kdy/proč odemkl, součet minut),
  `Fotky výkazů`, `Historie hodin` (bez IP adresy). Nové sloupce: role zapisujícího u hodin, `Způsob vykazování`
  u dobrovolníka (Sám / Organizace podle papírového výkazu; zatím jeden na dobrovolníka).
- Přehled ke schválení v dashboardu (měsíce po dobrovolnících a organizacích, schválit jednotlivě i hromadně).
  Chybějící fotka papírového výkazu jen upozorní.
- Fotka výkazu: `input type=file accept="image/*" capture="environment"`, zmenšit na cca 1600 px (JPEG), uložit do
  osobní složky dobrovolníka, zobrazovat přes API s ověřením (ne přes odkaz na Disk).
- **Převod stávajícího schvalování (varianta 1):** měsíc, kde jsou všechny řádky dvojice Schváleno, se zamkne
  (schvalovatel z původních dat). Měsíc se smíšenými/čekajícími řádky zůstane otevřený. Řádky Zamítnuto se vypíšou
  k ručnímu vyřešení a nezapočítávají se. **Před provedením: záloha tabulky + náhled (co se zamkne, co zůstane otevřené,
  které zamítnuté řádky řešit); provést až po potvrzení uživatele.** Globální uzávěrku `hodiny_uzavreno_do` nahradí
  měsíční zámky.

## Fáze D – portál organizace
Nová stránka `organizace.html` (přihlášení kódem/odkazem/Googlem, přidání na plochu telefonu), list Koordinátoři
organizací spravuje KONEP v dashboardu (jedna organizace jich může mít víc). Vlevo dobrovolníci organizace, roční
stránka z fáze B jen s ouškem této organizace, rychlá volba „Vyfotit výkaz“. **Nový dobrovolník od organizace:**
organizace zadá e-mail; odpověď je vždy stejná (nic se neodhalí). Pozvánka vede na běžný registrační formulář
s předvyplněnou organizací; člověk se objeví v dashboardu jako Nový zájemce s čekajícím přiřazením k organizaci
a KONEP ho potvrdí.

## Otevřené úkoly na později
Viz `PLAN.md` (export dat, co organizace vidí o dobrovolníkovi, samostatná registrace dobrovolníka).
