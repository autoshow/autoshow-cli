# URL Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/url/2026-05-13_22-06-36-105_autogenerate-show-notes-with-whisper-cpp-llama-cpp-and-node-js`
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
| 1 | `defuddle` | 0.49s |

### Top 3 Cheapest

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `defuddle` | $0.00 local monetary cost |

### Top 3 Highest Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `defuddle` | 8.22% WER, 8.89% CER, 89.88% coverage |

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| `defuddle` | 8.22% WER, 8.89% CER, 89.88% coverage | 0.49s | $0.00 |

## Service Providers

### Top 3 Fastest

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `spider` | 1.67s |
| 2 | `firecrawl` | 1.82s |
| 3 | `glm-reader` | 3.48s |

### Top 3 Cheapest

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `firecrawl` | $0.0008 |
| 2 | `spider` | $0.0012 |
| 3 | `zyte` | $0.0016 |

### Top 3 Highest Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `spider` | 1.32% WER, 1.26% CER, 100.00% coverage |
| 2 | `firecrawl` | 1.61% WER, 1.38% CER, 99.67% coverage |
| 3 | `glm-reader` | 12.28% WER, 10.87% CER, 96.70% coverage |

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| `firecrawl` | 1.61% WER, 1.38% CER, 99.67% coverage | 1.82s | $0.0008 |
| `glm-reader` | 12.28% WER, 10.87% CER, 96.70% coverage | 3.48s | $0.0100 |
| `spider` | 1.32% WER, 1.26% CER, 100.00% coverage | 1.67s | $0.0012 |
| `zyte` | 46.86% WER, 49.44% CER, 84.82% coverage | 10.20s | $0.0016 |

## Notes

- No additional notes.
