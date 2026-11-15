"""Accès aux séries : lecture du cache local (jamais d'appel réseau), et appel live sur un point (bonus).

Cache : data/cache/<variable>__<region>__<origine>.csv, colonnes date, valeur, unite (valeurs DÉJÀ converties
dans l'unité d'affichage du catalogue). Si une moyenne de zone existe, elle est préférée à la série point.
"""
from __future__ import annotations

import json
import threading
from pathlib import Path

import pandas as pd

from trend.catalog import charger_regions, charger_variables
from trend.config import CACHE_DIR, FIN_PERIODE
from trend.schemas import Region, Serie, Variable

ORIGINES = ("zone", "point")  # ordre de préférence
MIN_JOURS_VALIDES = 5  # NO₂ journalier : un mois compte s'il a au moins 5 jours mesurés
_VERROU = threading.Lock()  # le manifeste est partagé entre les téléchargements parallèles


def _facteur(unite_brute: str) -> tuple[str, float, float]:
    """(famille, facteur, décalage) : valeur_affichée = valeur_brute × facteur + décalage."""
    u = (unite_brute or "").strip().lower()
    if u in ("k", "kelvin"):
        return "kelvin", 1.0, -273.15
    if u in ("kg kg-1", "kg/kg", "kg kg**-1", "kg kg^-1"):
        return "kg/kg", 1000.0, 0.0
    if u in ("mm/hr", "mm/h", "mm hr-1", "mm hr^-1", "mm h-1"):
        return "mm/h", 24.0, 0.0
    if "molec" in u and "cm" in u:
        return "molecules/cm2", 1e-15, 0.0
    return "inconnue", 1.0, 0.0


def convertir(variable: Variable, brut: pd.Series, unite_brute: str) -> pd.Series:
    """Convertit une série brute Giovanni dans l'unité d'affichage du catalogue."""
    famille, facteur, decalage = _facteur(unite_brute)
    attendu = {"t2m": "kelvin", "qv2m": "kg/kg", "precip": "mm/h", "no2": "molecules/cm2"}.get(variable.id)
    if attendu and famille != attendu:
        raise ValueError(f"{variable.id} : unité brute inattendue « {unite_brute} » (attendu {attendu}).")
    return brut * facteur + decalage


def agreger_mensuel(journalier: pd.Series, min_jours: int = MIN_JOURS_VALIDES) -> pd.Series:
    """Journalier -> mensuel (1er du mois) : moyenne des jours valides, NaN si moins de `min_jours`."""
    g = journalier.groupby(journalier.index.to_period("M"))
    moyenne = g.mean()
    moyenne[g.count() < min_jours] = float("nan")
    moyenne.index = moyenne.index.to_timestamp()
    return moyenne


def normaliser_index(valeurs: pd.Series, debut: str, fin: str = FIN_PERIODE) -> pd.Series:
    """Index mensuel complet (1er du mois) entre debut et fin ; les mois absents deviennent NaN."""
    valeurs = valeurs.copy()
    valeurs.index = pd.DatetimeIndex(valeurs.index).to_period("M").to_timestamp()
    valeurs = valeurs[~valeurs.index.duplicated(keep="first")]
    index = pd.date_range(f"{debut}-01", f"{fin}-01", freq="MS")
    return valeurs.reindex(index).astype(float).rename("valeur")


# --- Cache -----------------------------------------------------------------------------------

def chemin_cache(variable_id: str, region_id: str, origine: str) -> Path:
    return CACHE_DIR / f"{variable_id}__{region_id}__{origine}.csv"


def ecrire_cache(serie: Serie, meta: dict | None = None) -> Path:
    """Écrit la série (déjà convertie) et met à jour data/cache/manifest.json."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    chemin = chemin_cache(serie.variable.id, serie.region.id, serie.origine)
    df = pd.DataFrame({"date": serie.valeurs.index.strftime("%Y-%m-%d"), "valeur": serie.valeurs.to_numpy(), "unite": serie.variable.unite})
    df.to_csv(chemin, index=False)
    manifeste = CACHE_DIR / "manifest.json"
    with _VERROU:
        contenu = json.loads(manifeste.read_text()) if manifeste.exists() else {}
        contenu[chemin.stem] = _entree_manifeste(serie, meta)
        manifeste.write_text(json.dumps(contenu, indent=2, ensure_ascii=False, sort_keys=True))
    return chemin


def _entree_manifeste(serie: Serie, meta: dict | None) -> dict:
    return {
        "variable": serie.variable.id,
        "region": serie.region.id,
        "origine": serie.origine,
        "n": int(serie.valeurs.notna().sum()),
        "manquants": int(serie.valeurs.isna().sum()),
        "debut": serie.valeurs.index[0].strftime("%Y-%m"),
        "fin": serie.valeurs.index[-1].strftime("%Y-%m"),
        **(meta or {}),
    }


def origines_disponibles(variable_id: str, region_id: str) -> list[str]:
    return [o for o in ORIGINES if chemin_cache(variable_id, region_id, o).exists()]


def get_series(variable_id: str, region_id: str) -> Serie:
    """Lit la série en cache. KeyError si id inconnu, FileNotFoundError si la série n'est pas en cache."""
    variable = charger_variables()[variable_id]
    region = charger_regions()[region_id]
    for origine in ORIGINES:
        chemin = chemin_cache(variable_id, region_id, origine)
        if chemin.exists():
            df = pd.read_csv(chemin, parse_dates=["date"])
            valeurs = pd.Series(df["valeur"].astype(float).to_numpy(), index=pd.DatetimeIndex(df["date"]), name="valeur")
            return Serie(variable=variable, region=region, valeurs=valeurs, origine=origine)
    raise FileNotFoundError(f"Série {variable_id} / {region_id} absente du cache ({CACHE_DIR}). Lancer scripts/build_cache.py.")


# --- Bonus : appel live sur un point ----------------------------------------------------------

def get_series_point(variable_id: str, lat: float, lon: float) -> Serie:
    """Série au point de grille le plus proche, via l'API Giovanni (2 à 3 s, réseau et identifiants requis)."""
    from trend.sources import giovanni

    variable = charger_variables()[variable_id]
    brut, meta = giovanni.serie_point(variable.giovanni_id, lat, lon, variable.debut, FIN_PERIODE)
    if variable.id == "no2":
        brut = agreger_mensuel(brut)
    valeurs = normaliser_index(convertir(variable, brut, meta.get("unit", "")), variable.debut)
    lat_s, lon_s = float(meta.get("lat", lat)), float(meta.get("lon", lon))
    region = Region(
        id=f"point_{lat_s:.2f}_{lon_s:.2f}",
        nom=f"Point {lat_s:.2f}, {lon_s:.2f}",
        type="point",
        bbox=(lon_s - 0.3, lat_s - 0.25, lon_s + 0.3, lat_s + 0.25),
        centre=(lat_s, lon_s),
        histoire="Point de grille choisi librement sur la carte.",
        variables_suggerees=(variable_id,),
    )
    return Serie(variable=variable, region=region, valeurs=valeurs, origine="point")
