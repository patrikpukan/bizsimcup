# Analýza dashboard.js v kontexte BIZ SIM CUP

Dátum: 5. novembra 2026

Tento dokument zachytáva predchádzajúcu analýzu skriptu a súťažných podkladov. Nálezy a výsledky testov sa vzťahujú na verziu skúmanú počas tejto analýzy; export dokumentu nie je novou kontrolou prípadných neskorších úprav.

## Záver

Dashboard má užitočné prehľady, ale v odporúčaniach sú chyby, ktoré môžu viesť k nesprávnej výrobe, nákupu aj cenám. Najvyššiu prioritu majú rozlíšenie variantu a fázy hry, oddelenie spoločnej výroby od filtra predajného kanála a plánovanie zásob podľa času dostupnosti.

Automatické odporúčania zatiaľ treba používať ako podnety na overenie, nie ako hotový plán zadávaný do SAP.

## Rozsah a overenie

- Preskúmaný bol celý `dashboard.js`, miestny snapshot `data.js`, súvisiace `odporucania.md` a spôsob načítania dát v `refresh_data.py`.
- Súťažný kontext bol overený v materiáloch v priečinku `materials`.
- Syntax skriptu prešla kontrolou `node --check`.
- Vybrané výpočty a načítanie dát boli overené lokálne v JavaScript VM s napodobeným DOM a sieťovými odpoveďami.
- Overenie používalo miestny snapshot firmy H5 z prvého kola a syntetické scenáre. Nešlo o pripojenie k živému SAP ani o kompletný test používateľského rozhrania v prehliadači.
- Pri syntetických výsledkoch uvedených nižšie ide o demonštráciu správania algoritmu, nie o výsledky skutočnej hry.
- Produkčný skript ani pôvodné odporúčania sa v rámci analýzy nemenili.

## 1. Nerozlišuje fázy Introduction

**Závažnosť: vysoká — nesprávna interpretácia pravidiel a výsledkov.**

Pri prázdnej výrobnej fronte skript vždy vyhlási, že linka stojí a treba okamžite uvoľniť výrobnú objednávku. Neoveruje pritom, či je výroba v danom variante a kole hry dostupná.

V štandardnom Introduction sa v prvom kole predáva počiatočná zásoba, výroba pribúda v druhom kole a nákup s plánovaním v treťom. Preto tvrdenie v `odporucania.md`, že nevyrábajúca továreň v prvom kole bola chybou tímu, nie je bez overenia nastavení konkrétneho workshopu opodstatnené.

**Dopad:** tím môže nesprávne vyhodnotiť svoju stratégiu a dostávať neuskutočniteľné pokyny.

**Odporúčanie:** zaviesť explicitný variant hry a dostupnosť činností podľa fázy. Upozornenia na výrobu a nákup zobrazovať iba vtedy, keď ich možno vykonať.

**Miesto v kóde:** `recommendations()`, upozornenie `Production line is idle`.

**Zdroj pravidiel:** [Participants’ Guide](<../materials/ParticipantsGuide_ERPsim_Manufacturing_Game (Accessible).pdf>), strana 6.

## 2. Predvolené nastavenia nezodpovedajú súťažnému Extended

**Závažnosť: vysoká — systematicky nesprávne kapacitné výpočty.**

Skript používa kapacitu 16 000 ks/deň, ktorá zodpovedá Introduction. Základná kapacita Extended je 24 000 ks/deň. Pevne nastavený setup 8 hodín zostáva nezmenený aj po prípadnej investícii do jeho skrátenia.

Podľa prezentácie sa na workshope používa Introduction, zatiaľ čo školské súťažné kolo používa Extended.

**Dopad:** nesprávne termíny dokončenia, dĺžka fronty, odporúčané dávky, materiálová potreba a vyhodnotenie využitia kapacity.

**Odporúčanie:** konfiguráciu viazať na variant hry a aktuálne parametre firmy. Ak sa nedajú spoľahlivo načítať, sprístupniť ich ako viditeľné používateľské nastavenia. Nestačí poznámka v komentári, že treba ručne zmeniť `CAPACITY`.

**Miesto v kóde:** `CFG.CAPACITY`, `CFG.SETUP_H` a ich použitie vo výrobných výpočtoch.

