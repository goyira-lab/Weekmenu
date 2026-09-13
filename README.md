# SaladeMenu v2.3 – layout-update

Deze versie gebruikt de nieuwe dashboard-layout met:
- brede header en navigatie;
- zoekveld + hoofdgroentefilter;
- receptenraster zoals in het gekozen ontwerp;
- favorieten;
- boodschappenlijst in de rechterzijbalk;
- populaire groenten;
- volledige boodschappenpagina;
- Android/PWA ondersteuning.

## Belangrijk: receptfoto's zitten NIET in deze ZIP
De site verwacht de bestaande afbeeldingen op GitHub op exact deze paden:

`assets/images/recipe-001.jpg` t/m `assets/images/recipe-080.jpg`

Laat de bestaande map `assets/images/` dus op GitHub staan en vervang alleen de bestanden uit deze update-ZIP.

## Uploaden
1. Pak deze ZIP uit.
2. Upload de inhoud naar de hoofdmap van dezelfde GitHub repository.
3. Kies bij dubbele bestanden **Replace/overschrijven**.
4. Verwijder `assets/images/` niet.
5. Na de commit kan GitHub Pages de nieuwe layout tonen.
6. Op Android kan de PWA eventueel één keer opnieuw worden gestart/ververst vanwege de nieuwe cacheversie.

Versie: 2.3

## Nieuw in v2.3
De boodschappenlijst laat standaard basisvoorraad weg:
- zout
- peper
- olijfolie
- bakolie / zonnebloemolie / neutrale of plantaardige olie
- water

Dit gebeurt alleen in de boodschappenlijst. In het recept zelf blijven deze ingrediënten gewoon zichtbaar.
