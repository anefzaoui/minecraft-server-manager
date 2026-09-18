---
title: 'Chatbot Minecraft per server'
description: "Questo fork aggiunge una chatbot configurabile dall'amministratore a ciascun server Minecraft gestito."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Înapoi la indexul documentației](/docs/)

Acest fork adaugă un chatbot configurat de administrator fiecărui server Minecraft gestionat. Se conectează la un
endpoint compatibil OpenAI pentru completări de chat, inclusiv Ollama pe un alt gazdă LAN. Fiecare server are
propriul său endpoint, model, nume de invocare, personaj, politică de transcriere, mesaje de outreach și politică de putere.
Numele de invocare implicit este `@wizard`, iar personajul implicit demonstrează un vrăjitor antic,
jucăuș din joc; ambele sunt editabile.

![Setări chatbot](/docs/images/integrations-chatbot.png)

## Experiența jucătorului

- Orice jucător poate folosi `@wizard <mesaj>` (sau numele de invocare configurat) pentru conversație și
  ajutor determinist, conștient de versiunea Minecraft, pentru rețete vanilla.
- Mesajele de bun venit la conectare și o verificare configurabilă, unică, reamintesc jucătorilor că chatbotul este
  disponibil. `@wizard chat` deschide o fereastră scurtă de conversație opt-in; `@wizard bye` o închide.
- **Utilizatorii de bază** pot invoca puteri proprii/ale lumii activate. **Controlorii de putere** pot invoca acțiuni validate separat, care afectează un alt jucător online. Jucătorii din niciun grup nu rămân
  doar pentru conversație.
- Auto-cadourile utilizatorilor de bază folosesc o listă de permisiuni pentru articole. Controlorii pot oferi altui jucător orice articol vanilla sau modat valid, cu nume spațiat, sub rezerva limitei de cantitate și a altor măsuri de siguranță pentru puteri.

![Transcrierea chatbotului](/docs/images/chatbot-transcripts.png)

## Design și securitate

Configurația și transcrierile sunt doar pentru administratori. Modelul nu primește niciodată RCON brut sau execuție arbitrară de comenzi. Un mesaj expune doar singura unealtă fixă care corespunde intenției sale explicite;
codul serverului validează autorizarea, argumentele, flag-urile, cantitățile, cooldown-urile și numele exacte ale jucătorilor online înainte de a executa o operațiune de serviciu existentă. Selectorii Minecraft sunt respinși, acțiunile între jucători nu pot viza apelantul, puterile încep în modul de simulare (dry-run), iar fiecare putere încercată este auditată. Modelele care nu suportă apelarea uneltelor revin la conversație.

Răspunsurile sunt limitate pentru chatul Minecraft. Rețetele vanilla cunoscute provin din datele de rețete versionate incluse și sunt redate ca rânduri stabile 2x2/3x3; LLM-ul nu este de încredere să inventeze layout-uri de rețete. Rețetele necunoscute sau modificate direcționează jucătorul către JEI/REI în loc să fabrice un răspuns.

## Fișiere principale de implementare

- `src/services/wizard.js`: configurație per server, cereri compatibile cu OpenAI, gestionarea chatului,
  outreach, retenția transcrierilor și limitele de răspuns.
- `src/services/wizardPowers.js`: verificări de rol, scheme de unelte specifice intenției, validare, execuție,
  cooldown-uri și auditarea puterilor.
- `src/services/wizardRecipes.js`: căutare deterministă de rețete versionate și formatare grilă. Datele despre rețete și articole provin din pachetul inclus [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data). (O versiune anterioară a acestui document indica o folder `src/data/recipes/` care nu a fost niciodată comisă; nu există o astfel de folder, iar datele se află în pachet. Vezi "Amprenta dependențelor".)
- `src/analytics/ingest.js`: redirecționează conexiunile, deconectările și chatul jucătorilor către chatbot.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js` și
  `views/partials/server/integrations.hbs`: API de administrator și interfața de utilizator pentru Integrări per server.
- `src/db/migrations/011_wizard_chat.js` până la `019_wizard_power_controllers.js`: schemă persistentă.
- `test/wizard.test.js`: teste de autorizare, limite de unelte, retenție, outreach și comportament chat.

Numele interne de rută/modul/tabel `wizard` sunt păstrate pentru compatibilitate cu upgrade-urile și API-ul;
„chatbot” este termenul de produs vizibil pentru utilizator. De asemenea, câmpul stocat `power_testers_json` corespunde grupului **Utilizatori de bază** din interfața de utilizator.

## Amprenta dependențelor (`minecraft-data`)

Ajutorul pentru rețete folosește pachetul `minecraft-data`. Este mare pe disc (aproximativ 429 MB instalat) și este inclus în imaginea de producție deoarece este o dependență de runtime, nu una de dezvoltare. Îl păstrăm intenționat pentru ca funcția de ajutor pentru rețete să funcționeze offline pentru fiecare versiune Minecraft, fără apeluri de rețea.

Note pentru oricine va analiza acest lucru în continuare (uman sau AI), astfel încât dimensiunea să nu fie o surpriză:

- Momentan se folosesc doar datele Java (`pc`). `wizardRecipes.js` citește `minecraftData.versions.pc`
  și tabelele `recipes`, `items` și `blocks` per versiune. Fișierele pe care le accesează efectiv însumează aproximativ 15 MB pe toate versiunile pc.
- Aproximativ 330 MB din pachet reprezintă `data/bedrock`, iar nimic aici nu îl citește încă. Îl lăsăm în loc intenționat. Dacă panoul adaugă vreodată suport pentru Minecraft Bedrock, datele despre rețete și articole Bedrock sunt deja aici, astfel încât funcția de rețete să poată crește pentru a acoperi serverele Bedrock fără a adăuga o nouă dependență. Începeți de la `minecraftData.versions.bedrock` și urmați aceeași structură ca și calea pc.
- Dacă dimensiunea trebuie să fie redusă înainte ca suportul Bedrock să fie lansat, există deja un model pentru aceasta în acest depozit. `src/services/itemRegistry.js` preia fișiere `minecraft-data` de pe CDN-ul jsDelivr atunci când are nevoie de ele și le salvează în cache în `api_cache`. Fie acea abordare, fie un subset mic, ales manual, din `src/data/recipes/` care acoperă câteva versiuni comune, ar reduce mult imaginea.

## Stocare locală și inspecție manuală

Toate setările și transcrierile reținute se află în baza de date SQLite a panoului la `/data/panel.db` în containerul panoului. Cu montarea standard Compose, calea gazdei este
`${DATA_DIR_HOST}/panel.db` (de exemplu, `/opt/msm/data/panel.db`). Tabelele relevante sunt
`wizard_configs`, `wizard_transcripts` și `wizard_outreach`; auditurile de putere sunt rânduri în tabelul `events` cu tipul `wizard-power`. Cheia API LLM opțională este criptată AES-256-GCM folosind `SESSION_SECRET` al panoului, de obicei persistată ca `${DATA_DIR_HOST}/.session-secret`.

Faceți backup la baza de date și opriți panoul înainte de editări directe SQLite pentru a gestiona corect fișierul său WAL.
Utilizarea interfeței de administrator/API este preferată, deoarece aplică validarea și criptarea. Păstrați fișierele
`panel.db`, `panel.db-wal` și `panel.db-shm` împreună atunci când copiați o bază de date live.
