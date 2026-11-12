# Feedback po kolách – ostrá hra (H6, Extended)

Dáta zo SAP (OData klient 418). Posledná aktualizácia: po 2. kole (deň 40). Ostatné tímy vidíme len cez celkový trh, takže poradie nevieme.

Obsah: [Prehľad](#prehľad) · [Prečo valuácia rástla málo](#prečo-valuácia-rástla-málo) · [Čo robiť v kole 3](#čo-robiť-v-kole-3) · [Kolo 2](#kolo-2) · [Kolo 1](#kolo-1)

## Prehľad

| Ukazovateľ | Kolo 1 | Kolo 2 |
|---|---|---|
| Valuácia na konci kola | €79,3M | **€104,9M** |
| Zisk za kolo | €358k (po investícii €475k) | **€1 301k** |
| Zisk kumulatívne | €358k | €1 659k |
| Tržby | €1,70M | €2,28M |
| Hrubá marža | €1,33M | €1,79M |
| Predané | 253 000 ks | 311 000 ks |
| Priemerná cena | €6,73 | €7,32 |
| Vyrobené | 377 000 ks (78 %) | 375 000 ks (78 %) |
| Sklad hotových výrobkov | 123 000 ks | **187 000 ks** |
| Podiel na trhu | 12,2 % | 10,8 % |
| Marketing | €11 250 | €23 750 |
| Rating / riziková prirážka | A / 5,00 % | A+ / 4,75 % |
| Úver | €8,0M | €6,8M |

## Prečo valuácia rástla málo

Valuácia sa nepočíta z kumulatívneho zisku, ale z **priemerného denného zisku za celú hru**:

```
valuácia = ((zisk + investícia do prestavby) ÷ odohrané dni × 240 − investícia) ÷ (7 % + riziková prirážka)
deň 40:   ((€1 659k + €475k) ÷ 40 × 240 − €475k) ÷ 11,75 % = €104,9M   (sedí so SAP)
```

- **Kumulatívny zisk vyzerá ako 4,6-násobok (€358k → €1 659k), ale to skresľuje investícia.** Bez jednorazovej investície €475k zarobilo kolo 1 €833k a kolo 2 €1 301k, teda +56 %.
- **Do valuácie ide priemer oboch kôl.** Denný zisk bol €41,6k v kole 1 a €65,0k v kole 2, priemer je €53,3k, teda +28 %. Spolu s lepším ratingom to dáva +32 % valuácie.
- **Koniec kola 1 bol navyše dočasné dno.** Na 21. deň valuácia vyskočila na €99,1M, lebo po znížení cien sa predalo 43 000 ks za deň. Od 21. do 40. dňa sa už takmer nepohla (€99,1M → €104,9M), lebo denný zisk v kole 2 (~€55k) bol blízko dovtedajšieho priemeru.
- **Valuácia kolíše každých 5 dní,** keď sa platí réžia (pokles na 25., 30., 35. a 40. deň). Počas kola bola najvyššie €112,9M (deň 37).

**Čo to znamená pre kolo 3** (ak je posledné a rating ostane A+):

| Zisk v kole 3 | Valuácia na konci |
|---|---|
| €1,3M (ako kolo 2) | ~€113M |
| €1,8M | ~€130M |
| €2,2M | ~€143M |

Každých €100k zisku navyše v kole 3 pridá asi €3,4M valuácie. Lepší rating o stupeň pridá asi 2 %. Ak bude kôl viac, váha jedného kola ďalej klesá, takže rozhoduje denný zisk v každom ďalšom kole.

## Čo robiť v kole 3

Na sklade je 187 000 ks, teda asi €1M hrubej marže. To je takmer toľko, koľko zarobilo celé kolo 2. Ak je kolo 3 posledné, nepredaný sklad na konci nemá žiadnu hodnotu.

1. **Hneď opraviť ceny produktov, ktoré sú na sklade a nepredávajú sa** (trh = dni 36–40):

   | Produkt | Sklad | Naša cena | Trh | Odporúčanie (východisko) |
   |---|---|---|---|---|
   | F01 500g Nut | 48 262 | DC12 €8,05 · DC14 €11,00 | €6,00 · €6,29 | asi €5,90 · €6,20 |
   | F12 1kg Blueberry | 64 616 | DC10 €7,80 · DC12 €8,00 | €8,15 · €9,34 | ceny sú pod trhom, nechať a pridať marketing |
   | F03 500g Strawberry | 24 418 (+8 690 vo výrobe) | DC12 €5,90 · DC14 €6,70 | €6,28 · €6,47 | DC12 zdvihnúť na ~€6,30, DC14 ~€6,45 |
   | F16 1kg Mixed | 24 000 | DC10 €8,80 · DC12 €9,35 | €9,06 · €7,03 | DC12 znížiť na ~€7,00 |
   | F11 1kg Nut | 10 208 | DC10 €7,70 · DC12 €8,25 | €6,73 · €6,99 | znížiť na ~€6,90 · €7,20 |
   | F14 1kg Raisin | 8 327 | DC10 €12,15 · DC12 €10,75 | €7,79 · €6,16 | asi €7,50 · €6,10 |
   | F02 500g Blueberry | 7 288 | DC12 €6,85 · DC14 €7,50 | €6,32 · €6,69 | asi €6,40 · €6,80 |

2. **Zaviesť pravidlo: keď sa produkt uvoľní do výroby, obchod hneď nastaví jeho cenu vo všetkých kanáloch.** F01 ležal od 32. dňa za cenu 34–75 % nad trhom a nepredal sa ani kus.
3. **F12 už nevyrábať.** Sklad 64 616 ks je toľko, koľko celý trh kúpi za 5 dní (63 000 ks).
4. **Vyrábať menšie dávky (24 000 ks) toho, čo trh berie vo veľkom:** F13 (nemáme ho, v kole 2 sa vypredal za najvyššie ceny), F04 (vypredaný), F02. Rovnaký produkt nedeliť na dve dávky s odstupom.
5. **Suroviny:** na sklade je pšenica a ovos asi na 80 000–150 000 ks, čučoriedky (R02) žiadne. Skontrolovať dodávky objednané na 38. deň a objednať tak, aby linka nestála.
6. **Kontroly v dňoch 5, 10 a 15:** pri každom produkte predaj za posledných 5 dní oproti skladu. Čo sa nepredáva, zlacniť hneď, nie po kole.
7. **Ak je kolo 3 posledné:** posledný nákup okolo 10.–12. dňa, výroba len toho, čo sa do 20. dňa predá, a od 15. dňa ceny nastaviť tak, aby sklad skončil na nule (nie pod náklad ~€1,50/ks).
8. **Marketing** sústrediť na produkty so skladom v DC14 a DC12 (F01, F03, F12), nie plošne.

## Kolo 2

### Čo sa zlepšilo

- **Zníženie cien 1kg zafungovalo.** Na 21. deň sa predalo 43 000 ks. F11 sa takmer vypredal (96 000 ks za €7,55–7,69, nad trhovým priemerom €7,09–7,18) a F13 sa dopredal za €9,15 / €10,30.
- **Tržby aj hrubá marža +34 %**, priemerná cena €7,32 (kolo 1 €6,73).
- **Viac 500g:** 55 % výroby (kolo 1 38 %). Tržby v DC14 stúpli z €62k na €262k.
- **Rating A → A+** od 34. dňa, úver splatený o €1,2M (na €6,8M), žiadna ďalšia investícia do prestavby.

### Problém 1: opakovali sa chyby z kola 1

| Chyba | Kolo 1 | Kolo 2 | Čo to stálo v kole 2 |
|---|---|---|---|
| Linka stojí na začiatku kola, chýbajú suroviny | dni 1–3 | dni 22 (časť) – 24 | ~65 000 ks |
| Cena vysoko nad trhom pri produkte na sklade | 1kg produkty | F01, F14, F16 | 80 000 ks bez jediného predaja |
| Príliš veľká dávka jedného 1kg produktu | F11 72 000 ks | F12 72 000 ks (dni 34–37) | sklad 64 616 ks |

- **F01:** vyrobených 48 000 ks (dni 31–32 a 39–40), predaných 0. Cena €8,05 v DC12 a €11,00 v DC14 pri trhu €6,00 a €6,29. Pri trhovej cene je to asi €290k tržieb.
- **F14:** 8 327 ks leží od kola 1 za €12,15 / €10,75. Cena sa celé kolo nezmenila, trh je €6–8.
- **F16:** 24 000 ks vyrobených na 37.–38. deň, predaných 0. V DC12 stojí €9,35 pri trhu €7,03.

### Problém 2: predávame menej, ako vyrábame

- Vyrobené 375 000 ks, predané 311 000 ks. Sklad narástol o 64 000 ks na 187 000 ks.
- Priemerný predaj bol 15 500 ks za deň pri kapacite 24 000. V dňoch 25 a 31 sa nepredalo nič, v dňoch 38–39 len 6 000–7 000 ks.
- Trh narástol o 50 % (z €14,0M na €21,1M), náš podiel klesol z 12,2 % na 10,8 %.

### Podiel na trhu

| Kanál | Trh | Naše tržby | Náš podiel | Kolo 1 |
|---|---|---|---|---|
| DC10 | €3,74M | €386k | 10,3 % | 14,9 % |
| DC12 | €11,71M | €1 628k | 13,9 % | 14,3 % |
| DC14 | €5,61M | €262k | **4,7 %** | 2,3 % |
| **Spolu** | €21,06M | €2,28M | **10,8 %** | 12,2 % |

DC14 je stále najväčšia nevyužitá príležitosť. Trh tam za kolo kúpil po ~200 000 ks z F01, F02, F03 aj F04, my sme predali spolu 42 000 ks. F01 v DC14 sme nepredali vôbec.

### Predaj po produktoch

| Produkt | Vyrobené | Predané | Naša priem. cena | Trh priem. | Sklad na konci |
|---|---|---|---|---|---|
| F11 1kg Nut | 40 000 | 96 249 | €7,55–7,69 | €7,09–7,18 | 10 208 |
| F12 1kg Blueberry | 103 207 | 62 832 | €8,34–8,61 | €8,23–8,40 | 64 616 |
| F13 1kg Strawberry | 0 | 24 188 | €9,15–10,30 | €7,73–7,87 | 0 |
| F04 500g Raisin | 48 000 | 47 922 | €4,75–5,14 | €4,77–4,79 | 78 |
| F02 500g Blueberry | 48 000 | 40 712 | €6,93–7,50 | €6,22–7,05 | 7 288 |
| F03 500g Strawberry | 63 310 | 38 892 | €6,04–7,24 | €6,27–6,83 | 24 418 |
| F01 500g Nut | 48 000 | **0** | – | €5,43–5,45 | 48 262 |
| F16 1kg Mixed | 24 000 | **0** | – | €7,32–9,01 | 24 000 |
| F14 1kg Raisin | 0 | **0** | – | €6,02–6,96 | 8 327 |

### Výroba

- 375 000 ks, 78 % kapacity. Linka stála od 22. dňa (po dokončení F12) do 24. dňa, lebo suroviny objednané na 21. deň prišli na 22. a 24. deň.
- 10 zmien produktu, každá stojí ~4 070 ks (prestavba 4,07 h), spolu ~40 000 ks. F01 aj F11 sa vyrábali v dvoch oddelených dávkach, čo pridalo dve zbytočné prestavby.

### Financie

| | Deň 20 | Deň 40 |
|---|---|---|
| Hotovosť | €1,37M | €1,31M |
| Pohľadávky | €1,50M | €1,66M |
| Úver | €8,0M | €6,8M |
| Záväzky voči dodávateľom | €0,59M | €0,59M |
| Debt loading | −€5,73M | −€4,42M |
| Rating | A | A+ |

Financie sú v poriadku. Rating sa zlepšil pri debt loadingu okolo −€5M. Ďalší stupeň odhadujem okolo −€4M (odhad z doterajších prechodov, nie overené pravidlo), teda asi €400k zisku navyše.

### Zhrnutie kola 2

Zisk za kolo stúpol o 56 %, ale valuácia počíta priemer za celú hru, preto rástla pomalšie. Najviac peňazí ostalo v sklade: 80 000 ks sa nepredalo len kvôli cene a linka opäť stála na začiatku kola.

## Kolo 1

Dáta zo SAP (OData klient 418) po skončení 1. kola (deň 20). Ostatné tímy vidíme len cez celkový trh, takže poradie nevieme.

> **Spresnenie 12. 11.:** čísla boli znova porovnané so živým SAP (stav po dni 20) a sedia. Doplnené sú trhové ceny za posledné obdobie, stav surovín, poznámka k F11 a k cenám 500g. Kde sa pôvodné odporúčanie zmenilo, je to v texte označené.

### Výsledok

| Ukazovateľ | Koniec kola 1 |
|---|---|
| **Valuácia** | **€79,3M** (v tréningu po 1. kole €19M) |
| Zisk | €358k (vrátane investícií do prestavby €475k) |
| Tržby / hrubá marža | €1,70M / €1,33M |
| Predané | 253 000 ks |
| Vyrobené | 377 000 ks (78 % kapacity) |
| Sklad hotových výrobkov | ~123 000 ks (+31 000 ks F12 vo výrobe) |
| Rating | A- → **A** (5,0 %) |
| Marketing | €11 250 |

#### Podiel na trhu

Odhadom je na trhu ~6 tímov (trh DC12 €8,6M ÷ 4 týždne ÷ €360k na tím a týždeň), takže priemerný podiel je ~17 %.

| Kanál | Trh | Naše tržby | Náš podiel |
|---|---|---|---|
| DC10 | €2,75M | €409k | **14,9 %** |
| DC12 | €8,60M | €1 234k | **14,3 %** |
| DC14 | €2,64M | €62k | **2,3 %** |
| **Spolu** | €14,0M | €1,70M | **12,2 %** |

Spolu máme menší podiel ako priemerný tím.

### Problém 1: ceny 1kg balení sú vysoko nad trhom a hromadí sa sklad (najdôležitejšie)

Na sklade je ~123 000 ks. Za posledných 5 dní sa z neho predalo len ~10 000 ks.

| Produkt | Sklad | Naša cena DC10 / DC12 | Trh DC10 / DC12 | Rozdiel |
|---|---|---|---|---|
| F11 1kg Nut | **66 457** | €8,90 / €7,85 | €7,66 / €6,91 | +14–16 % |
| F12 1kg Blueberry | 24 241 (+31k vo výrobe) | €11,35 / €10,25 | €8,21 / €8,18 | **+25–38 %** |
| F13 1kg Strawberry | 24 188 | €9,15 / €10,30 | €7,06 / €8,00 | **+29–30 %** |
| F14 1kg Raisin | 8 327 | €12,15 / €10,75 | €5,51 / €7,56 | +40–120 % |

Trhové ceny v tabuľke sú priemer za celé kolo. Ku koncu kola sa trh pohol, preto sa treba riadiť posledným obdobím (dni 16–20):

| Produkt | Naša cena DC10 / DC12 | Trh dni 16–20 DC10 / DC12 | Odporúčanie (východisko) |
|---|---|---|---|
| F11 1kg Nut | €8,90 / €7,85 | €8,48 / €6,63 | DC12 asi €6,50, DC10 mierne nižšie |
| F12 1kg Blueberry | €11,35 / €10,25 | €8,19 / €7,62 | asi €8,00 / €7,50 |
| F13 1kg Strawberry | €9,15 / €10,30 | €9,99 / €10,95 | sme pod trhom, znížiť len mierne |
| F14 1kg Raisin | €12,15 / €10,75 | €5,69 / €8,03 | asi €5,60 / €7,80 |

- **F13:** trh je malý (asi 15 000 ks za 5 dní za všetky tímy). Zľava na €7–8 by zbytočne pálila maržu.
- **F11:** neleží kvôli cene. 72 000 ks vzniklo v dňoch 17–20, takže sa predával len asi 3 dni (5 543 ks v DC12, v DC10 nič). Problém je veľkosť dávky: 66 000 ks je asi 70 % toho, čo celý trh kúpi za 5 dní, takže aj za trhovú cenu sa bude predávať 10 a viac dní.
- **F14:** predával sa za €5,60 / €6,73, terajšie ceny €12,15 / €10,75 sú nastavené až po tom.

**Odporúčanie:** ceny nastaviť podľa tabuľky vyššie a po 1–2 dňoch doladiť podľa predaja. Hotový výrobok na sklade nezarába a viaže hotovosť.

**Ceny 500g nastaviť skôr, než príde tovar.** V systéme ostali F02 za €19,45 (DC14) a €12,45 (DC12), F03 za €11,90 (DC12), F01 za €11,55 (DC14) a €7,65 (DC12). Kým tovar nie je na sklade, neprekážajú, ale s týmito cenami sa nová výroba nepredá.

### Problém 2: DC14 takmer nevyužívame

V DC14 je trh €2,64M a my sme tam predali za €62k. DC14 kupuje len 500g balenia a platí za ne najviac:

| Produkt | Trhová cena DC14 | Trhová cena DC12 |
|---|---|---|
| 500g Blueberry (F02) | €7,43 | €5,41 |
| 500g Strawberry (F03) | €7,35 | €5,75 |
| 500g Nut (F01) | €6,52 | €4,35 |
| 500g Mixed Fruit (F06) | €6,78 | €4,97 |
| 500g Raisin (F04) | €4,80 | €4,29 |
| 500g Original (F05) | €4,48 | €4,37 |

Na sklade teraz nemáme žiadne 500g výrobky (len 262 ks F01).

**Prečo sme v DC14 skoro nepredali:** 500g sme vyrábali (F01, F02, F03 po 48 000 ks), ale F02 a F03 sa celé predali v DC12 za €5,55–5,90, kým DC14 platil €7,40–8,80. V dňoch 16–20 bol trh DC14: F02 €8,80, F03 €7,87, F01 €6,55. Ceny 500g v DC12 preto držať vyššie, aby zostal tovar aj pre DC14.

**Odporúčanie:** ďalšia výroba má ísť do 500g (F02, F03, F01) pre DC14, nie ďalšie 1kg, kým sa nepredá zásoba.

### Výroba

| Dni | Produkt | Vyrobené |
|---|---|---|
| 1–3 | – (linka stála, suroviny prišli až 4. deň) | 0 |
| 4–5 | F12 | 48 000 |
| 6–8 | F13 | 48 000 |
| 8–10 | F02 | 48 000 |
| 10–12 | F14 | 48 000 |
| 12–14 | F03 | 48 000 |
| 14–16 | F01 | 48 000 |
| 17–20 | F11 | 72 000 |
| 20 | F12 (zákazka 48 000, hotových 16 793) | 16 793 |

- **Linka stála dni 1–3**, lebo suroviny prišli až na 4. deň. Strata je ~72 000 ks.
- **Prestavba:** investície €475k (deň 1 €250k, deň 9 €350k, deň 12 €475k) stiahli prestavbu z 8 h na 5 h, 4,5 h a nakoniec **4,07 h**. Strata pri zmene je teraz ~4 070 ks namiesto 8 000 ks. SAP počíta prestavbu ako 2 + 1 500 000 ÷ (250 000 + investícia) hodín, čo sedí s tabuľkou v Job Aid aj s hodnotou v SAP (4,06897 h). Ďalších €125k by ubralo len 0,31 h. *(Opravené 12. 11.: pôvodne tu bolo ~3 h a ~3 100 ks.)*
- 1kg produkty (F11, F12) sme vyrábali ešte aj na konci kola, hoci sa predávali pomaly.
- **Suroviny sú takmer na nule.** Na sklade je presne toľko, koľko treba na dokončenie rozrobenej F12 (31 207 ks): P01 a P02 po 31 207 ks, R02 6 241 kg, R05 6 241 kg, R06 18 724 kg. Ak nie sú otvorené nákupné objednávky, linka sa v 2. kole zastaví asi po dni a pol. Otvorené objednávky neboli pri kontrole overené.

### Financie

| | Deň 1 | Deň 20 |
|---|---|---|
| Hotovosť | €1,75M | €1,37M |
| Pohľadávky | €0 | €1,50M |
| Úver | €8,0M | €8,0M |
| Záväzky voči dodávateľom | €0 | €0,59M |
| Debt loading | −€6,25M (deň 2: −€6,61M) | −€5,73M |
| Rating | A- | A |

- Financie sú v poriadku a rating sa zlepšil.
- Splatenie úveru debt loading nezlepší, lebo hotovosť aj úver klesnú rovnako. Rating zlepší len zisk, takže hotovosť si nechajte ako rezervu.
- Zisk na 20. deň klesol o ~€140k. Pravdepodobne išlo o platbu réžie, ktorá chodí každých 5 dní (€75k), a úroky.
- **Valuácia** = ((zisk + investícia do prestavby) × 240 ÷ dni − investícia) ÷ (7 % + riziková prirážka). Deň 20: (€833k × 12 − €475k) ÷ 12 % = €79,34M, sedí so SAP presne. Pri ratingu A znamená €1 zisku za kolo asi €100 valuácie. V 18. deň bola valuácia €103,6M.

### Čo sme si po kole 1 odporučili na kolo 2

1. **Suroviny objednať hneď** (MD61 → MD01 → ME59N) a skontrolovať otvorené objednávky. Sklad stačí len na dokončenie F12.
2. **Ceny F11, F12, F14** znížiť podľa tabuľky trhu za dni 16–20 (VK32), F13 len mierne. Sledovať predaj 1–2 dni a doladiť.
3. **Ceny 500g** (F01, F02, F03) v DC12 aj DC14 nastaviť ešte pred naskladnením: DC14 podľa trhu DC14, DC12 dosť vysoko, aby zostal tovar pre DC14.
4. **Výroba:** 500g pre DC14 (F02, F03, F01), v menších dávkach. Ďalšie 1kg až keď zásoba klesne pod ~3–5 dní predaja.
5. **Marketing** zamerať na DC14, keď bude 500g na sklade. Citlivosť na reklamu je tam najvyššia.
6. **Hotovosť** držať ako rezervu, úver nesplácať kvôli ratingu.

### Zhrnutie kola 1

Valuácia je výrazne lepšia ako v tréningu, ale predávame menej, ako vyrábame. Najrýchlejší zisk prinesie zníženie cien 1kg balení a presun výroby na 500g pre DC14.
