# Image Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/output/2026-05-19_05-37-38-512_image-gen`
- Total providers: 6 (0 local, 6 service)
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
| 1 | `grok/grok-imagine-image` | 3.57s |
| 2 | `grok/grok-imagine-image-quality` | 4.45s |
| 3 | `minimax/image-01` | 15.87s |

### Top 3 Cheapest

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `minimax/image-01` | $0.0035 |
| 2 | `grok/grok-imagine-image` | $0.0200 |
| 3 | `grok/grok-imagine-image-quality` | $0.0500 |

### Top 3 Highest Quality

Unavailable: No explicit image quality metric was available for service providers. File size, dimensions, duration, bitrate, and subjective judgment are not used as quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| `gemini/gemini-3.1-flash-image-preview` | n/a | 23.69s | $0.0670 |
| `grok/grok-imagine-image` | n/a | 3.57s | $0.0200 |
| `grok/grok-imagine-image-quality` | n/a | 4.45s | $0.0500 |
| `minimax/image-01` | n/a | 15.87s | $0.0035 |
| `openai/gpt-image-2` | n/a | 62.83s | $0.0530 |
| `runway/gen4_image` | n/a | 31.01s | $0.0500 |

## Notes

- Best overall: `minimax/image-01` scored 89.63/100.
- The cheapest provider was `minimax/image-01` at 0.3500¢ ($0.0035).
- Fastest provider: `grok/grok-imagine-image` at 3.57s.
- Ranking used price-speed scoring: cost efficiency (50%) and processing speed (50%).
- Image existence, dimensions, and file size are reported as evidence only; they are not scoring inputs.
