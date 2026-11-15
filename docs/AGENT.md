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

## 3. État actuel : l'agent d'Ashneel est branché

- `src/agent/` est copié de la branche `ashneel` (la branche n'est pas fusionnée : elle part d'un ancien `main`).
  Son `analyse_environment` et son prompt sont conservés ; ajouts : client OpenAI créé au premier appel (l'import ne
  plante plus sans clé), délai `AGENT_TIMEOUT` (12 s par défaut) sans nouvelle tentative, règles propres à l'app
  (`APP_RULES` : français, 2 chiffres significatifs, jamais « stable » ni de cause), et `suggest_from_question` pour
  choisir variable et région.
- `trend/advisor.py` : `suggerer` et `expliquer` essaient l'agent si `OPENAI_API_KEY` est définie, sinon (ou en cas
  d'erreur) utilisent les règles (`_suggerer_regles`, `_expliquer_regles`).
- Garde-fous sur la réponse de l'agent :
  - suggestion : ids hors catalogue retirés, région inconnue mise à `None`, variable indisponible pour la région
    retirée ; s'il ne reste rien, repli. Question hors sujet ou détournement : aucune variable proposée ;
  - explication : on garde `executive_summary`. Rejetée (repli) si un seul nombre ne correspond pas, à l'arrondi
    près, à une valeur du résultat, si elle dit « prouvé / démontré », ou « stable » pour un résultat non significatif.
- Réponses mises en cache (même question, même résultat) : la démo ne repaie pas deux fois.

## 4. Configuration

Fichier `.env` à la racine (ignoré par git, jamais commité) :

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini     # facultatif
AGENT_TIMEOUT=12              # facultatif, en secondes
```

Sans clé, l'app fonctionne à l'identique avec le repli (`source="mots_cles"`).

## 5. Vérifier

```bash
PYTHONPATH=src:app .venv/bin/python -m pytest -q          # 32 tests, jamais d'appel réseau (agent simulé)
TREND_MOCK=0 PYTHONPATH=src .venv/bin/python app/api.py   # puis NASABot dans http://localhost:8000
```

Questions de test : « La pollution baisse-t-elle à Pékin ? », « Il pleut moins au Sahel ? », « NO2 au Svalbard »,
« Qui a gagné la Coupe du monde ? », puis « Que montre ce résultat ? » sur un verdict affiché.
