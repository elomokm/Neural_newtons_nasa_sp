"""Accès aux séries Giovanni (NASA GES DISC).

Deux services, validés par le spike (spike/RAPPORT.md) :
- série **point** : Giovanni Time Series API, synchrone, 2 à 3 s ;
- moyenne de **zone** : Giovanni Area-Average via Harmony, asynchrone, 40 à 150 s.

Identifiants Earthdata : variables EARTHDATA_USERNAME / EARTHDATA_PASSWORD, sinon ~/.netrc. Jamais dans le code.
Les valeurs renvoyées sont BRUTES (unité de la source) : la conversion est faite dans trend.data.
"""
from __future__ import annotations

import datetime as dt
import io
import tempfile
from pathlib import Path

import pandas as pd
import requests

TIMESERIES_URL = "https://api.giovanni.earthdata.nasa.gov/timeseries"
QUOTA_URL = "https://api.giovanni.earthdata.nasa.gov/quota"
CMR_VARIABLES_URL = "https://cmr.earthdata.nasa.gov/search/variables.umm_json"

_token: str | None = None


class AccesRefuse(RuntimeError):
    """Aucun identifiant Earthdata utilisable."""


def token() -> str:
    """Jeton Earthdata (EDL), mis en cache pour la session."""
    global _token
    if _token:
        return _token
    import earthaccess

    for strategie in ("environment", "netrc"):
        try:
            auth = earthaccess.login(strategy=strategie)
        except Exception:
            continue
        if auth and auth.authenticated:
            _token = earthaccess.get_edl_token()["access_token"]
            return _token
    raise AccesRefuse(
        "Identifiants Earthdata introuvables : créer ~/.netrc (machine urs.earthdata.nasa.gov login ... password ...) "
        "ou exporter EARTHDATA_USERNAME et EARTHDATA_PASSWORD."
    )


def quota() -> float:
    """Fraction du quota Giovanni mensuel déjà consommée (0 à 1)."""
    r = requests.get(QUOTA_URL, headers={"Authorization": f"Bearer {token()}"}, timeout=60)
    r.raise_for_status()
    return float(r.json()["quota"])


def decomposer(giovanni_id: str) -> tuple[str, str, str]:
    """'M2IMNXASM_5_12_4_T2M' -> ('M2IMNXASM', '5.12.4', 'T2M') ; 'GPM_3IMERGM_07_precipitation' -> ('GPM_3IMERGM', '07', ...)."""
    jetons = giovanni_id.split("_")
    variable = jetons[-1]
    reste = jetons[:-1]
    version = []
    while reste and reste[-1].isdigit():
        version.insert(0, reste.pop())
    return "_".join(reste), ".".join(version), variable


def _intervalle(debut: str, fin: str) -> tuple[str, str]:
    """'1980-01', '2024-12' -> bornes ISO du premier au dernier jour."""
    d = pd.Timestamp(f"{debut}-01")
    f = pd.Timestamp(f"{fin}-01") + pd.offsets.MonthEnd(0)
    return d.strftime("%Y-%m-%dT00:00:00"), f.strftime("%Y-%m-%dT23:59:59")


# --- Série point (Time Series API) ------------------------------------------------------------

def serie_point(giovanni_id: str, lat: float, lon: float, debut: str, fin: str) -> tuple[pd.Series, dict]:
    """Série brute au point de grille le plus proche. Renvoie (valeurs, métadonnées de l'en-tête)."""
    d, f = _intervalle(debut, fin)
    r = requests.get(
        TIMESERIES_URL,
        params={"data": giovanni_id, "location": f"[{lat},{lon}]", "time": f"{d}/{f}"},
        headers={"Authorization": f"Bearer {token()}"},
        timeout=600,
    )
    if r.status_code != 200:
        raise RuntimeError(f"Giovanni Time Series HTTP {r.status_code} : {r.text[:300]}")
    lignes = r.text.splitlines()
    debut_donnees = next(i for i, ligne in enumerate(lignes) if ligne.lower().startswith("timestamp"))
    meta = {}
    for ligne in lignes[:debut_donnees]:
        if "," in ligne:
            k, v = ligne.split(",", 1)
            meta[k.strip()] = v.strip()
    df = pd.read_csv(io.StringIO("\n".join(lignes[debut_donnees:])))
    df.columns = ["timestamp", "valeur"]
    valeurs = pd.Series(pd.to_numeric(df["valeur"], errors="coerce").to_numpy(), index=pd.DatetimeIndex(pd.to_datetime(df["timestamp"], format="mixed")))
    undef = float(meta.get("undef", "nan"))
    if pd.notna(undef):
        valeurs = valeurs.mask((valeurs == undef) | (valeurs.abs() > 1e20))
    meta["brut"] = r.text
    return valeurs, meta