**Zdroje:** [Job Aid Extended](<../materials/2024-25_JobAid_Manuf_Ext_EN.pdf>), strana 2; [Prezentace BIZ SIM CUP 2026](<../materials/Prezentace BIZ SIM CUP 2026.pdf>), strana 1.

## 3. Prepnutie zobrazovaného kanála mení výrobný plán celej firmy

**Závažnosť: vysoká — globálne rozhodnutie závisí od filtra zobrazenia.**

Dopyt pre výrobu skript sčíta zo všetkých kanálov. Maržu používanú na poradie výroby a rozdelenie výrobných dní však odvodí z aktuálne vybraného kanála. Spoločný výrobný plán tak môže byť iný podľa toho, či používateľ práve pozerá DC10, DC12 alebo DC14.

Ak chýbajú dodávateľské ceny, aj náhradný výpočet nákladov z historických predajov používa predaje vybraného kanála. Pri chýbajúcom predaji v tomto kanáli sa preto nemusí podariť určiť náklad, hoci firma má predaje toho istého produktu inde.

**Overenie:** v syntetickom scenári prepnutie DC12 → DC10 zmenilo pridelenie F12 z troch na štyri výrobné dni a F13 z dvoch na jeden. Firemné dáta zostali rovnaké.

**Dopad:** tím dostane rôzne odporúčania pre tú istú výrobnú linku iba zmenou pohľadu.

**Odporúčanie:** spoločnú výrobu počítať z očakávaného odbytu a marží naprieč kanálmi. Filter má ovplyvňovať zobrazenie a kanálové ceny, nie meniť vstupy globálneho výrobného rozhodnutia. Náklady produktu vyhodnocovať nezávisle od zobrazovaného predajného kanála.

**Miesto v kóde:** zostavenie `prod`, výpočet `ref`, `uc`, `margin` a `score` v `recommendations()`, následne rozdelenie `alloc`.

## 4. Odporúčaný nákup nezohľadňuje zásobu hotových výrobkov

**Závažnosť: vysoká — riziko nadvýroby a nadmerného nákupu.**

Rozdelenie výrobných dní vychádza z očakávaného dopytu a marže. Existujúcu zásobu hotových výrobkov ani rozpracovanú výrobu od požadovaného objemu neodpočíta. Následne vypočíta suroviny pre celý takto navrhnutý objem.

**Overenie:** v syntetickom teste s jediným produktom navrhol 320 000 ks výroby pri nulovej zásobe aj pri zásobe 500 000 hotových kusov.

Hrubý predajný forecast pre MD61 treba odlíšiť od čistej potreby výroby a nákupu. Rovnaký hrubý forecast môže mať pri rôznej zásobe odlišnú čistú potrebu surovín.

Plán sa navyše vždy skladá na celé 20-dňové kolo. Chýba samostatný výpočet pre zostávajúci čas hry a jednoznačné odlíšenie plánu nového kola od okamžitého nákupného odporúčania.

**Dopad:** zbytočné viazanie peňazí v zásobách, skladové náklady a nákup materiálov, ktoré už do konca hry nebude potrebné spracovať.

**Odporúčanie:** pre zvolený horizont najprv vypočítať čistú potrebu hotových výrobkov:

```text
čistá potreba výroby = max(
    0,
    očakávaný predaj + cieľová konečná zásoba
    − dostupná hotová zásoba − včas dokončená rozpracovaná výroba
)
```

Až potom vypočítať materiály, zohľadniť existujúce rezervácie a dodávky a overiť kapacitu, prestavby a prípustné výrobné dávky. Oddeliť tento výpočet od hrubého forecastu zadávaného do MD61.

**Miesto v kóde:** sekcie `production plan for a round` a `purchasing (MRP for that plan)`.

## 5. Budúca výroba a otvorené nákupy sa považujú za okamžite dostupné

**Závažnosť: vysoká — nesprávne pokrytie zásob a cenové signály.**

Pokrytie hotového výrobku sa počíta ako:

```text
(sklad + celá výrobná fronta produktu) / očakávaný denný predaj
```

