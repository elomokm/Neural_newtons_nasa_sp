"""Encadrés pédagogiques, détails statistiques et pied de page."""
from __future__ import annotations

import pandas as pd
import streamlit as st

import charte
from textes import explication_unite, t


def variable(var) -> None:
    with st.container(border=True):
        st.markdown(f"#### {t('def_titre')}")
        st.markdown(var.definition)
        st.markdown(t("def_unite", unite=var.unite, explication=explication_unite(var.unite)))
        debut = charte.mois(pd.Timestamp(f"{var.debut}-01"))
        st.caption(t("def_source", source=var.source, debut=debut))


def region(reg, serie) -> None:
    with st.container(border=True):
        st.markdown(f"#### {t('reg_titre')}")
        st.markdown(reg.histoire)
        st.markdown(t("reg_type", type=reg.type))
        st.caption(t("reg_point") if serie.origine == "point" else t("reg_zone"))


def details(res) -> None:
    var = res.serie.variable
    d = charte.decimales(res.pente_decennie)
    with st.expander(t("det_titre")):
        st.markdown(
            t(
                "det_pente",
                pente=charte.avec_unite(charte.signe(res.pente_decennie, d), var.unite),
                bas=charte.signe(res.ic95[0], d),
                haut=charte.signe(res.ic95[1], d),
            )
        )
        st.markdown(
            t("det_p", p=charte.p_texte(res.p_value), n=round(res.n_annees),
              debut=charte.mois(res.debut), fin=charte.mois(res.fin))
        )
        st.markdown(t("det_p_explication"))
        st.markdown(t("det_ic_explication"))
        st.markdown(t("det_methode"))
        st.markdown(t("det_tableau"))
        st.dataframe(res.tests, hide_index=True, width="stretch")
        st.markdown(t("det_limites"))
        st.markdown("\n".join(f"- {t(cle)}" for cle in ("limite_1", "limite_2", "limite_3")))


def pied(var) -> None:
    st.divider()
    st.caption(t("pied", source=var.source, giovanni_id=var.giovanni_id))

