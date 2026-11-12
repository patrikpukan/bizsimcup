# BIZ SIM CUP 2026 – odporúčania pre náš tím (tréning H5, ostrá hra H6)

Pravidlá hry (materiály v `materials/`) a dáta z celého prípravného kola (tréning Manufacturing Introduction, 3 kolá × 20 dní, OData `https://r75p.ucc.cloud/odata/792`).

**Ostrá hra beží na inom systéme:** `https://erpsim-b1.hec.ca:8001`, klient **418**, firma **H6**, scenár Extended. Overené cez OData `/odata/418` (rovnakých 18 entít). Pravidlá podľa `Current_Game_Rules`:

- kapacita 24 000 ks/deň, prestavba 8 h;
- réžia €75 000 každých 5 dní (≈ €15 000/deň);
- trh na tím a týždeň: DC10 €90k, DC12 €360k, DC14 €120k;
- sklady: suroviny 250 000 kg, obaly 750 000 ks, hotové výrobky 250 000 ks.

Dashboard tieto pravidlá načíta sám.

**Výsledok tréningu:** zisk **€1,04M**, hodnota firmy **€41,5M**, rating AAA+ celý čas, bez úveru, na konci €2,9M hotovosti.

---

## 1. Ako sa vyhráva

Vyhráva tím s najvyššou **Company Valuation** na konci hry.

```
Hodnota firmy = (kumulatívny zisk / odohrané dni × 240) / (7 % + riziková prirážka)
```

- **Zisk je hlavná páka.** €1 zisku navyše za kolo zvýši hodnotu asi o €8–10 (×12 ÷ diskont). Overené na našich dátach: €158 508 × 12 / 10 % = €19,02M, čo presne sedí so SAP.
- **Riziková prirážka** závisí od ratingu. Rating závisí od *debt loading* = (hotovosť + pohľadávky) − (úver + záväzky voči dodávateľom). Každý ďalší ~€1M čistého dlhu = o stupeň horší rating.
- Investícia do skrátenia setupu sa v Extended odpočíta zo zisku **raz**, nie ×12.
- **Hodnotu robí len predaný tovar.** Nepredané zásoby na konci hry sa do zisku nepočítajú.

## 2. Pravidlá pre hlavné kolo (Extended)

Štart: **úver €8M, žiadne zásoby, kapacita 24 000 ks/deň**, setup 8 h (= 8 000 ks straty pri každej zmene produktu), tri kanály DC10 / DC12 / DC14.

### Deň 1 (rozhoduje o celom kole)
1. **Hneď objednať suroviny aj obaly** (MD61 → MD01 → ME59N) aspoň na 7–10 dní výroby. Dashboard na 1. deň (ešte bez trhových dát) ponúkne štartovací plán z poľa *Start* v hlavičke: 5 produktov po 2 dni. Predvolené sú F14, F13, F12, F03, F02 podľa marží z tréningu a dajú sa prepísať. Dodanie trvá 1–5 dní a kým nedorazia, linka stojí. **Sklad surovín má limit 250 000 kg**; plán výroby sa preto automaticky skráti tak, aby nákup limit neprekročil. V tréningu sme objednali až na začiatku 3. kola a **linka stála 4 dni (≈ 64 000 ks)**.
2. **Nastaviť ceny vo VK32 pre všetky tri kanály** podľa trhu. Žiadne staré alebo testovacie ceny v systéme.
3. Dashboard: *Game = Extended*, *Capacity = 24 000*, *Rounds* podľa organizátorov, *Recipe* musí sedieť s tým, čo je v SAP (pred zmenou v ZCS02 pôvodné `35/35/30; 50/50; 30/30/10/10/10/10`, po zmene `20/60/20; 20/80; 20/50/1/1/1/27`).