Výpočet nezohľadňuje, kedy sa jednotlivé objednávky vo fronte dokončia. Podobne pri surovinách pripočíta všetky otvorené nákupné objednávky bez ohľadu na termín dodania.

**Overenie:** v syntetickom teste s nulovou hotovou zásobou a 160 000 ks vo výrobnej fronte skript vypočítal vyše 12 dní pokrytia. Preto odporučil cenu 5,65 € pri trhovej referencii približne 6,15 €, hoci výrobok aktuálne nebol dostupný na predaj.

**Dopad:** zníženie ceny pri nedostatku okamžite dostupného tovaru, prehliadnutie dočasného vypredania alebo podcenenie rizika zastavenia výroby pred príchodom surovín.

**Odporúčanie:** zostaviť dennú projekciu zásob. Použiť skutočné poradie výroby, čiastkový výstup výroby, prestavby, termíny dodávok a očakávaný predaj. Rozlišovať zásobu dostupnú teraz a budúce príjmy.

**Miesto v kóde:** `cover = (s + pend) / exp`, cenový násobok `mult` a započítanie `openPO` do materiálového pokrytia.

## 6. Náklad na kus nie je dostatočne spoľahlivý pre cenové minimum

**Závažnosť: vysoká pri zmene receptúr alebo cien materiálov.**

Funkcia `recipe()` má pevné recepty. Po zmene receptúry v Extended budú nesprávne náklady, materiálové rezervácie aj odporúčaný nákup.

Aktuálna cena od dodávateľa sa môže líšiť od účtovného nákladu existujúcej zásoby. Skript tieto veličiny používa zameniteľne: prednostne počíta aktuálnu cenu materiálov podľa receptu, inak historický pomer `COST / QUANTITY` z predajov.

Ak zdroj obsahuje viac dodávateľských cien rovnakého materiálu, priradenie do `rawPrice` použije posledný spracovaný riadok. Neobsahuje pravidlo výberu dodávateľa alebo relevantnej ponuky.

**Dopad:** nepresná marža, nevhodné poradie výroby a cenové minimum, ktoré nemusí chrániť zisk pri predaji existujúcej zásoby.

**Odporúčanie:** oddeliť účtovný náklad predávanej zásoby od nákladu novej výroby. Používať aktuálny kusovník a jednoznačné pravidlo pre dodávateľskú cenu. Pri chýbajúcich údajoch zobraziť neistotu a neprezentovať vypočítané minimum ako zaručene bezpečnú cenu.

**Miesto v kóde:** `recipe()`, `rawPrice`, `stdCost()` a cenová dolná hranica v `recommendations()`.

## 7. Cenové a marketingové rady majú vyššiu istotu, než podporujú dáta

**Závažnosť: stredná až vysoká — obmedzenie rozhodovacieho modelu.**

Dopyt sa odhaduje z približnej veľkosti trhu na tím a historického produktového mixu. Odporúčané ceny následne používajú pevné násobky, napríklad `1.08`, `0.96` alebo `0.92`, podľa vypočítaného pokrytia. Model nemá kalibráciu reakcie zákazníkov na cenu.

Historický predaj pritom nie je totožný s celkovým dopytom: ovplyvňujú ho zásoby, ceny a marketing všetkých tímov. Trhový priemer reprezentuje uskutočnené predaje, nie všetky ponukové ceny. Pokles objemu konkurencie pri rastúcej priemernej cene preto sám osebe nedokazuje vypredanie.

Marketingové rady tiež nemajú vyhodnotenie prírastku zisku po zmene rozpočtu. Označenia typu „Boost“ preto vyjadrujú príležitosť na experiment, nie potvrdenú návratnosť.

**Odporúčanie:** pri cenách a marketingu zobrazovať dôvod, mieru istoty a návrh malého experimentu. Po zmene sledovať predaj aj príspevok na zisk, dostupnosť tovaru a rozdiely medzi kanálmi. Nevyhodnocovať úspech iba cez tržby alebo počet kusov.

Aj tvrdenie v `odporucania.md`, že vyššie ceny pri rovnakých predaných kusoch prinesú konkrétny zisk a hodnotu firmy, treba označiť ako scenár s nezmeneným objemom. Zdraženie môže objem predaja zmeniť.

