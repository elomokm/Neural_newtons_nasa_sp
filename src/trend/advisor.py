"""Assistant : suggère variable et région à partir d'une question libre, et reformule un résultat en langage simple.

Fonctionne SANS clé d'API et sans réseau (règles et mots-clés), comme l'exige la démo. `suggerer` ne lève jamais
d'exception. Un modèle de langage peut être branché derrière la même interface ; en son absence, le repli
`source="mots_cles"` est toujours disponible.
"""
from __future__ import annotations

import re
import unicodedata

from trend.catalog import charger_regions, charger_variables
from trend.schemas import ResultatTendance, Suggestion

# Façons courantes de désigner les régions du catalogue (formes normalisées : minuscules, sans accents).
ALIAS_REGIONS: dict[str, tuple[str, ...]] = {
    "paris": ("paris", "ile de france", "idf"),
    "po": ("plaine du po", "vallee du po", "po ", "italie", "milan", "turin", "lombardie", "italy"),
    "pekin": ("pekin", "beijing", "chine", "china"),
    "los_angeles": ("los angeles", "l.a.", "californie", "california", "hollywood"),
    "dhaka": ("dhaka", "dacca", "bangladesh", "gange", "ganges", "delta"),
    "delhi": ("delhi", "new delhi", "inde", "india"),
    "sahel": ("sahel", "niger", "mali", "burkina", "sahara", "niamey"),
    "svalbard": ("svalbard", "spitzberg", "arctique", "arctic", "pole nord", "north pole", "banquise"),
    "espagne": ("espagne", "spain", "madrid", "castille", "mediterranee", "mediterranean"),
    "amazonie": ("amazonie", "amazon", "amazone", "foret tropicale", "rainforest", "bresil", "brazil", "manaus"),
    "france": ("france", "hexagone"),
}

# Questions typiques qui ne nomment pas la variable mais la sous-entendent.
INDICES_VARIABLES: dict[str, tuple[str, ...]] = {
    "t2m": ("rechauffe", "refroidi", "degre", "temperature", "chaud", "froid", "canicule", "warming", "hot", "cold"),
    "qv2m": ("humid", "vapeur", "moite", "sec ", "seche", "moisture"),
    "precip": ("pluie", "pleut", "precipit", "mousson", "secheresse", "neige", "rain", "drought", "inond"),
    "no2": ("pollu", "no2", "azote", "trafic", "voiture", "usine", "smog", "qualite de l'air", "air pollution", "nitrogen"),
}


def normaliser(texte: str) -> str:
    """Minuscules, sans accents, ponctuation remplacée par des espaces, espaces simples et bornés."""
    t = unicodedata.normalize("NFKD", texte or "").encode("ascii", "ignore").decode().lower()
    t = re.sub(r"[^a-z0-9' ]+", " ", t)
    return " " + re.sub(r"\s+", " ", t).strip() + " "


def _scores_variables(q: str) -> dict[str, int]:
    scores: dict[str, int] = {}
    for vid, variable in charger_variables().items():
        mots = {normaliser(m).strip() for m in variable.mots_cles} | set(INDICES_VARIABLES.get(vid, ()))
        scores[vid] = sum(1 for m in mots if m and m.strip() in q)
    return scores


def _region(q: str) -> str | None:
    meilleures = []
    for rid, alias in ALIAS_REGIONS.items():
        if rid not in charger_regions():
            continue
        for a in alias:
            if a.strip() and (a in q or f" {a.strip()} " in q):
                meilleures.append((len(a), rid))
    if not meilleures:
        for rid, region in charger_regions().items():  # nom officiel du catalogue
            if normaliser(region.nom.split(" (")[0]).strip() in q:
                meilleures.append((len(region.nom), rid))
    return max(meilleures)[1] if meilleures else None


def suggerer(question: str) -> Suggestion:
    """Variables et région suggérées pour une question libre. Ne lève jamais d'exception."""
    try:
        q = normaliser(question)
        variables, regions = charger_variables(), charger_regions()
        scores = _scores_variables(q)
        retenues = [vid for vid, sc in sorted(scores.items(), key=lambda kv: -kv[1]) if sc > 0]
        region_id = _region(q)
        indisponible = None
        if region_id and retenues:
            possibles = [v for v in retenues if v in regions[region_id].variables_suggerees]
            if not possibles:
                indisponible = variables[retenues[0]].nom
            retenues = possibles
        if not retenues:
            retenues = list(regions[region_id].variables_suggerees[:1]) if region_id else ["t2m"]
            raison = "Je n'ai pas reconnu de variable dans ta question : je propose de commencer par la température."
        else:
            raison = f"Ta question parle de « {variables[retenues[0]].nom.lower()} » ({variables[retenues[0]].source})."
        if region_id:
            raison += f" Région reconnue : {regions[region_id].nom}."
        else:
            raison += " Aucune région du catalogue reconnue : choisis-en une sur le globe."
        if indisponible:
            raison += f" « {indisponible} » n'est pas disponible pour cette région : je propose « {variables[retenues[0]].nom.lower()} » à la place."
        return Suggestion(variable_ids=retenues[:2], region_id=region_id, explication=raison, source="mots_cles")
    except Exception:  # jamais d'exception vers l'app
        return Suggestion(variable_ids=["t2m"], region_id=None, explication="Je propose de commencer par la température.", source="mots_cles")


def _fmt(x: float, unite: str) -> str:
    return f"{x:+.2g} {unite}".replace(".", ",").replace("-", "−")


def expliquer(resultat: ResultatTendance) -> str:
    """Reformulation en 3 ou 4 phrases simples, construite à partir du résultat (jamais de chiffre inventé)."""
    try:
        r, v, reg = resultat, resultat.serie.variable, resultat.serie.region
        debut, fin = r.debut.year, r.fin.year
        if r.significatif:
            clair = v.hausse_signifie if r.sens == "hausse" else v.baisse_signifie
            texte = (
                f"À {reg.nom}, entre {debut} et {fin}, la tendance est à la {r.sens} : environ {_fmt(r.pente_decennie, v.unite)} "
                f"par décennie, soit {_fmt(r.changement_total, v.unite)} au total. "
                f"Si rien ne changeait vraiment, une pente aussi nette n'apparaîtrait par hasard que dans "
                f"{'moins de 0,1 %' if r.p_value < 0.001 else 'moins de 1 %' if r.p_value < 0.01 else 'moins de 5 %'} des cas : "
                f"on parle de tendance significative. En clair : {clair}. "
                f"La vraie pente se situe probablement entre {_fmt(r.ic95[0], v.unite)} et {_fmt(r.ic95[1], v.unite)} par décennie."
            )
        else:
            texte = (
                f"À {reg.nom}, entre {debut} et {fin}, on ne voit pas de tendance significative. "
                f"La pente estimée ({_fmt(r.pente_decennie, v.unite)} par décennie) est trop faible par rapport aux variations "
                f"d'une année à l'autre pour qu'on puisse exclure le hasard. Cela ne veut pas dire « stable » : "
                f"une période plus longue pourrait trancher."
            )
        if r.periode_courte:
            texte += " Attention : moins de 30 ans de données, on décrit une tendance récente, pas encore un climat."
        return texte
    except Exception:
        return getattr(resultat, "resume", "")
