import numpy as np
import pandas as pd
import pytest

from conftest import serie_synthetique
from trend import data
from trend.catalog import charger_variables


def test_conversions():
    v = charger_variables()
    s = pd.Series([273.15, 293.15])
    assert np.allclose(data.convertir(v["t2m"], s, "K"), [0, 20])
    assert np.allclose(data.convertir(v["qv2m"], pd.Series([0.007]), "kg kg-1"), [7.0])
    assert np.allclose(data.convertir(v["precip"], pd.Series([0.1]), "mm/hr"), [2.4])
    assert np.allclose(data.convertir(v["no2"], pd.Series([4.2e15]), "molecules/cm^2"), [4.2])
    with pytest.raises(ValueError):
        data.convertir(v["t2m"], s, "mm/hr")


def test_agregation_mensuelle_no2():
    idx = pd.date_range("2020-01-01", "2020-02-29", freq="D")
    s = pd.Series(np.nan, index=idx)
    s[idx.month == 1] = 2.0  # 31 jours valides
    s[(idx.month == 2) & (idx.day <= 3)] = 5.0  # 3 jours seulement : mois rejeté
    m = data.agreger_mensuel(s)
    assert m[pd.Timestamp("2020-01-01")] == 2.0 and np.isnan(m[pd.Timestamp("2020-02-01")])


def test_normaliser_index():
    s = pd.Series([1.0, 2.0], index=pd.DatetimeIndex(["1980-01-01", "1980-03-01"]))
    n = data.normaliser_index(s, "1980-01", "1980-04")
    assert list(n.index.strftime("%Y-%m")) == ["1980-01", "1980-02", "1980-03", "1980-04"]
    assert n.isna().sum() == 2


def test_cache_lecture_et_preference_zone(tmp_path, monkeypatch):
    monkeypatch.setattr(data, "CACHE_DIR", tmp_path)
    point = serie_synthetique(pente_decennie=0.3)
    data.ecrire_cache(point, {"test": True})
    lu = data.get_series("t2m", "paris")
    assert lu.origine == "point" and len(lu.valeurs) == 540 and lu.variable.unite == "°C"
    zone = serie_synthetique(pente_decennie=0.6)
    zone.origine = "zone"
    data.ecrire_cache(zone)
    assert data.get_series("t2m", "paris").origine == "zone"
    assert data.origines_disponibles("t2m", "paris") == ["zone", "point"]
    manifeste = (tmp_path / "manifest.json").read_text()
    assert "t2m__paris__zone" in manifeste and "t2m__paris__point" in manifeste


def test_erreurs_du_contrat(tmp_path, monkeypatch):
    monkeypatch.setattr(data, "CACHE_DIR", tmp_path)
    with pytest.raises(KeyError):
        data.get_series("inconnue", "paris")
    with pytest.raises(KeyError):
        data.get_series("t2m", "atlantide")
    with pytest.raises(FileNotFoundError):
        data.get_series("t2m", "paris")
