# Diversification score

Score = clamp(0, 100, `100 - 0.90×max(0, largest holding%-10) - 0.35×max(0, top-three%-35) - 0.45×max(0, largest sector%-30) - 0.15×unresolved value% + min(10, positive holding count)`).

Subscores expose the single-security, sector, breadth, and data-quality contributions. ETFs and mutual funds are single direct holdings; the engine does not claim constituent look-through. Cash is included in portfolio value but excluded from security concentration. Unknown sectors and unresolved securities reduce coverage and the score's data-quality subscore.

This is an explainable composition signal, not a risk rating or recommendation.
