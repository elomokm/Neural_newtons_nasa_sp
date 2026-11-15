# Audit et finition du projet (branche `test`, 2026-11-15)

## 1. État constaté au départ

| Partie | État | Conséquence |
|---|---|---|
| Contrat (`docs/CONTRAT.md`, `schemas.py`) | Complet | Base solide pour assembler les parties. |
| Accès aux données (spike) | Validé : Giovanni point et Harmony zone, pour les 4 variables | La faisabilité était prouvée, mais aucune série n'était en cache (seulement 2 séries de test). |
| Moteur `src/trend/` (catalogue, données, statistiques, assistant) | **Fichiers vides** | L'application tournait uniquement sur des données simulées : aucun verdict réel. |
| Catalogues YAML, scénarios, scripts, tests | **Vides** | Rien n'était vérifiable automatiquement. |
| Application (`app/api.py` + front Earth Detective) | Branchée sur le contrat, fonctionnelle avec le mock | Prête à recevoir le vrai moteur. |
| Identité visuelle | Bleu nuit, verre dépoli, police Inter, dégradés indigo et turquoise | Rendu générique, « fait par une IA ». |
| Agent IA (branche `ashneel`) | Prototype OpenAI, clé payante requise, interface différente du contrat, branche partie d'un ancien `main` (supprime le spike et `schemas.py`) | Non fusionnable tel quel ; la démo doit marcher sans clé. |
| Documentation | README, méthode et choix de données vides | Rien à montrer au jury en dehors de l'app. |

## 2. Ce qui a été fait

1. **Moteur complet, conforme au contrat**
   - `catalog.py` : lecture des YAML ;
   - `data.py` : lecture du cache sans réseau, conversions d'unités, agrégation du NO₂ journalier ;
   - `sources/giovanni.py` : accès Time Series et Harmony, issu du spike ;
   - `stats.py` : anomalies, Mann-Kendall, pente de Sen, intervalle de confiance, contrôles ;
   - `advisor.py` : suggestions et explications sans clé d'API.
2. **Données réelles** : 86 séries NASA téléchargées (43 moyennes de zone, 43 points), 0 échec, 0,1 % du quota Giovanni. Le cache est versionné : la démo marche hors ligne, sans identifiants.
3. **Les histoires de la démo vérifiées sur les vraies données** (tests automatiques) :
   - Paris montre trois verdicts différents ;
   - le NO₂ évolue en sens opposés entre Los Angeles et Dhaka ;
   - à Pékin, la tendance du NO₂ bascule en 2012 ;
   - le Svalbard se réchauffe 1,75 fois plus vite que Paris.
4. **Nouvelle identité visuelle « Observatoire »** (détail ci-dessous), contrastes vérifiés.
5. **Tests** : 22 tests (moteur, données, assistant, serveur, histoires de la démo), linter propre.
6. **Documentation** : README, méthode statistique, chaîne de données, cet audit, contrat mis à jour (commande de lancement, propriété du dossier `earth-detective/`).

## 3. Choix à défendre devant le jury

- **Test sur les moyennes annuelles des anomalies**, pas sur les 540 mois : deux mois voisins se ressemblent ; les tester comme indépendants rendrait presque tout significatif. Le Mann-Kendall saisonnier et la correction de Hamed et Rao sont affichés en contrôle.
- **Moyenne de zone plutôt que point** : plus représentative de la région, moins bruitée. Le verdict diffère du point central dans 3 cas sur 43, documentés.
- **Assistant sans clé d'API** : la démo ne doit dépendre ni du réseau ni d'un crédit. Un modèle de langage peut être branché derrière les mêmes fonctions `suggerer` / `expliquer`.
- **« Significatif », jamais « prouvé »**. Sous 30 ans de données, avertissement de l'OMM. Un résultat non significatif est présenté comme une information, pas comme un échec.

## 4. Identité visuelle « Océan » et série temporelle

Le skill de design proposait une police Exo et une palette verte « bio » : écartées (cliché science-fiction ; le vert brouille les couleurs de verdict). Une première passe graphite et laiton avec l'orange pour les hausses a été abandonnée à la demande de l'équipe.

| Élément | Choix | Raison |
|---|---|---|
| Titres | Fraunces (serif éditorial) | Ton d'atlas ou de revue scientifique, à l'opposé des interfaces génériques. |
| Texte, chiffres | IBM Plex Sans, IBM Plex Mono | Dessinées pour la documentation technique, signes « + » et « − » lisibles au projecteur. |
| Fond | Bleu marine (#07111F à #15305A) | Sobre ; le globe et les verdicts portent la couleur. |
| Accent | Cyan (#5FD4E6) | Marque, lieu B, sélections ; jamais un verdict. |
| Verdicts | Rouge (#FF6B7D) hausse, bleu (#3D9BFF) baisse, gris non significatif | Convention des cartes de température ; lisible par les daltoniens (rouge / bleu) ; mêmes couleurs partout. |
| Effets | Panneaux plats, filets fins, ni verre dépoli ni lueur | Moins de bruit visuel, plus de lisibilité. |

Contrastes du texte sur les fonds, mesurés au critère WCAG : tous au-dessus de 4,5 pour 1.

**Série temporelle** : un seul graphique mensuel, un bouton « Données brutes / Sans les saisons » et une case « Afficher la pente ». Les onglets en trop (calendrier, stabilité, éventail de pentes, jauge « bruit / signal ») ont été retirés pour s'en tenir à ce que demande le défi.

## 5. Risques et limites connus

- **Thème sombre au projecteur** : les contrastes sont conformes, mais il faut tester sur le vrai projecteur avant le passage.
- **Clic libre sur le globe** limité aux 11 régions. `trend.data.get_series_point` existe (appel live de 2 à 3 s) mais n'est pas exposé dans l'interface.
- **Anglais** : l'interface est traduite, mais les textes du catalogue (définitions, régions) n'existent qu'en français.
- **`saisons_retirees: false`** affiche les moyennes annuelles réelles : aucune vue ne montre le cycle saisonnier brut.
- **Branche `ashneel`** non fusionnée : son prompt système peut servir si l'équipe veut un modèle de langage derrière `expliquer`.
- **Bundle du front** : 4,5 Mo (textures de la Terre incluses), versionné pour éviter Node.js sur le poste de démo.
- L'agent IA sera branché par un autre membre de l'équipe : voir `docs/AGENT.md`.

## 6. Prochaines étapes conseillées

1. Relire et fusionner `test` dans `data_elom`, puis dans `main`, après accord de l'équipe.
2. Répéter la démo de 3 minutes sur le vrai projecteur (enquêtes guidées dans l'ordre : Paris, NO₂, Pékin, Arctique).
3. Optionnel : exposer `get_series_point` pour le clic libre, et brancher un modèle de langage dans `advisor.expliquer`.
