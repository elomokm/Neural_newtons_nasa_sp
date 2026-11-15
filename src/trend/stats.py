"""Moteur statistique : anomalies, test de Mann-Kendall, pente de Sen et intervalle de confiance.

Méthode (docs/methods.md) :
1. On retire le cycle saisonnier : chaque mois est comparé à la moyenne de ce même mois sur la période (anomalies).
2. On calcule la moyenne annuelle des anomalies (années d'au moins 10 mois valides) : le test principal porte sur
   ces valeurs annuelles, ce qui limite l'effet de l'autocorrélation des mois successifs.
3. Test de Mann-Kendall (p-value) et pente de Sen avec son intervalle de confiance à 95 % (Gilbert 1987).
4. Contrôles : Mann-Kendall saisonnier sur les anomalies mensuelles, correction de Hamed et Rao, régression linéaire.
Tout chiffre affiché par l'app vient d'ici. Aucun appel réseau.
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd
import pymannkendall as mk
from scipy import stats as sps

from trend.config import ANNEES_CLIMAT, MIN_ANNEES, SEUIL_P
from trend.schemas import ResultatTendance, Serie

MIN_MOIS_PAR_AN = 10
Z_95 = 1.959964


def anomalies_mensuelles(valeurs: pd.Series) -> pd.Series:
    """Écart de chaque mois à la moyenne de ce même mois calendaire (le cycle des saisons disparaît)."""
    normale = valeurs.groupby(valeurs.index.month).transform("mean")
    return (valeurs - normale).rename("anomalie")


def moyennes_annuelles(anomalies: pd.Series, min_mois: int = MIN_MOIS_PAR_AN) -> pd.Series:
    """Moyenne par année civile, uniquement pour les années suffisamment renseignées. Index : année (int)."""
    g = anomalies.groupby(anomalies.index.year)
    moyenne = g.mean()
    moyenne = moyenne[g.count() >= min_mois]
    return moyenne.astype(float)


def pente_sen_ic(t: np.ndarray, y: np.ndarray, var_s: float, z: float = Z_95) -> tuple[float, float, float]:
    """Pente de Sen (médiane des pentes entre paires) et bornes de confiance (Gilbert 1987 ; Helsel et Hirsch 2002)."""
    i, j = np.triu_indices(len(y), k=1)
    pentes = np.sort((y[j] - y[i]) / (t[j] - t[i]))
    n = len(pentes)
    pente = float(np.median(pentes))
    if n < 2 or not np.isfinite(var_s) or var_s <= 0:
        return pente, float("nan"), float("nan")
    c = z * math.sqrt(var_s)
    rang_bas = (n - c) / 2  # rangs 1-indexés, interpolés
    rang_haut = (n + c) / 2 + 1
    rangs = np.arange(1, n + 1)
    bas = float(np.interp(np.clip(rang_bas, 1, n), rangs, pentes))
    haut = float(np.interp(np.clip(rang_haut, 1, n), rangs, pentes))
    return pente, bas, haut


def _bornes(valeurs: pd.Series, debut: str | None, fin: str | None) -> pd.Series:
    v = valeurs.sort_index()
    if debut:
        v = v[v.index >= pd.Timestamp(f"{debut}-01")]
    if fin:
        v = v[v.index <= pd.Timestamp(f"{fin}-01")]
    return v


def _ligne(test: str, valeur, p, detail: str) -> dict:
    return {
        "Test": test,
        "Valeur": None if valeur is None or not np.isfinite(valeur) else round(float(valeur), 3),
        "p-value": None if p is None or not np.isfinite(p) else round(float(p), 4),
        "Significatif": None if p is None or not np.isfinite(p) else bool(p < SEUIL_P),
        "Détail": detail,
    }


def _resume(serie: Serie, sens: str, significatif: bool, pente: float, p: float, debut: pd.Timestamp, fin: pd.Timestamp, courte: bool) -> str:
    v, r = serie.variable, serie.region
    signe = "+" if pente >= 0 else "−"
    pente_txt = f"{signe}{abs(pente):.2g}".replace(".", ",")
    p_txt = "p < 0,001" if p < 0.001 else f"p = {p:.3f}".replace(".", ",")
    periode = f"{debut.year} → {fin.year}"
    if significatif:
        phrase = (
            f"{r.nom}, {periode} : {sens} significative (au seuil de 5 %, {p_txt}) d'environ {pente_txt} {v.unite} par décennie. "
            f"En clair : {v.hausse_signifie if sens == 'hausse' else v.baisse_signifie}."
        )
    else:
        phrase = (
            f"{r.nom}, {periode} : pas de tendance significative sur cette période ({p_txt}). "
            f"La pente estimée ({pente_txt} {v.unite} par décennie) reste dans la variabilité naturelle d'une année à l'autre."
        )
    if courte:
        phrase += " Moins de 30 ans de données : on parle de tendance récente, pas encore de climat."
    return phrase


def _controles(y_an: np.ndarray, anomalies: pd.Series) -> list[dict]:
    """Tests de contrôle : Mann-Kendall corrigé de l'autocorrélation et Mann-Kendall saisonnier."""
    lignes = []
    with np.errstate(invalid="ignore", divide="ignore"):  # séries courtes : variance parfois dégénérée
        try:
            hr = mk.hamed_rao_modification_test(y_an)
            lignes.append(_ligne("Mann-Kendall corrigé (Hamed et Rao)", hr.z, hr.p, "Variance corrigée de l'autocorrélation des années."))
        except Exception as e:  # série trop courte pour la correction
            lignes.append(_ligne("Mann-Kendall corrigé (Hamed et Rao)", None, None, f"Non calculable : {e}"))
        try:
            mensuel = anomalies.to_numpy(dtype=float)
            complet = len(mensuel) - len(mensuel) % 12
            smk = mk.seasonal_test(mensuel[:complet], period=12)
            detail = "Chaque mois calendaire testé séparément, puis combiné (Hirsch et Slack)."
            lignes.append(_ligne("Mann-Kendall saisonnier (mensuel)", smk.z, smk.p, detail))
        except Exception as e:
            lignes.append(_ligne("Mann-Kendall saisonnier (mensuel)", None, None, f"Non calculable : {e}"))
    return lignes


