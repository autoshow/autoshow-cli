# URL Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/url/2026-05-21_09-38-58-898_autogenerate-show-notes-with-whisper-cpp-llama-cpp-and-node-js`
- Total providers: 4 (1 local, 3 service)
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
| 1 | <code>defuddle</code> | 0.85s |

### Automated Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>defuddle</code> | 99.40 accuracy (0.61% WER, 0.59% CER, 99.39% coverage) |

### Human Quality

Unavailable: No explicit humanQualityScore was available for local providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>defuddle</code> | 0.61% WER, 0.59% CER, 99.39% coverage | 0.85s | $0.00 |

## Service Providers

### Price

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>firecrawl</code> | $0.0008 |
| 2 | <code>spider</code> | $0.0012 |
| 3 | <code>glm-reader</code> | $0.0100 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>firecrawl</code> | 1.81s |
| 2 | <code>spider</code> | 1.96s |
| 3 | <code>glm-reader</code> | 5.77s |

### Automated Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>spider</code> | 93.09 accuracy (8.86% WER, 9.78% CER, 99.88% coverage) |
| 2 | <code>firecrawl</code> | 92.35 accuracy (9.61% WER, 10.39% CER, 99.03% coverage) |
| 3 | <code>glm-reader</code> | 83.73 accuracy (20.61% WER, 20.23% CER, 96.35% coverage) |

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>firecrawl</code> | 9.61% WER, 10.39% CER, 99.03% coverage | 1.81s | $0.0008 |
| <code>glm-reader</code> | 20.61% WER, 20.23% CER, 96.35% coverage | 5.77s | $0.0100 |
| <code>spider</code> | 8.86% WER, 9.78% CER, 99.88% coverage | 1.96s | $0.0012 |

## Notes

- No additional notes.
