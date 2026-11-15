# Décisions : variables et régions

> Décidé le 2026-11-14 à partir de données réelles (criblage de 4 variables × 14 régions candidates, API Giovanni point).
> Ces choix sont reportés dans `docs/CONTRAT.md` (section 3), qui fait foi.

## 1. Les 4 variables retenues

| id | Variable | Jeu de données NASA (identifiant Giovanni) | Période | Unité d'affichage |
|---|---|---|---|---|
| `t2m` | Température de l'air à 2 m | MERRA-2 `M2IMNXASM_5_12_4_T2M` | 1980-01 → 2024-12 (45 ans) | °C |
| `qv2m` | Humidité de l'air (humidité spécifique à 2 m) | MERRA-2 `M2IMNXASM_5_12_4_QV2M` | 1980-01 → 2024-12 (45 ans) | g de vapeur d'eau / kg d'air |
| `precip` | Précipitations | GPM IMERG V07 mensuel `GPM_3IMERGM_07_precipitation` | 1998-01 → 2024-12 (27 ans) | mm/jour |
| `no2` | Dioxyde d'azote (NO₂) troposphérique | OMI `OMNO2d_003_ColumnAmountNO2TropCloudScreened` (journalier, agrégé en mensuel) | 2004-10 → 2024-12 (20 ans) | 10¹⁵ molécules/cm² |

Conversions à faire côté data : T2M de K en °C ; QV2M de kg/kg en g/kg (× 1000) ; GPM de mm/h en mm/jour (× 24) ; NO₂ ÷ 10¹⁵, moyenne mensuelle des jours valides (au moins 5 jours valides par mois).

Les 4 variables couvrent 3 sources NASA différentes (MERRA-2, GPM, OMI) et 3 durées (20, 27 et 45 ans), ce qui permet de montrer l'effet de la longueur de la période sur la significativité.

## 2. Ce qu'on a écarté, et pourquoi

