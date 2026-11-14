"""Test 2 : série mensuelle de T2M (MERRA-2) moyennée sur la France (bbox).

Service : Giovanni Area-Average Time Series, appelé via Harmony (harmony-py),
  Request(..., variables=[<id Giovanni>], format="text/csv", average="area")
Référence : nasa/gesdisc-tutorials,
  notebooks/How_To_Access_the_Giovanni_Averaging_Service_Using_Python.ipynb

Usage :
  .venv/bin/python test_area.py                       # variable demandée (M2TMNXSLV)
  .venv/bin/python test_area.py --variable <ID>       # autre identifiant Giovanni
L'identifiant est de la forme <SHORTNAME>_<VERSION>_<VAR>, le short name et la
version de la collection en sont déduits.
"""

from __future__ import annotations

import argparse
import datetime as dt
import io
import time
from pathlib import Path

import earthaccess
import pandas as pd
from harmony import BBox, Client, Collection, Request

from common import (
    DATA_DIR,
    RAW_DIR,
    SPIKE_DIR,
    check_quota,
    cmr_unit,
    get_token,
    is_configured,
    plot_series,
    save_series,
    write_run_log,
)

BBOX_FRANCE = BBox(-5, 42, 9, 51)  # (ouest, sud, est, nord)
START = dt.datetime(1980, 1, 1)
STOP = dt.datetime(2024, 12, 31, 23, 59, 59)


def parse_area_csv(text: str) -> tuple[dict, pd.DataFrame]:
    """Format du notebook officiel : lignes "attribut,valeur" jusqu'à une ligne
    contenant seulement ",", puis un CSV classique (time, mean_<variable>)."""
    lines = text.splitlines()
    sep = next(i for i, l in enumerate(lines) if l.strip() == ",")
    meta = {}
    for l in lines[:sep]:
        k, v = l.split(",", 1)
        meta[k.strip()] = v.strip()
    df = pd.read_csv(io.StringIO("\n".join(lines[sep + 1 :])))
    return meta, df


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--variable", default="M2TMNXSLV_5_12_4_T2M")
    variable = ap.parse_args().variable
    short_name, *ver, _var = variable.split("_")
    version = ".".join(ver)  # "5_12_4" -> "5.12.4"

    print(f"[var] {variable} | dans configured-variables : {is_configured(variable)}")
    token = get_token()
    quota_before = check_quota(token)

    # Identifiant CMR de la collection (ex. M2TMNXSLV v5.12.4)
    t0 = time.perf_counter()
    # earthaccess >= 0.19 : concept_id est un attribut (le notebook l'appelle comme une méthode)
    concept_id = earthaccess.search_datasets(short_name=short_name, version=version)[0].concept_id
    t_cmr = time.perf_counter() - t0
    print(f"[cmr] {short_name} v{version} -> {concept_id} ({t_cmr:.1f} s)")

    client = Client()  # utilise les identifiants Earthdata (.netrc / env)
    request = Request(
        collection=Collection(id=concept_id),
        temporal={"start": START, "stop": STOP},
        spatial=BBOX_FRANCE,
        variables=[variable],
        format="text/csv",
        average="area",
    )
    print(f"[harmony] requête valide : {request.is_valid()}")

    info = {
        "variable": variable,
        "concept_id": concept_id,
        "temps_cmr_s": round(t_cmr, 2),
        "quota_avant": quota_before,
    }
    t0 = time.perf_counter()
    try:
        job_id = client.submit(request)
        info["job_id"] = job_id
        print(f"[harmony] job {job_id} soumis, attente du résultat...")
        files = [f.result() for f in client.download_all(job_id, directory=str(RAW_DIR), overwrite=True)]
    except Exception as e:  # on journalise l'erreur exacte, sans contournement
        info.update(temps_total_s=round(time.perf_counter() - t0, 2), erreur=repr(e))
        info["quota_apres"] = check_quota(token)
        write_run_log("area", info)
        raise SystemExit(f"Échec Harmony : {e!r}")
    elapsed = time.perf_counter() - t0
    status = client.status(job_id)
    print(f"[harmony] terminé en {elapsed:.1f} s -> {files}")

    raw_path = next(f for f in files if f.endswith(".csv"))
    meta, df = parse_area_csv(Path(raw_path).read_text())
    value_col = next(c for c in df.columns if c != "time")
    # L'en-tête du CSV Area-Average ne contient que dates, bbox et valeur de remplissage :
    # pas d'unité. On la prend dans l'en-tête si un jour elle y figure, sinon dans le CMR.
    unit = next((v for k, v in meta.items() if k.lower().startswith("unit")), None)
    unit_source = "en-tête CSV"
    if unit is None:
        unit, unit_source = cmr_unit(concept_id, _var), "CMR UMM-Var"
    print(f"[unité] {unit} (source : {unit_source})")
    # Contrôle : aucune valeur ne doit égaler la valeur de remplissage annoncée.
    fill = float(meta.get("Fill Value:", "nan"))
    n_fill = int((df[value_col] == fill).sum())
    out = save_series(df["time"], df[value_col], unit, DATA_DIR / "t2m_france_area.csv")
    plot_series(out, f"{variable} moyenne sur la France (lon -5..9, lat 42..51)", SPIKE_DIR / "plot_area.png")

    info.update(
        temps_total_s=round(elapsed, 2),
        statut_job=status,
        quota_apres=check_quota(token),
        reponse_brute=str(Path(raw_path).relative_to(SPIKE_DIR)),
        nb_points=len(out),
        premiere_date=out["date"].iloc[0],
        derniere_date=out["date"].iloc[-1],
        unite=unit,
        source_unite=unit_source,
        nb_valeurs_remplissage=n_fill,
        colonnes_brutes=list(df.columns),
        metadonnees_entete=meta,
    )
    write_run_log("area", info)


if __name__ == "__main__":
    main()
