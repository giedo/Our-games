# Onderzoek: kunnen de auto's en poppetjes echt rondom 3D worden?

Korte versie: **ja, voor een groot deel, en een eerste stap zit nu in het spel.** Volledig "echt" 3D (een achterkant en zijkant die het kind nooit getekend heeft) kan alleen met extra informatie: een tweede tekening, of een AI-model dat de rest raadt. Hieronder staat wat er was, wat er nu is, en welke vervolgstappen mogelijk zijn.

## Hoe het werkte (voor deze update)

Het spel krijgt van een kind precies één tekening per voertuig (van opzij) en één per poppetje (van voren). Uit één plaatje is niet te weten hoe de achterkant of de dikte eruitziet, dus het spel verzint de dikte:

- **Poppetjes** (`js/puffy.js`, modus `pillow`): de omtrek wordt opgeblazen als een ballon, dik in het midden, dun aan de rand. De tekening staat op voor- en achterkant.
- **Voertuigen** (modus `slab`): de omtrek wordt uitgezaagd als een plak van 1,36 m breed met een klein afgerond randje. Van opzij ziet dat er goed uit, van achteren zag je een platte plank met platte blokken als wielen.

## Wat er nu veranderd is

1. **Wielen worden herkend.** `findWheels()` in `js/puffy.js` zoekt de stukken van de omtrek die de grond raken (de onderste 5% van de tekening). Elk los stuk wordt een wiel met een middelpunt en straal. Is de onderkant één lange vlakke lijn (een boot, een slee), dan worden er geen wielen gemaakt.
2. **Banden steken uit.** Op de plek van een wiel is het model breder (1,2 keer) en hoekig, zoals een echte kartband. De wielen zijn nog steeds de getekende wielen, ze worden alleen dikker.
3. **De carrosserie is rond.** Tussen de wielen is de auto nu bol als een kussen (grotere afronding, dunnere rand), dus van achteren en schuin zie je een ronde vorm in plaats van een plank.
4. **Poppetjes zijn voller.** Ze worden ongeveer 40% dikker opgeblazen (`maxT` van 0,42 naar 0,58 m), zodat ze van opzij minder plat zijn.

De tekening van het kind blijft op voor- en achterkant staan. Dat is bewust: in de race kijk je bijna altijd van achteren naar je poppetje, en kinderen willen hun eigen tekening zien.

## Mogelijke vervolgstappen

| Optie | Wat het oplevert | Moeite | Nadelen |
| --- | --- | --- | --- |
| **A. Tweede tekening (achterkant of zijkant)** | Poppetje met een echte achterkant; met een zijaanzicht kan het model worden "gesneden" uit twee silhouetten (de techniek heet *visual hull*: alleen wat in beide tekeningen binnen de lijn valt, blijft over). | Middel: extra stap in de tekenstudio, nieuwe meshbouw. | Kinderen moeten twee keer tekenen en de tekeningen moeten ongeveer even groot zijn. |
| **B. Meer vormen afleiden uit één tekening** | Bijvoorbeeld armen en benen als losse delen die kunnen bewegen, of een hoofd dat iets uitsteekt. | Middel tot groot. | Gokwerk: werkt goed voor sommige tekeningen en raar voor andere. |
| **C. AI die van één plaatje een 3D-model maakt** | Er bestaan AI-modellen die van één foto een volledig 3D-object maken. | Groot. | Draait in de praktijk op een server: de tekeningen zouden het apparaat verlaten. Dat botst met de huidige belofte "geen netwerk, tekeningen blijven op het apparaat". Ook kost het tijd per tekening en het resultaat lijkt minder op de echte tekening. Ik kan niet bevestigen welke van deze modellen geschikt en betaalbaar is zonder het te testen. |
| **D. Draaiende 3D-wielen** | Losse wielen die echt ronddraaien als je rijdt. | Klein tot middel. | Elk wiel is een extra tekenopdracht voor de grafische kaart (8 karts x 2 assen = 16 extra), dus testen op een oudere iPad is nodig. Ze zouden de getekende wielen bedekken. |

**Advies:** begin met optie A als "extra knop" in de tekenstudio ("Teken ook de achterkant"), en laat het huidige model de standaard blijven voor wie maar één tekening maakt. Optie C alleen als jullie bewust kiezen voor een online dienst en de privacy goed regelen.

## Hoe je het verschil ziet

```bash
node tools/shot.mjs --world meadow --view race --at 0 --out nieuw.png
node tools/shot.mjs --game <map met oude versie> --world meadow --view race --at 0 --out oud.png
```