| Option écartée | Raison (vérifiée sur les données) |
|---|---|
| **Humidité du sol GLDAS 2.1** (`GLDAS_NOAH025_M_2_1_SoilMoi0_10cm_inst`) | Sur la même période 2000-2014, GLDAS 2.1 et GLDAS 2.0 donnent des **tendances de signe opposé** dans 3 régions sur 5 (Sahel : −0,88 significatif en 2.1 contre +0,09 en 2.0 ; Sibérie −0,50 contre +0,76 ; Amazonie −0,43 contre +0,36). Les tendances de la 2.1 dépendent des données d'entrée du modèle, pas seulement du climat. L'outil afficherait une fausse tendance. |
| Humidité du sol GLDAS 2.0 | Fiable mais **s'arrête en 2014**. Possible en variable bonus si l'équipe y tient, avec un avertissement clair. |
| Température MERRA-2 `M2TMNXSLV` | Non servie par Giovanni (voir `spike/RAPPORT.md`). |
| Précipitations MERRA-2 mensuelles | Non servies par Giovanni (seulement l'horaire, trop lourd). |
| NO₂ au Svalbard | Pas de mesure pendant la nuit polaire : série trop incomplète. |

## 3. Criblage : tendances au point central (pente par décennie)

> Mise à jour du 2026-11-15 : les tendances recalculées en **moyenne de zone** (séries utilisées par l'app) sont dans `docs/data_choices.md`, section 2. Les 4 histoires de la démo tiennent.

En **gras ✓** : significatif au seuil de 5 % (Mann-Kendall sur moyennes annuelles des anomalies). Point de grille au centre de la région, pas encore la moyenne de zone.

| Région | t2m (°C/déc) | qv2m (g/kg/déc) | precip (mm/j/déc) | no2 (10¹⁵/déc) |
|---|---|---|---|---|
| paris | **+0,41** ✓ | **+0,10** ✓ | +0,05 | **−2,99** ✓ |
| po | **+0,52** ✓ | **+0,26** ✓ | +0,03 | **−3,72** ✓ |
| pekin | **+0,26** ✓ | **+0,18** ✓ | **+0,34** ✓ | **−5,77** ✓ |
| los_angeles | **+0,17** ✓ | **+0,16** ✓ | +0,00 | **−5,84** ✓ |
| dhaka | **−0,20** ✓ | **+0,58** ✓ | −0,28 | **+2,16** ✓ |
| delhi | −0,11 | **+0,48** ✓ | +0,12 | −0,40 |
| mpumalanga | **+0,25** ✓ | −0,03 | +0,03 | **−2,47** ✓ |
| sahel | **+0,13** ✓ | **+0,22** ✓ | +0,00 | **+0,10** ✓ |
| svalbard | **+0,78** ✓ | **+0,12** ✓ | +0,07 | n/d |
| espagne | **+0,37** ✓ | **+0,14** ✓ | −0,02 | **−0,72** ✓ |
| amazonie | **+0,24** ✓ | **+0,12** ✓ | −0,20 | **−0,20** ✓ |
| californie | **+0,36** ✓ | **+0,09** ✓ | +0,04 | **−0,70** ✓ |
| siberie | **+0,31** ✓ | **+0,07** ✓ | −0,06 | −0,01 |
| murray_darling | **+0,20** ✓ | **+0,18** ✓ | +0,09 | −0,07 |

Ce que ça raconte :
- **Température** : hausse significative presque partout ; le Svalbard (Arctique) se réchauffe environ 2 fois plus vite que Paris.
- **Humidité de l'air** : hausse quasi générale, cohérente avec la physique (un air plus chaud contient plus de vapeur d'eau).
- **Précipitations** : presque jamais significatives en 27 ans. C'est un résultat en soi : la pluie varie tellement d'une année à l'autre qu'il faut des séries plus longues.
- **NO₂** : forte baisse dans les villes d'Europe, des États-Unis et en Chine ; **hausse à Dhaka**. C'est exactement « une même variable, des sens opposés ».
- **Pékin** : le NO₂ est stable de 2005 à 2011 (−1,0/déc, p = 0,56), puis chute à partir de 2012 (−9,2/déc, p < 0,001). Idéal pour le curseur de période.

Points à manier avec prudence (ne pas les mettre en avant dans la démo sans vérification) :
- **Dhaka et Delhi : température stable ou en baisse dans MERRA-2**, alors que l'humidité monte fortement. Une explication possible est l'irrigation et les aérosols, mais ce n'est pas vérifié ; à présenter comme une question ouverte.
- **Delhi : NO₂ sans tendance significative** au point central. À recontrôler avec la moyenne de zone.

## 4. Les 10 régions retenues

| id | Région | Type | Ce qu'elle montre | bbox proposée (ouest, sud, est, nord) |
|---|---|---|---|---|
| `paris` | Paris | ville | 3 variables, 3 verdicts : chaleur ↑, NO₂ ↓, pluie sans tendance | 1.8, 48.6, 2.9, 49.1 |
| `po` | Plaine du Pô | agricole et industrielle | Réchauffement le plus fort d'Europe du panel, NO₂ ↓ | 8.5, 44.6, 12.0, 45.8 |
| `pekin` | Pékin | ville | NO₂ stable puis effondrement après 2012 ; seule pluie significative | 115.9, 39.5, 116.9, 40.3 |
| `los_angeles` | Los Angeles | ville | Plus forte baisse de NO₂ du panel | -118.7, 33.7, -117.6, 34.3 |
| `dhaka` | Dhaka (delta du Gange) | ville / delta | NO₂ ↑ : le contre-exemple ; humidité ↑ forte | 90.0, 23.5, 90.8, 24.1 |
| `delhi` | Delhi | ville | Enquête ouverte : humidité ↑, NO₂ et température sans tendance nette | 76.8, 28.3, 77.6, 28.9 |
| `sahel` | Sahel (Niger, Mali, Burkina) | semi-aride | Pluie sans tendance significative : « on ne sait pas encore » | -5.0, 12.0, 15.0, 16.0 |
| `svalbard` | Svalbard | arctique | Réchauffement record (≈ 2 × Paris) | 10.0, 76.5, 28.0, 80.5 |
| `espagne` | Espagne centrale | méditerranéen | Réchauffement fort, pluie sans tendance | -6.0, 38.5, -1.0, 41.5 |
| `amazonie` | Amazonie centrale | forêt tropicale | Réchauffement significatif d'une forêt tropicale | -65.0, -8.0, -55.0, -1.0 |

Écartées : `californie` (redondant avec Los Angeles), `siberie` (le Svalbard couvre l'Arctique), `murray_darling` (tendances faibles), `mpumalanga` (baisse de NO₂ déjà montrée ailleurs, moins connu du public). `france` reste disponible comme région de test (déjà calculée dans le spike).

Les bbox font au moins 0,5° de côté pour contenir plusieurs cellules MERRA-2 (grille 0,5° × 0,625°). **L'équipe data recalcule les tendances en moyenne de zone** et met à jour ce tableau ; si une histoire ne tient plus, on change la région plutôt que forcer l'histoire.

## 5. Scénarios de démonstration retenus

1. **« Paris : trois enquêtes, trois verdicts »** (`t2m`, `no2`, `precip` sur `paris`) : l'outil sait dire « hausse », « baisse » et « pas de tendance ».
2. **« Même pollution, destins opposés »** (`no2`, comparaison `los_angeles` / `dhaka`) : le cœur du titre du défi.
3. **« Pékin : le moment où tout bascule »** (`no2`, `pekin`, curseur 2005-2011 puis 2012-2024) : la tendance dépend de la période choisie.
4. *(optionnel)* **« L'Arctique se réchauffe deux fois plus vite »** (`t2m`, comparaison `svalbard` / `paris`).

## 6. Moyenne de zone (Harmony) : statut par variable

Testé le 2026-11-14 sur la bbox France (lon −5 à 9, lat 42 à 51), période complète, 3 calculs lancés en parallèle :

| Variable | Statut | Durée | Contenu | Point d'attention pour le code data |
|---|---|---|---|---|
| `t2m` | ✅ (spike) | 39 à 153 s | 540 mois | Unité absente du CSV : la lire dans le CMR |
| `qv2m` | ✅ | 97 s | 540 mois | Même format que `t2m`, en kg/kg |
| `precip` | ✅ | 118 s | 324 mois (1998-2024) | En mm/h ; valeur de remplissage −9999.9 |
| `no2` | ✅ | 102 s | 7 361 jours, 0 jour manquant sur la France | Journalier : agréger en mensuel ; valeur de remplissage −1.27e30 ; la dernière ligne est datée du 31 du mois |

Coût du précalcul complet : 4 variables × 10 régions = 40 calculs. En lançant 3 à 4 calculs en parallèle (comme ce test), compter **environ 30 à 40 minutes**. Le quota consommé reste négligeable.
