# Video Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/output/2026-05-19_06-59-45-293_video-gen`
- Total providers: 5 (0 local, 5 service)
- Local and service providers are intentionally not ranked against each other.
- Reports expose separate fastest, cheapest, and highest-quality surfaces for each group.

## Method

- Fastest rankings use processing time when present.
- Cheapest local rankings use zero monetary cost and compare only local providers.
- Cheapest service rankings use reported monetary cost when present.
- Highest-quality rankings use only explicit quality evidence for the category.

## Local Providers

### Top 3 Fastest

Unavailable: No local providers were found.

### Top 3 Cheapest

Unavailable: No local providers were found.

### Top 3 Highest Quality

Unavailable: No local providers were found.

### Provider Detail

No local providers were found.

## Service Providers

### Top 3 Fastest

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `gemini/veo-3.1-lite-generate-preview` | 41.42s |
| 2 | `grok/grok-imagine-video` | 41.76s |
| 3 | `gemini/veo-3.1-fast-generate-preview` | 62.03s |

### Top 3 Cheapest

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `gemini/veo-3.1-lite-generate-preview` | $0.4000 |
| 2 | `grok/grok-imagine-video` | $0.4000 |
| 3 | `gemini/veo-3.1-fast-generate-preview` | $0.8000 |

### Top 3 Highest Quality

Unavailable: No explicit video quality metric was available for service providers. File size, dimensions, duration, bitrate, and subjective judgment are not used as quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| `gemini/veo-3.1-fast-generate-preview` | n/a | 62.03s | $0.8000 |
| `gemini/veo-3.1-generate-preview` | n/a | 72.16s | $3.2000 |
| `gemini/veo-3.1-lite-generate-preview` | n/a | 41.42s | $0.4000 |
| `grok/grok-imagine-video` | n/a | 41.76s | $0.4000 |
| `runway/gen4.5` | n/a | 172.09s | $0.9600 |

## Notes

- Best overall: `gemini/veo-3.1-lite-generate-preview` scored 100.00/100.
- The cheapest providers were `gemini/veo-3.1-lite-generate-preview` and `grok/grok-imagine-video` at 40.0000¢ ($0.4000).
- Fastest provider: `gemini/veo-3.1-lite-generate-preview` at 41.42s.
- Ranking used price-speed scoring: cost efficiency (50%) and processing speed (50%).
- Video artifact existence, file size, duration, dimensions, format, and bitrate are reported as evidence only; video quality is not assessed or scored.
