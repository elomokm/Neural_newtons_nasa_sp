# expected input/output structures
from pydantic import BaseModel
from typing import List


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