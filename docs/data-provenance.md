# Data provenance

Every market-data record is independently traceable.

| Data                        | Storage                    | Required provenance                                                                                |
| --------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------- |
| Quote                       | `MarketQuote`              | provider, retrieval time, market timestamp, provider timestamp, data status, transformation method |
| Price history               | `HistoricalPrice`          | provider, trading date, adjusted flag, retrieval time, timestamps, transformation method           |
| Profile/fundamentals        | `SecurityEnrichment`       | provider, retrieval time, provider timestamp, endpoint provenance                                  |
| Dividends, splits, earnings | `CorporateEvent`           | provider, event timestamp, retrieval time, source metadata                                         |
| News                        | `MarketNewsItem`           | provider, article/source identifiers, URL, publication timestamp, retrieval time                   |
| Identity resolution         | `MarketSecurityResolution` | provider, confidence, resolution source, search evidence, timestamp                                |

`DELAYED`, `END_OF_DAY`, `STALE`, `UNAVAILABLE`, `UNSUPPORTED`, and `PROVIDER_FAILURE` are distinct states. UI code must not render a missing value as `0`, and must not describe data as real-time unless the provider status explicitly says `REAL_TIME`.

Imported broker/CSV values remain their own source of truth and are not silently replaced by an external quote. Any future valuation or FX conversion must retain its own source, timestamps, and transformation record.
