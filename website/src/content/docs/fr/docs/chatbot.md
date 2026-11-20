---
title: 'Chatbot Minecraft par serveur'
description: "Le panneau propose un chatbot configuré par l'administrateur pour chaque serveur Minecraft géré, mis en place dans l'onglet Paramètres → Chatbot du serveur."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Retour à l'index de la documentation](/docs/)

Le panneau propose un chatbot configuré par l'administrateur pour chaque serveur Minecraft géré, accessible via l'onglet **Paramètres → Chatbot** du serveur. Il se connecte à un point de terminaison compatible OpenAI pour les complétions de chat, y compris Ollama sur un autre hôte du réseau local. Chaque serveur possède son propre point de terminaison, modèle, nom d'invocation, persona, politique de transcription, messages de sensibilisation et politique de pouvoirs. L'invocation par défaut est `@wizard`, et le persona par défaut incarne un sorcier ancien et joueur dans le monde du jeu ; les deux sont modifiables.

![Paramètres du chatbot](/docs/images/integrations-chatbot.png)

## Expérience du joueur

- Tout joueur peut utiliser `@wizard <message>` (ou l'invocation configurée) pour converser et obtenir de l'aide pour les recettes vanilla, de manière déterministe et adaptée à la version de Minecraft.
- Les messages de bienvenue lors de la connexion et un message de rappel unique et configurable rappellent aux joueurs que le chatbot est disponible. `@wizard chat` ouvre une courte fenêtre de conversation d'adhésion ; `@wizard bye` la ferme.
- Les **utilisateurs de base** peuvent invoquer des pouvoirs personnels/mondiaux activés. Les **contrôleurs de pouvoirs** peuvent invoquer des actions validées séparément affectant un autre joueur en ligne. Les joueurs n'appartenant à aucun de ces groupes restent limités à la conversation.
- Les auto-dons des utilisateurs de base utilisent une liste d'objets autorisés. Les contrôleurs peuvent donner à un autre joueur n'importe quel objet vanilla ou moddé valide avec un namespace, sous réserve de la limite de quantité et d'autres mesures de sécurité des pouvoirs.

![Transcriptions du chatbot](/docs/images/chatbot-transcripts.png)

## Conception et sécurité

La configuration et les transcriptions sont réservées aux administrateurs. Le modèle ne reçoit jamais de RCON brut ni d'exécution de commande arbitraire. Un message n'expose que l'unique outil fixe correspondant à son intention explicite ; le code du serveur valide l'autorisation, les arguments, les indicateurs, les quantités, les délais d'attente et les noms exacts des joueurs en ligne avant d'exécuter une opération de service existante. Les sélecteurs Minecraft sont rejetés, les actions inter-joueurs ne peuvent pas cibler l'appelant, les pouvoirs commencent en mode simulation (dry-run), et chaque pouvoir tenté est audité. Les modèles d'appel d'outils non pris en charge reviennent à la conversation uniquement.

Les réponses sont limitées pour le chat Minecraft. Les recettes vanilla connues proviennent de données de recettes groupées et versionnées et sont rendues sous forme de grilles stables 2x2/3x3 ; le LLM n'est pas censé inventer les dispositions de recettes. Les recettes inconnues ou moddées redirigent le joueur vers JEI/REI plutôt que de fabriquer une réponse.

## Fichiers d'implémentation principaux

- `src/services/wizard.js` : configuration par serveur, requêtes compatibles OpenAI, gestion du chat, sensibilisation, conservation des transcriptions et limites de réponse.
- `src/services/wizardPowers.js` : vérifications de rôle, schémas d'outils spécifiques à l'intention, validation, exécution, délais d'attente et audit des pouvoirs.
- `src/services/wizardRecipes.js` : recherche déterministe de recettes versionnées et formatage en grille. Les données de recettes et d'objets proviennent du package groupé [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data). (Une version antérieure de ce document faisait référence à un dossier `src/data/recipes/` qui n'a jamais été validé ; il n'existe pas, et les données résident dans le package. Voir "Empreinte des dépendances".)
- `src/analytics/ingest.js` : transmet les connexions, déconnexions et chats de joueurs analysés au chatbot.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js`, et `views/partials/server/integrations.hbs` (via `chatbot.hbs`) : API administrateur et onglet Paramètres → Chatbot par serveur.
- `src/db/migrations/011_wizard_chat.js`, `013_wizard_invocation_name.js`, `015_wizard_powers.js`, `017_wizard_outreach.js`, et `019_wizard_power_controllers.js` : schéma persistant.
- `test/wizard.test.js` : tests d'autorisation, de limites d'outils, de rétention, de sensibilisation et de comportement du chat.

Les noms internes de route/module/table `wizard` sont conservés pour la compatibilité des mises à jour et de l'API ; "chatbot" est le terme produit visible par l'utilisateur. De même, le champ stocké `power_testers_json` correspond au groupe **Utilisateurs de base** de l'interface utilisateur.

## Empreinte des dépendances (`minecraft-data`)

L'aide aux recettes utilise le package `minecraft-data`. Il est volumineux sur disque (environ 429 Mo installés) et est inclus dans l'image de production car il s'agit d'une dépendance d'exécution, pas de développement. Nous le conservons intentionnellement afin que l'aide aux recettes fonctionne hors ligne pour chaque version de Minecraft sans appel réseau.

Notes pour quiconque examinera ceci ensuite (humain ou IA), afin que la taille ne soit pas une surprise :

- Seules les données Java (`pc`) sont utilisées actuellement. `wizardRecipes.js` lit `minecraftData.versions.pc` et les tables `recipes`, `items` et `blocks` par version. Les fichiers qu'il touche réellement totalisent environ 15 Mo sur toutes les versions pc.
- Environ 330 Mo du package correspondent à `data/bedrock`, et rien ici ne le lit encore. Nous le laissons en place intentionnellement. Si le panneau ajoute un jour la prise en charge de Bedrock Minecraft, les données de recettes et d'objets Bedrock sont déjà là, de sorte que la fonctionnalité de recettes puisse se développer pour couvrir les serveurs Bedrock sans ajouter de nouvelle dépendance. Commencez par `minecraftData.versions.bedrock` et suivez la même structure que le chemin pc.
- Si la taille doit être réduite avant que le support Bedrock n'arrive, il existe déjà un modèle pour cela dans ce dépôt. `src/services/itemRegistry.js` récupère les fichiers `minecraft-data` du CDN jsDelivr lorsqu'il en a besoin et les met en cache dans `api_cache`. Soit cette approche, soit un petit sous-ensemble choisi à la main `src/data/recipes/` couvrant quelques versions courantes, réduirait considérablement l'image.

## Stockage local et inspection manuelle

Tous les paramètres et transcriptions conservés résident dans la base de données SQLite du panneau à `/data/panel.db` à l'intérieur du conteneur du panneau. Avec le montage Compose standard, le chemin hôte est `${DATA_DIR_HOST}/panel.db` (par exemple, `/opt/msm/data/panel.db`). Les tables pertinentes sont `wizard_configs`, `wizard_transcripts`, et `wizard_outreach` ; les audits de pouvoirs sont des lignes dans la table `events` avec le type `wizard-power`. La clé API LLM optionnelle est chiffrée AES-256-GCM avec la clé au repos du panneau, `.secret-key` dans le dossier de données (distinct de `SESSION_SECRET`).

Sauvegardez la base de données et arrêtez le panneau avant les modifications directes de SQLite afin que son WAL soit géré en toute sécurité. L'utilisation de l'interface utilisateur/API administrateur est préférée car elle applique la validation et le chiffrement. Gardez les fichiers `panel.db`, `panel.db-wal`, et `panel.db-shm` ensemble lors de la copie d'une base de données en direct.
