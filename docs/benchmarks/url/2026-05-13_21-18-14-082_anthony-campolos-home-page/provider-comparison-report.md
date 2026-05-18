# URL Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/url/2026-05-13_21-18-14-082_anthony-campolos-home-page`
- Total providers: 5 (1 local, 4 service)
- Local and service providers are intentionally not ranked against each other.
- Reports expose separate fastest, cheapest, and highest-quality surfaces for each group.

## Method

- Fastest rankings use processing time when present.
- Cheapest local rankings use zero monetary cost and compare only local providers.
- Cheapest service rankings use reported monetary cost when present.
- Highest-quality rankings use only explicit quality evidence for the category.

## Local Providers

### Top 3 Fastest

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `defuddle` | 0.26s |

### Top 3 Cheapest

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `defuddle` | $0.00 local monetary cost |

### Top 3 Highest Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `defuddle` | 2.83% WER, 2.50% CER, 96.83% coverage |

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| `defuddle` | 2.83% WER, 2.50% CER, 96.83% coverage | 0.26s | $0.00 |

## Service Providers

### Top 3 Fastest

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `firecrawl` | 1.77s |
| 2 | `spider` | 1.95s |
| 3 | `glm-reader` | 3.00s |

### Top 3 Cheapest

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `firecrawl` | $0.0008 |
| 2 | `spider` | $0.0012 |
| 3 | `zyte` | $0.0016 |

### Top 3 Highest Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `firecrawl` | 3.58% WER, 2.01% CER, 98.59% coverage |
| 2 | `spider` | 7.36% WER, 4.37% CER, 97.89% coverage |
| 3 | `zyte` | 48.30% WER, 47.90% CER, 59.15% coverage |

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| `firecrawl` | 3.58% WER, 2.01% CER, 98.59% coverage | 1.77s | $0.0008 |
| `glm-reader` | 66.60% WER, 64.07% CER, 61.62% coverage | 3.00s | $0.0100 |
| `spider` | 7.36% WER, 4.37% CER, 97.89% coverage | 1.95s | $0.0012 |
| `zyte` | 48.30% WER, 47.90% CER, 59.15% coverage | 14.26s | $0.0016 |

## Notes

- No additional notes.
