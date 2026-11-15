# Brancher l'agent IA

L'application appelle l'agent par **deux fonctions seulement**, dans `src/trend/advisor.py`. Tant qu'elles gardent la même
signature, rien d'autre n'est à modifier : ni le serveur, ni le front.

## 1. Les deux fonctions (contrat, `docs/CONTRAT.md` section 2)

```python
from trend.schemas import ResultatTendance, Suggestion

def suggerer(question: str) -> Suggestion: ...
def expliquer(resultat: ResultatTendance) -> str: ...
```

| Fonction | Reçoit | Renvoie | Utilisée quand |
|---|---|---|---|
| `suggerer` | La question libre de l'utilisateur, ex. « La pollution baisse-t-elle à Pékin ? » | `Suggestion(variable_ids, region_id, explication, source)` | Question tapée dans NASABot ; l'app ouvre ensuite la variable et la région proposées. |
| `expliquer` | Le `ResultatTendance` affiché (pente, IC, p-value, période, région…) | Un texte de 3 à 5 phrases en langage simple | Bouton « Que montre ce résultat ? » de NASABot. |

`Suggestion` :

- `variable_ids` : **uniquement** des ids du catalogue : `t2m`, `qv2m`, `precip`, `no2` (le premier est ouvert) ;
- `region_id` : un id du catalogue (`paris`, `po`, `pekin`, `los_angeles`, `dhaka`, `delhi`, `sahel`, `svalbard`, `espagne`, `amazonie`, `france`) ou `None` ;
- `explication` : une ou deux phrases affichées à l'utilisateur ;
- `source` : `"ia"` si la réponse vient du modèle, `"mots_cles"` pour le repli.

Le catalogue complet se lit avec `trend.catalog.charger_variables()` et `charger_regions()` : c'est ce qu'il faut donner
au modèle, rien de plus. Attention : pas de `no2` pour `svalbard` (`Region.variables_suggerees`).

## 2. Règles à respecter

1. **Ne jamais lever d'exception** : en cas de clé absente, de réseau coupé ou de réponse invalide, revenir aux règles actuelles.
2. **Aucun chiffre inventé** : le texte de `expliquer` ne cite que des valeurs présentes dans `ResultatTendance`
   (`pente_decennie`, `ic95`, `p_value`, `changement_total`, `debut`, `fin`, `n_annees`, `periode_courte`, `sens`, `significatif`).
3. **Vocabulaire** : « tendance significative (au seuil de 5 %) », jamais « prouvé » ; pas de cause affirmée.
4. **Clé d'API** : uniquement dans une variable d'environnement (fichier `.env`, ignoré par git). Jamais dans le code.
5. **Temps de réponse** : prévoir un délai maximal (5 s environ) puis le repli, pour que la démo ne reste jamais bloquée.

## 3. Structure conseillée

Les fonctions actuelles (règles et mots-clés, sans réseau) deviennent le repli :

```python
import os

def suggerer(question: str) -> Suggestion:
    if os.environ.get("CLE_API_AGENT"):          # nom de variable au choix
        try:
            return _suggerer_ia(question)          # appel au modèle, validé contre le catalogue
        except Exception:
            pass
    return _suggerer_regles(question)              # = la fonction suggerer actuelle, renommée

def expliquer(resultat: ResultatTendance) -> str:
    if os.environ.get("CLE_API_AGENT"):
        try:
            return _expliquer_ia(resultat)
        except Exception:
            pass
    return _expliquer_regles(resultat)             # = la fonction expliquer actuelle, renommée
```

Dans `_suggerer_ia`, vérifier la réponse du modèle avant de la renvoyer : ids hors catalogue retirés, combinaison
indisponible remplacée. Si rien ne reste, repli sur les règles.

## 4. Si l'agent part de la branche `ashneel`

Son `analyse_environment(data: dict)` attend un dictionnaire de statistiques et renvoie une `EnvironmentalAnalysis`.
Pour l'utiliser dans `expliquer` :

- construire `data` à partir du `ResultatTendance` (région, période, variable, unité, pente par décennie, IC 95 %,
  p-value, significatif, changement total) ;
- renvoyer `executive_summary` (et éventuellement `limitations`) comme texte ;
- garder le repli sur les règles si l'appel échoue.

Ne pas fusionner la branche telle quelle : elle part d'un ancien `main` et supprimerait le spike et `schemas.py`.
Copier seulement `src/agent/` dans le projet.

## 5. Vérifier

```bash
PYTHONPATH=src:app .venv/bin/python -m pytest -q tests/test_advisor.py   # doit passer SANS clé (repli)
PYTHONPATH=src .venv/bin/python app/api.py                                 # puis NASABot dans http://localhost:8000
```

Questions de test : « La pollution baisse-t-elle à Pékin ? », « Il pleut moins au Sahel ? », « NO2 au Svalbard »,
puis « Que montre ce résultat ? » sur un verdict affiché.
