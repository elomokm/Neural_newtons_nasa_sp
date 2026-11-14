"""Test 1 : série temporelle mensuelle de T2M (MERRA-2) sur un point (Paris).

Service : Giovanni in the Cloud, Time Series
  GET https://api.giovanni.earthdata.nasa.gov/timeseries
  paramètres : data, location "[lat,lon]", time "debut/fin"
  header     : Authorization: Bearer <token Earthdata>
Référence : nasa/gesdisc-tutorials, notebooks/How_to_Access_GiC_Time_Series_Service.ipynb

Usage :
  .venv/bin/python test_point.py                       # variable demandée (M2TMNXSLV)
  .venv/bin/python test_point.py --variable <ID>       # autre identifiant Giovanni
"""

from __future__ import annotations

import argparse
import io
import time

import pandas as pd
import requests

from common import (
    DATA_DIR,
    RAW_DIR,
    SPIKE_DIR,
    check_quota,
    get_token,
    is_configured,
    plot_series,
    save_series,
    write_run_log,
)

TIMESERIES_URL = "https://api.giovanni.earthdata.nasa.gov/timeseries"
LAT, LON = 48.85, 2.35  # Paris
TIME_RANGE = "1980-01-01T00:00:00/2024-12-31T23:59:59"


def parse_response(text: str) -> tuple[dict, pd.DataFrame]:
    """Sépare l'en-tête "clé,valeur" des données.

    Format observé dans le notebook officiel : ~13 lignes de métadonnées
    (param_name, unit, lat, lon, ...), puis une ligne "Timestamp (UTC),..."
    suivie des données. On cherche cette ligne plutôt que de figer le nombre 13.
    """
    lines = text.splitlines()
    start = next(i for i, l in enumerate(lines) if l.lower().startswith("timestamp"))
    meta = {}
    for l in lines[:start]:
        if "," in l:
            k, v = l.split(",", 1)
            meta[k.strip()] = v.strip()
    df = pd.read_csv(io.StringIO("\n".join(lines[start:])))
    df.columns = ["timestamp", "value"]
    return meta, df


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--variable", default="M2TMNXSLV_5_12_4_T2M")
    variable = ap.parse_args().variable

    print(f"[var] {variable} | dans configured-variables : {is_configured(variable)}")
    token = get_token()
    quota_before = check_quota(token)

    params = {"data": variable, "location": f"[{LAT},{LON}]", "time": TIME_RANGE}
    t0 = time.perf_counter()
    r = requests.get(
        TIMESERIES_URL, params=params, headers={"Authorization": f"Bearer {token}"}, timeout=600
    )
    elapsed = time.perf_counter() - t0
    print(f"[timeseries] HTTP {r.status_code} en {elapsed:.1f} s, {len(r.content)} octets")

    # On garde toujours la réponse brute, succès ou échec, pour le rapport.
    raw_path = RAW_DIR / f"point_{variable}.txt"
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    raw_path.write_text(r.text)

    quota_after = check_quota(token)
    info = {
        "variable": variable,
        "url": r.url,
        "http_status": r.status_code,
        "temps_reponse_s": round(elapsed, 2),
        "taille_octets": len(r.content),
        "quota_avant": quota_before,
        "quota_apres": quota_after,
        "reponse_brute": str(raw_path.relative_to(SPIKE_DIR)),
    }

    if r.status_code != 200:
        info["erreur"] = r.text[:2000]
        write_run_log("point", info)
        raise SystemExit(f"Échec de la requête point : {r.text[:500]}")

    meta, df = parse_response(r.text)
    unit = meta.get("unit", "inconnue")
    out = save_series(df["timestamp"], df["value"], unit, DATA_DIR / "t2m_paris_point.csv")
    plot_series(
        out,
        f"{variable} au point [{meta.get('lat', LAT)}, {meta.get('lon', LON)}] (Paris)",
        SPIKE_DIR / "plot_point.png",
    )
    info.update(
        nb_points=len(out),
        premiere_date=out["date"].iloc[0],
        derniere_date=out["date"].iloc[-1],
        unite=unit,
        metadonnees_entete=meta,
    )
    write_run_log("point", info)


if __name__ == "__main__":
    main()
