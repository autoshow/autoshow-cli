# Video Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/video/2026-05-21_06-50-32-135_video-gen`
- Total providers: 9 (0 local, 9 service)
- Local and service providers are intentionally not ranked against each other.
- Reports expose complete price, speed, automated-quality, and human-quality rankings for each group.

## Method

- Price rankings use zero monetary cost for local providers and reported monetary cost for services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Automated quality rankings use only explicit qualityScore evidence.
- Human quality rankings use only explicit humanQualityScore evidence.
- File size, dimensions, duration, bitrate, cost, and speed are not used as quality proxies.

## Local Providers

### Price

Unavailable: No local providers were found.

### Speed

Unavailable: No local providers were found.

### Automated Quality

Unavailable: No local providers were found.

### Human Quality

Unavailable: No local providers were found.

### Provider Detail

No local providers were found.

## Service Providers

### Price

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>minimax/T2V-01</code> | $0.1900 |
| 2 | <code>minimax/T2V-01-Director</code> | $0.1900 |
| 3 | <code>glm/cogvideox-3</code> | $0.2000 |
| 4 | <code>gemini/veo-3.1-lite-generate-preview</code> | $0.4000 |
| 5 | <code>glm/viduq1-text</code> | $0.4000 |
| 6 | <code>grok/grok-imagine-video</code> | $0.4000 |
| 7 | <code>minimax/MiniMax-Hailuo-2.3</code> | $0.5600 |
| 8 | <code>gemini/veo-3.1-fast-generate-preview</code> | $0.8000 |
| 9 | <code>gemini/veo-3.1-generate-preview</code> | $3.2000 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>grok/grok-imagine-video</code> | 41.60s |
| 2 | <code>gemini/veo-3.1-lite-generate-preview</code> | 62.05s |
| 3 | <code>gemini/veo-3.1-generate-preview</code> | 72.03s |
| 4 | <code>gemini/veo-3.1-fast-generate-preview</code> | 72.17s |
| 5 | <code>minimax/MiniMax-Hailuo-2.3</code> | 123.61s |
| 6 | <code>minimax/T2V-01-Director</code> | 155.06s |
| 7 | <code>minimax/T2V-01</code> | 165.16s |
| 8 | <code>glm/viduq1-text</code> | 196.37s |
| 9 | <code>glm/cogvideox-3</code> | 348.39s |

### Automated Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>gemini/veo-3.1-generate-preview</code> | 88.00/100 explicit quality score |
| 2 | <code>minimax/MiniMax-Hailuo-2.3</code> | 88.00/100 explicit quality score |
| 3 | <code>minimax/T2V-01-Director</code> | 88.00/100 explicit quality score |
| 4 | <code>grok/grok-imagine-video</code> | 86.00/100 explicit quality score |
| 5 | <code>gemini/veo-3.1-lite-generate-preview</code> | 84.00/100 explicit quality score |
| 6 | <code>gemini/veo-3.1-fast-generate-preview</code> | 80.00/100 explicit quality score |
| 7 | <code>glm/viduq1-text</code> | 80.00/100 explicit quality score |
| 8 | <code>minimax/T2V-01</code> | 80.00/100 explicit quality score |
| 9 | <code>glm/cogvideox-3</code> | 78.00/100 explicit quality score |

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>gemini/veo-3.1-fast-generate-preview</code> | 80.00 explicit quality score | 72.17s | $0.8000 |
| <code>gemini/veo-3.1-generate-preview</code> | 88.00 explicit quality score | 72.03s | $3.2000 |
| <code>gemini/veo-3.1-lite-generate-preview</code> | 84.00 explicit quality score | 62.05s | $0.4000 |
| <code>glm/cogvideox-3</code> | 78.00 explicit quality score | 348.39s | $0.2000 |
| <code>glm/viduq1-text</code> | 80.00 explicit quality score | 196.37s | $0.4000 |
| <code>grok/grok-imagine-video</code> | 86.00 explicit quality score | 41.60s | $0.4000 |
| <code>minimax/MiniMax-Hailuo-2.3</code> | 88.00 explicit quality score | 123.61s | $0.5600 |
| <code>minimax/T2V-01</code> | 80.00 explicit quality score | 165.16s | $0.1900 |
| <code>minimax/T2V-01-Director</code> | 88.00 explicit quality score | 155.06s | $0.1900 |

## Notes

- Video quality rankings use only explicit qualityScore or humanQualityScore evidence when available.
- Video artifact existence, file size, duration, dimensions, format, and bitrate are reported as evidence only and are not used as quality proxies.
