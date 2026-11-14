# Contrat d'API Earth Detective

Le front est branché sur le back par une seule ligne : `src/config.js` → `backendUrl: 'http://localhost:8000'`
(ou `?backend=http://localhost:8000` dans l'URL). Sans back, il interroge NASA POWER directement.
Tous les champs marqués optionnels s'affichent « – » s'ils sont absents. CORS doit être activé.

## POST /analyze
Requête : `{ "lat": 48.85, "lon": 2.35, "variable": "T2M", "start": 1996, "end": 2025, "alpha": 0.05 }`
Variables : `T2M`, `PRECTOTCORR`, `RH2M`, `SOIL`, `NO2`
- `SOIL` = NASA POWER `GWETTOP` × 100 (humidité de surface du sol, %).
- `NO2` = colonne troposphérique de NO₂ (unité 10¹⁵ molécules/cm²), **absente de NASA POWER**. Source conseillée : OMI OMNO2d (GES DISC, depuis 2005). Elle doit être servie par le backend ; sans backend, le front affiche un message explicite.

Réponse :
```json
{
  "annual":  [{"year": 1996, "value": 11.2}],
  "monthly": [{"year": 1996, "month": 1, "value": 4.1}],
  "seasonal": [{"month": 1, "slope_per_decade": 0.3, "ci95": [0.1, 0.5], "p_value": 0.02}],
  "trend": {
    "direction": "up|down|inconclusive",
    "slope_per_decade": 0.35, "ci95": [0.14, 0.56], "p_value": 0.001, "significant": true,
    "method": "mann-kendall|hamed-rao", "total_change": 1.01, "mean": 12.1, "sd": 0.6,
    "intercept_per_year": -20.2, "z": 3.3, "autocorr1": 0.12,
    "mk": {"tau": 0.4, "s": 120, "z": 3.3, "p": 0.001},
    "hamed_rao": {"z": 2.9, "p": 0.004},
    "ols": {"slope_per_decade": 0.33, "ci95": [0.1, 0.5], "p": 0.003},
    "seasonal_mk": {"z": 3.1, "p": 0.002}
  },
  "meta": {"source": "MERRA-2", "cell": {"lat": 49.0, "lon": 2.5}, "full_period": [1981, 2025]},
  "full_annual": [{"year": 1981, "value": 10.8}]
}
```
Seuls `annual`, `monthly` et `trend.slope_per_decade`, `trend.p_value`, `trend.direction` sont indispensables.

## GET /atlas?variable=T2M&start=1996&end=2025&alpha=0.05
`{ "points": [{"id": "paris", "lat": 48.85, "lon": 2.35, "slope_per_decade": 0.5, "p_value": 0.001, "direction": "up"}] }`
Les ids sont ceux des 30 lieux de `src/content.js` (PLACES).

## Règles à respecter côté calcul (important)

- **Précipitations (`PRECTOTCORR`)** : POWER renvoie des mm/jour. Le cumul annuel = somme sur les 12 mois de (taux × nombre de jours du mois). Ne jamais faire la moyenne des taux. Le navigateur fait déjà cette conversion (`agg: 'sum_rate'`).
- **`direction`** : `up`, `down` ou `inconclusive`. Les libellés pymannkendall (`increasing`, `decreasing`, `no trend`) sont aussi acceptés et normalisés par le front.
- **Années valides** : seules les années de 12 mois complets entrent dans le calcul annuel.
- **Intervalle de pente** : Theil-Sen classique. Il n'est pas corrigé de l'autocorrélation (seule la p-valeur l'est avec Hamed-Rao). Ne pas le présenter comme corrigé.
- **Stabilité** : doit utiliser le même test que le verdict principal.
