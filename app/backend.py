"""Seul point d'accès de l'app au moteur (utilisé par l'API web et par l'app Streamlit de secours).

TREND_MOCK=0 : vrai moteur (trend.catalog, trend.data, trend.stats, trend.advisor) ; TREND_MOCK=1 : module local `mock`.
Sans réglage : le vrai moteur si data/cache contient des séries, sinon le mock. Le reste de l'app n'importe que ce fichier.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

_CACHE = Path(__file__).resolve().parents[1] / "data" / "cache"
_choix = os.environ.get("TREND_MOCK")
# Sans réglage explicite : vrai moteur dès que le cache contient des séries, sinon mock.
MOCK = (_choix != "0") if _choix is not None else not any(_CACHE.glob("*__*__*.csv"))

if MOCK:
    from mock import analyser as _analyser
    from mock import charger_regions as _charger_regions
    from mock import charger_scenarios as _charger_scenarios
    from mock import charger_variables as _charger_variables
    from mock import get_series as _get_series
else:
    from trend.catalog import charger_regions as _charger_regions
    from trend.catalog import charger_scenarios as _charger_scenarios
    from trend.catalog import charger_variables as _charger_variables
    from trend.data import get_series as _get_series
    from trend.stats import analyser as _analyser

# L'assistant IA est un bonus : s'il n'est pas importable, l'app masque ses fonctions.
try:
    if MOCK:
        from mock import expliquer, suggerer
    else:
        from trend.advisor import expliquer, suggerer
    ADVISOR = True
except Exception:  # module vide, absent, ou erreur à l'import
    suggerer = expliquer = None
    ADVISOR = False

# Réponse libre de Trendbot (agent IA) : seulement avec le vrai moteur ; None = le front utilise ses règles.
try:
    if MOCK:
        raise ImportError
    from trend.advisor import repondre
except Exception:
    def repondre(question, resultat=None, langue="fr", historique=None):  # noqa: ARG001
        return None


# Les résultats sont mis en cache par identifiants (chaînes) : une analyse n'est calculée qu'une fois.
# Les exceptions (KeyError, FileNotFoundError, ValueError) ne sont pas mises en cache.
@lru_cache(maxsize=1)
def variables():
    return _charger_variables()


@lru_cache(maxsize=1)
def regions():
    return _charger_regions()


@lru_cache(maxsize=1)
def scenarios():
    return _charger_scenarios()


@lru_cache(maxsize=256)
def serie(variable_id: str, region_id: str):
    return _get_series(variable_id, region_id)


@lru_cache(maxsize=4096)
def resultat(variable_id: str, region_id: str, debut: str | None = None, fin: str | None = None):
    return _analyser(serie(variable_id, region_id), debut, fin)


def disponible(variable_id: str, region_id: str) -> bool:
    """Le contrat n'a pas de champ « disponible » : on s'appuie sur Region.variables_suggerees."""
    return variable_id in regions()[region_id].variables_suggerees
