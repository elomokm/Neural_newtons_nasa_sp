import numpy as np
import pandas as pd
import pytest

from conftest import serie_synthetique
from trend.stats import analyser, anomalies_mensuelles, moyennes_annuelles, pente_sen_ic


def test_tendance_connue_retrouvee(serie_tendance):
    r = analyser(serie_tendance)
    assert r.significatif and r.sens == "hausse" and r.p_value < 0.001
    assert abs(r.pente_decennie - 0.5) < 0.12
    assert r.ic95[0] < r.pente_decennie < r.ic95[1]
    assert abs(r.changement_total - r.pente_decennie / 10 * r.n_annees) < 1e-9
    assert not r.periode_courte and 44.9 < r.n_annees < 45.1
    assert r.droite.index.equals(r.anomalies.index)
    assert r.tests["Test"].str.contains("Mann-Kendall").sum() >= 2
    assert "prouv" not in r.resume.lower()


def test_bruit_pur_non_significatif(serie_bruit):
    r = analyser(serie_bruit)
    assert not r.significatif and abs(r.pente_decennie) < 0.1
    assert "pas de tendance significative" in r.resume


def test_anomalies_sans_saisons(serie_tendance):
    a = anomalies_mensuelles(serie_tendance.valeurs)
    par_mois = a.groupby(a.index.month).mean()
    assert np.allclose(par_mois.to_numpy(), 0, atol=1e-9)
    assert a.std() < serie_tendance.valeurs.std() / 2  # le cycle saisonnier dominait


def test_periode_et_erreurs(serie_tendance):
    r = analyser(serie_tendance, "2000-01", "2015-12")
    assert r.debut == pd.Timestamp("2000-01-01") and r.fin == pd.Timestamp("2015-12-01") and r.periode_courte
    with pytest.raises(ValueError):
        analyser(serie_tendance, "2020-01", "2023-12")
    with pytest.raises(ValueError):
        analyser(serie_tendance, "2030-01", "2035-12")


def test_valeurs_manquantes_tolerees():
    s = serie_synthetique("no2", "pekin", debut="2004-10", fin="2024-12", pente_decennie=-3, bruit=0.8, graine=5)
    v = s.valeurs.copy()
    v[v.index.month.isin([12, 1])] = np.nan  # hiver manquant, comme une station polaire
    s.valeurs = v
    r = analyser(s)
    assert r.significatif and r.sens == "baisse"
    assert moyennes_annuelles(anomalies_mensuelles(v)).notna().all()


def test_ic_sen_contient_la_pente():
    t = np.arange(30, dtype=float)
    y = 0.3 * t + np.random.default_rng(2).normal(0, 1, 30)
    import pymannkendall as mk

    res = mk.original_test(y)
    pente, bas, haut = pente_sen_ic(t, y, res.var_s)
    assert bas < pente < haut and abs(pente - 0.3) < 0.1


def test_serie_reelle_du_spike():
    """Température de Paris (MERRA-2, spike) : ordre de grandeur connu, +0,4 °C par décennie."""
    df = pd.read_csv("spike/data/t2m_paris_point.csv", parse_dates=["date"])
    s = serie_synthetique()
    s.valeurs = pd.Series(df["valeur"].to_numpy() - 273.15, index=pd.DatetimeIndex(df["date"]))
    r = analyser(s)
    assert r.significatif and 0.3 < r.pente_decennie < 0.5 and r.p_value < 1e-4
