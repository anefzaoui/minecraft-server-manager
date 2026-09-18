---
title: 'Actualizări'
description: 'Pagina Actualizări urmărește ce este învechit pe întreaga flotă într-un singur loc:'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Înapoi la indexul documentației](/docs/)

Pagina **Actualizări** urmărește ce nu este la zi pe întreaga flotă, într-un singur loc:

- Versiuni de **Modpack** ([modpacks](/docs/modpacks/)) comparativ cu Modrinth / CurseForge / indexul de lansare GTNH.
- **Conținut personalizat** pe care l-ați adăugat singur — moduri, datapacks, resource packs, pluginuri — fiecare comparat cu sursa sa: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) sau GitHub Releases. Căutările GitHub folosesc revalidarea ETag, astfel încât verificările zilnice abia ating limita de rate.
- Starea învechită a **imaginii Docker**: ID-ul imaginii fiecărui container rulat comparativ cu un tag proaspăt tras (deduplicat pe servere cu același tag), oferit ca o actualizare doar pentru recreare.
- **Fixări de versiune independente**: pentru un server fără un pachet gestionat, o fixare explicită `mc_version` comparativ cu manifestul Mojang și o variabilă de mediu explicită pentru build-ul loader-ului (`PAPER_BUILD`, `FORGE_VERSION` și similare) comparativ cu registrul loader-ului. Build-urile Paper provin din **API-ul Fill v3** curent al PaperMC (endpoint-ul moștenit v2 a încetat să mai primească noi versiuni Minecraft).

![Actualizări](/docs/images/updates.png)

## Cum funcționează

Panoul verifică versiunile fixate ale fiecărui server în raport cu sursa upstream și listează orice element cu o lansare mai nouă. Un număr corespunzător apare, de asemenea, pe țigla "Actualizări disponibile" din [dashboard](/docs/dashboard/).

Verificările se execută la cerere și pot fi programate ([Schedules](/docs/schedules/)). **Politica** de actualizare este per server: dumneavoastră decideți dacă panoul doar vă notifică sau dacă totul rămâne manual.

## Aplicarea unei actualizări

Actualizările nu sunt niciodată silențioase. Când alegeți să actualizați un pachet, panoul:

1. Face un **backup pre-actualizare** (astfel încât să fie reversibil; sunt păstrate ultimele 10 backup-uri pre-actualizare per server).
2. Repin-uiește exact noua versiune.
3. Recreează containerul, rezolvând din nou runtime-ul Java dacă este necesar.
4. Monitorizează prima pornire, cu un buget de timp per platformă.

Dacă nu pornește corect, reveniți la backup-ul pre-actualizare. Un server care urmărește versiuni stabile nu va primi niciodată o versiune beta, iar linkul către jurnalul de modificări indică diferența reală per versiune acolo unde sursa o oferă. O actualizare eșuată declanșează, de asemenea, o [alertă](/docs/integrations/) Discord dacă integrarea este configurată.
