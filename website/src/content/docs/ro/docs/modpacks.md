---
title: 'Modpackuri'
description: 'Pagina Modpackuri (și fila Din modpack din vrăjitorul de creare) instalează un modpack ca server, întotdeauna fixat la o versiune exactă a pachetului, astfel încât o repornire să poată'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Înapoi la indexul documentației](/docs/)

Pagina **Modpack-uri** (și fila **Din modpack** din [expertul de creare](/docs/servers/)) instalează un modpack ca server, **fixat întotdeauna la o versiune exactă a pachetului**, astfel încât o repornire nu poate face upgrade silențios al pachetului fără știrea dvs.

![Modpack-uri](/docs/images/modpacks.png)

## Platforme suportate

- **CurseForge** - căutați sau lipiți un URL al pachetului. Necesită o cheie API CurseForge pentru căutare și pachete private (adăugați-o la Setări → Chei API).
- **Modrinth** - căutați după nume.
- **FTB** - Pachete Feed The Beast.
- **GT New Horizons** - pachetul expert 1.7.10, instalat din propriul index de lansare GTNH. GTNH alege runtime-ul său Java per versiune de pachet (2.8.0+ rulează pe **Java 25** prin patch-uri lwjgl3ify incluse, versiunile mai vechi pe Java 21 sau 17), iar expertul mărește RAM-ul și discul serverului la minime rezonabile pentru acesta.
- **Zip personalizat** - deloc un pachet publicat: încărcați un **export de modpack CurseForge** (fișierul zip cu `manifest.json` pe care aplicația CurseForge îl produce pentru un set de moduri selectat manual) sau **orice zip de fișiere jar de moduri**. Panoul rezolvă manifestul în masă prin API-ul CurseForge (sau identifică fiecare fișier jar după hash/amprentă/metadate), previzualizează ce se potrivește și instalează totul într-o singură sarcină - inclusiv configurațiile `overrides/` ale pachetului dacă optați. Modurile ale căror autori interzic descărcările automate sunt listate cu un link către browser și un slot de încărcare manuală în loc să eșueze instalarea.

## Cum funcționează fixarea

Când alegeți un pachet, panoul rezolvă versiunea exactă, o înregistrează și o instalează. Pe pagina **Actualizări** veți fi informat când este disponibilă o versiune mai nouă; upgrade-ul este o acțiune deliberată, protejată, cu un backup pre-actualizare și rollback. Serverelor cu urmărire stabilă nu li se oferă niciodată o versiune beta.

Serverele create pe versiuni foarte vechi ale panoului (înainte de 0.9.7) puteau rămâne _nefixate_, ceea ce înseamnă că imaginea containerului instala silențios cea mai recentă versiune a pachetului la fiecare pornire. Panoul repară acum acestea la pornire: le blochează pe fiecare la versiunea care este efectiv instalată (citită din propriile înregistrări ale panoului sau din manifestul de instalare al imaginii, niciodată un "latest" proaspăt rezolvat) și înregistrează un eveniment. Dacă nu poate determina ce este instalat, pagina Setări a serverului afișează un avertisment care vă cere să selectați manual versiunea, iar orice încercare de a salva o configurație de modpack nefixată este respinsă categoric.

## Politica de actualizare

Fiecare server are o politică de actualizare în **Setări**, iar toate cele trei opțiuni înseamnă exact ceea ce spun:

- **Doar manual** - nimic nu se schimbă de la sine, iar serverul este lăsat complet în afara insignei de actualizare și a paginii Actualizări. Modul "lasă-mă în pace": ideal pentru un pachet ajustat manual sau importat pe care nu doriți niciodată să fie atins.
- **Notifică-mă** (implicit) - verificarea zilnică afișează actualizările disponibile ca o insignă și pe pagina Actualizări; aplicarea lor este întotdeauna la un clic de dvs.
- **Actualizare automată** - după verificarea zilnică programată, actualizările **pachetului** în așteptare sunt aplicate prin aceeași cale protejată ca un upgrade manual: backup pre-actualizare, monitorizare a stării de funcționare și rollback automat dacă noua versiune nu reușește să pornească. Actualizările care ar muta serverul la o versiune diferită de Minecraft sunt întotdeauna omise cu un eveniment în schimb - conversia permanentă a unei lumi este o decizie pe care panoul refuză să o ia pentru dvs. Butoanele manuale "verifică acum" doar verifică; nu declanșează niciodată actualizări automate.

## Upgrade-ul unui pachet

De pe un server fixat, puteți face upgrade la o versiune mai nouă într-o singură acțiune. Panoul face mai întâi un backup, schimbă versiunea fixată, recreează containerul (rezolvând din nou Java dacă noua versiune necesită un runtime diferit) și monitorizează prima pornire, cu o fereastră generoasă pentru pachete mari precum GTNH care descarcă câțiva gigabytes și construiesc o lume cu câteva sute de moduri la prima pornire.
