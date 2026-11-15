"""Lecture des catalogues YAML (variables, régions, scénarios de démo)."""
from __future__ import annotations

from functools import lru_cache

import yaml

from trend.config import CATALOG_DIR, DEMOS_DIR
from trend.schemas import Region, Variable


def _lire(chemin):
    with open(chemin, encoding="utf-8") as f:
        return yaml.safe_load(f) or []


@lru_cache(maxsize=1)
def charger_variables() -> dict[str, Variable]:
    """Lit data/catalog/variables.yaml ; l'ordre du fichier est conservé."""
    variables = {}
    for d in _lire(CATALOG_DIR / "variables.yaml"):
        d = dict(d)
        d["mots_cles"] = tuple(str(m) for m in d.get("mots_cles", ()))
        d["debut"] = str(d["debut"])
        v = Variable(**d)
        variables[v.id] = v
    return variables


@lru_cache(maxsize=1)
def charger_regions() -> dict[str, Region]:
    """Lit data/catalog/regions.yaml ; l'ordre du fichier est conservé."""
    regions = {}
    for d in _lire(CATALOG_DIR / "regions.yaml"):
        d = dict(d)
        d["bbox"] = tuple(float(x) for x in d["bbox"])
        d["centre"] = tuple(float(x) for x in d["centre"])
        d["variables_suggerees"] = tuple(str(v) for v in d.get("variables_suggerees", ()))
        r = Region(**d)
        regions[r.id] = r
    return regions


@lru_cache(maxsize=1)
def charger_scenarios() -> list[dict]:
    """Lit data/demos/scenarios.yaml (format : contrat, section 4)."""
    scenarios = _lire(DEMOS_DIR / "scenarios.yaml")
    for s in scenarios:
        for e in s.get("etapes", []):
            e["periode"] = [str(x) for x in e.get("periode", [])]
            e["regions"] = [str(r) for r in e.get("regions", [])]
            e["saisons_retirees"] = bool(e.get("saisons_retirees", False))
    return scenarios
