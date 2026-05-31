# Image Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/image/2026-05-21_10-33-37-508_image-gen`
- Total providers: 10
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
| 3 | `reve/reve-create@20250915` | $0.0240 |
| 4 | `bfl/flux-2-pro` | $0.0300 |
| 5 | `bfl/flux-2-flex` | $0.0500 |
| 6 | `grok/grok-imagine-image-quality` | $0.0500 |
| 7 | `openai/gpt-image-2` | $0.0530 |
| 8 | `gemini/gemini-3.1-flash-image-preview` | $0.0670 |
| 9 | `bfl/flux-2-max` | $0.0700 |
| 10 | `openai/gpt-image-1.5` | $0.0800 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `grok/grok-imagine-image-quality` | 4.71s |
| 2 | `grok/grok-imagine-image` | 5.49s |
| 3 | `reve/reve-create@20250915` | 6.34s |
| 4 | `reve/latest` | 6.87s |
| 5 | `gemini/gemini-3.1-flash-image-preview` | 16.11s |
| 6 | `bfl/flux-2-flex` | 16.65s |
| 7 | `bfl/flux-2-pro` | 16.79s |
| 8 | `openai/gpt-image-1.5` | 40.08s |
| 9 | `bfl/flux-2-max` | 47.13s |
| 10 | `openai/gpt-image-2` | 59.03s |

### Automated Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `openai/gpt-image-2` | 90.00/100 |
| 2 | `gemini/gemini-3.1-flash-image-preview` | 86.00/100 |
| 3 | `grok/grok-imagine-image-quality` | 82.00/100 |
| 4 | `openai/gpt-image-1.5` | 78.00/100 |
| 5 | `bfl/flux-2-flex` | 76.00/100 |
| 6 | `bfl/flux-2-pro` | 76.00/100 |
| 7 | `bfl/flux-2-max` | 74.00/100 |
| 8 | `reve/latest` | 74.00/100 |
| 9 | `grok/grok-imagine-image` | 72.00/100 |
| 10 | `reve/reve-create@20250915` | 60.00/100 |

### Human Quality

Unavailable: No explicit humanQualityScore was available for these providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| `bfl/flux-2-flex` | 76.00/100 | 16.65s | $0.0500 |
| `bfl/flux-2-max` | 74.00/100 | 47.13s | $0.0700 |
| `bfl/flux-2-pro` | 76.00/100 | 16.79s | $0.0300 |
| `gemini/gemini-3.1-flash-image-preview` | 86.00/100 | 16.11s | $0.0670 |
| `grok/grok-imagine-image` | 72.00/100 | 5.49s | $0.0200 |
| `grok/grok-imagine-image-quality` | 82.00/100 | 4.71s | $0.0500 |
| `openai/gpt-image-1.5` | 78.00/100 | 40.08s | $0.0800 |
| `openai/gpt-image-2` | 90.00/100 | 59.03s | $0.0530 |
| `reve/latest` | 74.00/100 | 6.87s | $0.0240 |
| `reve/reve-create@20250915` | 60.00/100 | 6.34s | $0.0240 |

## Notes

- Image mode evaluates existing generated images only; it does not generate new images.
- Quality scores are explicit judge scores and are not inferred from file size, dimensions, latency, or cost.
