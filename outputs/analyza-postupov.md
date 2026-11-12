# Analýza doterajších postupov a odporúčania do ďalších kôl

Dátum: 12. novembra 2026, po 1. kole ostrej hry (H6, Extended).

Podklady: `odporucania.md`, `feedback-kolo1.md`, `analyza-dashboard.md`, karty hráčov v `players/`, `dashboard.js`, `refresh_data.py` a história práce na projekte. Čísla z 1. kola sú prevzaté z `feedback-kolo1.md`; do živého SAP sa pri tejto analýze nepozeralo. Kód sa nemenil.

## Hlavný záver

Pripravili sme sa na inú hru, než akú hráme. V tréningu nás brzdila výroba a ceny pod trhom, v ostrej hre nás brzdí odbyt. Poučenia z tréningu (dvíhať ceny, prednosť má 1kg, linka musí bežať naplno) sme preniesli bez overenia a v 1. kole zafungovali opačne.

## Čo nás stálo najviac

- **Kapacita je väčšia ako náš férový podiel trhu.** Trh dáva tímu asi €2,28M za kolo (DC10 €90k + DC12 €360k + DC14 €120k týždenne), čo je pri priemernej cene €6,70 zhruba 340 000 ks. Linka vyrobí 480 000 ks. Plnú výrobu teda predáme len s cenou mierne pod trhom, nie nad ním.
- **Ceny 1kg boli 14–120 % nad trhom.** Dashboard pritom odporúča najviac +8 % nad trhom, takže tieto ceny nevznikli z neho. Treba zistiť v tíme, odkiaľ sa vzali (napr. F14 za €12,15 pri trhu €5,51).
- **Na sklade leží asi €600k hrubej marže.** Je to 123 000 ks pri marži okolo €5/ks, kým zisk celého kola bol €358k.
- **Mix výroby bol 62 % 1kg** (233 000 z 377 000 ks), hoci 500g sa vypredali a DC14 (len 500g, najvyššie ceny) ostal na 2,3 % podielu. Štartovací zoznam F14, F13, F12 vychádzal z marží v tréningu, kde bol len kanál DC12.
- **Do prestavby išlo €475k**, hoci karta kapitána hovorí optimum €250k a „nikdy nad €400k“. Vo valuácii to stojí asi €4M a vráti sa, ak prinesie aspoň ~€40k zisku za kolo navyše, teda len ak ušetrené kusy aj predáme.
- **1kg sa vyrábalo aj v dňoch 17–20** (F11 72 000 ks, potom F12), keď už bolo vidno, že sa nepredáva.
- **Linka stála dni 1–3**, kým prišli suroviny.

## Slabiny v postupe

- **Spätná väzba prišla až po kole.** Nikto počas hry nesledoval, či predaj drží krok s výrobou.
- **Dashboard nevidí našu hlavnú chybu.** Má upozornenie na cenu pod trhom, ale žiadne na cenu nad trhom pri rastúcom sklade. Dopyt odhaduje ako férový podiel bez ohľadu na našu cenu, takže ďalej radil vyrábať 1kg. Najväčšia zľava, ktorú navrhne, je −8 % pod trhom, čo pri veľkom prebytku nemusí stačiť.
- **Dokumenty si protirečia:**
  - Úver: karta kapitána hovorí splácať, feedback hovorí nesplácať.
  - Réžia na kus: €1,55 na karte obchodu, €0,90 v odporúčaniach.
  - Veľkosť DC14: €135k na karte, €120k v pravidlách.
  - Názov skriptu: karty píšu `digger.js`, súbor je `dashboard.js`.
  - Kontrolný zoznam v `odporucania.md` stále hovorí „vyrábame 1kg F14 / F13“.
  - Dĺžka dávky: karta výroby hovorí bloky po 48 000 ks, odporúčania 3–4 dni na produkt.
