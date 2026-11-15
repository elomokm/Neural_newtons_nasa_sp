"""Serveur de l'app (app/api.py) sur le cache réel : routes, erreurs du contrat, histoires de la démo."""
import pytest
from fastapi.testclient import TestClient

import api
import backend

pytestmark = pytest.mark.skipif(backend.MOCK, reason="cache data/cache vide : le serveur tourne sur le mock")
client = TestClient(api.app)


def test_catalogue():
    cat = client.get("/api/catalogue").json()
    assert not cat["mock"] and cat["advisor"]
    assert [v["id"] for v in cat["variables"]] == ["t2m", "qv2m", "precip", "no2"]
    assert len(cat["regions"]) == 11 and len(cat["scenarios"]) >= 3
    assert cat["periodes"]["t2m"] == ["1980-01", "2024-12"] and cat["periodes"]["no2"][0] == "2004-10"


def test_analyse_resultat_complet():
    r = client.get("/api/analyse", params={"variable_id": "t2m", "region_id": "paris"}).json()
    assert r["significatif"] and r["sens"] == "hausse" and r["origine"] == "zone"
    assert r["ic95"][0] < r["pente_decennie"] < r["ic95"][1]
    assert len(r["anomalies"]["dates"]) == len(r["droite"]["dates"]) == 540
    assert {"Test", "Valeur", "p-value", "Significatif", "Détail"} <= set(r["tests"][0])


def test_erreurs_du_contrat():
    assert client.get("/api/analyse", params={"variable_id": "no2", "region_id": "svalbard"}).json()["detail"]["code"] == "pas_en_cache"
    assert client.get("/api/analyse", params={"variable_id": "x", "region_id": "paris"}).status_code == 404
    rr = client.get("/api/analyse", params={"variable_id": "t2m", "region_id": "paris", "debut": "2020-01", "fin": "2023-12"})
    assert rr.status_code == 422 and rr.json()["detail"]["code"] == "periode_trop_courte"


def _verdict(v, r, debut=None, fin=None):
    p = {"variable_id": v, "region_id": r}
    if debut:
        p.update(debut=debut, fin=fin)
    j = client.get("/api/analyse", params=p).json()
    return ("hausse" if j["sens"] == "hausse" else "baisse") if j["significatif"] else "aucune"


def test_histoires_de_la_demo():
    """Les scénarios de data/demos/scenarios.yaml racontent ce que disent les données (aucun chiffre écrit à l'avance)."""
    assert [_verdict("t2m", "paris"), _verdict("no2", "paris"), _verdict("precip", "paris")] == ["hausse", "baisse", "aucune"]
    assert _verdict("no2", "los_angeles") == "baisse" and _verdict("no2", "dhaka") == "hausse"
    assert _verdict("no2", "pekin", "2005-01", "2011-12") == "aucune" and _verdict("no2", "pekin", "2012-01", "2024-12") == "baisse"
    sv = client.get("/api/analyse", params={"variable_id": "t2m", "region_id": "svalbard"}).json()["pente_decennie"]
    pa = client.get("/api/analyse", params={"variable_id": "t2m", "region_id": "paris"}).json()["pente_decennie"]
    assert sv > 1.5 * pa


def test_atlas_stabilite_assistant_front():
    assert len(client.get("/api/atlas", params={"variable_id": "no2"}).json()["points"]) == 10
    pts = client.get("/api/stabilite", params={"variable_id": "t2m", "region_id": "paris"}).json()["points"]
    assert pts[0]["debut"] == 1980 and pts[-1]["debut"] == 2015
    s = client.post("/api/suggerer", json={"question": "La pollution baisse-t-elle à Pékin ?"}).json()
    assert s["variable_ids"][0] == "no2" and s["region_id"] == "pekin"
    assert "Paris" in client.post("/api/expliquer", json={"variable_id": "t2m", "region_id": "paris"}).json()["texte"]
    assert client.get("/").status_code == 200
