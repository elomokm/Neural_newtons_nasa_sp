"""Seul point d'accès de l'app au moteur.

TREND_MOCK=0 : vrai moteur (trend.catalog, trend.data, trend.stats, trend.advisor).
Sinon (par défaut) : module local `mock`. Le reste de l'app n'importe que ce fichier.
"""
from __future__ import annotations

import os

import streamlit as st

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


@st.cache_data(show_spinner=False)
def variables():
    return _charger_variables()


@st.cache_data(show_spinner=False)
def regions():
    return _charger_regions()


@st.cache_data(show_spinner=False)
def scenarios():
    return _charger_scenarios()


@st.cache_data(show_spinner=False)
def serie(variable_id: str, region_id: str):
    return _get_series(variable_id, region_id)


@st.cache_data(show_spinner=False)
def resultat(variable_id: str, region_id: str, debut: str | None = None, fin: str | None = None):
    return _analyser(serie(variable_id, region_id), debut, fin)


def disponible(variable_id: str, region_id: str) -> bool:
    """Le contrat n'a pas de champ « disponible » : on s'appuie sur Region.variables_suggerees."""
    return variable_id in regions()[region_id].variables_suggerees
