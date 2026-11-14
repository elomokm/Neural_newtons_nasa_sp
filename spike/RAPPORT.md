# Spike accès données Giovanni : T2M MERRA-2 mensuelle 1980-2024

> Statut au 2026-11-14 : **RÉUSSI**, avec un changement de collection validé par l'équipe.
> Les deux méthodes renvoient 540 points mensuels (janvier 1980 à décembre 2024), sans trou ni valeur manquante, et le cycle saisonnier est net.
> Variable utilisée : `M2IMNXASM_5_12_4_T2M` au lieu de `M2TMNXSLV_5_12_4_T2M`, que Giovanni n'expose pas (voir § 3).

## 1. Résumé

| | Point Paris | Moyenne zone France |
|---|---|---|
| Service | Giovanni Time Series API (`GET /timeseries`) | Giovanni Area-Average via Harmony (`harmony-py`) |
| Script | `test_point.py` | `test_area.py` |
| Variable | `M2IMNXASM_5_12_4_T2M` | `M2IMNXASM_5_12_4_T2M` |
| Emprise | lat 48.85, lon 2.35 → point de grille servi : **49.0 N, 2.5 E** | bbox lon -5 à 9, lat 42 à 51 |
| Temps de réponse | **2,4 s** (3,2 s au premier essai) | **38,9 s** (152,8 s au premier essai), mode asynchrone |
| Points obtenus | **540** | **540** |
| Unité | K (fournie dans l'en-tête de la réponse) | K (absente du CSV, lue dans le CMR) |
| Quota consommé | ~5,4 × 10⁻⁹ (0,0000005 %) | ~2,2 × 10⁻⁶ (0,0002 %) |
| Sorties | `data/t2m_paris_point.csv`, `plot_point.png` | `data/t2m_france_area.csv`, `plot_area.png` |

Contrôle qualité sur les deux CSV : 540 lignes, 0 NaN, 0 doublon, 0 mois manquant entre 1980-01 et 2024-12, aucune valeur égale à la valeur de remplissage.

| | Min | Max | Moyenne janvier | Moyenne juillet |
|---|---|---|---|---|
| Paris (point) | 269,8 K | 296,1 K | 275,9 K | 292,2 K |
| France (zone) | 272,9 K | 296,0 K | 277,6 K | 292,4 K |

Ces ordres de grandeur sont plausibles (≈ 3 °C en janvier, ≈ 19 °C en juillet). La zone a des hivers plus doux que le point, car elle inclut des régions océaniques et méditerranéennes.

## 2. Environnement et lancement

- venv isolé `spike/.venv` (Python 3.12, créé avec `uv`), dépendances figées dans `requirements.txt` : earthaccess 0.19.0, harmony-py 1.8.0, pandas 3.1.1, matplotlib 3.11.2, requests 2.34.2
- Auth : `earthaccess.login()` (variables `EARTHDATA_USERNAME`/`EARTHDATA_PASSWORD`, puis `~/.netrc`), token via `earthaccess.get_edl_token()`. Aucun identifiant dans le code.
- Lancement :
  ```
  cd spike
  .venv/bin/python test_point.py --variable M2IMNXASM_5_12_4_T2M
  .venv/bin/python test_area.py  --variable M2IMNXASM_5_12_4_T2M
  ```
- Chaque exécution écrit un journal `data/<point|area>_run.json` (statut, temps, quota avant/après, métadonnées) et conserve la réponse brute dans `data/raw/`.
- Format des CSV produits : `date` (AAAA-MM-01), `valeur` (float), `unite`.

## 3. Collection demandée non disponible : M2TMNXSLV

`M2TMNXSLV_5_12_4_T2M` est absente de la liste publique des variables Giovanni (`https://api.giovanni.earthdata.nasa.gov/configured-variables/`, 867 variables). Les deux services la rejettent avec un token valide :

- **Time Series** (1,3 s) : HTTP 403, `{"code": "400", "message": "Bad or missing input", "context": "Data parameter is invalid"}`
- **Harmony Area-Average** (0,6 s, aucun job créé) : HTTP 422, `the requested combination of operations: variable subsetting and area averaging on C1276812859-GES_DISC is unsupported`

La collection existe pourtant dans le CMR (`C1276812859-GES_DISC`) : Giovanni ne la sert simplement pas.

Variables T2M MERRA-2 servies par Giovanni : `M2IMNXASM_5_12_4_T2M` (mensuelle), `M2SDNXSLV_5_12_4_T2MMEAN` (journalière), `M2T1NXSLV_5_12_4_T2M` (horaire).
**Choix validé : `M2IMNXASM_5_12_4_T2M`** (collection instM_2d_asm_Nx, DOI 10.5067/5ESKGQTZG7FO, CMR `C1276812823-GES_DISC`, grille 0,5° × 0,625°).
Différence : M2TMNXSLV est une moyenne mensuelle de valeurs horaires ; M2IMNXASM est une moyenne mensuelle de valeurs instantanées (toutes les 3 h). L'écart est faible pour des moyennes mensuelles, mais il faudra le mentionner dans la méthode.

## 4. Format brut des réponses

### Time Series (point)

Texte CSV, 14 lignes `clé,valeur`, une ligne vide, puis l'en-tête des données (`data/raw/point_M2IMNXASM_5_12_4_T2M.txt`) :

```
prod_name,M2IMNXASM.5.12.4
doi,10.5067/5ESKGQTZG7FO
param_short_name,T2M
param_name,2-meter air temperature
unit,K
undef,1e+15
begin_time,1980-01-01 00:00:00
end_time,2024-12-01 00:00:00
lat,49.0
lon,2.5
lat_resolution,0.5
lon_resolution,0.625
mean,2.8382e+02
Request_time,2026-11-14 11:52:38

Timestamp (UTC),Data
1980-01-01 00:00,273.185
...
```

- Le notebook officiel annonce 13 lignes d'en-tête ; il y en a 14 plus une ligne vide. Le parseur cherche la ligne `Timestamp` au lieu de compter les lignes.
- `lat`/`lon` donnent le point de grille réellement servi (49.0, 2.5), et non les coordonnées demandées.
- Réponse synchrone, 13,7 ko pour 45 ans.

### Area-Average (Harmony)

Fichier CSV téléchargé (`data/raw/GIOVANNI-areaAvgTimeSeries.M2IMNXASM_5_12_4_T2M.19800101-20241231.5W_42N_9E_51N.csv`) : 4 lignes d'en-tête, une ligne `,`, puis les données :

```
User Start Date:,1980-01-01T00:00:00.000Z
User End Date:,2024-12-31T23:59:59.000Z
User Bounding Box:,"-5, 42, 9, 51"
Fill Value:,999999986991104.0
,
time,mean_M2IMNXASM_5_12_4_T2M
1980-01-01T00:00:00,275.896
...
```

- **Pas d'unité dans le fichier.** Elle est lue dans les métadonnées UMM-Var du CMR (variable `V3379566904-GES_DISC`, `Units: K`), en filtrant sur la collection, car le nom `T2M` existe dans plusieurs collections.
- Traitement asynchrone : `submit` → job Harmony → `download_all`. Statut final `successful`, progression 100 %. Les sorties restent disponibles côté Harmony jusqu'au 2026-12-14.
- Les clés de l'en-tête se terminent par `:` (ex. `Fill Value:`).

### Quota

`GET /quota` → `{"status":200,"quota":<fraction du quota mensuel consommée, 0..1>}`

## 5. Quota consommé

| Étape | Quota avant | Quota après |
|---|---|---|
| Appels rejetés (M2TMNXSLV, point et zone) | 0 | 0 |
| Diagnostic point M2IMNXASM, année 1980 | 0 | 1,3 × 10⁻¹⁰ |
| Point 1980-2024 (essai 1, plantage de mon code après réception) | 1,3 × 10⁻¹⁰ | 5,54 × 10⁻⁹ |
| Point 1980-2024 (essai 2, OK) | 5,54 × 10⁻⁹ | 1,095 × 10⁻⁸ |
| Zone 1980-2024 (essai 1, OK sans unité) | 1,095 × 10⁻⁸ | 2,25 × 10⁻⁶ |
| Zone 1980-2024 (essai 2, OK avec unité) | 2,25 × 10⁻⁶ | 4,49 × 10⁻⁶ |

**Total consommé : 4,49 × 10⁻⁶ du quota mensuel (0,00045 %). Restant : ≈ 99,9996 %.**
Une série zone de 45 ans coûte environ 400 fois plus qu'une série point, mais reste négligeable : on pourrait en lancer plusieurs milliers par mois.

## 6. Erreurs rencontrées et résolutions

| Erreur | Cause | Résolution |
|---|---|---|
| Script bloqué indéfiniment sans identifiants | `earthaccess.login(strategy="all")` finit par une invite interactive | Essai explicite de `environment` puis `netrc`, puis arrêt avec un message clair |
| `TypeError: 'str' object is not callable` sur `.concept_id()` | Le notebook officiel appelle une méthode ; dans earthaccess 0.19, c'est un attribut | `.concept_id` sans parenthèses |
| Time Series : `Data parameter is invalid` | `M2TMNXSLV_5_12_4_T2M` non configurée dans Giovanni | Passage à `M2IMNXASM_5_12_4_T2M`, validé par l'équipe |
| Harmony : `variable subsetting and area averaging ... is unsupported` | Même cause, côté Harmony | Idem |
| `AttributeError: 'Series' object has no attribute 'strftime'` | Bug dans mon code (`Series.strftime` au lieu de `Series.dt.strftime`) | Corrigé dans `common.save_series` |
| Unité « inconnue » dans le CSV zone | Le CSV Area-Average ne contient pas l'unité | Lecture de l'unité dans le CMR (`common.cmr_unit`) |

## 7. Points d'attention pour la suite

- **Temps Harmony variable** : 153 s puis 39 s pour la même requête. Il faut prévoir une attente asynchrone et ne pas appeler Harmony pendant une interaction utilisateur sans cache.
- **Point ≠ coordonnées demandées** : la Time Series renvoie le point de grille le plus proche. Il faudra afficher les coordonnées réellement servies.
- **Liste des variables** : `configured-variables` est la source de vérité. Il faut la vérifier avant de proposer une variable dans l'outil.
- **Formats hétérogènes** entre les deux services (en-têtes, nom de la colonne de temps, présence de l'unité) : il faudra une couche de normalisation, comme `save_series` ici.
- **Earthdata** : le token EDL est valable 24 h et peut être réutilisé entre requêtes.

## 8. Conclusion

L'accès aux données Giovanni en Python fonctionne pour les deux méthodes, de bout en bout : authentification, vérification du quota, série point synchrone en quelques secondes, moyenne de zone asynchrone en moins de 3 minutes. Les séries obtenues sont complètes (540 mois) et cohérentes. Le coût en quota est négligeable.
Seule réserve : la collection M2TMNXSLV n'est pas servie par Giovanni. Le projet doit donc partir de la liste des variables configurées, et non du catalogue MERRA-2 complet.
