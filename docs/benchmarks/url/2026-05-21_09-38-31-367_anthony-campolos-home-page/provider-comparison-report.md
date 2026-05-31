# URL Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/url/2026-05-21_09-38-31-367_anthony-campolos-home-page`
- Total providers: 5 (1 local, 4 service)
- Local and service providers are intentionally not ranked against each other.
- Reports expose complete price, speed, automated-quality, and human-quality rankings for each group.

## Method

- Price rankings use zero monetary cost for local providers and reported monetary cost for services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Automated quality rankings use WER/CER/coverage-derived extraction accuracy.
- Human quality rankings use only explicit humanQualityScore evidence.
- File size, dimensions, duration, bitrate, cost, and speed are not used as quality proxies.

## Local Providers

### Price

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>defuddle</code> | $0.00 local monetary cost |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>defuddle</code> | 0.58s |

### Automated Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>defuddle</code> | 97.17 accuracy (2.83% WER, 2.50% CER, 96.83% coverage) |

### Human Quality

Unavailable: No explicit humanQualityScore was available for local providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>defuddle</code> | 2.83% WER, 2.50% CER, 96.83% coverage | 0.58s | $0.00 |

## Service Providers

### Price

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>firecrawl</code> | $0.0008 |
| 2 | <code>spider</code> | $0.0012 |
| 3 | <code>zyte</code> | $0.0016 |
| 4 | <code>glm-reader</code> | $0.0100 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>firecrawl</code> | 0.95s |
| 2 | <code>spider</code> | 2.04s |
| 3 | <code>glm-reader</code> | 3.88s |
| 4 | <code>zyte</code> | 13.34s |

### Automated Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>firecrawl</code> | 97.35 accuracy (3.58% WER, 2.01% CER, 98.59% coverage) |
| 2 | <code>spider</code> | 94.70 accuracy (7.36% WER, 4.37% CER, 97.89% coverage) |
| 3 | <code>zyte</code> | 53.66 accuracy (48.30% WER, 47.90% CER, 59.15% coverage) |
| 4 | <code>glm-reader</code> | 41.09 accuracy (66.60% WER, 64.07% CER, 61.62% coverage) |

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>firecrawl</code> | 3.58% WER, 2.01% CER, 98.59% coverage | 0.95s | $0.0008 |
| <code>glm-reader</code> | 66.60% WER, 64.07% CER, 61.62% coverage | 3.88s | $0.0100 |
| <code>spider</code> | 7.36% WER, 4.37% CER, 97.89% coverage | 2.04s | $0.0012 |
| <code>zyte</code> | 48.30% WER, 47.90% CER, 59.15% coverage | 13.34s | $0.0016 |

## Notes

- No additional notes.