### Výroba
4. **Linka musí bežať každý deň naplno.** Prestoj je najdrahšia chyba. Suroviny doobjednávať, keď krytie klesne pod ~6 dní (tabuľka ME59N v dashboarde).
5. **Dlhé dávky: aspoň 3–4 dni na produkt.** V tréningu sme menili produkt každé ~2 dni, teda ~7 zmien za kolo. To je **~37 000 ks straty za kolo (~12 % kapacity)**.
6. **Prednosť majú 1kg produkty.** Kapacita sa počíta v kusoch, takže 1kg box prinesie o €1–1,5 viac marže na rovnaký čas linky. Marža na kus v 3. kole (trhová cena − náklad SAP):

   | Produkt | Trh | Náklad | Marža |
   |---|---|---|---|
   | F14 · 1kg Raisin | €7,03 | €1,39 | **€5,64** |
   | F13 · 1kg Strawberry | €7,47 | €2,28 | **€5,19** |
   | F12 · 1kg Blueberry | €6,91 | €2,27 | €4,64 |
   | F11 · 1kg Nut | €6,25 | €1,62 | €4,63 |
   | F03 · 500g Strawberry | €5,31 | €1,23 | €4,08 |
   | F02 · 500g Blueberry | €4,93 | €1,23 | €3,70 |
   | F04 · 500g Raisin | €4,46 | €0,79 | €3,67 |
   | F01 · 500g Nut | €4,25 | €0,90 | €3,35 |

   V 3. kole sme F14 ani F13 nevyrábali, hoci mali najvyššiu maržu. V Extended berie DC10 len 1kg a DC14 len 500g, preto treba vyrábať oboje. Pomer určí trh (tabuľka *What to produce next*).

### Ceny a predaj
7. **Ceny podľa trhu, nie podľa nákladov.** V tréningu sme boli stále pod trhom: 1. kolo −27 %, 2. kolo −10 %, 3. kolo −5 %. Pritom sme vypredávali všetko, takže **cenu sme mohli zdvihnúť**.
   - zásoba mizne rýchlejšie, než ju vyrobíme → zdvihnúť o 5–10 %,
   - zásoba leží niekoľko dní → mierne znížiť, nikdy však pod náklad.
8. **Každé ráno skontrolovať VK32** (dashboard *Prices*). V 2. kole sa 500g Nut predával za €2,50, kým trh platil €4,05. Bola to zabudnutá cena z výpredaja v 1. kole.
9. **Ku koncu kola ceny skôr dvíhať**, lebo konkurencii dochádza tovar a trhové ceny rastú.

