
from agent.agent import analyse_environment


sample_data = {
    "region": "Mauritius",

    "period": {
        "start": 2020,
        "end": 2025
    },

    "variables": [
        "temperature",
        "rainfall",
        "humidity"
    ],

    "statistics": {
        "temperature": {
            "average": 27.4,
            "unit": "degrees Celsius",
            "trend": "increasing",
            "percentage_change": 3.5
        },

        "rainfall": {
            "average": 2100,
            "unit": "mm/year",
            "trend": "decreasing",
            "percentage_change": -8.2
        },

        "humidity": {
            "average": 78,
            "unit": "percentage",
            "trend": "stable"
        }
    },

    "relationships": [
        {
            "variables": ["temperature", "rainfall"],
            "correlation": -0.62,
            "covariance": -14.3
        },

        {
            "variables": ["temperature", "humidity"],
            "correlation": 0.35,
            "covariance": 4.8
        }
    ]
}


if __name__ == "__main__":

    print("Starting environmental analysis...\n")

    result = analyse_environment(sample_data)

    print("=" * 50)
    print("ENVIRONMENTAL ANALYSIS")
    print("=" * 50)

    print("\nEXECUTIVE SUMMARY:")
    print(result.executive_summary)

    print("\nVARIABLE ANALYSES:")

    for item in result.variable_analyses:

        print(f"\n{item.variable.upper()}")
        print("Trend:", item.observed_trend)
        print("Interpretation:", item.interpretation)
        print("Implications:", item.implications)

    print("\nRELATIONSHIPS:")

    for item in result.relationship_analyses:

        print(item.variables)
        print(item.correlation_interpretation)
        print(item.significance)

    print("\nREGIONAL IMPLICATIONS:")

    for implication in result.regional_implications:
        print("-", implication)

    print("\nCONCLUSION:")
    print(result.conclusion)

    print("\nLIMITATIONS:")

    for limitation in result.limitations:
        print("-", limitation)
