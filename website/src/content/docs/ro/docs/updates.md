---
title: 'Actualizări'
description: 'Urmăriți și aplicați actualizări pentru versiuni Minecraft, modpack-uri, moduri și plugin-uri pe fiecare server, cu o politică per server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Înapoi la indexul documentației](/docs/)

Pagina **Actualizări** urmărește ce este învechit pe întreaga flotă într-un singur loc:

- Versiuni de **Modpack** ([modpacks](/docs/modpacks/)) comparativ cu Modrinth / CurseForge / indexul de lansare GTNH.
- **Conținut personalizat** pe care l-ați adăugat singur (moduri, datapacks, resource packs, pluginuri), fiecare comparativ cu sursa sa: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) sau GitHub Releases. Căutările GitHub folosesc revalidarea ETag, astfel încât verificările zilnice abia ating limita de rate.
- Starea învechită a **imaginii Docker**: ID-ul imaginii fiecărui container de server comparativ cu un tag tras recent (deduplicat pe servere cu același tag), oferit ca o actualizare care necesită doar reconstrucție.
- **Fixări de versiune independente**: pentru un server fără un pachet gestionat, o fixare explicită `mc_version` comparativ cu manifestul Mojang și o variabilă de mediu explicită pentru versiunea loader-ului (`PAPER_BUILD`, `FORGE_VERSION` și similare) comparativ cu registrul loader-ului. Build-urile Paper provin din **API-ul Fill v3** curent al PaperMC (endpoint-ul legacy v2 a încetat să mai primească noi versiuni Minecraft). Pe un server cu moduri, o versiune Minecraft mai nouă este oferită doar după ce o [verificare de versiune](#minecraft-version-compatibility) a arătat că fiecare mod instalat are un build pentru aceasta. Un server Forge fixat primește build-ul recomandat de Forge, niciodată un build mai vechi decât cel la care este fixat, iar un server fixat la o lansare nu primește niciodată o pre-lansare (unul deja pe un beta poate primi un beta mai nou sau lansarea). Aplicarea unui build de loader face mai întâi un backup pre-actualizare. Mutarea unui server Forge sau NeoForge la o nouă versiune Minecraft șterge numărul build-ului loader fixat, deoarece un build este făcut pentru o singură versiune Minecraft; un cuvânt cheie precum `latest` este păstrat, deoarece urmează versiunea de la sine. Pentru a alege manual un build specific, consultați [schimbarea versiunii mod loader-ului](#changing-the-mod-loader-version).

![Updates](/docs/images/updates.png)

## Cum funcționează

Panoul verifică versiunile fixate ale fiecărui server în raport cu sursa upstream și listează orice element cu o lansare mai nouă. Un număr corespunzător apare și pe caseta "Actualizări disponibile" din [dashboard](/docs/dashboard/).

Verificările rulează zilnic pe un [program](/docs/schedules/) implicit și la cerere cu **Verifică tot acum**. **Ignoră** pe o linie oprește oferirea acelei versiuni particulare; una mai nouă va fi oferită din nou. Politica de **actualizare** este per server: panoul lasă totul manual (implicit, care păstrează și serverul în afara acestei pagini), doar vă notifică, sau aplică singur actualizările pachetului ([politica de actualizare](/docs/modpacks/#update-policy)).

## Compatibilitatea versiunilor Minecraft

O versiune Minecraft mai nouă nu este o actualizare dacă modurile dvs. nu pot veni cu dvs. Fiecare server are propria filă **Versiuni** (sub Moduri) care răspunde la această întrebare:

- Versiunea pe care rulează serverul acum și **cea mai înaltă versiune pentru care fiecare mod instalat are un build**.
- O linie colapsabilă per versiune Minecraft viitoare, cu câte moduri sunt pregătite și câte nu au nimic publicat încă. Deschideți o linie pentru a vedea ce moduri ar rămâne în urmă și care sunt în regulă.

![Version compatibility](/docs/images/server-versions.png)

Apăsați **Verifică versiuni viitoare** pentru a o rula. Nimic nu scanează de la sine: o verificare citește fiecare jar din folderul mods al serverului și întreabă Modrinth și CurseForge despre fiecare, deci se întâmplă doar când cereți dvs. Progresul și rezultatele parțiale sunt scrise pe măsură ce se desfășoară, deci închiderea paginii sau reîmprospătarea nu pierde nimic, iar o verificare întreruptă de o repornire a panoului o spune și oferă să ruleze din nou. Tot ce a lucrat o verificare întreruptă este păstrat, deci rularea din nou nu reface acea muncă.

Un raport descrie doar serverul pentru care a fost făcut. Schimbați versiunea Minecraft, loader-ul sau modurile în sine (adăugați unul, eliminați unul, actualizați unul) și raportul este marcat ca învechit și nu mai este folosit, până când rulați din nou verificarea.

Modurile sunt identificate din lista proprie de fișiere a modpack-ului, acolo unde există, și altfel după conținutul fișierului, în același mod în care un launcher recunoaște un jar. Două tipuri de moduri nu pot fi răspunsuri, și niciunul nu este ghicit:

- **Nu a putut fi identificat**: un jar construit manual sau un build privat pe care niciun registru nu îl recunoaște.
- **Nu a putut fi verificat**: un mod din GitHub Releases, Hangar sau SpigotMC, sau unul al cărui proiect a fost retras. Acestea nu publică o listă a versiunilor Minecraft pentru care este fiecare build.

Cât timp oricare dintre acestea este instalat, panoul nu va oferi o actualizare Minecraft cu un singur clic, deoarece nu poate spune în mod onest ce s-ar strica. Aplicarea unei versiuni peste ceea ce suportă modurile este refuzată și numește modurile care o blochează.

Modurile pe care le-ați **dezactivat** nu joacă niciun rol: serverul nu le încarcă, deci dezactivarea unui mod este o modalitate reală de a depăși un blocaj. Activarea sau dezactivarea unui mod marchează raportul pentru re-verificare.

Aceasta acoperă serverele care rulează moduri: Fabric, Forge, NeoForge și Quilt. Serverele de pluginuri de tip Paper păstrează comportamentul simplu de cea mai recentă lansare și nu au filă Versiuni, deoarece două dintre registrele din care provin pluginurile nu publică nimic ce o verificare ar putea citi.

![A version opened, showing which mods would be left behind](/docs/images/server-versions-expanded.png)

Deschiderea unei versiuni listează mai întâi modurile fără build pentru ea (cele care decid răspunsul) și păstrează pe cele pregătite în spatele unui clic. Pachetele mari încarcă o pagină de moduri pe rând, deci un server cu 300 de moduri se deschide la fel de repede ca unul cu cinci moduri.

## Schimbarea versiunii mod loader-ului

Filă **Versiuni** are și o secțiune **Versiune Loader**. Aceasta arată ce build Forge, NeoForge, Fabric sau Quilt are instalat serverul și, acolo unde poate fi schimbat, un selector pentru a trece la altul.

- **Un server Forge, NeoForge, Fabric sau Quilt** poate rula orice build publicat. Selectorul listează build-urile recente pentru versiunea Minecraft a serverului, cu build-urile recomandate și cele mai recente de la Forge etichetate. **Alt Build…** preia orice build mai vechi după numărul său, iar **Implicit** revine la a lăsa serverul să aleagă.
- **Un modpack Forge sau Fabric CurseForge** instalează versiunea loader-ului declarată de propriul manifest, deci modul obișnuit de a o schimba este actualizarea pachetului. Când pachetul în sine listează versiunea greșită (un mod din interior cere un Forge mai nou decât instalează pachetul), secțiunea poate suprascrie, iar **Versiunea Modpack-ului** elimină suprascrierea din nou. Actualizarea pachetului o elimină și pe aceasta, deoarece noua versiune își declară propriul loader. Dacă noua versiune listează în continuare pe cea greșită, setați din nou suprascrierea.
- **Un modpack NeoForge CurseForge sau un modpack Modrinth** arată loader-ul, dar nu poate fi suprascris: imaginea serverului aplică suprascrierea doar pentru pachetele Forge și Fabric. Loader-ul său urmează versiunea pachetului, deci actualizați pachetul în schimb. Loader-ul unui pachet FTB nu poate fi schimbat nici aici. Secțiunea sa de obicei nu apare, deoarece propriul instalator FTB păstrează înregistrări pe care panoul nu le citește.

Panoul verifică dacă build-ul există înainte de a vă cere ceva. Un build Forge sau NeoForge este făcut pentru o singură versiune Minecraft, deci pe un server care urmează cea mai recentă lansare, fixarea unuia păstrează și serverul la versiunea Minecraft pe care o rulează acum (confirmarea o spune). Alegerea **Implicit** după aceea elimină fixarea, dar păstrează acea versiune Minecraft. Un server care a urmat cea mai recentă lansare se poate muta și la o imagine Java diferită atunci când este reconstruit, cea de care are nevoie acea versiune. Un astfel de server care nu a pornit niciodată este rugat să pornească mai întâi, astfel încât panoul să știe acea versiune. Forge sare peste numere de build (nu există 47.4.14 între 47.4.13 și 47.4.15), deci un mod care "necesită 47.4.14 sau mai sus" este satisfăcut de următorul build superior, iar refuzul îl numește. O schimbare face un backup pre-actualizare, apoi reconstruiește serverul. Noul build este instalat la următoarea pornire a serverului, iar secțiunea o spune până atunci.

## Anularea unei actualizări de mod

Fiecare build de la care un mod este actualizat rămâne în biblioteca partajată, deci o actualizare care strică ceva este reversibilă. Linia modului din fila **Moduri** primește un buton **Anulează** care pune înapoi build-ul anterior. Nu există descărcare, deci funcționează chiar dacă proiectul a fost între timp retras din registrul său. Build-ul de la care ați revenit nu mai este oferit până când nu apare unul mai nou.

![Revert a mod to the build it was updated from](/docs/images/mods-revert.png)

## Aplicarea unei actualizări

Actualizările nu sunt niciodată silențioase. Când alegeți să actualizați un pachet (sau [să îl schimbați la o altă versiune](/docs/modpacks/#changing-the-pack-version), inclusiv cele mai vechi), panoul:

1. Face un **backup pre-actualizare** (deci este reversibil; implicit, ultimele 10 backup-uri pre-actualizare per server sunt păstrate, vezi [retenția](/docs/backups/#retention)).
2. Repune fixarea versiunii noi exacte.
3. Reconstruiește serverul, rezolvând din nou runtime-ul Java dacă este necesar.
4. Monitorizează prima pornire, cu un buget de timp per platformă.

Dacă nu pornește corect, reveniți la backup-ul pre-actualizare. Un server care urmărește stabil nu primește niciodată un beta, iar linkul către jurnalul de modificări indică diferența reală per versiune acolo unde sursa o oferă. O actualizare eșuată declanșează și o [alertă](/docs/integrations/) Discord dacă integrarea este configurată.
