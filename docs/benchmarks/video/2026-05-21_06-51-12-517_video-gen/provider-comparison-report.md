# Video Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/video/2026-05-21_06-51-12-517_video-gen`
- Total providers: 8 (0 local, 8 service)
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
| 3 | <code>gemini/veo-3.1-lite-generate-preview</code> | $0.2000 |
| 4 | <code>glm/cogvideox-3</code> | $0.2000 |
| 5 | <code>grok/grok-imagine-video</code> | $0.2000 |
| 6 | <code>minimax/MiniMax-Hailuo-2.3</code> | $0.2800 |
| 7 | <code>gemini/veo-3.1-fast-generate-preview</code> | $0.4000 |
| 8 | <code>glm/viduq1-text</code> | $0.4000 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>grok/grok-imagine-video</code> | 21.02s |
| 2 | <code>gemini/veo-3.1-fast-generate-preview</code> | 41.38s |
| 3 | <code>gemini/veo-3.1-lite-generate-preview</code> | 41.41s |
| 4 | <code>minimax/MiniMax-Hailuo-2.3</code> | 72.33s |
| 5 | <code>glm/cogvideox-3</code> | 149.94s |
| 6 | <code>minimax/T2V-01-Director</code> | 154.63s |
| 7 | <code>glm/viduq1-text</code> | 190.84s |
| 8 | <code>minimax/T2V-01</code> | 401.03s |

### Automated Quality

Unavailable: No explicit video qualityScore was available for service providers. File size, dimensions, duration, bitrate, cost, and speed are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>gemini/veo-3.1-fast-generate-preview</code> | n/a | 41.38s | $0.4000 |
| <code>gemini/veo-3.1-lite-generate-preview</code> | n/a | 41.41s | $0.2000 |
| <code>glm/cogvideox-3</code> | n/a | 149.94s | $0.2000 |
| <code>glm/viduq1-text</code> | n/a | 190.84s | $0.4000 |
| <code>grok/grok-imagine-video</code> | n/a | 21.02s | $0.2000 |
| <code>minimax/MiniMax-Hailuo-2.3</code> | n/a | 72.33s | $0.2800 |
| <code>minimax/T2V-01</code> | n/a | 401.03s | $0.1900 |
| <code>minimax/T2V-01-Director</code> | n/a | 154.63s | $0.1900 |

## Notes

- Video artifact existence, file size, duration, dimensions, format, and bitrate are reported as evidence only; video quality is not assessed or scored.
