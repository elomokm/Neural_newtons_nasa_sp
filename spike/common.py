"""Fonctions partagées par test_point.py et test_area.py.

Spike d'accès aux données uniquement : authentification Earthdata, quota Giovanni,
écriture du CSV normalisé, graphique de contrôle, journal de l'exécution.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import earthaccess
import matplotlib

matplotlib.use("Agg")  # rendu sans fenêtre (PNG uniquement)
import matplotlib.pyplot as plt
import pandas as pd
import requests

SPIKE_DIR = Path(__file__).resolve().parent
DATA_DIR = SPIKE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
QUOTA_URL = "https://api.giovanni.earthdata.nasa.gov/quota"
CONFIGURED_VARS_URL = "https://api.giovanni.earthdata.nasa.gov/configured-variables/"


def get_token() -> str:
    """Connexion Earthdata via earthaccess, renvoie un bearer token.

    On essaie les variables d'environnement (EARTHDATA_USERNAME / EARTHDATA_PASSWORD)
    puis ~/.netrc. Pas de strategy="all" : elle finit par une invite interactive
    qui bloque un script lancé sans terminal. Aucun identifiant dans le code.
    """
    auth = None
    for strategy in ("environment", "netrc"):
        try:
            auth = earthaccess.login(strategy=strategy)
        except Exception as e:  # identifiants absents ou refusés pour cette stratégie
            print(f"[auth] stratégie {strategy} : échec ({e})")
            continue
        if auth and auth.authenticated:
            print(f"[auth] connecté via {strategy}")
            break
    if not auth or not auth.authenticated:
        raise SystemExit(
            "Échec de l'authentification Earthdata : aucun identifiant trouvé.\n"
            "Créer ~/.netrc (machine urs.earthdata.nasa.gov login ... password ...)\n"
            "ou exporter EARTHDATA_USERNAME et EARTHDATA_PASSWORD."
        )
    return earthaccess.get_edl_token()["access_token"]


def check_quota(token: str) -> float:
    """Fraction du quota Giovanni mensuel consommée (entre 0 et 1)."""
    r = requests.get(QUOTA_URL, headers={"Authorization": f"Bearer {token}"}, timeout=60)
    print(f"[quota] HTTP {r.status_code} -> {r.text.strip()}")
    r.raise_for_status()
    return float(r.json()["quota"])


def is_configured(variable: str) -> bool:
    """Vérifie si la variable figure dans la liste publique des variables Giovanni."""
    r = requests.get(CONFIGURED_VARS_URL, timeout=60)
    r.raise_for_status()
    return variable in r.json()["configured_variables"]


def cmr_unit(concept_id: str, var_name: str) -> str:
    """Unité officielle d'une variable, lue dans les métadonnées UMM-Var du CMR.

    Utile pour le service Area-Average : son CSV n'indique pas l'unité.
    On filtre sur la collection car un même nom (ex. T2M) existe dans plusieurs collections.
    """
    r = requests.get(
        "https://cmr.earthdata.nasa.gov/search/variables.umm_json",
        params={"name": var_name, "provider": concept_id.split("-")[1], "page_size": 100},
        timeout=60,
    )
    r.raise_for_status()
    for item in r.json()["items"]:
        cols = item["meta"].get("associations", {}).get("collections", [])
        if any(concept_id in str(c) for c in cols):
            return item["umm"].get("Units", "inconnue")
    return "inconnue"


def save_series(dates, values, unit: str, path: Path) -> pd.DataFrame:
    """Écrit le CSV normalisé : colonnes date, valeur, unite."""
    df = pd.DataFrame(
        {
            "date": pd.to_datetime(pd.Series(dates)).dt.strftime("%Y-%m-%d").values,
            "valeur": pd.to_numeric(pd.Series(values)).values,
            "unite": unit,
        }
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    print(f"[csv] {len(df)} lignes -> {path.relative_to(SPIKE_DIR)}")
    return df


def plot_series(df: pd.DataFrame, title: str, path: Path) -> None:
    """Graphique rapide pour vérifier le cycle saisonnier à l'œil."""
    fig, ax = plt.subplots(figsize=(12, 4))
    ax.plot(pd.to_datetime(df["date"]), df["valeur"], lw=0.8)
    ax.set_title(title)
    ax.set_ylabel(df["unite"].iloc[0])
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=120)
    plt.close(fig)
    print(f"[plot] -> {path.relative_to(SPIKE_DIR)}")


def write_run_log(name: str, info: dict) -> None:
    """Journal JSON de l'exécution (temps, quota, nombre de points) pour le rapport."""
    info["horodatage_local"] = time.strftime("%Y-%m-%d %H:%M:%S")
    path = DATA_DIR / f"{name}_run.json"
    path.write_text(json.dumps(info, indent=2, ensure_ascii=False, default=str))
    print(f"[log] -> {path.relative_to(SPIKE_DIR)}")
