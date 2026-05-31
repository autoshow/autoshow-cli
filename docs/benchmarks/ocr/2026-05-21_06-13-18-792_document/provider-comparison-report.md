# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/ocr/2026-05-21_06-13-18-792_document`
- Total providers: 21 (3 local, 18 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.

## Method

- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>ocrmypdf</code> | $0.00 local monetary cost | 91.57 | 8.43% | 7.10% | 10.45s | $0.00 |
| 2 | <code>paddle-ocr</code> | $0.00 local monetary cost | 100.00 | 0.00% | 0.00% | 0.00s | $0.00 |
| 3 | <code>tesseract</code> | $0.00 local monetary cost | 100.00 | 0.00% | 0.00% | 0.05s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>paddle-ocr</code> | 0.00s | 100.00 | 0.00% | 0.00% | 0.00s | $0.00 |
| 2 | <code>tesseract</code> | 0.05s | 100.00 | 0.00% | 0.00% | 0.05s | $0.00 |
| 3 | <code>ocrmypdf</code> | 10.45s | 91.57 | 8.43% | 7.10% | 10.45s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>paddle-ocr</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.00s | $0.00 |
| 2 | <code>tesseract</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.05s | $0.00 |
| 3 | <code>ocrmypdf</code> | 91.57/100 quality score | 91.57 | 8.43% | 7.10% | 10.45s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>glm/glm-ocr</code> | $0.0012 | 95.13 | 4.87% | 4.90% | 12.65s | $0.0012 |
| 2 | <code>openai/gpt-5.4-nano</code> | $0.0055 | 100.00 | 0.00% | 0.00% | 33.40s | $0.0055 |
| 3 | <code>gemini/gemini-3.1-flash-lite-preview</code> | $0.0078 | 100.00 | 0.00% | 0.00% | 11.31s | $0.0078 |
| 6 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0151 | 88.02 | 11.98% | 10.80% | 181.54s | $0.0151 |
| 7 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0198 | 96.85 | 3.15% | 3.35% | 93.51s | $0.0198 |
| 8 | <code>openai/gpt-5.4-mini</code> | $0.0200 | 100.00 | 0.00% | 0.00% | 14.29s | $0.0200 |
| 9 | <code>mistral/mistral-ocr-2512</code> | $0.0200 | 96.62 | 3.38% | 3.48% | 3.46s | $0.0200 |
| 10 | <code>grok/grok-4.3</code> | $0.0406 | 97.99 | 2.01% | 2.10% | 137.12s | $0.0406 |
| 11 | <code>anthropic/claude-haiku-4-5</code> | $0.0427 | 84.29 | 15.71% | 40.76% | 40.67s | $0.0427 |
| 12 | <code>kimi/kimi-k2.6</code> | $0.0535 | 100.00 | 0.00% | 0.00% | 118.49s | $0.0535 |
| 13 | <code>openai/gpt-5.4</code> | $0.0642 | 100.00 | 0.00% | 0.00% | 38.62s | $0.0642 |
| 14 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0665 | 100.00 | 0.00% | 0.00% | 61.58s | $0.0665 |
| 15 | <code>openai/gpt-5.5</code> | $0.1346 | 100.00 | 0.00% | 0.00% | 37.92s | $0.1346 |
| 16 | <code>anthropic/claude-sonnet-4-6</code> | $0.1351 | 100.00 | 0.00% | 0.00% | 86.80s | $0.1351 |
| 17 | <code>anthropic/claude-opus-4-7</code> | $0.2746 | 100.00 | 0.00% | 0.00% | 74.36s | $0.2746 |
| 18 | <code>unstructured/hi_res_and_enrichment</code> | $0.3000 | 98.68 | 1.32% | 0.53% | 41.78s | $0.3000 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-2512</code> | 3.46s | 96.62 | 3.38% | 3.48% | 3.46s | $0.0200 |
| 3 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 11.31s | 100.00 | 0.00% | 0.00% | 11.31s | $0.0078 |
| 4 | <code>glm/glm-ocr</code> | 12.65s | 95.13 | 4.87% | 4.90% | 12.65s | $0.0012 |
| 5 | <code>openai/gpt-5.4-mini</code> | 14.29s | 100.00 | 0.00% | 0.00% | 14.29s | $0.0200 |
| 6 | <code>openai/gpt-5.4-nano</code> | 33.40s | 100.00 | 0.00% | 0.00% | 33.40s | $0.0055 |
| 7 | <code>openai/gpt-5.5</code> | 37.92s | 100.00 | 0.00% | 0.00% | 37.92s | $0.1346 |
| 8 | <code>openai/gpt-5.4</code> | 38.62s | 100.00 | 0.00% | 0.00% | 38.62s | $0.0642 |
| 9 | <code>anthropic/claude-haiku-4-5</code> | 40.67s | 84.29 | 15.71% | 40.76% | 40.67s | $0.0427 |
| 10 | <code>unstructured/hi_res_and_enrichment</code> | 41.78s | 98.68 | 1.32% | 0.53% | 41.78s | $0.3000 |
| 11 | <code>gemini/gemini-3.1-pro-preview</code> | 61.58s | 100.00 | 0.00% | 0.00% | 61.58s | $0.0665 |
| 12 | <code>anthropic/claude-opus-4-7</code> | 74.36s | 100.00 | 0.00% | 0.00% | 74.36s | $0.2746 |
| 14 | <code>anthropic/claude-sonnet-4-6</code> | 86.80s | 100.00 | 0.00% | 0.00% | 86.80s | $0.1351 |
| 15 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 93.51s | 96.85 | 3.15% | 3.35% | 93.51s | $0.0198 |
| 16 | <code>kimi/kimi-k2.6</code> | 118.49s | 100.00 | 0.00% | 0.00% | 118.49s | $0.0535 |
| 17 | <code>grok/grok-4.3</code> | 137.12s | 97.99 | 2.01% | 2.10% | 137.12s | $0.0406 |
| 18 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 181.54s | 88.02 | 11.98% | 10.80% | 181.54s | $0.0151 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-opus-4-7</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 74.36s | $0.2746 |
| 2 | <code>anthropic/claude-sonnet-4-6</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 86.80s | $0.1351 |
| 3 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 11.31s | $0.0078 |
| 4 | <code>gemini/gemini-3.1-pro-preview</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 61.58s | $0.0665 |
| 5 | <code>kimi/kimi-k2.6</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 118.49s | $0.0535 |
| 6 | <code>openai/gpt-5.4</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 38.62s | $0.0642 |
| 7 | <code>openai/gpt-5.4-mini</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 14.29s | $0.0200 |
| 8 | <code>openai/gpt-5.4-nano</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 33.40s | $0.0055 |
| 9 | <code>openai/gpt-5.5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 37.92s | $0.1346 |
| 11 | <code>unstructured/hi_res_and_enrichment</code> | 98.68/100 quality score | 98.68 | 1.32% | 0.53% | 41.78s | $0.3000 |
| 13 | <code>grok/grok-4.3</code> | 97.99/100 quality score | 97.99 | 2.01% | 2.10% | 137.12s | $0.0406 |
| 14 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 96.85/100 quality score | 96.85 | 3.15% | 3.35% | 93.51s | $0.0198 |
| 15 | <code>mistral/mistral-ocr-2512</code> | 96.62/100 quality score | 96.62 | 3.38% | 3.48% | 3.46s | $0.0200 |
| 16 | <code>glm/glm-ocr</code> | 95.13/100 quality score | 95.13 | 4.87% | 4.90% | 12.65s | $0.0012 |
| 17 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 88.02/100 quality score | 88.02 | 11.98% | 10.80% | 181.54s | $0.0151 |
| 18 | <code>anthropic/claude-haiku-4-5</code> | 84.29/100 quality score | 84.29 | 15.71% | 40.76% | 40.67s | $0.0427 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | Local | 91.57 | 8.43% | 7.10% | 10.45s | $0.00 |
| <code>paddle-ocr</code> | Local | 100.00 | 0.00% | 0.00% | 0.00s | $0.00 |
| <code>tesseract</code> | Local | 100.00 | 0.00% | 0.00% | 0.05s | $0.00 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 84.29 | 15.71% | 40.76% | 40.67s | $0.0427 |
| <code>anthropic/claude-opus-4-7</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 74.36s | $0.2746 |
| <code>anthropic/claude-sonnet-4-6</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 86.80s | $0.1351 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 96.85 | 3.15% | 3.35% | 93.51s | $0.0198 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 88.02 | 11.98% | 10.80% | 181.54s | $0.0151 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 11.31s | $0.0078 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 61.58s | $0.0665 |
| <code>glm/glm-ocr</code> | Third-Party Service | 95.13 | 4.87% | 4.90% | 12.65s | $0.0012 |
| <code>grok/grok-4.3</code> | Third-Party Service | 97.99 | 2.01% | 2.10% | 137.12s | $0.0406 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 118.49s | $0.0535 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 96.62 | 3.38% | 3.48% | 3.46s | $0.0200 |
| <code>openai/gpt-5.4</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 38.62s | $0.0642 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 14.29s | $0.0200 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 33.40s | $0.0055 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 37.92s | $0.1346 |
| <code>unstructured/hi_res_and_enrichment</code> | Third-Party Service | 98.68 | 1.32% | 0.53% | 41.78s | $0.3000 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | 92 | 32 | 23 | 1744 |
| <code>paddle-ocr</code> | 0 | 0 | 0 | 1744 |
| <code>tesseract</code> | 0 | 0 | 0 | 1744 |
| <code>anthropic/claude-haiku-4-5</code> | 6 | 199 | 69 | 1744 |
| <code>anthropic/claude-opus-4-7</code> | 0 | 0 | 0 | 1744 |
| <code>anthropic/claude-sonnet-4-6</code> | 0 | 0 | 0 | 1744 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 1 | 54 | 0 | 1744 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 15 | 56 | 138 | 1744 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | 0 | 0 | 0 | 1744 |
| <code>gemini/gemini-3.1-pro-preview</code> | 0 | 0 | 0 | 1744 |
| <code>glm/glm-ocr</code> | 9 | 69 | 7 | 1744 |
| <code>grok/grok-4.3</code> | 0 | 35 | 0 | 1744 |
| <code>kimi/kimi-k2.6</code> | 0 | 0 | 0 | 1744 |
| <code>mistral/mistral-ocr-2512</code> | 3 | 6 | 50 | 1744 |
| <code>openai/gpt-5.4</code> | 0 | 0 | 0 | 1744 |
| <code>openai/gpt-5.4-mini</code> | 0 | 0 | 0 | 1744 |
| <code>openai/gpt-5.4-nano</code> | 0 | 0 | 0 | 1744 |
| <code>openai/gpt-5.5</code> | 0 | 0 | 0 | 1744 |
| <code>unstructured/hi_res_and_enrichment</code> | 15 | 3 | 5 | 1744 |

## Notes

- Best local model: `paddle-ocr/paddle-ocr` scored 100.00/100.
- Best cloud service: `anthropic/claude-opus-4-7` scored 100.00/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.1165¢ ($0.0012).
- Fastest local model: `paddle-ocr/paddle-ocr` at 0.00s.
- Fastest cloud service: `mistral/mistral-ocr-2512` at 3.46s.
