"""Seul point d'accès de l'app au moteur (utilisé par l'API web et par l'app Streamlit de secours).

TREND_MOCK=0 : vrai moteur (trend.catalog, trend.data, trend.stats, trend.advisor).
Sinon (par défaut) : module local `mock`. Le reste de l'app n'importe que ce fichier.
"""
from __future__ import annotations

import os
from functools import lru_cache

MOCK = os.environ.get("TREND_MOCK", "1") != "0"

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
