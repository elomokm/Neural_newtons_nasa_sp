# Prompt : partie APPLICATION (Streamlit)

> À coller tel quel dans ton assistant IA de code, depuis la racine du dépôt.

---

Tu m'aides à construire l'**application Streamlit** d'un projet de hackathon NASA Space Apps 2026, défi « Be An Earth System Trend Detective! ». Nous sommes 4, il reste environ 24 h. Je suis responsable **uniquement de l'app** (`app/`). Deux coéquipiers font les données et les statistiques, un autre fait l'assistant IA. Lis tout ce prompt avant d'écrire du code.

## 1. Ce que le jury attend (à garder en tête à chaque choix)

Le défi demande un outil qui permet de : (1) choisir des variables Earth science intéressantes, (2) les obtenir pour une région, (3) tracer leur série temporelle sur une longue période, (4) **dire s'il y a une tendance, de combien, et si elle est statistiquement significative** (Mann-Kendall, intervalle de confiance). Public visé : lycéens, étudiants, grand public avec un bagage scientifique. Bonus valorisés : définitions simples des variables, parcours guidé, exemples de démonstration, IA pour suggérer des variables. L'idée centrale du titre : **une même variable peut monter dans une région et baisser dans une autre**.

Conséquence pour l'app : **le verdict de tendance est l'élément central de l'écran**, pas une jolie carte. Une carte animée mois par mois est explicitement HORS PÉRIMÈTRE (elle montre des valeurs, pas une tendance, et coûte des centaines de requêtes).

## 2. Ce que tu ne fais PAS

