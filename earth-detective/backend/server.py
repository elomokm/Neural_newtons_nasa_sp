"""Backend de référence. Le collègue remplace seulement la fonction `compute`.
pip install fastapi uvicorn pymannkendall scipy numpy requests ; uvicorn server:app --port 8000"""
import calendar
import numpy as np, pymannkendall as mk, requests
from scipy import stats
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
POWER = "https://power.larc.nasa.gov/api/temporal/monthly/point"

def monthly(lat, lon, var, start, end):
    if var == "NO2":
        # NO2 n'est pas dans NASA POWER. Source conseillée : OMI OMNO2d (colonne troposphérique, GES DISC), 2005 à aujourd'hui.
        # À brancher : retourner [(année, mois, valeur en 1e15 molécules/cm²), ...] pour la maille la plus proche.
        raise NotImplementedError("brancher OMNO2d ici")
    p = {"parameters": var, "community": "AG", "latitude": lat, "longitude": lon, "start": start, "end": end, "format": "JSON"}
    d = requests.get(POWER, params=p, timeout=60).json()["properties"]["parameter"][var]
    return [(int(k[:4]), int(k[4:]), v) for k, v in d.items() if k[4:] != "13" and v != -999]

SUM_RATE = {"PRECTOTCORR"}  # taux journaliers mm/j : on les convertit en cumul annuel (comme le navigateur)
DIR = {"increasing": "up", "decreasing": "down", "no trend": "inconclusive"}

def annual_value(rows_y, var):
    if var in SUM_RATE:  # somme(taux mensuel × jours du mois)
        return float(sum(v * calendar.monthrange(y, m)[1] for y, m, v in rows_y))
    return float(np.mean([v for _, _, v in rows_y]))

def compute(rows, alpha, var="T2M"):
    years = sorted({y for y, _, _ in rows})
    annual = []
    for y in years:
        ry = [r for r in rows if r[0] == y]
        if len(ry) == 12:  # années complètes uniquement
            annual.append((y, annual_value(ry, var)))
    ys = np.array([a[0] for a in annual]); vs = np.array([a[1] for a in annual])
    r = mk.hamed_rao_modification_test(vs, alpha=alpha)
    sl = stats.theilslopes(vs, ys, 1 - alpha)
    return {
        "annual": [{"year": int(y), "value": float(v)} for y, v in annual],
        "monthly": [{"year": y, "month": m, "value": v} for y, m, v in rows],
        "trend": {"direction": DIR.get(r.trend, "inconclusive"),  # contrat : up / down / inconclusive
                  "slope_per_decade": float(sl[0] * 10), "ci95": [float(sl[2] * 10), float(sl[3] * 10)],
                  "p_value": float(r.p), "significant": bool(r.h), "method": "hamed-rao",
                  "z": float(r.z), "total_change": float(sl[0] * (ys[-1] - ys[0]))},
        "meta": {"source": "MERRA-2 via NASA POWER", "years_valid": len(annual), "method": "hamed-rao",
                 "note": "Intervalle de pente = Theil-Sen classique, non corrigé de l'autocorrélation"},
    }

@app.post("/analyze")
def analyze(b: dict):
    return compute(monthly(b["lat"], b["lon"], b["variable"], b["start"], b["end"]), b.get("alpha", 0.05), b["variable"])

@app.get("/atlas")
def atlas(variable: str, start: int, end: int, alpha: float = 0.05):
    return {"points": []}  # à remplir avec les 30 lieux de content.js
