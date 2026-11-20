---
title: 'Mises à jour'
description: 'Suivez et appliquez les mises à jour des versions de Minecraft, des modpacks, des mods et des plugins sur chaque serveur, avec une politique par serveur.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Retour à l'index de la documentation](/docs/)

La page **Mises à jour** suit ce qui est obsolète sur l'ensemble de votre parc en un seul endroit :

- Versions de **Modpack** ([modpacks](/docs/modpacks/)) par rapport à Modrinth / CurseForge / l'index de publication GTNH.
- **Contenu personnalisé** que vous avez ajouté vous-même (mods, datapacks, resource packs, plugins), chacun par rapport à sa source : Modrinth, CurseForge, Hangar, SpigotMC (Spiget), ou GitHub Releases. Les recherches GitHub utilisent la revalidation ETag, donc les vérifications quotidiennes touchent à peine leur limite de requêtes.
- Obsolescence de l'**image Docker** : ID d'image de chaque conteneur de serveur par rapport à un tag fraîchement extrait (dédupliqué entre les serveurs utilisant le même tag), proposé comme une mise à niveau nécessitant une reconstruction uniquement.
- **Épinglage de version autonome** : pour un serveur sans pack géré, un épinglage explicite de `mc_version` par rapport au manifeste de Mojang, et une variable d'environnement explicite pour le build du loader (`PAPER_BUILD`, `FORGE_VERSION`, etc.) par rapport au registre du loader. Les builds Paper proviennent de l'actuelle **Fill v3 API** de PaperMC (le point d'accès hérité v2 a cessé de recevoir les nouvelles versions de Minecraft). Sur un serveur avec des mods, une version plus récente de Minecraft n'est proposée qu'une fois qu'une [vérification de version](#minecraft-version-compatibility) a montré que chaque mod installé dispose d'un build pour celle-ci. Un serveur Forge épinglé se voit proposer le build recommandé par Forge, jamais un build plus ancien que celui auquel il est épinglé, et un serveur épinglé à une version stable ne se voit jamais proposer une pré-version (une version déjà en bêta peut se voir proposer une bêta plus récente ou la version stable). L'application d'un build de loader effectue d'abord une sauvegarde pré-mise à jour. Le déplacement d'un serveur Forge ou NeoForge vers une nouvelle version de Minecraft efface son numéro de build de loader épinglé, car un build est fait pour une seule version de Minecraft ; un mot-clé tel que `latest` est conservé, car il suit la version par lui-même. Pour choisir vous-même un build spécifique, voir [changer la version du mod loader](#changing-the-mod-loader-version).

![Mises à jour](/docs/images/updates.png)

## Comment ça marche

Le panneau vérifie les versions épinglées de chaque serveur par rapport à la source en amont et liste tout ce qui a une nouvelle publication. Un compte correspondant apparaît également sur la tuile "Mises à jour disponibles" du [tableau de bord](/docs/dashboard/).

Les vérifications s'exécutent quotidiennement selon un [planificateur](/docs/schedules/) par défaut et à la demande avec **Tout vérifier maintenant**. **Ignorer** sur une ligne arrête de proposer cette version particulière ; une version plus récente sera à nouveau proposée. La **politique** de mise à jour est par serveur : le panneau laisse tout en manuel (par défaut, ce qui maintient également le serveur hors de cette page), vous notifie simplement, ou applique lui-même les mises à jour de pack ([politique de mise à jour](/docs/modpacks/#update-policy)).

## Compatibilité des versions de Minecraft

Une nouvelle version de Minecraft n'est pas une mise à niveau si vos mods ne peuvent pas vous suivre. Chaque serveur a son propre onglet **Versions** (sous Mods) qui répond à cette question :

- La version que le serveur exécute actuellement, et la **version la plus élevée pour laquelle chaque mod installé a un build**.
- Une ligne repliable par version future de Minecraft, indiquant combien de mods sont prêts et combien n'ont encore rien publié. Ouvrez une ligne pour voir quels mods seraient laissés pour compte, et lesquels sont compatibles.

![Compatibilité des versions](/docs/images/server-versions.png)

Appuyez sur **Vérifier les futures versions** pour l'exécuter. Rien ne scanne de soi-même : une vérification lit chaque jar dans le dossier mods du serveur et interroge Modrinth et CurseForge pour chacun, donc cela ne se produit que lorsque vous le demandez. La progression et les résultats partiels sont enregistrés au fur et à mesure, donc fermer la page ou rafraîchir ne fait rien perdre, et une vérification interrompue par un redémarrage du panneau le signale et propose de la relancer. Tout ce qu'une vérification interrompue avait déjà déterminé est conservé, donc la relancer ne refait pas ce travail.

Un rapport ne décrit que le serveur pour lequel il a été créé. Modifiez la version de Minecraft, le loader, ou les mods eux-mêmes (ajoutez-en un, supprimez-en un, mettez-en un à jour) et le rapport est marqué comme obsolète et n'est plus utilisé, jusqu'à ce que vous relanciez la vérification.

Les mods sont identifiés à partir de la liste de fichiers du modpack lui-même lorsqu'elle existe, et sinon par le contenu du fichier, de la même manière qu'un lanceur reconnaît un jar. Deux types de mods ne peuvent pas être traités, et aucun n'est deviné :

- **Impossible à identifier** : un jar construit manuellement ou un build privé que ni le registre ne reconnaît.
- **Impossible à vérifier** : un mod provenant de GitHub Releases, Hangar ou SpigotMC, ou dont le projet a été retiré. Ceux-ci ne publient pas de liste indiquant pour quelle version de Minecraft chaque build est destiné.

Tant que l'un de ceux-ci est installé, le panneau ne proposera aucune mise à jour de version Minecraft en un clic, car il ne peut pas dire honnêtement ce qui pourrait casser. L'application d'une version supérieure à ce que les mods supportent est refusée, et nomme les mods qui la bloquent.

Les mods que vous avez **désactivés** ne jouent aucun rôle : le serveur ne les charge pas, donc désactiver un mod est un moyen réel de contourner un blocage. Activer ou désactiver un mod marque le rapport pour une nouvelle vérification.

Ceci couvre les serveurs qui exécutent des mods : Fabric, Forge, NeoForge et Quilt. Les serveurs de plugins de type Paper conservent le comportement simple de dernière publication et n'ont pas d'onglet Versions, car deux des registres d'où proviennent les plugins ne publient rien qu'une vérification puisse lire.

![Une version ouverte, montrant quels mods seraient laissés pour compte](/docs/images/server-versions-expanded.png)

Ouvrir une version liste d'abord les mods sans build pour celle-ci (ceux qui déterminent la réponse) et garde les mods prêts derrière un clic. Les gros packs chargent une page de mods à la fois, donc un serveur de 300 mods s'ouvre aussi vite qu'un serveur de cinq mods.

## Changer la version du mod loader

L'onglet **Versions** contient également une carte **Version du Loader**. Elle indique quel build Forge, NeoForge, Fabric ou Quilt le serveur a installé et, lorsque cela peut être modifié, un sélecteur pour en choisir un autre.

- **Un serveur Forge, NeoForge, Fabric ou Quilt** peut exécuter n'importe quel build publié. Le sélecteur liste les builds récents pour la version de Minecraft du serveur, avec les builds recommandés et les derniers de Forge étiquetés. **Autre Build…** permet d'entrer n'importe quel ancien build par son numéro, et **Défaut** revient à laisser le serveur choisir.
- **Un modpack Forge ou Fabric CurseForge** installe la version du loader déclarée par son propre manifeste, donc la manière habituelle de la changer est de mettre à jour le pack. Lorsque le pack lui-même liste la mauvaise version (un mod à l'intérieur demande un Forge plus récent que celui installé par le pack), la carte peut la remplacer, et **Version du Modpack** supprime la substitution à nouveau. La mise à jour du pack la supprime également, car la nouvelle version déclare son propre loader. Si la nouvelle version liste toujours la mauvaise, définissez à nouveau la substitution.
- **Un modpack NeoForge CurseForge, ou un modpack Modrinth,** affiche son loader mais ne peut pas être remplacé : l'image du serveur n'applique la substitution qu'aux packs Forge et Fabric. Son loader suit la version du pack, donc mettez à jour le pack à la place. Le loader d'un pack FTB ne peut pas non plus être modifié ici. Sa carte n'apparaît généralement pas, car l'installateur FTB lui-même conserve des enregistrements que le panneau ne lit pas.

Le panneau vérifie que le build existe avant de vous demander quoi que ce soit. Un build Forge ou NeoForge est fait pour une seule version de Minecraft, donc sur un serveur qui suit la dernière publication, l'épinglage d'un build maintient également le serveur sur la version de Minecraft qu'il exécute actuellement (la confirmation le dit). Choisir **Défaut** ensuite supprime l'épinglage mais conserve cette version de Minecraft. Un serveur qui suivait la dernière publication peut également passer à une image Java différente lors de sa reconstruction, celle dont cette version a besoin. Un tel serveur qui n'a jamais démarré est invité à démarrer une première fois, afin que le panneau connaisse cette version. Forge saute des numéros de build (il n'y a pas de 47.4.14 entre 47.4.13 et 47.4.15), donc un mod qui "requiert 47.4.14 ou supérieur" est satisfait par le prochain build supérieur, et le refus le nomme. Un changement effectue une sauvegarde pré-mise à jour, puis reconstruit le serveur. Le nouveau build est installé lors du prochain démarrage du serveur, et la carte le signale jusqu'alors.

## Annuler une mise à jour de mod

Chaque build à partir duquel un mod est mis à jour reste dans la bibliothèque partagée, donc une mise à jour qui casse quelque chose est réversible. La ligne du mod dans l'onglet **Mods** obtient un bouton **Rétablir** qui remet le build précédent. Il n'y a pas de téléchargement, donc cela fonctionne même si le projet a depuis été retiré de son registre. Le build à partir duquel vous avez rétabli n'est plus proposé jusqu'à ce qu'un nouveau apparaisse.

![Rétablir un mod au build à partir duquel il a été mis à jour](/docs/images/mods-revert.png)

## Appliquer une mise à jour

Les mises à jour ne sont jamais silencieuses. Lorsque vous choisissez de mettre à niveau un pack (ou de [le basculer vers une autre version](/docs/modpacks/#changing-the-pack-version), y compris les anciennes), le panneau :

1. Effectue une **sauvegarde pré-mise à jour** (pour qu'elle soit réversible ; par défaut, les 10 dernières sauvegardes pré-mise à jour par serveur sont conservées, voir [rétention](/docs/backups/#retention)).
2. Ré-épingle la nouvelle version exacte.
3. Reconstruit le serveur, en résolvant à nouveau le runtime Java si nécessaire.
4. Surveille le premier démarrage, avec un budget de temps par plateforme.

S'il ne démarre pas correctement, vous revenez à la sauvegarde pré-mise à jour. Un serveur suivant la version stable ne se voit jamais proposer une bêta, et le lien du journal des modifications pointe vers la différence réelle par version lorsque la source en fournit une. Une mise à jour échouée déclenche également une [alerte](/docs/integrations/) Discord si l'intégration est configurée.