**Miesto v kóde:** model `dem`, cenový násobok `mult`, `competitorSection()` a marketingové signály v `recommendations()`.

**Zdroj k interpretácii trhových dát:** Participants’ Guide, strana 90, tabuľka 8.3.

## 8. Obnova dát môže vytvárať falošný pocit aktuálnosti

**Závažnosť: vysoká pri neúplných alebo zastaraných dátach.**

### LIVE režim ignoruje stránkovanie OData

`fetchLive()` spracuje iba `j.d.results`. Nesleduje `__next`. Ak server odpoveď stránkuje, dashboard analyzuje iba prvú stránku. Lokálny `refresh_data.py` pritom stránkovanie spracúva.

**Overenie:** pri napodobenej odpovedi obsahujúcej `__next` vykonal skript iba jednu požiadavku na každý dataset a ďalšiu stránku nenačítal.

**Oprava:** načítať všetky stránky a overiť úplnosť dát pred výpočtom odporúčaní.

### Lokálny režim môže vykázať úspech po neúspešnej obnove

Ak načítanie `data.js` zlyhá a `window.ERPSIM_DATA` už obsahuje starý snapshot, chyba sa potlačí. `tick()` následne zobrazí úspešnú aktualizáciu.

**Overenie:** po simulovanom zlyhaní načítania vrátil `fetchLocal()` pôvodný snapshot bez výnimky.

**Oprava:** odlíšiť úspešné načítanie od použitia posledných dostupných dát. Stav aktuálnosti odvodiť aj od času vytvorenia snapshotu, nie iba od času posledného pokusu o obnovu.

### Časové obdobia nemusia byť porovnateľné

Trhový podiel a odpočet konkurencie predpokladajú, že trhové dáta a naše predaje pokrývajú rovnaký interval. Príručka opisuje trhový report ako dáta za posledných 20 dní, aktualizované po päťdňových obdobiach. Bez overenia konkrétneho rozsahu OData môže porovnanie s dlhšou históriou predajov skresľovať výsledky.

**Oprava:** určovať spoločný časový interval a rovnaké uzavreté obdobia pre oba zdroje. Zobrazovať obdobie, z ktorého sa ukazovateľ počíta. Tento bod je rizikom pri rozdielnom rozsahu zdrojov, nie potvrdenou chybou aktuálneho snapshotu prvého kola.

**Miesto v kóde:** `fetchLive()`, `fetchLocal()`, `tick()`, kumulatívne KPI a odpočet našich predajov od trhu.

## Odporúčané poradie úprav

1. Rozlíšiť variant a fázu hry; nastaviť aktuálnu kapacitu a setup.
2. Oddeliť spoločný výrobný model od filtra predajného kanála.
3. Zaviesť časový model zásob, výroby a dodávok; oddeliť hrubý forecast od čistej potreby nákupu.
4. Spresniť kusovníky a náklady existujúcej zásoby aj novej výroby.
5. Opraviť stránkovanie, signalizáciu zastaraných dát a porovnateľnosť časových období.
6. Kalibrovať cenové a marketingové heuristiky na pozorovaných výsledkoch.
7. Doplniť rozhodovacie scenáre podľa cieľa súťaže: vplyv na Company Valuation, hotovosť a rating, vrátane investícií a zostávajúceho času hry.

## Podklady

- [dashboard.js](dashboard.js)
- [data.js](data.js)
- [odporucania.md](odporucania.md)
- [refresh_data.py](refresh_data.py)
- [Participants’ Guide](<../materials/ParticipantsGuide_ERPsim_Manufacturing_Game (Accessible).pdf>) — najmä strany 6, 42, 90 a 96.
- [Job Aid Extended](<../materials/2024-25_JobAid_Manuf_Ext_EN.pdf>) — najmä strana 2.
- [Manufacturing Extended](<../materials/2025-26_Manuf_Extended_EN.pdf>) — najmä pravidlá kanálov a hodnotenia firmy.
- [Prezentace BIZ SIM CUP 2026](<../materials/Prezentace BIZ SIM CUP 2026.pdf>) — rozlíšenie workshopu a školského súťažného kola.
