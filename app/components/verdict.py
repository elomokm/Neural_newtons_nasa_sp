"""Carte verdict : ce qui change, de combien, et si c'est sûr."""
from __future__ import annotations

import html

import streamlit as st

import charte
from textes import t


def _chance(p: float) -> str:
    if p < 0.001:
        return t("chance_01")
    if p < 0.01:
        return t("chance_1")
    return t("chance_5")


def carte(res) -> None:
    var = res.serie.variable
    ton = charte.tonalite(res)
    d = charte.decimales(res.pente_decennie)
    pente = charte.avec_unite(charte.signe(res.pente_decennie, d), var.unite)

    blocs = [
        '<div class="td-ligne1">',
        f'<div class="td-badge">{t("v_" + ton)}</div>',
        f'<div class="td-pente">{pente}<small>{t("v_par_decennie")}</small></div>',
        "</div>",
    ]
    if res.significatif:
        dt = charte.decimales(res.changement_total)
        total = charte.avec_unite(charte.signe(res.changement_total, dt), var.unite)
        bas, haut = (charte.signe(x, d) for x in res.ic95)
        blocs += [
            f'<div class="td-total">{t("v_total", n=round(res.n_annees), total=total)}',
            f'<span class="td-ic">{t("v_ic", bas=bas, haut=charte.avec_unite(haut, var.unite))}</span></div>',
            f'<div class="td-phrase">{t("v_signif", sens=t("nom_" + res.sens), chance=_chance(res.p_value))}</div>',
        ]
        phrase = var.hausse_signifie if res.sens == "hausse" else var.baisse_signifie
        blocs.append(f'<div class="td-clair">{t("v_en_clair", phrase=html.escape(phrase))}</div>')
    else:
        blocs.append(f'<div class="td-phrase">{t("v_non_signif", pente=pente)}</div>')
    if res.periode_courte:
        blocs.append(f'<div class="td-alerte">{t("v_courte")}</div>')

    style = f"--c:{charte.COULEURS[ton]};--f:{charte.FONDS[ton]}"
    # Une seule ligne HTML : une indentation serait lue comme du code par le markdown.
    st.markdown(f'<div class="td-verdict td-{ton}" style="{style}">{"".join(blocs)}</div>', unsafe_allow_html=True)
