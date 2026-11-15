# Méthode statistique

Tout chiffre affiché par l'application vient de `trend.stats.analyser()`. Ni le front ni le serveur ne calculent de statistique.

## 1. Données d'entrée

Une série mensuelle par variable et par région, déjà convertie dans l'unité d'affichage (voir `docs/data_choices.md`).
L'index est le premier jour de chaque mois. Un mois manquant vaut `NaN`.

## 2. Retirer les saisons (anomalies)

L'écart entre l'été et l'hiver est bien plus grand que la tendance sur 40 ans. On compare donc chaque mois à la moyenne
de ce même mois calendaire sur la période analysée :

```
anomalie(janvier 2010) = valeur(janvier 2010) − moyenne(tous les janviers de la période)
```

Le cycle saisonnier disparaît. Il reste la variabilité d'une année à l'autre et l'éventuelle tendance.

## 3. Moyennes annuelles

On fait la moyenne des anomalies de chaque année civile, en ne gardant que les années d'au moins 10 mois valides.
Le test principal porte sur ces valeurs annuelles. Deux raisons :

- deux mois consécutifs se ressemblent (autocorrélation) ; tester 540 mois comme s'ils étaient indépendants rendrait
  presque tout « significatif » ;
- c'est l'échelle que comprend le public : « l'année 2022 a été plus chaude que la normale ».

## 4. Test de Mann-Kendall (significativité)

Pour chaque paire d'années, on regarde si la seconde est au-dessus ou au-dessous de la première. Si les hausses
l'emportent nettement sur les baisses (ou l'inverse), la tendance est jugée **significative au seuil de 5 %**.

- Statistique : S = somme des signes ; Z = S normalisé par sa variance (avec correction des ex æquo).
- p-value : probabilité d'observer une pente aussi nette si aucune tendance n'existait.
- Verdict : `significatif = p < 0,05`. On écrit « tendance significative (au seuil de 5 %) », jamais « prouvée ».

Ce test ne suppose pas que les données suivent une loi normale. Il ne mesure que la direction, pas la vitesse.

## 5. Pente de Sen et intervalle de confiance (vitesse)

- **Pente de Sen** : médiane des pentes entre toutes les paires d'années. Une année extrême (canicule, El Niño) ne la
  déforme pas, contrairement à une régression linéaire.
- **Intervalle de confiance à 95 %** : méthode de Gilbert (1987), à partir de la variance de S. Les bornes sont les pentes
  de rangs `(N − C)/2` et `(N + C)/2 + 1` parmi les N pentes triées, avec `C = 1,96 × √Var(S)`.
- Affichage : pente **par décennie** (pente annuelle × 10) ; changement total = pente × durée analysée.
- Droite de tendance : pente de Sen, ordonnée à l'origine de Conover (médiane des résidus), tracée sur l'index mensuel.

## 6. Contrôles affichés dans l'onglet « Preuves »

| Test | Rôle |
|---|---|
| Mann-Kendall corrigé (Hamed et Rao, 1998) | Vérifie que le verdict tient quand on corrige l'autocorrélation entre années. |
| Mann-Kendall saisonnier (Hirsch et Slack, 1984) | Test sur les 12 mois calendaires séparément, puis combiné : utilise toutes les données mensuelles. |
| Régression linéaire | Pente « classique », pour comparaison ; sensible aux valeurs extrêmes. |

Ces contrôles ne changent pas le verdict ; ils permettent de juger sa robustesse.

## 7. Règles d'affichage

- **Moins de 30 ans** de données : avertissement « tendance récente, pas encore de climat » (recommandation de l'OMM).
- **Moins de 5 ans** : pas d'analyse (`ValueError`, message clair dans l'interface).
- **Non significatif** : « pas de tendance significative sur cette période ». Cela ne veut pas dire « stable » ;
  une période plus longue peut trancher (onglet « Stabilité » : le test relancé pour chaque année de départ).

## 8. Limites

- Une tendance décrit un changement, elle n'en explique pas la cause.
- Les tendances sont supposées linéaires sur la période ; une rupture (Pékin vers 2012) se voit en changeant la période.
- MERRA-2 est une réanalyse (modèle + observations) ; GPM et OMI sont des estimations satellite. Ce ne sont pas des
  mesures de station au sol.
- Une moyenne de zone lisse le bruit local : un verdict peut différer entre la zone et son point central
  (exemple : NO₂ sur la France, significatif en zone, pas au point central).

## Références

- Mann H. B. (1945), Kendall M. G. (1975) : test de tendance non paramétrique.
- Sen P. K. (1968) : estimateur de pente robuste.
- Gilbert R. O. (1987), *Statistical Methods for Environmental Pollution Monitoring* : intervalle de confiance de la pente.
- Hirsch R. M., Slack J. R. (1984) : test saisonnier. Hamed K. H., Rao A. R. (1998) : correction de l'autocorrélation.
- Bibliothèque : `pymannkendall` (Hussain et Mahmud, 2019).
