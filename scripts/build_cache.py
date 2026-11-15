"""Précalcul du cache : télécharge les séries Giovanni pour tout le catalogue et les écrit dans data/cache/.

    PYTHONPATH=src .venv/bin/python scripts/build_cache.py --origine point                # ~1 min (43 séries)
    PYTHONPATH=src .venv/bin/python scripts/build_cache.py --origine zone --parallele 4   # ~40 min (Harmony)
    options : --variables t2m,no2  --regions paris,dhaka  --force (réécrit les séries déjà en cache)

Les identifiants Earthdata viennent de l'environnement ou de ~/.netrc. Les réponses brutes sont gardées dans
data/cache/raw/ (ignoré par git) pour pouvoir rejouer la conversion sans nouvel appel réseau.
"""
from __future__ import annotations

import argparse
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from trend import data  # noqa: E402
from trend.catalog import charger_regions, charger_variables  # noqa: E402
from trend.config import CACHE_DIR, FIN_PERIODE  # noqa: E402
from trend.schemas import Serie  # noqa: E402
from trend.sources import giovanni  # noqa: E402

RAW = CACHE_DIR / "raw"


def construire(variable_id: str, region_id: str, origine: str) -> dict:
    variable, region = charger_variables()[variable_id], charger_regions()[region_id]
    t0 = time.perf_counter()
    if origine == "point":
        brut, meta = giovanni.serie_point(variable.giovanni_id, *region.centre, variable.debut, FIN_PERIODE)
    else:
        brut, meta = giovanni.serie_zone(variable.giovanni_id, region.bbox, variable.debut, FIN_PERIODE)
    RAW.mkdir(parents=True, exist_ok=True)
    (RAW / f"{variable_id}__{region_id}__{origine}.txt").write_text(meta.pop("brut", ""))
    if variable_id == "no2":
        brut = data.agreger_mensuel(brut)
    valeurs = data.normaliser_index(data.convertir(variable, brut, meta.get("unit", "")), variable.debut)
    serie = Serie(variable=variable, region=region, valeurs=valeurs, origine=origine)
    infos = {
        "giovanni_id": variable.giovanni_id,
        "unite_brute": meta.get("unit"),
        "duree_s": round(time.perf_counter() - t0, 1),
        "horodatage": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    if origine == "point":
        infos.update(lat_servie=float(meta.get("lat", region.centre[0])), lon_servie=float(meta.get("lon", region.centre[1])))
    else:
        infos.update(bbox=list(region.bbox), job_harmony=meta.get("job_id"))
    data.ecrire_cache(serie, infos)
    return {"cle": f"{variable_id}/{region_id}/{origine}", "n": int(valeurs.notna().sum()), "manquants": int(valeurs.isna().sum()), **infos}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--origine", choices=["point", "zone"], default="point")
    ap.add_argument("--variables", default="")
    ap.add_argument("--regions", default="")
    ap.add_argument("--parallele", type=int, default=4)
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    variables = [v for v in charger_variables() if not a.variables or v in a.variables.split(",")]
    regions = charger_regions()
    cibles = [
        (v, r)
        for v in variables
        for r in regions
        if (not a.regions or r in a.regions.split(","))
        and v in regions[r].variables_suggerees
        and (a.force or not data.chemin_cache(v, r, a.origine).exists())
    ]
    print(f"[cache] {len(cibles)} séries à construire ({a.origine}), quota consommé avant : {giovanni.quota():.2e}")
    debut = time.perf_counter()
    echecs = []
    with ThreadPoolExecutor(max_workers=a.parallele) as pool:
        travaux = {pool.submit(construire, v, r, a.origine): (v, r) for v, r in cibles}
        for fut in as_completed(travaux):
            v, r = travaux[fut]
            try:
                res = fut.result()
                print(f"  ok  {v:7s} {r:12s} n={res['n']:4d} manquants={res['manquants']:3d} {res['duree_s']:6.1f}s")
            except Exception as e:  # on journalise l'échec sans contourner
                echecs.append((v, r, repr(e)))
                print(f"  KO  {v:7s} {r:12s} {e!r}")
                traceback.print_exc(limit=1)
    print(f"[cache] terminé en {time.perf_counter() - debut:.0f} s, {len(cibles) - len(echecs)} ok, {len(echecs)} échecs, quota après : {giovanni.quota():.2e}")
    for v, r, e in echecs:
        print(f"  échec {v}/{r} : {e[:200]}")
    sys.exit(1 if echecs else 0)


if __name__ == "__main__":
    main()
