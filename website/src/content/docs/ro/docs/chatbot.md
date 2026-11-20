---
title: 'Chatbot Minecraft per server'
description: 'Panoul oferă un chatbot configurat de administrator pentru fiecare server Minecraft gestionat, configurat în fila Setări → Chatbot a serverului.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Înapoi la indexul documentației](/docs/)

Panoul oferă un chatbot configurat de administrator pentru fiecare server Minecraft gestionat, configurat în fila **Setări → Chatbot** a serverului. Acesta se conectează la un
endpoint compatibil OpenAI pentru completarea conversațiilor, inclusiv Ollama pe un alt gazdă LAN. Fiecare server are
propriul său endpoint, model, nume de invocare, personaj, politică de transcriere, mesaje de contact și politică de putere. Invocarea implicită este `@wizard`, iar personajul implicit demonstrează un vrăjitor antic,
jucăuș din joc; ambele sunt editabile.

![Setări chatbot](/docs/images/integrations-chatbot.png)

## Experiența jucătorului

- Orice jucător poate folosi `@wizard <mesaj>` (sau invocarea configurată) pentru conversație și
  ajutor cu rețete vanilla deterministe, conștiente de versiunea Minecraft.
- Mesajele de bun venit la conectare și o verificare configurabilă unică la începutul sesiunii de joc le reamintesc jucătorilor că chatbotul este disponibil. `@wizard chat` deschide o fereastră scurtă de conversație cu opțiune de participare; `@wizard bye` o închide.
- **Utilizatorii de bază** pot invoca puteri proprii/ale lumii activate. **Controlorii de putere** pot invoca acțiuni validate separat, care afectează un alt jucător online. Jucătorii din niciun grup nu rămân
  doar pentru conversație.
- Cadourile proprii ale utilizatorilor de bază folosesc o listă de permise pentru articole. Controlorii pot oferi altui jucător orice articol vanilla valid cu nume spațiat sau modificat, supus limitei de cantitate și altor măsuri de siguranță a puterii.

![Transcrieri chatbot](/docs/images/chatbot-transcripts.png)

## Proiectare și securitate

Configurația și transcrierile sunt doar pentru administratori. Modelul nu primește niciodată RCON brut sau execuție arbitrară de comenzi. Un mesaj expune doar singura unealtă fixă care corespunde intenției sale explicite;
codul serverului validează autorizarea, argumentele, flag-urile, cantitățile, perioadele de răcire și numele exacte ale jucătorilor online înainte de a executa o operațiune de serviciu existentă. Selectorii Minecraft sunt respinși,
acțiunile între jucători nu pot viza apelantul, puterile încep în modul de testare (dry-run), iar fiecare putere încercată este auditată. Modelele care nu suportă apelarea uneltelor revin la conversație.

Răspunsurile sunt limitate pentru chat-ul Minecraft. Rețetele vanilla cunoscute provin din date de rețete versiuni incluse și sunt redate ca rânduri stabile 2x2/3x3; LLM-ul nu este de încredere pentru a inventa layout-uri de rețete. Rețetele necunoscute sau modificate direcționează jucătorul către JEI/REI în loc să fabrice un răspuns.

## Fișiere principale de implementare

- `src/services/wizard.js`: configurație per server, cereri compatibile OpenAI, gestionarea chat-ului,
  mesaje de contact, păstrarea transcrierilor și limite de răspuns.
- `src/services/wizardPowers.js`: verificări de rol, scheme de unelte specifice intenției, validare, execuție,
  perioade de răcire și auditarea puterilor.
- `src/services/wizardRecipes.js`: căutare deterministă de rețete versiuni și formatare grilă. Datele despre rețete și articole provin din pachetul inclus [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data). (O versiune anterioară a acestui document indica o folder `src/data/recipes/` care nu a fost niciodată comisă; nu există o astfel de folder, iar datele se află în pachet. Vezi "Amprenta dependențelor".)
- `src/analytics/ingest.js`: redirecționează intrările, ieșirile și chat-ul jucătorilor către chatbot.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js` și
  `views/partials/server/integrations.hbs` (prin `chatbot.hbs`): API-ul de administrator și fila Setări → Chatbot per server.
- `src/db/migrations/011_wizard_chat.js`, `013_wizard_invocation_name.js`, `015_wizard_powers.js`,
  `017_wizard_outreach.js` și `019_wizard_power_controllers.js`: schemă persistentă.
- `test/wizard.test.js`: teste de autorizare, limită de unelte, retenție, mesaje de contact și comportament chat.

Numele interne de rută/modul/tabel `wizard` sunt păstrate pentru compatibilitatea de upgrade și API; "chatbot" este termenul de produs vizibil pentru utilizator. De asemenea, câmpul stocat `power_testers_json` corespunde grupului **Utilizatori de bază** din interfața grafică.

## Amprenta dependențelor (`minecraft-data`)

Ajutorul pentru rețete folosește pachetul `minecraft-data`. Este mare pe disc (aproximativ 429 MB instalat) și este inclus în imaginea de producție deoarece este o dependență de runtime, nu una de dezvoltare. Îl păstrăm intenționat pentru ca ajutorul pentru rețete să funcționeze offline pentru fiecare versiune Minecraft fără apeluri de rețea.

Note pentru oricine va analiza acest lucru în continuare (uman sau AI), astfel încât dimensiunea să nu fie o surpriză:

- Se folosesc doar datele Java (`pc`) în prezent. `wizardRecipes.js` citește `minecraftData.versions.pc`
  și tabelele per versiune `recipes`, `items` și `blocks`. Fișierele pe care le atinge efectiv însumează aproximativ 15 MB pe toate versiunile pc.
- Aproximativ 330 MB din pachet este `data/bedrock`, iar nimic aici nu îl citește încă. Îl lăsăm în loc intenționat. Dacă panoul adaugă vreodată suport pentru Bedrock Minecraft, datele despre rețete și articole Bedrock sunt deja aici, astfel încât funcția de rețete să poată crește pentru a acoperi serverele Bedrock fără a adăuga o nouă dependență. Începeți de la `minecraftData.versions.bedrock` și urmați aceeași structură ca și calea pc.
- Dacă dimensiunea trebuie redusă vreodată înainte de lansarea suportului Bedrock, există deja un model pentru aceasta în acest depozit. `src/services/itemRegistry.js` preia fișiere `minecraft-data` de la CDN-ul jsDelivr
  când are nevoie de ele și le stochează în cache în `api_cache`. Fie acea abordare, fie un subset mic, ales manual, din `src/data/recipes/` care acoperă câteva versiuni comune, ar reduce mult imaginea.

## Stocare locală și inspecție manuală

Toate setările și transcrierile reținute se află în baza de date SQLite a panoului la `/data/panel.db` în interiorul containerului panoului. Cu montarea standard Compose, calea gazdei este
`${DATA_DIR_HOST}/panel.db` (de exemplu, `/opt/msm/data/panel.db`). Tabelele relevante sunt
`wizard_configs`, `wizard_transcripts` și `wizard_outreach`; auditurile de putere sunt rânduri în tabelul `events` cu tipul `wizard-power`. Cheia API LLM opțională este criptată AES-256-GCM cu cheia de repaus a panoului, `.secret-key` în folderul de date (separat de `SESSION_SECRET`).

Faceți backup la baza de date și opriți panoul înainte de editări directe SQLite pentru a gestiona în siguranță fișierul său WAL.
Utilizarea interfeței de administrare/API este preferată, deoarece aplică validarea și criptarea. Păstrați fișierele
`panel.db`, `panel.db-wal` și `panel.db-shm` împreună la copierea unei baze de date live.
