import types

import pytest

from conftest import serie_synthetique
from trend import advisor
from trend.advisor import expliquer, suggerer
from trend.stats import analyser


def test_suggestions_par_mots_cles():
    s = suggerer("Est-ce que la pollution baisse à Pékin ?")
    assert s.variable_ids[0] == "no2" and s.region_id == "pekin" and s.source == "mots_cles"
    s = suggerer("Il pleut moins au Sahel ?")
    assert s.variable_ids[0] == "precip" and s.region_id == "sahel"
    s = suggerer("Is the Arctic warming faster?")
    assert s.variable_ids[0] == "t2m" and s.region_id == "svalbard"
    s = suggerer("NO2 au Svalbard")
    assert "no2" not in s.variable_ids and s.region_id == "svalbard"  # pas de NO₂ en nuit polaire


def test_suggestion_sans_indice_ne_plante_pas():
    s = suggerer("")
    assert s.variable_ids and s.explication
    s = suggerer("blabla 42 ???")
    assert s.variable_ids == ["t2m"] and s.region_id is None


def test_expliquer_reprend_les_chiffres_du_resultat():
    r = analyser(serie_synthetique(pente_decennie=0.5, bruit=0.8))
    texte = expliquer(r)
    assert "Paris" in texte and "par décennie" in texte and "significative" in texte
    assert "prouv" not in texte.lower()
    r2 = analyser(serie_synthetique(pente_decennie=0.0, bruit=1.0, graine=3))
    assert "pas de tendance significative" in expliquer(r2)


# --- Agent IA (simulé : aucun appel réseau) ----------------------------------------------------


class FauxAgent:
    """Remplace src/agent/agent.py : renvoie des réponses fixées, ou lève une erreur."""

    def __init__(self, resume=None, suggestion=None, erreur=None):
        self.resume, self.suggestion, self.erreur = resume, suggestion, erreur

    def analyse_environment(self, data):
        if self.erreur:
            raise self.erreur
        self.data = data
        return types.SimpleNamespace(executive_summary=self.resume)

    def suggest_from_question(self, question, catalogue):
        if self.erreur:
            raise self.erreur
        return types.SimpleNamespace(**self.suggestion)


@pytest.fixture
def brancher(monkeypatch):
    def _brancher(faux):
        advisor._suggerer_ia.cache_clear()
        advisor._texte_agent.cache_clear()
        monkeypatch.setattr(advisor, "_agent", lambda: faux)
        return faux

    yield _brancher
    advisor._suggerer_ia.cache_clear()
    advisor._texte_agent.cache_clear()


def test_sans_cle_on_utilise_le_repli(monkeypatch):
    from agent import agent  # noqa: F401  importé d'abord : l'import lit .env et y reprendrait la clé
    monkeypatch.undo()  # retire le faux _agent de conftest : on teste la vraie détection de clé
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert advisor._agent() is None
    assert suggerer("La pollution baisse-t-elle à Pékin ?").source == "mots_cles"


def test_explication_ia_acceptee_si_chiffres_du_resultat(brancher):
    r = analyser(serie_synthetique(pente_decennie=0.5, bruit=0.8))
    pente = f"{r.pente_decennie:.2f}".replace(".", ",")
    texte = f"À Paris, entre {r.debut.year} et {r.fin.year}, la température monte d'environ {pente} °C par décennie (seuil de 5 %)."
    faux = brancher(FauxAgent(resume=texte))
    assert expliquer(r) == texte
    assert faux.data["statistics"][r.serie.variable.nom]["significant"] is True


def test_explication_ia_rejetee_si_chiffre_invente(brancher):
    r = analyser(serie_synthetique(pente_decennie=0.5, bruit=0.8))
    brancher(FauxAgent(resume="La température a augmenté de 37 % depuis 1950, c'est prouvé."))
    texte = expliquer(r)
    assert "37" not in texte and texte == advisor._expliquer_regles(r)


def test_garde_fou_chiffres():
    ok = [0.412, -0.1, 0.9, 2005, 2024]
    assert advisor.chiffres_verifies("+0,41 g/kg par décennie entre 2005 et 2024 (NO2, T2M)", ok)
    assert advisor.chiffres_verifies("de −0,1 à 0,9", ok)
    assert not advisor.chiffres_verifies("+0,47 g/kg", ok)
    assert not advisor.chiffres_verifies("soit 12 % de plus", ok)


def test_explication_ia_en_panne_bascule_sur_les_regles(brancher):
    r = analyser(serie_synthetique(pente_decennie=0.5, bruit=0.8))
    brancher(FauxAgent(erreur=TimeoutError("délai dépassé")))
    assert expliquer(r) == advisor._expliquer_regles(r)


