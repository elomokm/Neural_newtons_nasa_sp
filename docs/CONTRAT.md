# Contrat commun Trend Detective

Ce fichier est la **seule source de vérité** sur la façon dont les 4 parties du projet se parlent.
Personne ne change ce contrat seul : toute modification se décide en équipe, puis on met à jour ce fichier.

## Qui possède quoi

| Partie | Dossiers / fichiers | Responsables |
|---|---|---|
| Données | `src/trend/sources/`, `src/trend/data.py`, `src/trend/catalog.py`, `scripts/`, `data/catalog/*.yaml` (champs techniques), `data/cache/` | Équipe data |
| Statistiques | `src/trend/stats.py`, `tests/test_stats.py` | Équipe data (auteur du moteur) |
| Contrat | `src/trend/schemas.py`, ce fichier | Équipe data, validé par tous |
| Application | `app/` (serveur `api.py`, app de secours Streamlit), `earth-detective/` (front) | Personne app |
| IA et contenu | `src/trend/advisor.py`, `data/demos/scenarios.yaml`, champs texte des YAML (`definition`, `histoire`, `hausse_signifie`, `baisse_signifie`, `mots_cles`) | Personne agent IA |

Règle d'or : **on ne modifie pas le code d'une autre partie**. On demande à son responsable.

## Lancer le projet

```bash
PYTHONPATH=src .venv/bin/python app/api.py          # puis http://localhost:8000
```

Le serveur sert le front Earth Detective et expose ce contrat en JSON (`/api/docs`). Sans réglage, il utilise le vrai
moteur dès que `data/cache` contient des séries ; `TREND_MOCK=1` force les données simulées.
App de secours : `PYTHONPATH=src streamlit run app/streamlit_app.py`. Mise à jour du 2026-11-15 (branche `test`).

## 1. Structures de données : `src/trend/schemas.py`

Si ce fichier n'existe pas encore, il doit être créé avec **exactement** ce contenu.

```python
"""Contrat de données partagé par data, stats, app et advisor. Ne pas modifier sans accord de l'équipe."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

import pandas as pd


@dataclass(frozen=True)
class Variable:
    id: str                    # identifiant court : "t2m", "qv2m", "precip", "no2"
    giovanni_id: str           # ex. "M2IMNXASM_5_12_4_T2M"
    nom: str                   # ex. "Température de l'air à 2 m"
    definition: str            # 1 à 3 phrases compréhensibles par un lycéen
    unite: str                 # unité D'AFFICHAGE, déjà convertie : "°C", "mm/jour", "kg/m²", "10¹⁵ molécules/cm²"
    source: str                # ex. "MERRA-2 (NASA GMAO)"
    debut: str                 # premier mois disponible, "AAAA-MM"
    hausse_signifie: str       # ex. "il fait plus chaud"
    baisse_signifie: str       # ex. "il fait plus froid"
    mots_cles: tuple[str, ...] # pour la recherche et l'advisor


@dataclass(frozen=True)
class Region:
    id: str                                  # ex. "paris"
    nom: str                                 # ex. "Paris"
    type: str                                # "ville", "agricole", "forêt tropicale", "semi-aride", "arctique", "méditerranéen", "pays"
    bbox: tuple[float, float, float, float]  # (ouest, sud, est, nord) en degrés
    centre: tuple[float, float]              # (lat, lon), pour placer la région sur une carte
    histoire: str                            # 1 à 2 phrases : pourquoi cette région est intéressante
    variables_suggerees: tuple[str, ...]     # ids de Variable


@dataclass
class Serie:
    variable: Variable
    region: Region
    valeurs: pd.Series                 # index : DatetimeIndex MENSUEL (1er du mois), valeurs float dans variable.unite
    origine: Literal["zone", "point"]  # moyenne sur la bbox, ou point de grille


@dataclass
class ResultatTendance:
    serie: Serie
    debut: pd.Timestamp                # début de la période réellement analysée
    fin: pd.Timestamp
    n_annees: float
    anomalies: pd.Series               # série SANS cycle saisonnier, même index que la période
    droite: pd.Series                  # droite de tendance ajustée sur les anomalies, même index
    pente_decennie: float              # pente de Sen, en unité par décennie
    ic95: tuple[float, float]          # intervalle de confiance à 95 % de la pente, par décennie
    p_value: float                     # test de Mann-Kendall (test principal)
    significatif: bool                 # p_value < 0.05
    sens: Literal["hausse", "baisse"]  # signe de la pente (même si non significatif)
    changement_total: float            # pente × durée, en unité
    periode_courte: bool               # moins de 30 ans (recommandation OMM)
    resume: str                        # phrase simple générée sans IA, toujours disponible
    tests: pd.DataFrame                # détail : colonnes Test, Valeur, p-value, Significatif, Détail
    ruptures: list[dict] = field(default_factory=list)  # option avancée, souvent vide


@dataclass
class Suggestion:
    variable_ids: list[str]            # uniquement des ids présents dans le catalogue
    region_id: str | None              # id du catalogue, ou None si aucune région ne correspond
    explication: str                   # pourquoi ces choix, en langage simple
    source: Literal["ia", "mots_cles"] # qui a produit la suggestion (IA ou repli sans IA)
```

## 2. Fonctions publiques

