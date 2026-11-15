"""Serveur d'Earth Detective : sert le front (earth-detective/dist) et expose le contrat de l'équipe en JSON.

Aucun calcul statistique ici : tout vient de trend.stats.analyser() (ou du mock), via backend.py.

Lancement depuis la racine du dépôt :
    PYTHONPATH=src .venv/bin/python app/api.py              # mock (par défaut)
    TREND_MOCK=0 PYTHONPATH=src .venv/bin/python app/api.py # vrai moteur
puis ouvrir http://localhost:8000  (documentation de l'API : http://localhost:8000/api/docs)
"""
from __future__ import annotations

import dataclasses
import math
import os
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import backend

RACINE = Path(__file__).resolve().parents[1]
FRONT = RACINE / "earth-detective" / "dist"

app = FastAPI(title="Earth Detective", docs_url="/api/docs", openapi_url="/api/openapi.json")


# --- Mise en JSON des objets du contrat ------------------------------------------------------

def _propre(x):
    """Convertit en types JSON (NaN et infini deviennent null, types numpy en types Python)."""
    if isinstance(x, dict):
        return {str(k): _propre(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_propre(v) for v in x]
    if isinstance(x, (bool, np.bool_)):
        return bool(x)
    if isinstance(x, (int, np.integer)):
        return int(x)
    if isinstance(x, (float, np.floating)):
        return float(x) if math.isfinite(float(x)) else None
    if isinstance(x, pd.Timestamp):
        return x.strftime("%Y-%m")
    if x is None or x is pd.NaT:
        return None
    return x


def _mois(ts) -> str:
    return pd.Timestamp(ts).strftime("%Y-%m")


def _serie(s: pd.Series) -> dict:
    return {"dates": [_mois(d) for d in s.index], "valeurs": _propre(s.astype(float).tolist())}


def _resultat(res) -> dict:
    serie = res.serie
    tests = res.tests.astype(object).where(pd.notna(res.tests), None).to_dict(orient="records")
    return _propre(
        {
            "variable": dataclasses.asdict(serie.variable),
            "region": dataclasses.asdict(serie.region),
            "origine": serie.origine,
            "serie": _serie(serie.valeurs),
            "debut": _mois(res.debut),
            "fin": _mois(res.fin),
            "n_annees": res.n_annees,
            "anomalies": _serie(res.anomalies),
            "droite": _serie(res.droite),
            "pente_decennie": res.pente_decennie,
            "ic95": list(res.ic95),
            "p_value": res.p_value,
            "significatif": res.significatif,
            "sens": res.sens,
            "changement_total": res.changement_total,
            "periode_courte": res.periode_courte,
            "resume": res.resume,
            "tests": tests,
            "ruptures": res.ruptures,
        }
    )


def _analyser(variable_id: str, region_id: str, debut: str | None, fin: str | None):
    """Appelle le moteur et traduit ses erreurs en réponses HTTP claires."""
    try:
        return backend.resultat(variable_id, region_id, debut, fin)
    except KeyError:
        raise HTTPException(404, {"code": "inconnu", "message": "Variable ou région inconnue."}) from None
    except FileNotFoundError:
        raise HTTPException(404, {"code": "pas_en_cache", "message": "Série pas encore en cache."}) from None
    except ValueError:
        raise HTTPException(422, {"code": "periode_trop_courte", "message": "Période de moins de 5 ans."}) from None


# --- Routes ----------------------------------------------------------------------------------

@app.get("/api/catalogue")
def catalogue() -> dict:
    """Variables, régions, scénarios de démo, et période couverte par chaque variable."""
    variables, regions = backend.variables(), backend.regions()
    periodes = {}
    for v_id in variables:
        for r_id in regions:
            if not backend.disponible(v_id, r_id):
                continue
            try:
                valeurs = backend.serie(v_id, r_id).valeurs
            except (KeyError, FileNotFoundError):
                continue
            periodes[v_id] = [_mois(valeurs.index[0]), _mois(valeurs.index[-1])]
            break
    return _propre(
        {
            "variables": [dataclasses.asdict(v) for v in variables.values()],
            "regions": [dataclasses.asdict(r) for r in regions.values()],
            "scenarios": backend.scenarios(),
            "periodes": periodes,
            "mock": backend.MOCK,
            "advisor": backend.ADVISOR,
        }
    )


@app.get("/api/analyse")
def analyse(variable_id: str, region_id: str, debut: str | None = None, fin: str | None = None) -> dict:
    """Le ResultatTendance complet du contrat, pour une variable, une région et une période (AAAA-MM)."""
    return _resultat(_analyser(variable_id, region_id, debut, fin))


@app.get("/api/atlas")
def atlas(variable_id: str, debut: str | None = None, fin: str | None = None) -> dict:
    """Une tendance par région disponible, pour colorer le globe."""
    if variable_id not in backend.variables():
        raise HTTPException(404, {"code": "inconnu", "message": "Variable inconnue."})
    points = []
    for r_id, region in backend.regions().items():
        if not backend.disponible(variable_id, r_id):
            continue
        try:
            res = backend.resultat(variable_id, r_id, debut, fin)
        except (KeyError, FileNotFoundError, ValueError):
            continue  # série absente ou période trop courte : la région n'apparaît pas
        points.append(
            {
                "region_id": r_id,
                "nom": region.nom,
                "lat": region.centre[0],
                "lon": region.centre[1],
                "pente_decennie": res.pente_decennie,
                "ic95": list(res.ic95),
                "p_value": res.p_value,
                "significatif": res.significatif,
                "sens": res.sens,
            }
        )
    return _propre({"points": points})


@app.get("/api/stabilite")
def stabilite(variable_id: str, region_id: str, fin: str | None = None, min_annees: int = 10) -> dict:
    """Le verdict si l'on commence l'étude plus tôt ou plus tard : analyser() relancé pour chaque année de départ."""
    try:
        valeurs = backend.serie(variable_id, region_id).valeurs
    except KeyError:
        raise HTTPException(404, {"code": "inconnu", "message": "Variable ou région inconnue."}) from None
    except FileNotFoundError:
        raise HTTPException(404, {"code": "pas_en_cache", "message": "Série pas encore en cache."}) from None
    premier = valeurs.index[0]
    annee_0 = premier.year if premier.month == 1 else premier.year + 1
    annee_fin = int(fin[:4]) if fin else valeurs.index[-1].year
    points = []
    for annee in range(annee_0, annee_fin - min_annees + 2):
        try:
            res = backend.resultat(variable_id, region_id, f"{annee}-01", fin)
        except ValueError:
            continue
        points.append(
            {
                "debut": annee,
                "pente_decennie": res.pente_decennie,
                "ic95": list(res.ic95),
                "p_value": res.p_value,
                "significatif": res.significatif,
            }
        )
    return _propre({"points": points})


class Question(BaseModel):
    question: str


class Demande(BaseModel):
    variable_id: str
    region_id: str
    debut: str | None = None
    fin: str | None = None


@app.post("/api/suggerer")
def suggerer(q: Question) -> dict:
    """Assistant : variables et région suggérées pour une question en langage libre."""
    if not backend.ADVISOR:
        raise HTTPException(503, {"code": "advisor_absent", "message": "Assistant indisponible."})
    return _propre(dataclasses.asdict(backend.suggerer(q.question)))


@app.post("/api/expliquer")
def expliquer(d: Demande) -> dict:
    """Assistant : reformulation simple d'un résultat (repli : resultat.resume)."""
    res = _analyser(d.variable_id, d.region_id, d.debut, d.fin)
    texte = backend.expliquer(res) if backend.ADVISOR else res.resume
    return {"texte": texte}


class QuestionBot(BaseModel):
    question: str
    langue: str = "fr"
    demande: Demande | None = None          # résultat affiché (variable, région, période), s'il y en a un
    historique: list[dict[str, str]] = []   # derniers messages : {"who": "me" | "ai", "text": ...}


@app.post("/api/repondre")
def repondre(q: QuestionBot) -> dict:
    """Trendbot : réponse de l'agent IA à une question libre sur le résultat affiché.
    {"texte": null} si l'agent est absent ou si sa réponse ne passe pas les garde-fous : le front répond alors seul."""
    res = None
    if q.demande is not None:
        try:
            res = _analyser(q.demande.variable_id, q.demande.region_id, q.demande.debut, q.demande.fin)
        except HTTPException:
            res = None
    return {"texte": backend.repondre(q.question, res, q.langue, q.historique)}


# Le front est servi en dernier, pour ne pas masquer les routes /api.
if FRONT.is_dir():
    app.mount("/", StaticFiles(directory=FRONT, html=True), name="front")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("PORT", "8000")))
