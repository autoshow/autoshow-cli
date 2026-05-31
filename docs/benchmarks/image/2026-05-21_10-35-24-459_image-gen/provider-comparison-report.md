# Image Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/image/2026-05-21_10-35-24-459_image-gen`
- Total providers: 9
- Judge model: `gpt-5.5`
- Local and service providers are intentionally not ranked against each other.

## Method

- Price rankings use zero monetary cost for local providers and reported monetary cost for services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Automated quality rankings use the explicit OpenAI vision judge score from `image-quality-report.json`.
- Human quality rankings use only explicit `humanQualityScore` evidence.
- File size, dimensions, latency, and cost are not used as quality proxies.

## Local Providers

### Price

Unavailable: No providers were found.

### Speed

Unavailable: No providers were found.

### Automated Quality

Unavailable: No providers were found.

### Human Quality

Unavailable: No providers were found.

### Provider Detail

No local providers were found.

## Service Providers

### Price

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `grok/grok-imagine-image` | $0.0200 |
| 2 | `reve/latest` | $0.0240 |
| 3 | `bfl/flux-2-pro` | $0.0300 |
| 4 | `bfl/flux-2-flex` | $0.0500 |
| 5 | `grok/grok-imagine-image-quality` | $0.0500 |
| 6 | `openai/gpt-image-2` | $0.0530 |
| 7 | `gemini/gemini-3.1-flash-image-preview` | $0.0670 |
| 8 | `bfl/flux-2-max` | $0.0700 |
| 9 | `openai/gpt-image-1.5` | $0.0800 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `grok/grok-imagine-image-quality` | 5.05s |
| 2 | `grok/grok-imagine-image` | 6.01s |
| 3 | `reve/latest` | 6.12s |
| 4 | `bfl/flux-2-pro` | 11.52s |
| 5 | `bfl/flux-2-flex` | 16.18s |
| 6 | `openai/gpt-image-1.5` | 22.10s |
| 7 | `gemini/gemini-3.1-flash-image-preview` | 25.02s |
| 8 | `bfl/flux-2-max` | 41.69s |
| 9 | `openai/gpt-image-2` | 152.34s |

### Automated Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `bfl/flux-2-flex` | 88.00/100 |
| 2 | `openai/gpt-image-1.5` | 88.00/100 |
| 3 | `openai/gpt-image-2` | 86.00/100 |
| 4 | `bfl/flux-2-max` | 84.00/100 |
| 5 | `grok/grok-imagine-image` | 84.00/100 |
| 6 | `gemini/gemini-3.1-flash-image-preview` | 82.00/100 |
| 7 | `grok/grok-imagine-image-quality` | 82.00/100 |
| 8 | `bfl/flux-2-pro` | 80.00/100 |
| 9 | `reve/latest` | 76.00/100 |

### Human Quality

Unavailable: No explicit humanQualityScore was available for these providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| `bfl/flux-2-flex` | 88.00/100 | 16.18s | $0.0500 |
| `bfl/flux-2-max` | 84.00/100 | 41.69s | $0.0700 |
| `bfl/flux-2-pro` | 80.00/100 | 11.52s | $0.0300 |
| `gemini/gemini-3.1-flash-image-preview` | 82.00/100 | 25.02s | $0.0670 |
| `grok/grok-imagine-image` | 84.00/100 | 6.01s | $0.0200 |
| `grok/grok-imagine-image-quality` | 82.00/100 | 5.05s | $0.0500 |
| `openai/gpt-image-1.5` | 88.00/100 | 22.10s | $0.0800 |
| `openai/gpt-image-2` | 86.00/100 | 152.34s | $0.0530 |
| `reve/latest` | 76.00/100 | 6.12s | $0.0240 |

## Notes

- Image mode evaluates existing generated images only; it does not generate new images.
- Quality scores are explicit judge scores and are not inferred from file size, dimensions, latency, or cost.
