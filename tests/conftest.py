"""Fixtures communes : séries synthétiques et cache temporaire."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from trend import advisor
from trend.catalog import charger_regions, charger_variables
from trend.schemas import Serie


def serie_synthetique(variable_id="t2m", region_id="paris", debut="1980-01", fin="2024-12", pente_decennie=0.4, bruit=1.0, graine=0):
    """Cycle saisonnier + tendance linéaire + bruit gaussien, dans l'unité du catalogue."""
    idx = pd.date_range(f"{debut}-01", f"{fin}-01", freq="MS")
    rng = np.random.default_rng(graine)
    t = idx.year.to_numpy() + (idx.month.to_numpy() - 0.5) / 12
    valeurs = 11 + 8 * np.cos(2 * np.pi * (idx.month.to_numpy() - 7) / 12) + pente_decennie / 10 * (t - t.mean()) + rng.normal(0, bruit, len(idx))
    return Serie(charger_variables()[variable_id], charger_regions()[region_id], pd.Series(valeurs, index=idx, name="valeur"), "point")


@pytest.fixture(autouse=True)
def sans_reseau(monkeypatch):
    """Même si une clé est dans .env, les tests n'appellent jamais OpenAI : repli, ou agent simulé (test_advisor)."""
    advisor._suggerer_ia.cache_clear()
    advisor._texte_agent.cache_clear()
    monkeypatch.setattr(advisor, "_agent", lambda: None)


@pytest.fixture
def serie_tendance():
    return serie_synthetique(pente_decennie=0.5, bruit=0.8)


@pytest.fixture
def serie_bruit():
    return serie_synthetique(pente_decennie=0.0, bruit=1.0, graine=3)
