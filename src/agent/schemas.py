# expected input/output structures
from typing import List, Optional

from pydantic import BaseModel


class VariableAnalysis(BaseModel):
    variable: str
    observed_trend: str
    interpretation: str
    implications: str


class RelationshipAnalysis(BaseModel):
    variables: List[str]
    correlation_interpretation: str
    significance: str


class EnvironmentalAnalysis(BaseModel):
    executive_summary: str

    variable_analyses: List[VariableAnalysis]

    relationship_analyses: List[RelationshipAnalysis]

    regional_implications: List[str]

    conclusion: str

    limitations: List[str]

class QuestionSuggestion(BaseModel):
    """Sortie structurée de suggest_from_question (vérifiée ensuite contre le catalogue par trend.advisor)."""

    variable_ids: List[str]
    region_id: Optional[str]
    explication: str
    hors_sujet: bool