### Marketing
10. **Ako funguje (Participants' Guide):** v ZADS sa zadáva **denná suma na produkt a región**. Obchody vidia rozpočty všetkých firiem a rozhodujú sa podľa **podielu na celkovom marketingu** daného produktu v regióne: dvojnásobný rozpočet = dvojnásobný vplyv. Je to hra s nulovým súčtom, takže reklama na jeden náš produkt berie zákazníkov aj iným našim produktom v tom istom regióne. Cena a dostupnosť sú pre obchody dôležitejšie ako marketing. Citlivosť na reklamu: DC14 vysoká, DC12 stredná, DC10 nízka.
11. **V tréningu sme dali spolu ~€1 230** (€1–40 na deň na produkt a región, väčšinou 1–2 bunky naraz). To je zanedbateľné, preto efekt nepoznáme. Výdavky konkurencie OData neposkytuje. Dajú sa odhadnúť len z výsledkovej tabuľky organizátora (MKTG/S × tržby).
12. **Odporúčaný rozsah (odhad z veľkosti trhu, nie overené pravidlo):** jedna bunka produkt × región má v priemere ~3 000 ks a ~€17 000 tržieb za deň (všetky tímy spolu). Pri marži ~€4/ks znamená každé 1 % podielu navyše ~€120 marže za deň.
   - **Test: €100–300 na deň** na bunku, 2–4 dni, potom porovnať náš podiel v bunke (dashboard *market share by region*) pred a po.
   - **Silné bunky** (veľký trh, máme zásobu, *pref* ≥ 1,1, DC14 alebo DC12): **€300–500 na deň**, ak test ukázal rast podielu.
   - **Strop:** celý marketing ~2–3 % tržieb (MKTG/S). Pri plnej kapacite v Extended je to ~€3–4k za deň na všetky bunky spolu.
   - **Nula:** produkty bez zásoby, DC10 a bunky, kde nás drží cena alebo dostupnosť.
13. **Keď vypredávame všetko, čo vyrobíme, marketing objem nezvýši.** Vtedy je lepšie zdvihnúť cenu. Marketing sa oplatí, keď je zásoba navyše, alebo na udržanie vyššej ceny.

### Financie
14. **„Veľký dlh na začiatku a potom kvantita“ neodporúčame.** Kvantitu obmedzuje trh a kapacita, nie peniaze. Úverová linka sa sama predĺži, keď hotovosť klesne pod nulu.
15. **Splatenie úveru rating nezlepší** (hotovosť aj úver klesnú rovnako), ušetrí len úrok. Splácať len sumu *Safe to repay now* z dashboardu, lebo faktúry dodávateľom sú splatné 20 dní po dodaní.
16. **Investície** posudzovať kalkulačkou v dashboarde (rozhoduje vplyv na konečné ocenenie). Skrátenie setupu sa oplatí, ak meníme produkt často. Kapacita sa oplatí, len ak opakovane vypredávame a do konca ostáva dosť kôl.

### Posledné kolo
17. **Nevyrábať, čo sa už nepredá.** V tréningu sme v dňoch 56–60 vyrobili **~70 000 ks**, ktoré ostali na sklade. Zisk za deň na konci klesol a ocenenie s ním, z €42,6M (deň 55) na €41,5M. V posledných ~5 dňoch vyrábať len to, čo sa reálne predá, a nakupovať len na zostávajúce dni (dashboard sa prepne do *End-game mode*).
18. Posledné dni: dvíhať ceny na vypredávaných produktoch, zásoby rozpredať, ale nie pod náklad.

## 3. Poučenie z prípravného kola

| | 1. kolo | 2. kolo | 3. kolo |
|---|---|---|---|
| Čo sa dalo robiť | len predaj | + výroba | + plánovanie a nákup |
| Predané ks | 237 000 | 237 000 | 170 000 |
| Tržby | €796k | €1 135k | €932k |
| Hrubá marža | €447k | €775k | €682k |
| Naša cena vs. trh | €3,35 vs. 4,61 (−27 %) | €4,78 vs. 5,33 (−10 %) | €5,48 vs. 5,78 (−5 %) |
| Podiel na trhu | 8,3 % | 11,7 % | 7,9 % |
| Výroba (dni) | – | 256 000 ks (19 dní) | 224 000 ks (16 dní) |
| Dni s predajom | 3 z 20 | 18 z 20 | 10 z 20 |
| Zisk kumulatívne / hodnota | €159k / €19,0M | €644k / €38,7M | €1 037k / €41,5M |

**Čo fungovalo:** v 2. kole linka bežala 19 z 20 dní a predalo sa všetko, čo sme vyrobili. Ceny sa z kola na kolo približovali trhu. Rating bol celý čas AAA+.

**Čo nás stálo najviac:**
1. **Neskorý nákup surovín** (3. kolo): prvé objednávky až v 41. deň, preto linka stála v dňoch 41–44. Ďalšia vlna prišla až v 50. deň (dodané 51–53), takže sa v dňoch 50–53 skoro nepredávalo. Predaj bol len 10 dní z 20.
2. **Krátke dávky**: ~7 zmien produktu za kolo, každá stojí tretinu dňa (~5 300 ks pri 16 000/deň).
3. **Zlý výber produktov** (3. kolo): F14 a F13, najmaržovejšie produkty, sme nevyrábali vôbec.
4. **Výroba na konci hry**: ~70 000 ks vyrobených v dňoch 56–60 ostalo na sklade. Suroviny sme zaplatili, ale do zisku sa nikdy nedostali.
5. **Ceny pod trhom** a zabudnutá výpredajová cena (500g Nut za €2,50).
6. **1. kolo**: štartovú zásobu sme minuli za 2 dni (72 % v 1. deň) za ceny o €1–1,35 pod trhom. Potom 18 dní nebolo čo predávať.

## 4. Postup v SAP: plánovanie a nákup

Dashboard, karta **Live recommendations → Planning & purchasing**:

1. **MD61 (prognóza predaja):** tlačidlo *Copy column (12 rows)* skopíruje vždy 12 riadkov v poradí F01–F06, F11–F16, rovnako ako v SAP. Pri produktoch, ktoré nevyrábame, je 0. Každá hodnota = plánovaná výroba + zásoba + rozpracované, lebo MD01 zásobu a otvorené objednávky sám odpočíta. MRP tak naplánuje presne náš plán obmedzený kapacitou a skladom surovín. Keď dashboard hlási dni „cut by the storage limit“, zopakujte MD61 → MD01 o pár dní, keď sa suroviny minú.
2. **MD01 (MRP):** spustite výpočet. Vzniknú plánované objednávky a požiadavky na nákup.
3. **ME59N:** vytvorte nákupné objednávky. Množstvá porovnajte so stĺpcom *Order qty*. Dodanie trvá 1–5 dní, platí sa 20 dní po dodaní.
4. **CO41 (výroba):** výrobnú objednávku uvoľníte až vtedy, keď sú na sklade všetky suroviny. Uvoľňujte v poradí z tabuľky *What to produce next* a rovnaké produkty dávajte za sebou.
5. Počas kola sledujte *Production & materials*: kedy sa produkt minie, kedy príde ďalšia dávka a ktoré nákupné objednávky ešte neprišli.

**Čistá potreba výroby** = prognóza na 20 dní + 3 dni rezervy − zásoba − fronta. V koncovej fáze hry sa obmedzí na zostávajúce dni a rezerva sa ruší.

## 5. Kontrolný zoznam počas kola

- [ ] Beží linka a je vo fronte výroba aspoň na 3 dni?
- [ ] Majú suroviny a obaly krytie ≥ 6 dní, prípadne je objednané?
- [ ] VK32 vo všetkých kanáloch: žiadna cena pod trhom pri vypredanom produkte, žiadne staré výpredajové ceny?
- [ ] Vyrábame najmaržovejšie produkty (1kg F14 / F13), ak ich trh berie?
- [ ] Marketing len na produkty so zásobou, v testovaných bunkách, MKTG/S do ~3 %?
- [ ] Hotovosť > 0, rating sa nezhoršuje, faktúry na 5 dní sú pokryté?
- [ ] Sklad hotových výrobkov < 250 000 ks, surovín < 250 000 kg, obalov < 750 000?
- [ ] Posledné kolo: nevyrábame niečo, čo sa do konca hry nepredá?

---

## Dashboard – ako používať

Súbory v tomto priečinku:
- `dashboard.js`: celý dashboard (sám sa obnovuje každých 20, 30 alebo 60 s)
- `dashboard.html`: lokálna verzia, číta `data.js`
- `data.js`: dáta pre lokálnu verziu (snapshot z 1. kola tréningu)
- `refresh_data.py`: stiahne čerstvé dáta do `data.js`

### A) Živý dashboard priamo zo SAP (odporúčané, netreba heslo ani skript)
1. V Chrome, kde si prihlásený do SAP, otvor `https://erpsim-b1.hec.ca:8001/`. Stránka „404 / Service cannot be reached“ je v poriadku, slúži len na to, aby konzola bežala na doméne SAP. Dashboard podľa adresy sám zvolí klienta 418; pre tréningový server `r75p.ucc.cloud` zvolí 792.
2. Otvor konzolu (F12 → Console) a vlož celý obsah súboru `dashboard.js`, potom Enter.
3. Dashboard sťahuje dáta z OData cez tvoje prihlásenie a sám sa obnovuje (20 s / 30 s / 60 s / vypnuté). Keď vyprší SAP session, zobrazí sa červené upozornenie. Stačí sa znova prihlásiť a kód vložiť ešte raz.

### Živé odporúčania v dashboarde
Karta **Live recommendations** sa prepočíta pri každej obnove dát:
- **Upozornenia:** linka stojí, produkt je vypredaný a nič sa nevyrába, cena je pod nákladmi alebo pod trhom, sklad je nad 90 % alebo nad limitom (hotové výrobky 250 000, suroviny 250 000 kg, obaly 750 000), záporná hotovosť.
- **What to produce next (CO41):** poradie výroby podľa marže × očakávaného dopytu a dní do vypredania, odporúčaná dĺžka dávky a či sú na ňu suroviny.
- **Prices (VK32):** odporúčaná cena podľa trhu a zásoby (pri nedostatku vyššia, pri prebytku nižšia, nikdy pod náklad × 1,15). Počíta sa pre vybraný kanál (DC10/12/14).
- **Marketing signals (ZADS):** kde marketing zastaviť (chýba zásoba), kde pridať (je zásoba a región má vysoký dopyt na jednu predajňu a nízky náš podiel) a kde ste stratili zákazníkov.
- **Konkurencia:** celý trh mínus my, po produktoch (objem a cena konkurencie, týždenná zmena, signál „konkurencii dochádza tovar“) a po týždňoch (my oproti priemernému tímu). Dáta jednotlivých tímov OData neposkytuje.
- **Production & materials:** harmonogram výroby s časovou osou, denná výroba oproti kapacite (využitie, straty na prestavbách), zásoby po dňoch, kedy sa produkt minie oproti tomu, kedy príde ďalšia dávka, suroviny rezervované pre frontu a nákupné objednávky so skutočnou dodacou lehotou.
- **Plán na kolo (MD61) a nákup (ME59N):** rozdelenie výrobných dní medzi produkty a koľko surovín objednať, s ohľadom na dodaciu lehotu 1–5 dní.

Sú to heuristiky, teda podnety na overenie, nie hotový plán do SAP. Model nepozná skutočnú cenovú citlivosť zákazníkov a nevidí ponuky ostatných tímov. Marketingové signály sú návrhy na malý experiment.

**Úver a rating:** karta *Loan & credit rating monitor* ukazuje úver, hotovosť, pohľadávky, záväzky a debt loading s trendom za posledných 5 dní. Upozorní, keď hotovosť klesne pod nulu (beží úverová linka), keď úver rastie, a koľko dní pri súčasnom tempe zostáva do ďalšieho ~€1M poklesu debt loadingu (≈ o stupeň horší rating). Ukazuje aj, aký rozsah debt loadingu sme zatiaľ pri každom ratingu videli.

**Nové polia v hlavičke:** *Recipe* a *Rounds* (počet kôl hry).

*Recipe* má 3 skupiny oddelené `;`, všetko v % hmotnosti balenia a každá skupina dáva spolu 100:

| Skupina | Produkty | Zložky | Predvolené (náš recept pre ZCS02) |
|---|---|---|---|
| 1 | F01–F04, F11–F14 | R05 pšenica / R06 ovos / príchuť | `20/60/20` |
| 2 | F05, F15 (Original) | R05 / R06 | `20/80` |
| 3 | F06, F16 (Mixed) | R05 / R06 / R01 / R02 / R03 / R04 | `20/50/1/1/1/27` |

Pole teda obsahuje `20/60/20; 20/80; 20/50/1/1/1/27`. Pri 500g balení to zodpovedá napr. 0,10 / 0,30 / 0,10 kg, pri 1kg balení dvojnásobku.

**Tento recept platí až po zmene v ZCS02.** Na začiatku hry má SAP `35/35/30; 50/50; 30/30/10/10/10/10`. Kým recept v SAP nezmeníte, zadajte do poľa tieto pôvodné hodnoty, inak dashboard objedná zlé množstvá surovín. Recept sa použije pre výrobné náklady, rezervácie surovín aj nákup v ME59N. Ak BOM detektív hlási rozdiel, recept v SAP sa líši od toho v hlavičke. Keď ostáva menej ako 20 dní, zapne sa **koncová fáza hry**: plánovanie a nákup sa obmedzia na zostávajúce dni a ruší sa bezpečnostná zásoba.

**Platby dodávateľom:** karta úveru ukazuje faktúry splatné o 20 dní po dodaní (po dňoch) a **„Safe to repay now“** = hotovosť − faktúry na 5 dní − 5 dní fixných nákladov.

**Kopírovanie:** tlačidlá *Copy column* kopírujú vždy pevnú mriežku riadkov SAP. MD61 má 12 riadkov (F01–F06, F11–F16). VK32 má pre DC10 6 riadkov (F11–F16), pre DC12 12 riadkov a pre DC14 6 riadkov (F01–F06). Produkt bez odporúčania dostane aktuálnu cenu, prípadne prázdny riadok, ak cena nie je známa. Pri prvom použití skontrolujte, že poradie riadkov v SAP naozaj sedí.

**Fixné náklady sa počítajú živo:** tržby − náklady na predaný tovar − marketing − investícia do setupu − zisk, od 1. dňa. Zobrazujú sa v karte úveru ako €/deň a €/kus pri plnej kapacite a slúžia ako spodná hranica odporúčanej ceny (aspoň €0,90/ks). V 1. kole tréningu to vyšlo ~€14k/deň, teda €0,90/ks. V ostrom kole sa vyššia hodnota prejaví sama.

**Počty predajní (ostré kolo):** DC10 North 2 / South 7 / West 3 · DC12 19 / 23 / 17 · DC14 45 / 38 / 40. Používajú sa pre „pref“ (preferencia regiónu na predajňu) a pre cielenie marketingu.

**Kalkulačka investícií (dole na stránke):** porovnáva skrátenie setupu a navýšenie kapacity. Verdikt sa rozhoduje podľa **vplyvu na konečné ocenenie** (hodnotí sa ocenenie, nie hotovosť): ocenenie = kumulatívny zisk ÷ dni hry × 240 ÷ diskontná sadzba. Extra zisk sa ráta len za zostávajúce dni. Setup sa odpočíta raz, pri kapacite sa rátajú len odpisy. Prázdne polia berú živé hodnoty (marža za posledných 5 dní, počet zmien produktu za kolo, zostávajúce dni, sadzba). Hodnoty, ktoré zadáte, sa pri obnove neprepíšu. **Overte si cenu a efekt investície v SAP a pravidlách kola** a zadajte ich do políčok. Predvolené sú €125k za 8 → 6 h a €1M za +1 000 ks/deň. Pri hre s 3 kolami a ~3 zmenami za kolo sa setup väčšinou neoplatí. Pri ~8 zmenách za kolo už áno.

**BOM detektív (v sekcii Production):** SAP OData nemá entitu s kusovníkom (`BOM_Changes` je prázdna), preto dashboard odvodí skutočnú spotrebu na kus z pohybov zásob. Berie len dni, keď sa vyrábal jediný produkt a v okolí nebola dodávka danej suroviny. Ak spotreba nesedí s receptom v poli *Recipe*, zobrazí sa červeno. Vtedy treba recept skontrolovať v SAP (CS03 / ZCS02) a zadať nový pomer do poľa *Recipe*.

**Nastavenia v hlavičke dashboardu:** *Game* (Introduction / Extended), *Capacity* (16 000 / 24 000 alebo viac po investícii) a *Setup* (8 h alebo menej po investícii do skrátenia prestavby). Ukladajú sa v prehliadači. Dashboard podľa hry a kola vie, čo je dostupné (Introduction: 1. kolo predaj, 2. kolo + výroba, 3. kolo + plánovanie a nákup). Výroba a nákup sa počítajú za všetky kanály spolu, filter *Channel* mení len ceny a marketing. Pri zmene receptu (ZCS02) stačí zadať nový pomer do poľa *Recipe* (predvolený je 35/35/30).

### B) Lokálna verzia
Spusti skript, ktorý sa opýta na SAP meno a heslo (heslo nikam neukladá):

```bash
python3 refresh_data.py --loop 20
```

Potom otvor `dashboard.html`. Dashboard každých 20 s znova načíta `data.js`, nie je potrebné obnovovať stránku.