# --- Moyenne de zone (Harmony) -----------------------------------------------------------------

def unite_cmr(concept_id: str, nom_variable: str) -> str:
    """Unité officielle (UMM-Var) : le CSV Area-Average ne la contient pas."""
    r = requests.get(
        CMR_VARIABLES_URL,
        params={"name": nom_variable, "provider": concept_id.split("-")[1], "page_size": 100},
        timeout=60,
    )
    r.raise_for_status()
    for item in r.json()["items"]:
        collections = item["meta"].get("associations", {}).get("collections", [])
        if any(concept_id in str(c) for c in collections):
            return item["umm"].get("Units", "inconnue")
    return "inconnue"


def unite_time_series(giovanni_id: str, lat: float, lon: float, mois: str) -> str:
    """Unité lue dans l'en-tête d'une série point d'un seul mois (appel de 2 s, coût de quota négligeable).

    Repli documenté pour les collections dont le CMR ne publie pas l'unité au niveau variable (cas de GPM IMERG).
    """
    _, meta = serie_point(giovanni_id, lat, lon, mois, mois)
    return meta.get("unit", "inconnue")


def serie_zone(giovanni_id: str, bbox: tuple[float, float, float, float], debut: str, fin: str) -> tuple[pd.Series, dict]:
    """Moyenne spatiale sur la bbox (ouest, sud, est, nord), via Harmony. Asynchrone : compter 1 à 3 minutes."""
    import earthaccess
    from harmony import BBox, Client, Collection, Request

    token()  # vérifie les identifiants avant de lancer un travail distant
    short_name, version, nom_var = decomposer(giovanni_id)
    jeux = earthaccess.search_datasets(short_name=short_name, version=version)
    if not jeux:
        raise RuntimeError(f"Collection introuvable dans le CMR : {short_name} v{version}")
    concept_id = jeux[0].concept_id
    d, f = _intervalle(debut, fin)
    requete = Request(
        collection=Collection(id=concept_id),
        temporal={"start": dt.datetime.fromisoformat(d), "stop": dt.datetime.fromisoformat(f)},
        spatial=BBox(*bbox),
        variables=[giovanni_id],
        format="text/csv",
        average="area",
    )
    if not requete.is_valid():
        raise RuntimeError(f"Requête Harmony invalide : {requete.error_messages()}")
    client = Client()
    job = client.submit(requete)
    with tempfile.TemporaryDirectory() as dossier:
        fichiers = [x.result() for x in client.download_all(job, directory=dossier, overwrite=True)]
        csv = next(x for x in fichiers if x.endswith(".csv"))
        texte = Path(csv).read_text()
    lignes = texte.splitlines()
    sep = next(i for i, ligne in enumerate(lignes) if ligne.strip() == ",")
    meta = {}
    for ligne in lignes[:sep]:
        k, v = ligne.split(",", 1)
        meta[k.strip().rstrip(":")] = v.strip().strip('"')
    df = pd.read_csv(io.StringIO("\n".join(lignes[sep + 1 :])))
    colonne = next(c for c in df.columns if c != "time")
    valeurs = pd.Series(pd.to_numeric(df[colonne], errors="coerce").to_numpy(), index=pd.DatetimeIndex(pd.to_datetime(df["time"], format="mixed")))
    fill = float(meta.get("Fill Value", "nan"))
    if pd.notna(fill):
        valeurs = valeurs.mask((valeurs == fill) | (valeurs.abs() > 1e20))
    unite, source_unite = unite_cmr(concept_id, nom_var), "CMR UMM-Var"
    if unite == "inconnue":
        unite, source_unite = unite_time_series(giovanni_id, (bbox[1] + bbox[3]) / 2, (bbox[0] + bbox[2]) / 2, debut), "en-tête Time Series"
    meta.update(unit=unite, source_unite=source_unite, concept_id=concept_id, job_id=job, brut=texte)
    return valeurs, meta
