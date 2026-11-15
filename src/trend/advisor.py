"""Assistant : suggère variable et région à partir d'une question libre, et reformule un résultat en langage simple.

Deux niveaux, derrière la même interface (docs/AGENT.md) :
- l'agent IA d'Ashneel (src/agent, OpenAI), utilisé seulement si OPENAI_API_KEY est définie (variable d'environnement
  ou fichier .env) ; sa réponse est vérifiée (ids du catalogue, aucun chiffre absent du résultat) ;
- le repli par règles et mots-clés, sans réseau, utilisé sinon ou dès que l'agent échoue.
`suggerer` et `expliquer` ne lèvent jamais d'exception.
"""
from __future__ import annotations

import json
import re
import unicodedata
from functools import lru_cache

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


def _suggerer_regles(question: str) -> Suggestion:
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


def _expliquer_regles(resultat: ResultatTendance) -> str:
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


# --- Agent IA (facultatif) -------------------------------------------------------------------

def _agent():
    """Module de l'agent si une clé est configurée, sinon None (repli). Import paresseux : openai reste facultatif."""
    try:
        from agent import agent

        return agent if agent.is_configured() else None
    except Exception:
        return None


def _catalogue_pour_agent() -> dict:
    """Ce que l'agent a le droit de choisir : ids, noms, définitions, types et histoires du catalogue."""
    return {
        "variables": [{"id": v.id, "nom": v.nom, "definition": v.definition} for v in charger_variables().values()],
        "regions": [
            {"id": r.id, "nom": r.nom, "type": r.type, "histoire": r.histoire, "variables": list(r.variables_suggerees)}
            for r in charger_regions().values()
        ],
    }


@lru_cache(maxsize=256)
def _suggerer_ia(question: str) -> Suggestion | None:
    """Suggestion de l'agent, vérifiée contre le catalogue. None si l'agent est absent ou si rien d'exploitable ne reste."""
    ag = _agent()
    if ag is None:
        return None
    rep = ag.suggest_from_question(question, _catalogue_pour_agent())
    variables, regions = charger_variables(), charger_regions()
    if rep.hors_sujet:
        return Suggestion(
            variable_ids=[], region_id=None, source="ia",
            explication="Je ne peux répondre qu'aux questions sur l'environnement. Essaie par exemple : "
            "« La pollution baisse-t-elle à Pékin ? » ou « Il pleut moins au Sahel ? »",
        )
    region_id = rep.region_id if rep.region_id in regions else None
    ids = [v for v in dict.fromkeys(rep.variable_ids) if v in variables]  # ids hors catalogue retirés
    if region_id:
        ids = [v for v in ids if v in regions[region_id].variables_suggerees]  # combinaison indisponible retirée
    if not ids or not rep.explication.strip():
        return None
    return Suggestion(variable_ids=ids[:2], region_id=region_id, explication=rep.explication.strip(), source="ia")


def suggerer(question: str) -> Suggestion:
    """Variables et région suggérées pour une question libre : agent IA si disponible, sinon règles."""
    try:
        sug = _suggerer_ia((question or "").strip())
        if sug is not None:
            return sug
    except Exception:  # clé invalide, réseau, délai dépassé, réponse invalide : repli
        pass
    return _suggerer_regles(question)


# Nombres d'un texte : « 0,41 », « −0.3 », « 2005 ». Les chiffres collés à une lettre (NO2, T2M, CO2) sont ignorés.
_NOMBRE = re.compile(r"(?<![A-Za-zÀ-ÿ])[-−+]?\d+(?:[.,]\d+)?")


def _nombres(texte: str) -> list[str]:
    return _NOMBRE.findall(texte or "")


def _vers_float(s: str) -> float:
    return float(s.replace("−", "-").replace(",", "."))


def _arrondi(x: float) -> float:
    return float(f"{x:.4g}")  # 4 chiffres : les arrondis du modèle tombent comme ceux du front


def _donnees_agent(r: ResultatTendance) -> dict:
    """Le ResultatTendance au format attendu par analyse_environment (que des valeurs déjà calculées, arrondies)."""
    v, reg = r.serie.variable, r.serie.region
    return {
        "region": reg.nom,
        "region_type": reg.type,
        "period": {"start": r.debut.year, "end": r.fin.year, "years": round(r.n_annees, 1)},
        "variables": [v.nom],
        "statistics": {
            v.nom: {
                "unit": v.unite,
                "definition": v.definition,
                "trend": r.sens if r.significatif else "no significant trend",
                "significant": bool(r.significatif),
                "slope_per_decade": _arrondi(r.pente_decennie),
                "slope_95ci_per_decade": [_arrondi(r.ic95[0]), _arrondi(r.ic95[1])],
                "p_value": _arrondi(r.p_value),
                "total_change": _arrondi(r.changement_total),
                "rise_means": v.hausse_signifie,
                "fall_means": v.baisse_signifie,
            }
        },
        "short_period": bool(r.periode_courte),
        "method": "Mann-Kendall test and Sen's slope on annual means of monthly anomalies (seasons removed), 5 % threshold",
        "relationships": [],
    }


def _chiffres_autorises(r: ResultatTendance) -> list[float]:
    v, reg = r.serie.variable, r.serie.region
    valeurs = [r.pente_decennie, *r.ic95, r.changement_total, r.p_value, r.p_value * 100,
               r.debut.year, r.fin.year, r.n_annees, round(r.n_annees)]
    seuils = [5, 95, 30, 10, 0.05, 0.01, 0.001, 1, 0.1]  # seuils et vocabulaire de la méthode (5 %, 95 %, 30 ans, décennie)
    du_texte = [_vers_float(n) for n in _nombres(f"{v.nom} {v.unite} {reg.nom}")]  # ex. « air à 2 m »
    return [float(x) for x in valeurs + seuils + du_texte]


