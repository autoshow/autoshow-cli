# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/ocr/2026-05-21_06-03-14-635_document`
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
| 1 | <code>ocrmypdf</code> | $0.00 local monetary cost | 91.57 | 8.43% | 7.10% | 10.36s | $0.00 |
| 2 | <code>paddle-ocr</code> | $0.00 local monetary cost | 100.00 | 0.00% | 0.00% | 0.00s | $0.00 |
| 3 | <code>tesseract</code> | $0.00 local monetary cost | 100.00 | 0.00% | 0.00% | 0.05s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>paddle-ocr</code> | 0.00s | 100.00 | 0.00% | 0.00% | 0.00s | $0.00 |
| 2 | <code>tesseract</code> | 0.05s | 100.00 | 0.00% | 0.00% | 0.05s | $0.00 |
| 3 | <code>ocrmypdf</code> | 10.36s | 91.57 | 8.43% | 7.10% | 10.36s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>paddle-ocr</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.00s | $0.00 |
| 2 | <code>tesseract</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.05s | $0.00 |
| 3 | <code>ocrmypdf</code> | 91.57/100 quality score | 91.57 | 8.43% | 7.10% | 10.36s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>glm/glm-ocr</code> | $0.0012 | 95.13 | 4.87% | 4.90% | 12.63s | $0.0012 |
| 2 | <code>openai/gpt-5.4-nano</code> | $0.0055 | 99.54 | 0.46% | 0.50% | 29.43s | $0.0055 |
| 3 | <code>gemini/gemini-3.1-flash-lite-preview</code> | $0.0081 | 100.00 | 0.00% | 0.00% | 12.56s | $0.0081 |
| 4 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0146 | 96.67 | 3.33% | 3.02% | 147.66s | $0.0146 |
| 7 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0198 | 97.19 | 2.81% | 2.98% | 114.39s | $0.0198 |
| 8 | <code>openai/gpt-5.4-mini</code> | $0.0199 | 99.77 | 0.23% | 0.20% | 26.93s | $0.0199 |
| 9 | <code>mistral/mistral-ocr-2512</code> | $0.0200 | 96.62 | 3.38% | 3.48% | 2.53s | $0.0200 |
| 10 | <code>grok/grok-4.3</code> | $0.0405 | 97.42 | 2.58% | 2.81% | 112.03s | $0.0405 |
| 11 | <code>anthropic/claude-haiku-4-5</code> | $0.0426 | 81.02 | 18.98% | 24.94% | 39.03s | $0.0426 |
| 12 | <code>kimi/kimi-k2.6</code> | $0.0535 | 100.00 | 0.00% | 0.00% | 167.25s | $0.0535 |
| 13 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0628 | 100.00 | 0.00% | 0.00% | 68.14s | $0.0628 |
| 14 | <code>openai/gpt-5.4</code> | $0.0642 | 100.00 | 0.00% | 0.00% | 36.21s | $0.0642 |
| 15 | <code>anthropic/claude-sonnet-4-6</code> | $0.1351 | 100.00 | 0.00% | 0.00% | 86.12s | $0.1351 |
| 16 | <code>openai/gpt-5.5</code> | $0.1376 | 100.00 | 0.00% | 0.00% | 29.32s | $0.1376 |
| 17 | <code>anthropic/claude-opus-4-7</code> | $0.2746 | 100.00 | 0.00% | 0.00% | 74.36s | $0.2746 |
| 18 | <code>unstructured/hi_res_and_enrichment</code> | $0.3000 | 98.68 | 1.32% | 0.53% | 42.53s | $0.3000 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-2512</code> | 2.53s | 96.62 | 3.38% | 3.48% | 2.53s | $0.0200 |
| 2 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 12.56s | 100.00 | 0.00% | 0.00% | 12.56s | $0.0081 |
| 3 | <code>glm/glm-ocr</code> | 12.63s | 95.13 | 4.87% | 4.90% | 12.63s | $0.0012 |
| 5 | <code>openai/gpt-5.4-mini</code> | 26.93s | 99.77 | 0.23% | 0.20% | 26.93s | $0.0199 |
| 6 | <code>openai/gpt-5.5</code> | 29.32s | 100.00 | 0.00% | 0.00% | 29.32s | $0.1376 |
| 7 | <code>openai/gpt-5.4-nano</code> | 29.43s | 99.54 | 0.46% | 0.50% | 29.43s | $0.0055 |
| 8 | <code>openai/gpt-5.4</code> | 36.21s | 100.00 | 0.00% | 0.00% | 36.21s | $0.0642 |
| 9 | <code>anthropic/claude-haiku-4-5</code> | 39.03s | 81.02 | 18.98% | 24.94% | 39.03s | $0.0426 |
| 10 | <code>unstructured/hi_res_and_enrichment</code> | 42.53s | 98.68 | 1.32% | 0.53% | 42.53s | $0.3000 |
| 11 | <code>gemini/gemini-3.1-pro-preview</code> | 68.14s | 100.00 | 0.00% | 0.00% | 68.14s | $0.0628 |
| 13 | <code>anthropic/claude-opus-4-7</code> | 74.36s | 100.00 | 0.00% | 0.00% | 74.36s | $0.2746 |
| 14 | <code>anthropic/claude-sonnet-4-6</code> | 86.12s | 100.00 | 0.00% | 0.00% | 86.12s | $0.1351 |
| 15 | <code>grok/grok-4.3</code> | 112.03s | 97.42 | 2.58% | 2.81% | 112.03s | $0.0405 |
| 16 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 114.39s | 97.19 | 2.81% | 2.98% | 114.39s | $0.0198 |
| 17 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 147.66s | 96.67 | 3.33% | 3.02% | 147.66s | $0.0146 |
| 18 | <code>kimi/kimi-k2.6</code> | 167.25s | 100.00 | 0.00% | 0.00% | 167.25s | $0.0535 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-opus-4-7</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 74.36s | $0.2746 |
| 2 | <code>anthropic/claude-sonnet-4-6</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 86.12s | $0.1351 |
| 3 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 12.56s | $0.0081 |
| 4 | <code>gemini/gemini-3.1-pro-preview</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 68.14s | $0.0628 |
| 5 | <code>kimi/kimi-k2.6</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 167.25s | $0.0535 |
| 6 | <code>openai/gpt-5.4</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 36.21s | $0.0642 |
| 7 | <code>openai/gpt-5.5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 29.32s | $0.1376 |
| 8 | <code>openai/gpt-5.4-mini</code> | 99.77/100 quality score | 99.77 | 0.23% | 0.20% | 26.93s | $0.0199 |
| 9 | <code>openai/gpt-5.4-nano</code> | 99.54/100 quality score | 99.54 | 0.46% | 0.50% | 29.43s | $0.0055 |
| 11 | <code>unstructured/hi_res_and_enrichment</code> | 98.68/100 quality score | 98.68 | 1.32% | 0.53% | 42.53s | $0.3000 |
| 13 | <code>grok/grok-4.3</code> | 97.42/100 quality score | 97.42 | 2.58% | 2.81% | 112.03s | $0.0405 |
| 14 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 97.19/100 quality score | 97.19 | 2.81% | 2.98% | 114.39s | $0.0198 |
| 15 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 96.67/100 quality score | 96.67 | 3.33% | 3.02% | 147.66s | $0.0146 |
| 16 | <code>mistral/mistral-ocr-2512</code> | 96.62/100 quality score | 96.62 | 3.38% | 3.48% | 2.53s | $0.0200 |
| 17 | <code>glm/glm-ocr</code> | 95.13/100 quality score | 95.13 | 4.87% | 4.90% | 12.63s | $0.0012 |
| 18 | <code>anthropic/claude-haiku-4-5</code> | 81.02/100 quality score | 81.02 | 18.98% | 24.94% | 39.03s | $0.0426 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | Local | 91.57 | 8.43% | 7.10% | 10.36s | $0.00 |
| <code>paddle-ocr</code> | Local | 100.00 | 0.00% | 0.00% | 0.00s | $0.00 |
| <code>tesseract</code> | Local | 100.00 | 0.00% | 0.00% | 0.05s | $0.00 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 81.02 | 18.98% | 24.94% | 39.03s | $0.0426 |
| <code>anthropic/claude-opus-4-7</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 74.36s | $0.2746 |
| <code>anthropic/claude-sonnet-4-6</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 86.12s | $0.1351 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 97.19 | 2.81% | 2.98% | 114.39s | $0.0198 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 96.67 | 3.33% | 3.02% | 147.66s | $0.0146 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 12.56s | $0.0081 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 68.14s | $0.0628 |
| <code>glm/glm-ocr</code> | Third-Party Service | 95.13 | 4.87% | 4.90% | 12.63s | $0.0012 |
| <code>grok/grok-4.3</code> | Third-Party Service | 97.42 | 2.58% | 2.81% | 112.03s | $0.0405 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 167.25s | $0.0535 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 96.62 | 3.38% | 3.48% | 2.53s | $0.0200 |
| <code>openai/gpt-5.4</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 36.21s | $0.0642 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 99.77 | 0.23% | 0.20% | 26.93s | $0.0199 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 99.54 | 0.46% | 0.50% | 29.43s | $0.0055 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 29.32s | $0.1376 |
| <code>unstructured/hi_res_and_enrichment</code> | Third-Party Service | 98.68 | 1.32% | 0.53% | 42.53s | $0.3000 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | 92 | 32 | 23 | 1744 |
| <code>paddle-ocr</code> | 0 | 0 | 0 | 1744 |
| <code>tesseract</code> | 0 | 0 | 0 | 1744 |
| <code>anthropic/claude-haiku-4-5</code> | 0 | 155 | 176 | 1744 |
| <code>anthropic/claude-opus-4-7</code> | 0 | 0 | 0 | 1744 |
| <code>anthropic/claude-sonnet-4-6</code> | 0 | 0 | 0 | 1744 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 1 | 48 | 0 | 1744 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 10 | 48 | 0 | 1744 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | 0 | 0 | 0 | 1744 |
| <code>gemini/gemini-3.1-pro-preview</code> | 0 | 0 | 0 | 1744 |
| <code>glm/glm-ocr</code> | 9 | 69 | 7 | 1744 |
| <code>grok/grok-4.3</code> | 1 | 44 | 0 | 1744 |
| <code>kimi/kimi-k2.6</code> | 0 | 0 | 0 | 1744 |
| <code>mistral/mistral-ocr-2512</code> | 3 | 6 | 50 | 1744 |
| <code>openai/gpt-5.4</code> | 0 | 0 | 0 | 1744 |
| <code>openai/gpt-5.4-mini</code> | 0 | 4 | 0 | 1744 |
| <code>openai/gpt-5.4-nano</code> | 0 | 8 | 0 | 1744 |
| <code>openai/gpt-5.5</code> | 0 | 0 | 0 | 1744 |
| <code>unstructured/hi_res_and_enrichment</code> | 15 | 3 | 5 | 1744 |

## Notes

- Best local model: `paddle-ocr/paddle-ocr` scored 100.00/100.
- Best cloud service: `anthropic/claude-opus-4-7` scored 100.00/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.1165¢ ($0.0012).
- Fastest local model: `paddle-ocr/paddle-ocr` at 0.00s.
- Fastest cloud service: `mistral/mistral-ocr-2512` at 2.53s.
