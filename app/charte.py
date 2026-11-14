"""Charte visuelle : couleurs de sens, style CSS et mise en forme des nombres."""
from __future__ import annotations

import math

import pandas as pd
import streamlit as st

from textes import LANGUE, nom_mois

# Trois couleurs de sens, les mêmes partout (verdict, graphiques, carte).
ORANGE = "#E8590C"  # hausse significative
BLEU = "#1971C2"    # baisse significative
GRIS = "#868E96"    # pas de tendance significative
COULEURS = {"hausse": ORANGE, "baisse": BLEU, "aucune": GRIS}
FONDS = {"hausse": "#FFF4E6", "baisse": "#E7F5FF", "aucune": "#F1F3F5"}

ENCRE = "#1F2328"
DISCRET = "#57606A"
COURBE = "#495057"      # valeurs brutes
ANOMALIES = "#ADB5BD"   # anomalies mensuelles, en retrait derrière la droite

SEPARATEUR = "," if LANGUE == "fr" else "."
SEPARATEURS_PLOTLY = ", " if LANGUE == "fr" else ".,"  # décimale puis milliers
MOINS = "−"


def tonalite(resultat) -> str:
    """'hausse', 'baisse' ou 'aucune' (non significatif) : pilote la couleur."""
    return resultat.sens if resultat.significatif else "aucune"


def decimales(x: float, chiffres: int = 2) -> int:
    """Nombre de décimales pour garder `chiffres` chiffres significatifs."""
    if not math.isfinite(x) or x == 0:
        return chiffres - 1
    return max(0, chiffres - 1 - math.floor(math.log10(abs(x))))


def nombre(x: float, d: int) -> str:
    texte = f"{abs(x):.{d}f}"
    negatif = x < 0 and float(texte) != 0
    return (MOINS if negatif else "") + texte.replace(".", SEPARATEUR)


def signe(x: float, d: int) -> str:
    """Nombre toujours signé (+ ou vrai signe moins), sauf zéro."""
    texte = f"{abs(x):.{d}f}"
    if float(texte) == 0:
        return texte.replace(".", SEPARATEUR)
    return ("+" if x > 0 else MOINS) + texte.replace(".", SEPARATEUR)


def avec_unite(valeur: str, unite: str) -> str:
    """'+0,41 °C', mais '−5,8 × 10¹⁵ molécules/cm²' quand l'unité commence par un chiffre."""
    return f"{valeur} × {unite}" if unite[:1].isdigit() else f"{valeur} {unite}"


def p_texte(p: float) -> str:
    if p < 0.001:
        return f"< 0{SEPARATEUR}001"
    return nombre(p, 3)


def mois(ts: pd.Timestamp) -> str:
    return f"{nom_mois(ts.month)} {ts.year}"


CSS = f"""
<style>
.block-container {{ padding-top: 2.2rem; max-width: 1250px; }}
.td-mock {{ background:#FFF8DB; color:#5C4400; border:1px solid #F2E2A0; border-radius:8px;
  padding:.35rem .8rem; font-size:.85rem; margin-bottom:.9rem; }}
.td-entete {{ font-size:1rem; letter-spacing:.05em; color:{DISCRET}; margin:0 0 .6rem; }}
.td-entete b {{ color:{ENCRE}; text-transform:uppercase; letter-spacing:.08em; }}
.td-verdict {{ border-left:10px solid var(--c); background:var(--f); border-radius:14px;
  padding:1.1rem 1.5rem 1.2rem; margin-bottom:1.1rem; color:{ENCRE}; }}
.td-ligne1 {{ display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:.3rem 1.5rem; }}
.td-badge {{ color:var(--c); font-weight:800; font-size:1.7rem; text-transform:uppercase;
  letter-spacing:.02em; line-height:1.2; }}
.td-aucune .td-badge {{ font-size:1.35rem; }}
.td-pente {{ color:var(--c); font-weight:800; font-size:2.7rem; line-height:1;
  font-variant-numeric:tabular-nums; white-space:nowrap; }}
.td-aucune .td-pente {{ font-size:1.7rem; }}
.td-pente small {{ font-size:1.05rem; font-weight:500; color:{DISCRET}; margin-left:.35rem; }}
.td-total {{ font-size:1.3rem; margin-top:.7rem; }}
.td-ic {{ display:block; color:{DISCRET}; font-size:.98rem; margin-top:.15rem; }}
.td-phrase {{ font-size:1.08rem; margin-top:.55rem; line-height:1.5; }}
.td-clair {{ font-size:1.3rem; font-weight:700; margin-top:.55rem; }}
.td-alerte {{ margin-top:.8rem; font-size:.95rem; color:#5C4400; background:#FFF8DB; border-radius:8px; padding:.45rem .75rem; }}
</style>
"""


def injecter_css() -> None:
    st.markdown(CSS, unsafe_allow_html=True)