def chiffres_verifies(texte: str, autorises: list[float]) -> bool:
    """Vrai si chaque nombre du texte correspond, à l'arrondi près, à une valeur autorisée (signe ignoré)."""
    for brut in _nombres(texte):
        x = abs(_vers_float(brut))
        decimales = len(brut.replace(",", ".").split(".")[1]) if re.search(r"[.,]", brut) else 0
        tol = 0.5 * 10 ** (-decimales) + 1e-9
        if not any(abs(x - abs(a)) <= max(tol, 0.01 * abs(a)) for a in autorises):
            return False
    return True


@lru_cache(maxsize=256)
def _texte_agent(donnees_json: str) -> str:
    ag = _agent()
    if ag is None:
        return ""
    return ag.analyse_environment(json.loads(donnees_json)).executive_summary.strip()


_NEGATION = re.compile(r"\b(pas|ne|n|not|no|never|jamais|aucun\w*)\b|n't", re.IGNORECASE)


def vocabulaire_ok(texte: str, significatif: bool | None) -> bool:
    """Refuse « prouvé / démontré » (FR et EN), et « stable » pour un résultat non significatif,
    sauf à la forme négative (« ne prouve pas », « ne veut pas dire stable », « does not prove »)."""
    interdits = [r"prouv|démontr|\bprove|\bproof\b|demonstrat"]
    if significatif is False:
        interdits.append(r"stab")
    for motif in interdits:
        for m in re.finditer(motif, texte, re.IGNORECASE):
            if not _NEGATION.search(texte[max(0, m.start() - 40) : m.start()]):
                return False
    return True


def _expliquer_ia(r: ResultatTendance) -> str | None:
    """Texte de l'agent s'il passe les garde-fous, sinon None."""
    texte = _texte_agent(json.dumps(_donnees_agent(r), ensure_ascii=False, sort_keys=True))
    if not texte or not vocabulaire_ok(texte, bool(r.significatif)):
        return None
    if not chiffres_verifies(texte, _chiffres_autorises(r)):
        return None  # un seul nombre inconnu : la réponse est jetée
    return texte


def expliquer(resultat: ResultatTendance) -> str:
    """Reformulation simple d'un résultat : agent IA si disponible et vérifié, sinon règles (jamais de chiffre inventé)."""
    try:
        texte = _expliquer_ia(resultat)
        if texte:
            return texte
    except Exception:
        pass
    return _expliquer_regles(resultat)


# --- Trendbot : question libre sur le résultat affiché ------------------------------------------

_OUTIL = {
    "method": (
        "Monthly NASA values averaged over the region; seasons removed (each month compared with the mean of the same "
        "month); annual means; Mann-Kendall test (compares each year with all later ones) gives the p-value; Sen's slope "
        "(median of slopes between all pairs of years) gives the speed per decade with a 95 % confidence interval. "
        "p < 0.05: significant rise or fall. p >= 0.05: no significant trend over this period, which does not mean stable. "
        "Fewer than 30 years: recent trend, not yet climate (WMO). No analysis under 5 years."
    ),
    "data_sources": "NASA MERRA-2 reanalysis (temperature, humidity), GPM IMERG (rain), OMI satellite on Aura (NO2).",
    "limits": (
        "Values describe a region (satellite and model data), not a local station. A trend does not prove its cause. "
        "Nothing about daily extreme events. The verdict can change with the chosen period (Stability tab)."
    ),
}


def contexte_bot(r: ResultatTendance | None) -> dict:
    """Ce que Trendbot a le droit d'utiliser : le résultat affiché (ou rien) et la description de l'outil."""
    return {"result": _donnees_agent(r) if r is not None else None, **_OUTIL}


@lru_cache(maxsize=256)
def _reponse_agent(question: str, contexte_json: str, langue: str, historique_json: str) -> str:
    ag = _agent()
    if ag is None:
        return ""
    return ag.answer_question(question, json.loads(contexte_json), langue, json.loads(historique_json))


def repondre(question: str, resultat: ResultatTendance | None = None, langue: str = "fr", historique: list[dict] | None = None) -> str | None:
    """Réponse de l'agent à une question libre, vérifiée ; None si l'agent est absent, en panne, ou si la réponse
    ne passe pas les garde-fous (le front utilise alors ses règles). Ne lève jamais d'exception."""
    try:
        langue = "en" if langue == "en" else "fr"
        hist = [{"who": str(m.get("who", "")), "text": str(m.get("text", ""))[:400]} for m in (historique or [])[-6:]]
        texte = _reponse_agent(
            (question or "").strip()[:500],
            json.dumps(contexte_bot(resultat), ensure_ascii=False, sort_keys=True),
            langue,
            json.dumps(hist, ensure_ascii=False),
        )
        if not texte:
            return None
        autorises = _chiffres_autorises(resultat) if resultat is not None else [5, 95, 30, 10, 0.05, 1, 2]
        autorises += [2]  # « 2 m », « NO 2 » écrit avec une espace
        autorises += [_vers_float(n) for n in _nombres(question or "")]  # reprendre un nombre de la question n'est pas l'inventer
        if not chiffres_verifies(texte, autorises) or not vocabulaire_ok(texte, bool(resultat.significatif) if resultat is not None else None):
            return None
        return texte
    except Exception:
        return None