def analyser(serie: Serie, debut: str | None = None, fin: str | None = None) -> ResultatTendance:
    """Analyse de tendance sur la période [debut, fin] (format "AAAA-MM", None = toute la série).

    Lève ValueError si la période couvre moins de 5 ans ou contient trop peu de données.
    """
    v = _bornes(serie.valeurs, debut, fin)
    v = v[v.first_valid_index() : v.last_valid_index()] if v.notna().any() else v.iloc[0:0]
    if v.empty:
        raise ValueError("Aucune donnée sur la période demandée.")
    n_mois = (v.index[-1].year - v.index[0].year) * 12 + (v.index[-1].month - v.index[0].month) + 1
    n_annees = n_mois / 12
    if n_annees < MIN_ANNEES:
        raise ValueError(f"Période trop courte : {n_annees:.1f} ans, il en faut au moins {MIN_ANNEES}.")

    anomalies = anomalies_mensuelles(v)
    annuel = moyennes_annuelles(anomalies)
    if len(annuel) < MIN_ANNEES:
        raise ValueError(f"Trop peu d'années complètes ({len(annuel)}) pour tester une tendance.")

    t_an = annuel.index.to_numpy(dtype=float) + 0.5  # milieu de l'année civile
    y_an = annuel.to_numpy(dtype=float)
    with np.errstate(invalid="ignore", divide="ignore"):
        res_mk = mk.original_test(y_an)
    pente_an, ic_bas, ic_haut = pente_sen_ic(t_an, y_an, res_mk.var_s)
    p = float(res_mk.p) if np.isfinite(res_mk.p) else 1.0  # variance dégénérée (très peu d'années) : rien de significatif
    significatif = p < SEUIL_P
    sens = "hausse" if pente_an >= 0 else "baisse"

    # Droite de tendance sur l'index mensuel : intercept de Conover (médiane des résidus), temps en années.
    t_mois = anomalies.index.year.to_numpy() + (anomalies.index.month.to_numpy() - 0.5) / 12
    origine = float(np.median(y_an - pente_an * t_an))
    droite = pd.Series(pente_an * t_mois + origine, index=anomalies.index, name="tendance")

    # Contrôles secondaires.
    lignes = [
        _ligne("Mann-Kendall (moyennes annuelles)", res_mk.z, p, f"Z = {res_mk.z:.2f}, tau = {res_mk.Tau:.2f}, n = {len(y_an)} ans. Test principal."),
        _ligne("Pente de Sen (par décennie)", pente_an * 10, None, f"IC 95 % : {ic_bas * 10:+.3g} à {ic_haut * 10:+.3g} {serie.variable.unite}/décennie"),
    ]
    lignes += _controles(y_an, anomalies)
    reg = sps.linregress(t_an, y_an)
    detail_ols = f"Pente OLS par décennie, R² = {reg.rvalue ** 2:.2f}. Sensible aux valeurs extrêmes."
    lignes.append(_ligne("Régression linéaire (contrôle)", reg.slope * 10, reg.pvalue, detail_ols))
    tests = pd.DataFrame(lignes, columns=["Test", "Valeur", "p-value", "Significatif", "Détail"])

    courte = n_annees < ANNEES_CLIMAT
    return ResultatTendance(
        serie=serie,
        debut=v.index[0],
        fin=v.index[-1],
        n_annees=n_annees,
        anomalies=anomalies,
        droite=droite,
        pente_decennie=pente_an * 10,
        ic95=(ic_bas * 10, ic_haut * 10),
        p_value=p,
        significatif=significatif,
        sens=sens,
        changement_total=pente_an * n_annees,
        periode_courte=courte,
        resume=_resume(serie, sens, significatif, pente_an * 10, p, v.index[0], v.index[-1], courte),
        tests=tests,
        ruptures=[],
    )