def test_suggestion_ia_verifiee_contre_le_catalogue(brancher):
    brancher(FauxAgent(suggestion={"variable_ids": ["co2", "no2"], "region_id": "pekin", "explication": "Le NO₂ trace la pollution.", "hors_sujet": False}))
    s = suggerer("L'air de Pékin est-il plus propre ?")
    assert s.source == "ia" and s.variable_ids == ["no2"] and s.region_id == "pekin"


def test_suggestion_ia_combinaison_indisponible_puis_repli(brancher):
    brancher(FauxAgent(suggestion={"variable_ids": ["no2"], "region_id": "svalbard", "explication": "…", "hors_sujet": False}))
    s = suggerer("NO2 au Svalbard")
    assert s.source == "mots_cles" and "no2" not in s.variable_ids


def test_suggestion_ia_region_inventee_et_hors_sujet(brancher):
    brancher(FauxAgent(suggestion={"variable_ids": ["t2m"], "region_id": "atlantide", "explication": "La température.", "hors_sujet": False}))
    assert suggerer("Fait-il plus chaud ?").region_id is None
    brancher(FauxAgent(suggestion={"variable_ids": [], "region_id": None, "explication": "", "hors_sujet": True}))
    s = suggerer("Qui a gagné la Coupe du monde ?")
    assert s.source == "ia" and s.variable_ids == [] and s.region_id is None


def test_suggestion_ia_en_panne_bascule_sur_les_regles(brancher):
    brancher(FauxAgent(erreur=ConnectionError("réseau coupé")))
    s = suggerer("Il pleut moins au Sahel ?")
    assert s.source == "mots_cles" and s.variable_ids[0] == "precip"


def test_garde_fou_vocabulaire():
    assert not advisor.vocabulaire_ok("Les pluies sont restées globalement stables.", significatif=False)
    assert advisor.vocabulaire_ok("Pas de tendance significative, ce qui ne veut pas dire « stable ».", significatif=False)
    assert advisor.vocabulaire_ok("Les valeurs ne montrent pas de changement clair et stable.", significatif=False)
    assert not advisor.vocabulaire_ok("Le réchauffement est prouvé.", significatif=True)


# --- NASABot : questions libres (agent simulé) --------------------------------------------------

class FauxBot:
    def __init__(self, texte=None, erreur=None):
        self.texte, self.erreur = texte, erreur

    def answer_question(self, question, context, language, history):
        if self.erreur:
            raise self.erreur
        self.vu = (question, context, language, history)
        return self.texte


def test_repondre_sans_agent_renvoie_none():
    assert advisor.repondre("what do you see", None, "en") is None


def test_repondre_avec_le_resultat_comme_contexte(brancher):
    r = analyser(serie_synthetique(pente_decennie=0.5, bruit=0.8))
    pente = f"{r.pente_decennie:.2f}"
    faux = brancher(FauxBot(texte=f"In Paris the temperature rises by about {pente} °C per decade. A trend does not prove its cause."))
    assert advisor.repondre("what do you see", r, "en", [{"who": "me", "text": "hi"}]).startswith("In Paris")
    question, contexte, langue, historique = faux.vu
    assert langue == "en" and contexte["result"]["region"] == "Paris" and historique == [{"who": "me", "text": "hi"}]


def test_repondre_rejette_chiffre_invente_et_cause_prouvee(brancher):
    r = analyser(serie_synthetique(pente_decennie=0.5, bruit=0.8))
    brancher(FauxBot(texte="Temperatures rose 40 % because of cars."))
    assert advisor.repondre("why?", r, "en") is None
    brancher(FauxBot(texte="This proves that traffic is the cause."))
    assert advisor.repondre("why?", r, "en") is None


def test_repondre_accepte_un_nombre_de_la_question(brancher):
    brancher(FauxBot(texte="Je ne peux pas prédire 2050 : l'outil décrit seulement une tendance passée."))
    assert advisor.repondre("et en 2050 ?", None, "fr") is not None


def test_repondre_en_panne(brancher):
    brancher(FauxBot(erreur=TimeoutError()))
    assert advisor.repondre("what do you see", None, "en") is None


def test_vocabulaire_anglais():
    assert advisor.vocabulaire_ok("This does not prove a cause.", significatif=True)
    assert not advisor.vocabulaire_ok("This proves the warming.", significatif=True)
    assert not advisor.vocabulaire_ok("Rain stayed stable.", significatif=False)
    assert advisor.vocabulaire_ok("No trend, which does not mean stable.", significatif=False)
