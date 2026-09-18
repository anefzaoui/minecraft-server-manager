---
title: 'Päivitykset'
description: 'Päivitykset-sivu seuraa yhdessä paikassa, mikä on vanhentunutta palvelinlaivastossasi:'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Takaisin dokumenttien luetteloon](/docs/)

**Päivitykset**-sivu seuraa yhdessä paikassa, mikä on vanhentunutta laitteistossasi:

- **Modpack**-versiot ([modpackit](/docs/modpacks/)) verrattuna Modrinth / CurseForge / GTNH-julkaisuluetteloon.
- **Mukautettu sisältö**, jonka olet itse lisännyt – modit, datapackit, resurssipackit, plugin-lisäosat – jokainen verrattuna sen lähteeseen: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) tai GitHub Releases. GitHub-haut käyttävät ETag-uudelleentarkistusta, joten päivittäiset tarkistukset tuskin koskettavat sen nopeusrajoitusta.
- **Docker-imagen** vanhentuneisuus: kunkin käynnissä olevan säiliön imagen ID verrattuna äskettäin haettuun tunnisteeseen (deduplikoidaan palvelinten välillä samalla tunnisteella), tarjotaan uudelleenluontipäivityksenä.
- **Itsenäiset versiopinnit**: palvelimelle, jolla ei ole hallittua pakettia, eksplisiittinen `mc_version`-pinni verrattuna Mojangin manifestiin ja eksplisiittinen latausohjelman ympäristömuuttuja (`PAPER_BUILD`, `FORGE_VERSION` ja vastaavat) verrattuna latausohjelman rekisteriin. Paper-koosteet tulevat PaperMC:n nykyisestä **Fill v3 API**:sta (vanha v2-pääte lopetti uusien Minecraft-versioiden vastaanottamisen).

![Päivitykset](/docs/images/updates.png)

## Miten se toimii

Paneeli tarkistaa kunkin palvelimen kiinnitetyt versiot verrattuna ylävirran lähteeseen ja listaa kaiken, jolla on uudempi julkaisu. Vastaava määrä näkyy myös [koontinäytön](/docs/dashboard/) "Päivityksiä saatavilla" -ruudussa.

Tarkistukset suoritetaan tarvittaessa ja ne voidaan ajoittaa ([Aikataulut](/docs/schedules/)). Päivityksen **käytäntö** on palvelinkohtainen: sinä päätät, ilmoittaako paneeli sinulle vain vai jätetäänkö kaikki manuaaliseksi.

## Päivityksen soveltaminen

Päivitykset eivät ole koskaan hiljaisia. Kun päätät päivittää paketin, paneeli:

1. Ottaa **päivitystä edeltävän varmuuskopion** (joten se on palautettavissa; viimeiset 10 päivitystä edeltävää varmuuskopiota palvelinta kohden säilytetään).
2. Kiinnittää tarkan uuden version uudelleen.
3. Luo säiliön uudelleen, ratkaisten Java-ajoympäristön tarvittaessa.
4. Valvoo ensimmäistä käynnistystä, käyttäen alustakohtaista aikarajaa.

Jos se ei käynnisty terveenä, palautat päivitystä edeltävään varmuuskopioon. Vakaata seurantaa käyttävälle palvelimelle ei koskaan tarjota beta-versiota, ja muutosten lokilinkki osoittaa todelliseen versiopohjaiseen eroon, jossa lähde tarjoaa sellaisen. Epäonnistunut päivitys käynnistää myös Discord- [hälytyksen](/docs/integrations/), jos integraatio on määritetty.
