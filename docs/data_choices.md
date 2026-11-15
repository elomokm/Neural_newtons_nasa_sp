# Données : chaîne de traitement et résultats

Choix des variables et des régions, avec leur justification : `docs/DECISIONS_DONNEES.md`.
Ce document décrit comment les séries sont obtenues, et ce qu'elles montrent.

## 1. Chaîne de traitement

```
Giovanni (NASA GES DISC) ──► scripts/build_cache.py ──► data/cache/*.csv ──► trend.data.get_series ──► trend.stats.analyser
   Time Series (point)            conversion d'unités        86 séries          lecture seule, sans réseau
   Area-Average via Harmony       agrégation NO₂ mensuelle   + manifest.json
```

| Étape | Détail |
|---|---|
| Accès | `src/trend/sources/giovanni.py`. Identifiants Earthdata lus dans l'environnement ou `~/.netrc`, jamais dans le code. |
| Série point | Time Series API, point de grille le plus proche du centre de la région (2 à 3 s par série). |
| Moyenne de zone | Area-Average via Harmony sur la bbox de la région (25 à 40 s par série, asynchrone). **C'est la série utilisée par l'app.** |
| Conversions | T2M : K → °C. QV2M : kg/kg → g/kg (× 1000). Pluie GPM : mm/h → mm/jour (× 24). NO₂ : molécules/cm² → 10¹⁵ molécules/cm². |
| NO₂ journalier | Moyenne mensuelle des jours valides ; un mois est rejeté s'il compte moins de 5 jours mesurés. |
| Valeurs de remplissage | Remplacées par `NaN` (−1,27 × 10³⁰ pour OMI, 10¹⁵ pour MERRA-2, −9999,9 pour GPM). |
| Unité absente | Le CSV Area-Average ne contient pas l'unité : lecture dans le CMR (UMM-Var), sinon dans l'en-tête d'une Time Series d'un mois (cas de GPM). |
| Traçabilité | `data/cache/manifest.json` : nombre de mois, mois manquants, unité brute, durée, identifiant du job Harmony. |

Reconstruire le cache (identifiants Earthdata requis) :

```bash
PYTHONPATH=src .venv/bin/python scripts/build_cache.py --origine point --force              # ~30 s
PYTHONPATH=src .venv/bin/python scripts/build_cache.py --origine zone --parallele 4 --force # ~5 min
```

Bilan du précalcul du 2026-11-15 : 43 séries point et 43 moyennes de zone, **0 échec, 0 mois manquant en zone**,
quota Giovanni consommé : 0,1 % du quota mensuel.

## 2. Ce que montrent les données (moyennes de zone)

Pente de Sen par décennie, test de Mann-Kendall sur les moyennes annuelles. **Gras** : significatif au seuil de 5 %.
Périodes : `t2m` et `qv2m` 1980 → 2024, `precip` 1998 → 2024, `no2` 2005 → 2024.

| Région | Température (°C) | Humidité (g/kg) | Pluie (mm/jour) | NO₂ (10¹⁵ molécules/cm²) |
|---|---|---|---|---|
| Paris | **+0,40** | **+0,10** | −0,04 | **−1,98** |
| Plaine du Pô | **+0,50** | **+0,23** | +0,05 | **−2,55** |
| Pékin | **+0,22** | **+0,19** | **+0,33** | **−4,17** |
| Los Angeles | **+0,17** | **+0,16** | +0,01 | **−4,59** |
| Dhaka | **−0,23** | **+0,57** | −0,26 | **+1,59** |
| Delhi | −0,12 | **+0,48** | +0,12 | −0,30 |
| Sahel | **+0,12** | **+0,23** | +0,06 | +0,03 |
| Svalbard | **+0,70** | **+0,12** | +0,05 | pas de mesure (nuit polaire) |
| Espagne centrale | **+0,34** | **+0,13** | −0,04 | **−0,30** |
| Amazonie centrale | **+0,31** | **+0,08** | −0,11 | +0,02 |
| France | **+0,39** | **+0,15** | −0,06 | **−0,53** |

Lecture :

- **Température** : hausse significative presque partout ; le Svalbard (+0,70) se réchauffe environ 1,75 fois plus vite
  que Paris (+0,40). Exception : Dhaka, en baisse significative, et Delhi, sans tendance : une question ouverte
  (irrigation, aérosols ?), à présenter comme telle.
- **Humidité** : hausse significative dans les 11 régions, cohérente avec un air plus chaud qui retient plus de vapeur.
- **Pluie** : une seule tendance significative (Pékin). La pluie varie tellement d'une année à l'autre que 27 ans ne
  suffisent pas : c'est un résultat en soi.
- **NO₂** : forte baisse dans les villes d'Europe, des États-Unis et de Chine ; **hausse à Dhaka**. C'est la même
  variable avec des sens opposés : le cœur du défi.
- **Pékin et la période** : NO₂ sans tendance significative de 2005 à 2011 (p = 0,23), puis forte baisse de 2012
  à 2024 (−7,7 par décennie, p < 0,001).

## 3. Zone ou point ?

Sur 43 paires, le verdict diffère entre moyenne de zone et point central dans 3 cas : température au Sahel, humidité en
Amazonie, NO₂ sur la France (significatifs en zone, pas au point). La moyenne de zone lisse le bruit local : elle est
plus représentative de la région et c'est elle que l'application affiche. La série point reste en cache pour comparaison.
