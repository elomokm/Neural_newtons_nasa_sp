"""Graphiques plotly : toujours un titre, l'unité sur l'axe et la source en petit dessous."""
from __future__ import annotations

import plotly.graph_objects as go

import charte
from textes import t


def _habiller(fig: go.Figure, titre: str, axe_y: str, variable) -> go.Figure:
    fig.update_layout(
        template="plotly_white",
        height=440,
        separators=charte.SEPARATEURS_PLOTLY,
        font=dict(size=15, color=charte.ENCRE),
        title=dict(text=titre, x=0, xanchor="left", font=dict(size=19)),
        margin=dict(l=10, r=10, t=90, b=70),
        legend=dict(orientation="h", x=0, xanchor="left", y=1.02, yanchor="bottom", font=dict(size=14)),
        hovermode="x unified",
    )
    fig.update_yaxes(title_text=axe_y, gridcolor="#E9ECEF", zeroline=False)
    fig.update_xaxes(gridcolor="#F1F3F5")
    fig.add_annotation(
        text=t("g_source", source=variable.source, giovanni_id=variable.giovanni_id),
        xref="paper", yref="paper", x=0, y=-0.17, xanchor="left", showarrow=False,
        font=dict(size=12, color=charte.DISCRET),
    )
    return fig


def brut(res) -> go.Figure:
    serie = res.serie
    var = serie.variable
    valeurs = serie.valeurs
    fig = go.Figure(
        go.Scatter(
            x=valeurs.index, y=valeurs.to_numpy(), mode="lines", name=t("g_leg_brut"),
            line=dict(color=charte.COURBE, width=1.6),
            hovertemplate=f"%{{x|%m/%Y}} : %{{y:.2f}} {var.unite}<extra></extra>",
        )
    )
    # Période analysée surlignée si elle ne couvre pas toute la série (curseur de période).
    if res.debut > valeurs.index[0] or res.fin < valeurs.index[-1]:
        fig.add_vrect(x0=res.debut, x1=res.fin, fillcolor="#FFE8CC", opacity=0.35, line_width=0, layer="below")
    titre = t("g_titre_brut", variable=var.nom, region=serie.region.nom)
    return _habiller(fig, titre, t("g_axe_brut", unite=var.unite), var)


def anomalies(res) -> go.Figure:
    var = res.serie.variable
    ton = charte.tonalite(res)
    d = charte.decimales(res.pente_decennie)
    pente = charte.avec_unite(charte.signe(res.pente_decennie, d), var.unite)
    fig = go.Figure()
    fig.add_hline(y=0, line=dict(color="#CED4DA", width=1, dash="dot"))
    fig.add_trace(
        go.Scatter(
            x=res.anomalies.index, y=res.anomalies.to_numpy(), mode="lines", name=t("g_leg_anom"),
            line=dict(color=charte.ANOMALIES, width=1.3),
            hovertemplate=f"%{{x|%m/%Y}} : %{{y:+.2f}} {var.unite}<extra></extra>",
        )
    )
    fig.add_trace(
        go.Scatter(
            x=res.droite.index, y=res.droite.to_numpy(), mode="lines",
            name=t("g_leg_droite", pente=pente),
            line=dict(color=charte.COULEURS[ton], width=5),
            hoverinfo="skip",
        )
    )
    titre = t("g_titre_anom", variable=var.nom, region=res.serie.region.nom)
    return _habiller(fig, titre, t("g_axe_anom", unite=var.unite), var)