| Fonction | Module | Responsable | Rôle |
|---|---|---|---|
| `charger_variables() -> dict[str, Variable]` | `trend.catalog` | data | Lit `data/catalog/variables.yaml` |
| `charger_regions() -> dict[str, Region]` | `trend.catalog` | data | Lit `data/catalog/regions.yaml` |
| `charger_scenarios() -> list[dict]` | `trend.catalog` | data | Lit `data/demos/scenarios.yaml` |
| `get_series(variable_id: str, region_id: str) -> Serie` | `trend.data` | data | Lit `data/cache/` ; **ne fait jamais d'appel réseau** si le cache existe |
| `get_series_point(variable_id: str, lat: float, lon: float) -> Serie` | `trend.data` | data | Bonus : appel live à l'API point (2 à 3 s) |
| `analyser(serie: Serie, debut: str \| None = None, fin: str \| None = None) -> ResultatTendance` | `trend.stats` | stats | `debut` / `fin` au format "AAAA-MM" ; None = toute la série |
| `suggerer(question: str) -> Suggestion` | `trend.advisor` | agent IA | Ne lève jamais d'exception : repli sans IA si besoin |
| `expliquer(resultat: ResultatTendance) -> str` | `trend.advisor` | agent IA | Reformule `resultat` ; renvoie `resultat.resume` en cas de doute |

Erreurs : `get_series` lève `KeyError` si la variable ou la région est inconnue, `FileNotFoundError` si la série n'est pas en cache. `analyser` lève `ValueError` si la période fait moins de 5 ans.

## 3. Catalogue (DÉCIDÉ le 2026-11-14)

Justification complète, données à l'appui : `docs/DECISIONS_DONNEES.md`. Les 4 variables ont été testées en série point **et** en moyenne de zone Harmony.

| id | Nom | giovanni_id | Unité d'affichage | Période |
|---|---|---|---|---|
| `t2m` | Température de l'air à 2 m | `M2IMNXASM_5_12_4_T2M` | °C | 1980-01 → 2024-12 |
| `qv2m` | Humidité de l'air (humidité spécifique à 2 m) | `M2IMNXASM_5_12_4_QV2M` | g/kg | 1980-01 → 2024-12 |
| `precip` | Précipitations | `GPM_3IMERGM_07_precipitation` | mm/jour | 1998-01 → 2024-12 |
| `no2` | Dioxyde d'azote (NO₂) troposphérique | `OMNO2d_003_ColumnAmountNO2TropCloudScreened` (journalier → mensuel) | 10¹⁵ molécules/cm² | 2004-10 → 2024-12 |

| id | Nom | Type | bbox (ouest, sud, est, nord) | Centre (lat, lon) | Variables |
|---|---|---|---|---|---|
| `paris` | Paris | ville | 1.8, 48.6, 2.9, 49.1 | 48.85, 2.35 | toutes |
| `po` | Plaine du Pô | agricole et industrielle | 8.5, 44.6, 12.0, 45.8 | 45.2, 10.25 | toutes |
| `pekin` | Pékin | ville | 115.9, 39.5, 116.9, 40.3 | 39.9, 116.4 | toutes |
| `los_angeles` | Los Angeles | ville | -118.7, 33.7, -117.6, 34.3 | 34.0, -118.15 | toutes |
| `dhaka` | Dhaka (delta du Gange) | ville | 90.0, 23.5, 90.8, 24.1 | 23.8, 90.4 | toutes |
| `delhi` | Delhi | ville | 76.8, 28.3, 77.6, 28.9 | 28.6, 77.2 | toutes |
| `sahel` | Sahel | semi-aride | -5.0, 12.0, 15.0, 16.0 | 14.0, 5.0 | toutes |
| `svalbard` | Svalbard | arctique | 10.0, 76.5, 28.0, 80.5 | 78.5, 19.0 | `t2m`, `qv2m`, `precip` (pas de NO₂ : nuit polaire) |
| `espagne` | Espagne centrale | méditerranéen | -6.0, 38.5, -1.0, 41.5 | 40.0, -3.5 | toutes |
| `amazonie` | Amazonie centrale | forêt tropicale | -65.0, -8.0, -55.0, -1.0 | -4.5, -60.0 | toutes |
| `france` | France (région de test) | pays | -5.0, 42.0, 9.0, 51.0 | 46.5, 2.0 | toutes |

Scénarios de démo retenus : voir `docs/DECISIONS_DONNEES.md`, section 5.

## 4. Format de `data/demos/scenarios.yaml`

```yaml
- id: no2_destins_opposes
  titre: "Même polluant, tendances opposées"
  accroche: "Une même variable peut monter ici et baisser là-bas."
  etapes:
    - texte: "On regarde d'abord le NO₂ au-dessus de Los Angeles."
      variable: no2
      regions: [los_angeles]         # 1 région = vue simple, 2 régions = comparaison
      periode: ["2005-01", "2024-12"]
      saisons_retirees: false
    - texte: "Retirons les saisons, puis comparons avec Dhaka."
      variable: no2
      regions: [los_angeles, dhaka]
      periode: ["2005-01", "2024-12"]
      saisons_retirees: true
```

## 5. Règles communes

- **Vocabulaire :** jamais « prouvé ». On écrit « tendance significative (au seuil de 5 %) » ou « pas de tendance significative sur cette période ».
- **Aucun chiffre inventé :** tout chiffre affiché vient de `ResultatTendance` ou des données.
- **L'app doit marcher sans réseau et sans clé d'IA** : elle lit le cache, et l'advisor a un repli sans IA. C'est indispensable pour la démo.
- **Secrets :** clés d'API uniquement dans les variables d'environnement ou dans `.env` (ignoré par git), jamais dans le code.
- **Points d'étape :** H4 = une chaîne complète (température Paris affichée dans l'app avec le vrai moteur). H20 = gel des fonctionnalités. Soumission avant H23.