- Tu ne récupères aucune donnée NASA (pas d'appel Giovanni, pas d'OWID, pas d'autre source).
- Tu ne calcules aucune statistique (pas de régression, pas de test) : tout vient de `trend.stats.analyser()`.
- Tu n'appelles aucun LLM directement : tout passe par `trend.advisor`.
- Tu ne modifies rien en dehors de `app/` (sauf ajouter des dépendances à `requirements.txt` après m'avoir prévenu).
- Tu n'écris jamais le mot « prouvé ». Formulation : « tendance significative (au seuil de 5 %) » / « pas de tendance significative sur cette période ».
- Tu n'affiches aucun chiffre qui ne vient pas de `ResultatTendance` ou des données.

## 3. Le contrat commun (OBLIGATOIRE, ne pas le modifier)

Le fichier de référence est `docs/CONTRAT.md`. Lis-le en entier. Résumé de ce dont l'app a besoin :

```python
from trend.schemas import Variable, Region, Serie, ResultatTendance, Suggestion
from trend.catalog import charger_variables, charger_regions, charger_scenarios
from trend.data import get_series                 # (variable_id, region_id) -> Serie, lit le cache local
from trend.stats import analyser                  # (serie, debut="AAAA-MM"|None, fin=...) -> ResultatTendance
from trend.advisor import suggerer, expliquer     # bonus, peut être absent au début
```

Champs utiles de `ResultatTendance` : `serie` (avec `serie.valeurs`, `serie.variable`, `serie.region`), `debut`, `fin`, `n_annees`, `anomalies` (série sans saisons), `droite` (droite de tendance, même index que `anomalies`), `pente_decennie`, `ic95`, `p_value`, `significatif`, `sens` ("hausse"/"baisse"), `changement_total`, `periode_courte` (< 30 ans), `resume` (phrase simple), `tests` (DataFrame de détail), `ruptures` (souvent vide).

Champs utiles de `Variable` : `nom`, `definition`, `unite`, `source`, `debut`, `hausse_signifie`, `baisse_signifie`. De `Region` : `nom`, `type`, `centre` (lat, lon), `histoire`.

Erreurs à gérer proprement dans l'UI (message clair, pas de trace Python) : `KeyError` (id inconnu), `FileNotFoundError` (série pas encore en cache), `ValueError` (période < 5 ans).

## 4. Travailler AVANT que les autres aient fini : le mock

Les modules `trend.data` / `trend.stats` / `trend.advisor` ne seront prêts que vers H4 à H8. **Tu ne les attends pas.**

1. Si `src/trend/schemas.py` est vide ou absent, crée-le avec EXACTEMENT le contenu de la section 1 de `docs/CONTRAT.md`, puis préviens-moi (je préviens l'équipe data).
2. Crée `app/mock.py` qui expose les mêmes fonctions que le contrat (`charger_variables`, `charger_regions`, `charger_scenarios`, `get_series`, `analyser`, `suggerer`) et renvoie des objets du contrat :
   - catalogue : les 4 variables et 11 régions des tableaux de la section 3 de `docs/CONTRAT.md` (attention : pas de NO₂ pour `svalbard`, l'app doit masquer une combinaison indisponible) ;
   - séries : pour `t2m` sur `paris` et `france`, lis les vrais fichiers `spike/data/t2m_paris_point.csv` et `spike/data/t2m_france_area.csv` (colonnes `date, valeur, unite`, valeurs en Kelvin à convertir en °C) ; pour le reste, génère un cycle saisonnier + une tendance + du bruit avec numpy (graine fixe) ;
   - `analyser` factice : anomalies = valeurs moins la moyenne de chaque mois, droite par `numpy.polyfit`, p_value inventée mais plausible. C'est SEULEMENT pour développer l'interface.
3. Dans l'app, un seul point d'entrée choisit la source : `app/backend.py` importe depuis `trend.*` si la variable d'environnement `TREND_MOCK` vaut `0`, sinon depuis le module local `mock` (Streamlit ajoute le dossier `app/` au chemin d'import, donc `import mock` et `import backend` fonctionnent). Le reste de l'app importe **uniquement** `backend`. Ainsi, le passage au vrai moteur se fait en changeant une variable d'environnement.
4. Affiche un bandeau discret « Données de démonstration (mock) » quand le mock est actif.

## 5. Le rendu attendu (ce que le jury doit voir)

**Règle des 5 secondes :** quelqu'un qui découvre l'écran doit comprendre en 5 secondes *ce qui change, où, de combien, et si c'est sûr*. Donc, de haut en bas : **le verdict d'abord, le graphique ensuite, les explications après, les détails techniques repliés.**

### Écran « Enquête » (écran par défaut)

```
┌─ Barre latérale ─────────────┐ ┌─────────────────────────────────────────────────────────┐
│ Que veux-tu enquêter ?       │ │ PARIS · Température de l'air à 2 m · 1980 → 2024         │
│ [ texte libre (bonus IA) ]   │ │ ┌─────────────────────────────────────────────────────┐ │
│ ─── ou choisis ───           │ │ │ ▲ HAUSSE SIGNIFICATIVE        +0,41 °C par décennie │ │
│ Variable [Température     ▾] │ │ │ Sur 45 ans : environ +1,8 °C   (IC 95 % : +0,27 à  │ │
│ Région   [Paris           ▾] │ │ │ +0,57). Moins de 5 % de chances que ce soit le      │ │
│ Période  1980 ●━━━━━━━● 2024 │ │ │ hasard. En clair : il fait plus chaud.              │ │
│                              │ │ └─────────────────────────────────────────────────────┘ │
│ Mode  (•) Une région         │ │  [ Données brutes ]  [ Sans les saisons ]                │
│       ( ) Comparer 2 régions │ │   graphique plotly pleine largeur, droite de tendance    │
│       ( ) Carte du monde     │ │   épaisse sur l'onglet « Sans les saisons »              │
│                              │ │ ┌ C'est quoi ? ────────────┐ ┌ Pourquoi cette région ? ┐ │
│ [ ▶ Lancer une démo ]        │ │ │ définition · unité ·     │ │ histoire de la région   │ │
│                              │ │ │ source NASA              │ │                          │ │
└──────────────────────────────┘ │ └──────────────────────────┘ └──────────────────────────┘ │
                                 │ ▸ Détails statistiques (replié) : tableau des tests,     │
                                 │   p-value expliquée, méthode                             │
                                 └─────────────────────────────────────────────────────────┘
```

### Écran « Comparer 2 régions »

```
 NO₂ troposphérique · 2005 → 2024
 ┌ LOS ANGELES ─────────────────┐   ┌ DHAKA ───────────────────────┐
 │ ▼ BAISSE SIGNIFICATIVE       │   │ ▲ HAUSSE SIGNIFICATIVE       │
 │ −5,8 par décennie            │   │ +2,2 par décennie            │
 └──────────────────────────────┘   └──────────────────────────────┘
  Un seul graphique : les anomalies des 2 régions superposées (2 couleurs) + leurs droites
  Phrase de synthèse : « Même variable, sens opposés. »
```

### Écran « Carte du monde »

Une carte (plotly `scatter_geo`, projection simple, fond clair) avec **un point par région** pour la variable choisie. Couleur = pente (échelle divergente bleu ↔ orange, centrée sur 0). Point **plein** si significatif, **cercle vide** sinon. Une légende courte : « plein = tendance significative ». Cliquer sur un point ouvre l'écran Enquête sur cette région. C'est la réponse visuelle à « **où** ça change ».

### Mode démo

Un bandeau en haut de l'écran Enquête : titre du scénario, texte de l'étape, bouton « Étape suivante ». Chaque étape règle automatiquement variable, région(s), période et onglet.

### Charte visuelle

- **Toujours les mêmes couleurs de sens** partout (verdict, carte, comparaison) : orange = hausse significative, bleu = baisse significative, gris = non significatif. Pas d'arc-en-ciel.
- Pour la variable elle-même, aucun jugement « bien / mal » par la couleur : une baisse de NO₂ est une bonne nouvelle, une baisse de pluie peut être une mauvaise ; la phrase `hausse_signifie` / `baisse_signifie` donne le sens, pas la couleur.
- Thème clair (projecteur), verdict en grande police, chiffres arrondis (2 chiffres significatifs pour la pente), virgule décimale si l'interface est en français.
- Un graphique n'est jamais sans titre, unité sur l'axe et source en petit dessous.
- Le gris (non significatif) n'est pas un échec : la phrase dit « pas de tendance significative **sur cette période** » et invite à essayer une période plus longue.

## 6. Ce qu'il faut construire, par priorité

### Socle (obligatoire, visé pour H4 avec le mock)

Écran principal « Enquête » :
- **Barre latérale** : choix de la variable (selectbox avec `nom`), choix de la région (selectbox avec `nom`), affichage de la période disponible.
- **Carte verdict, en haut, en gros** : une phrase en langage simple construite à partir du résultat, par exemple « À Paris, la température a augmenté d'environ 1,8 °C entre 1980 et 2024 (+0,41 °C par décennie). Cette hausse est significative : il y a moins de 5 % de chances qu'elle soit due au hasard. » Code couleur : orange = hausse significative, bleu = baisse significative, gris = non significatif. Utilise `hausse_signifie` / `baisse_signifie` pour traduire en mots (« il fait plus chaud »). Si `periode_courte`, ajoute un avertissement : « Moins de 30 ans de données : on parle de tendance récente, pas encore de climat (recommandation de l'Organisation météorologique mondiale). »
- **Graphique principal (plotly)**, deux onglets :
  1. « Données brutes » : `serie.valeurs`, on voit le cycle des saisons ;
  2. « Sans les saisons » : `anomalies` + `droite` en trait épais ; légende claire.
  Un court texte explique pourquoi on retire les saisons (« l'écart entre l'été et l'hiver est bien plus grand que la tendance sur 40 ans ; on compare chaque mois à la moyenne de ce même mois »).
- **Encadré « C'est quoi cette variable ? »** : `definition`, `unite` expliquée, `source`.
- **Expander « Détails statistiques »** : le DataFrame `tests`, la pente avec son intervalle de confiance, et une explication de la p-value pour un lycéen.
- **Mention des données** en pied de page : source NASA de la variable et identifiant Giovanni.

### Fort (après le socle)

- **Curseur de période d'analyse** (`st.select_slider` sur les mois disponibles, début et fin) : on rappelle `analyser(serie, debut, fin)` et le verdict se met à jour. Ajoute une phrase d'aide : « Une tendance peut devenir significative quand on allonge la période. » C'est un point fort pédagogique explicitement cité dans le défi.
- **Mode comparaison** : même variable, deux régions côte à côte, deux verdicts, un graphique superposé des anomalies. C'est le cœur du titre du défi.
- **Carte des régions** (plotly `scatter_geo` ou `scatter_map`) pour la variable choisie : un point par région à `centre`, couleur = `pente_decennie` (échelle divergente centrée sur 0), point plein si significatif, cercle vide sinon. Cliquer sur un point (ou à défaut un selectbox) sélectionne la région. Le calcul vient de `analyser(get_series(v, r))` pour chaque région en cache.
- **Mode démo** : lit `charger_scenarios()`, affiche le `titre`, puis les `etapes` une par une avec un bouton « Étape suivante » ; chaque étape règle la variable, la ou les régions, la période et l'onglet (`saisons_retirees`).

### Bonus (seulement si tout le reste marche)

- **Champ « Que veux-tu enquêter ? »** : appelle `suggerer(question)` et pré-remplit variable et région, en affichant `explication`. Si `trend.advisor` n'est pas importable, le champ est masqué.
- Bouton « Explique-moi simplement » qui affiche `expliquer(resultat)`.

## 7. Contraintes techniques

- Streamlit + plotly. Python 3.12. Lancement : `PYTHONPATH=src streamlit run app/streamlit_app.py`.
- Mets en cache avec `@st.cache_data` des fonctions qui prennent des **ids et des chaînes** (pas des objets `Serie`), par exemple `charger_resultat(variable_id, region_id, debut, fin)`.
- L'app doit démarrer et fonctionner **sans réseau et sans clé d'API**. Aucun appel réseau dans le rendu des pages.
- Organisation : `app/streamlit_app.py` (point d'entrée), `app/backend.py`, `app/mock.py`, `app/components/` (verdict, graphiques, carte, définitions), `app/pages/` si plusieurs pages.
- **Tous les textes affichés dans un seul fichier `app/textes.py`** (dictionnaire). La langue de l'interface (français ou anglais) n'est pas encore tranchée par l'équipe : ce fichier permettra de basculer vite.
- Lisible sur un écran de projecteur : grandes polices pour le verdict, pas plus de 3 couleurs principales.
- Pas de logo NASA (règles Space Apps).

## 8. Façon de travailler

- Branche git `app`. Commits petits et fréquents. Ne touche pas aux fichiers des autres parties.
- Avance par étapes et montre-moi le résultat à chaque étape : (1) mock + écran socle, (2) curseur de période, (3) comparaison, (4) carte, (5) mode démo, (6) bonus.
- **Point d'étape H4** : l'écran socle tourne avec le mock. Ensuite on bascule `TREND_MOCK=0` dès que l'équipe data annonce que `get_series` et `analyser` sont prêts, et on corrige les écarts.
- **H20 : gel des fonctionnalités.** Après, seulement des corrections.
- Si un élément du contrat te semble manquer ou faux, **ne le contourne pas** : écris-moi précisément ce qui manque, je le remonte à l'équipe data.

Commence par lire `docs/CONTRAT.md`, puis propose-moi en 10 lignes maximum le découpage des fichiers de `app/` avant d'écrire le code.