- **Kód sa upravoval počas živej hry** (9:52–10:08) a projekt nemá git. Chyba v skripte uprostred kola by nás nechala bez dashboardu.
- **Dáta z 1. kola nie sú archivované.** `data.js` je stále tréningový snapshot firmy H5, takže kolo 1 sa dá spätne analyzovať len zo živého SAP.
- **Vzorec valuácie je overený v SAP (12. 11.):** valuácia = ((zisk + investícia do prestavby) × 240 ÷ dni − investícia) ÷ (7 % + riziková prirážka). Deň 20: (€833k × 12 − €475k) ÷ 12 % = €79,34M, sedí presne. Pri ratingu A znamená €1 zisku za kolo asi €100 valuácie, kým €1 investície do prestavby stojí len €8,3.
- **Marketing bol €11 250 za kolo (0,7 % tržieb)** pri pláne 1,5–3 %. Bez 500g na sklade pre DC14 však nebolo čo podporovať, takže to nie je hlavný problém.

## Odporúčania do ďalších kôl

1. **Riadiť sa zásobou, nie využitím linky.** Cieľ je 3–6 dní predaja na sklade pri každom produkte. Nad 8 dní znížiť cenu o 5 % každé 2 dni, pod 2 dni zdvihnúť o 3–5 %.
2. **Hneď na začiatku kola 2 stiahnuť ceny 1kg** na trh alebo 5–10 % pod neho, najviac pri F11. Pri nákladoch okolo €1,50/ks sa oplatí aj predaj výrazne pod trhom.
3. **Vyrábať 500g** (F02, F03, F01) pre DC14 a DC12. Ďalšie 1kg až keď zásoba klesne pod 5 dní.
4. **Využiť kratšiu prestavbu.** Pri 4,07 h stojí zmena okolo 4 000 ks, takže si môžeme dovoliť dávky po 24 000 ks a širší sortiment namiesto 72 000 ks jedného produktu.
5. **Zaviesť kontroly v dňoch 5, 10 a 15.** Kapitán porovná predané a vyrobené kusy, sklad po produktoch a našu cenu oproti trhu vo všetkých troch kanáloch.
6. **Žiadne ďalšie investície** do prestavby ani kapacity, kým nevypredávame.
7. **Marketing až keď je 500g na sklade,** v DC14 ako test €200–400 na bunku a deň, s porovnaním podielu pred a po.
8. **Úver:** splácať len sumu *Safe to repay now*. Rating to nezmení, ušetrí to úrok. Okolo dní 21–25 odídu platby za suroviny z 1. kola (€0,59M).
9. **Posledné kolo:** posledný nákup okolo 12. dňa, výroba len toho, čo sa do konca predá.
10. **Organizácia:**
    - zmraziť kód počas kola a zaviesť git,
    - po každom kole uložiť dáta cez `refresh_data.py`,
    - zjednotiť dokumenty podľa bodov vyššie,
    - dať hráčom jednostranový update namiesto starých kariet.

## Čo overiť

- Počet kôl u organizátorov (karty píšu „3 alebo 4“).
- ~~Skutočný čas prestavby v SAP po investícii €475k.~~ Overené: 4,07 h. Vzorec je 2 + 1 500 000 ÷ (250 000 + investícia), ďalšie investície sa už takmer neoplatia.
- Otvorené nákupné objednávky: na sklade sú suroviny len na dokončenie rozrobenej F12 (31 207 ks).
- Výsledkovú tabuľku organizátora: poradie tímov a marketing konkurencie.
- Odkiaľ sa vzali ceny 1kg v 1. kole.

## Možné úpravy dashboardu (zatiaľ neurobené)

- Upozornenie „cena nad trhom a sklad rastie“.
- Odhad dopytu, ktorý zohľadní našu cenu oproti trhu a skutočný predaj za posledné dni.
- Väčšia zľava pri veľkom prebytku zásob.
- Ukazovateľ predané oproti vyrobeným kusom za kolo a sklad v dňoch predaja po produktoch.
