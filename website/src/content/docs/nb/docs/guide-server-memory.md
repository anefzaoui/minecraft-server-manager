---
title: 'Hvor mye RAM trenger en Minecraft-server?'
description: 'Hvor mye RAM en Minecraft-server trenger for vanilla, Paper, lette mods og store modpacks, og hvor mye som bør beholdes for maskinen.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-memory.md'
---

[← Tilbake til dokumentindeks](/docs/)

Kort svar, for en server som faktisk skal spilles på:

| Hva du kjører                                 | Java heap   | Gi maskinen |
| --------------------------------------------- | ----------- | ----------- |
| Vanilla eller Paper, opptil 10 spillere       | 2 GB        | 4 GB        |
| Paper med plugins, 10 til 30 spillere         | 4 GB        | 6 GB        |
| En lett modpack, 40 til 80 mods               | 4 GB        | 6 GB        |
| En stor "kitchen-sink"-pack, 150 til 300 mods | 6 til 8 GB  | 10 GB       |
| GregTech New Horizons og lignende monstre     | 8 til 12 GB | 16 GB       |

To tall, ikke ett. Det er den delen de fleste guider hopper over, og grunnen til at folk kjøper en 4 GB
server, gir Java 4 GB, og så ser den dø.

## Heapen og maskinen er forskjellige tall

Java heapen (`-Xmx`) er hvor mye minne spillet selv kan bruke til verden, entiteter og mod-data. Maskinen,
eller containeren, må holde denne heapen **pluss** alt annet Java trenger: klassemetadata, tråd-stabler,
søppeltømmer-regnskap, nettverksbuffere og selve JVM-en. Den overheaden er omtrent 0,5 til 1,5 GB for en
moddet server.

Hvis heapen er lik maskinens minne, dreper kjernen serveren i det øyeblikket Java når for den overheaden.
I Docker vises dette som exit code 137, og i loggene som ingenting i det hele tatt: prosessen forsvinner
bare midt i en setning. Folk skylder vanligvis på en mod.

En trygg regel: **heap pluss 25 prosent, og minst én ledig gigabyte.** En 8 GB heap krever en 10 GB
maskin.

## Mer RAM er ikke mer ytelse

Minecraft er begrenset av én tråd i det meste den gjør. Å gi en 40-mod pack 16 GB gjør ikke at chunks
genereres raskere; det gjør at hver søppeltømming-pause varer lenger, fordi det er mer å gå gjennom. En
server som hakker hvert trettiende sekund, er ofte en server med for mye heap, ikke for lite.

Øk heapen når du ser dette, og ikke ellers:

- `java.lang.OutOfMemoryError: Java heap space` i loggen.
- Gjentatte "Can't keep up! Is the server overloaded?" med søppeltømming-pauser i timingen.
- Minnebruk som klatrer til taket og blir der i timevis.

## Hvorfor serveren din viser 12 GB brukt mens ingen er online

Fordi du ba den om det. To standardinnstillinger konspirerer:

1. Det vanlige Docker-imaget setter start-heapen lik maksimum, så `-Xms` og `-Xmx` er begge ditt tall.
   Java krever det med en gang i stedet for å vokse inn i det.
2. Det populære Aikar flaggsettet inkluderer `-XX:+AlwaysPreTouch`, som går gjennom hver side av den
   heapen ved oppstart slik at sidene blir virkelig allokert. Det er bevisst: det bytter en tregere
   oppstart og et høyt ledig tall mot færre pauser senere.

Målt på Paper 1.21.1 med en 2 GB heap i en 4 GB container, samplet i tre minutter etter at verden var
ferdig lastet:

| Konfigurasjon                        | Resident memory |
| ------------------------------------ | --------------- |
| Ingen flagg                          | 2.60 GiB        |
| Aikar flagg                          | 2.59 GiB        |
| Aikar flagg uten `AlwaysPreTouch`    | 1.95 GiB        |
| Aikar flagg med en 512 MB start-heap | 1.38 GiB        |
| Ingen flagg med en 512 MB start-heap | 1.25 GiB        |

Så en server som "bruker" 12 GB på tomgang, er vanligvis en 12 GB heap som har blitt pre-touched, ikke en
lekkasje. Din overvåking leser det riktig; tallet betyr bare ikke det det ser ut som.

Hvis du vil ha et ærlig tomgangstall, sett start-heapen lavere enn maksimum. Du betaler for det med
noen flere samlinger tidlig. Hvis du heller vil ha jevne bildefrekvenser, la det være og slutt å se på
grafen.

## Spillere betyr mindre enn du tror

Å doble fra 10 til 20 spillere koster langt mindre enn å legge til femti mods. Spillere legger mest til
entiteter og lastede chunks, som skalerer forsiktig. Mods legger til klassedata, registre,
verdensgenereringsfunksjoner og deres egne cacher, som ikke gjør det. Størrelse for pakken først, legg
deretter til omtrent 100 til 200 MB per vanlige spiller på en moddet server.

Visningsavstand er den andre store spaken. Å slippe fra 12 til 8 chunks kan spare en gigabyte på en
travel server og merkes knapt i spill.

## I Minecraft Server Manager

Hver server har to separate felt, **Java heap** og **container minnegrense**, nettopp fordi de er
forskjellige spørsmål. Opprettingsveiviseren setter containergrensen 50 prosent over heapen for deg,
og panelet nekter å lagre en server hvis containergrense ikke er over heapen, fordi den kombinasjonen
ender med exit code 137 i stedet for en feilmelding.

Minne-meteret på en server viser hva containeren faktisk bruker, med en merknad når heapen ble krevd
på forhånd, slik at en pre-touched heap ikke leses som en løpsk. En server som kjernen drepte for
minne, blir registrert nøyaktig som det i historikken, i stedet for som en mystisk krasj.

Relatert: [opprette og administrere servere](/docs/servers/),
[krasjlogger](/docs/servers/#crash-reports--mclogs-analysis), [lagring og kvoter](/docs/storage/).
