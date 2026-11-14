# Main AI agent logic and API calls

import os
import json

from dotenv import load_dotenv
from openai import OpenAI

from .prompts import SYSTEM_PROMPT
from .schemas import EnvironmentalAnalysis


# Load environment variables
load_dotenv()

# Initialize OpenAI client
client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)

MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")


def analyse_environment(data: dict) -> EnvironmentalAnalysis:
    """
    Receives environmental statistics and returns
    an AI-generated environmental interpretation.
    """

    if not data:
        raise ValueError("Environmental data cannot be empty.")

    # Convert the input dictionary into JSON
    formatted_data = json.dumps(data, indent=2)

    # Send information to the AI model
    response = client.responses.parse(
        model=MODEL,

        instructions=SYSTEM_PROMPT,

        input=f"""
        Analyse the following environmental data.

        Explain the observed trends, relationships,
        environmental significance and possible
        regional implications.

        DATA:

        {formatted_data}
        """,

        text_format=EnvironmentalAnalysis
    )

    # Retrieve the structured response
    result = response.output_parsed

    if result is None:
        raise RuntimeError("The AI did not return a valid analysis.")

    return result
