# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/ocr/2026-05-21_05-04-05-389_document`
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
| 1 | <code>ocrmypdf</code> | $0.00 local monetary cost | 12.89 | 87.11% | 89.16% | 24.62s | $0.00 |
| 2 | <code>paddle-ocr</code> | $0.00 local monetary cost | 4.83 | 95.17% | 96.37% | 0.00s | $0.00 |
| 3 | <code>tesseract</code> | $0.00 local monetary cost | 4.83 | 95.17% | 96.37% | 0.03s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>paddle-ocr</code> | 0.00s | 4.83 | 95.17% | 96.37% | 0.00s | $0.00 |
| 2 | <code>tesseract</code> | 0.03s | 4.83 | 95.17% | 96.37% | 0.03s | $0.00 |
| 3 | <code>ocrmypdf</code> | 24.62s | 12.89 | 87.11% | 89.16% | 24.62s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>ocrmypdf</code> | 12.89/100 quality score | 12.89 | 87.11% | 89.16% | 24.62s | $0.00 |
| 2 | <code>paddle-ocr</code> | 4.83/100 quality score | 4.83 | 95.17% | 96.37% | 0.00s | $0.00 |
| 3 | <code>tesseract</code> | 4.83/100 quality score | 4.83 | 95.17% | 96.37% | 0.03s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>glm/glm-ocr</code> | $0.0003 | 82.79 | 17.21% | 26.10% | 9.32s | $0.0003 |
| 4 | <code>openai/gpt-5.4-nano</code> | $0.0016 | 4.71 | 95.29% | 95.62% | 23.43s | $0.0016 |
| 5 | <code>gemini/gemini-3.1-flash-lite-preview</code> | $0.0018 | 4.71 | 95.29% | 97.14% | 8.13s | $0.0018 |
| 6 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 29.72 | 70.28% | 74.82% | 10.18s | $0.0020 |
| 7 | <code>openai/gpt-5.4-mini</code> | $0.0036 | 12.04 | 87.96% | 87.35% | 17.76s | $0.0036 |
| 8 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0037 | 55.74 | 44.26% | 41.64% | 178.08s | $0.0037 |
| 9 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0052 | 96.48 | 3.52% | 2.29% | 115.12s | $0.0052 |
| 10 | <code>grok/grok-4.3</code> | $0.0102 | 96.06 | 3.94% | 2.78% | 52.20s | $0.0102 |
| 11 | <code>anthropic/claude-haiku-4-5</code> | $0.0128 | 29.16 | 70.84% | 78.84% | 157.44s | $0.0128 |
| 12 | <code>kimi/kimi-k2.6</code> | $0.0171 | 93.60 | 6.40% | 1.51% | 79.63s | $0.0171 |
| 13 | <code>unstructured/hi_res_and_enrichment</code> | $0.0300 | 6.87 | 93.13% | 84.76% | 92.67s | $0.0300 |
| 14 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0387 | 98.01 | 1.99% | 1.06% | 101.24s | $0.0387 |
| 15 | <code>anthropic/claude-sonnet-4-6</code> | $0.0521 | 63.08 | 36.92% | 38.25% | 82.37s | $0.0521 |
| 16 | <code>openai/gpt-5.4</code> | $0.0592 | 38.66 | 61.34% | 54.20% | 87.96s | $0.0592 |
| 17 | <code>openai/gpt-5.5</code> | $0.1190 | 15.52 | 84.48% | 84.92% | 66.22s | $0.1190 |
| 18 | <code>anthropic/claude-opus-4-7</code> | $0.1333 | 95.04 | 4.96% | 3.26% | 97.91s | $0.1333 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 8.13s | 4.71 | 95.29% | 97.14% | 8.13s | $0.0018 |
| 2 | <code>glm/glm-ocr</code> | 9.32s | 82.79 | 17.21% | 26.10% | 9.32s | $0.0003 |
| 3 | <code>mistral/mistral-ocr-2512</code> | 10.18s | 29.72 | 70.28% | 74.82% | 10.18s | $0.0020 |
| 4 | <code>openai/gpt-5.4-mini</code> | 17.76s | 12.04 | 87.96% | 87.35% | 17.76s | $0.0036 |
| 5 | <code>openai/gpt-5.4-nano</code> | 23.43s | 4.71 | 95.29% | 95.62% | 23.43s | $0.0016 |
| 6 | <code>grok/grok-4.3</code> | 52.20s | 96.06 | 3.94% | 2.78% | 52.20s | $0.0102 |
| 7 | <code>openai/gpt-5.5</code> | 66.22s | 15.52 | 84.48% | 84.92% | 66.22s | $0.1190 |
| 9 | <code>kimi/kimi-k2.6</code> | 79.63s | 93.60 | 6.40% | 1.51% | 79.63s | $0.0171 |
| 10 | <code>anthropic/claude-sonnet-4-6</code> | 82.37s | 63.08 | 36.92% | 38.25% | 82.37s | $0.0521 |
| 12 | <code>openai/gpt-5.4</code> | 87.96s | 38.66 | 61.34% | 54.20% | 87.96s | $0.0592 |
| 13 | <code>unstructured/hi_res_and_enrichment</code> | 92.67s | 6.87 | 93.13% | 84.76% | 92.67s | $0.0300 |
| 14 | <code>anthropic/claude-opus-4-7</code> | 97.91s | 95.04 | 4.96% | 3.26% | 97.91s | $0.1333 |
| 15 | <code>gemini/gemini-3.1-pro-preview</code> | 101.24s | 98.01 | 1.99% | 1.06% | 101.24s | $0.0387 |
| 16 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 115.12s | 96.48 | 3.52% | 2.29% | 115.12s | $0.0052 |
| 17 | <code>anthropic/claude-haiku-4-5</code> | 157.44s | 29.16 | 70.84% | 78.84% | 157.44s | $0.0128 |
| 18 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 178.08s | 55.74 | 44.26% | 41.64% | 178.08s | $0.0037 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.1-pro-preview</code> | 98.01/100 quality score | 98.01 | 1.99% | 1.06% | 101.24s | $0.0387 |
| 2 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 96.48/100 quality score | 96.48 | 3.52% | 2.29% | 115.12s | $0.0052 |
| 3 | <code>grok/grok-4.3</code> | 96.06/100 quality score | 96.06 | 3.94% | 2.78% | 52.20s | $0.0102 |
| 4 | <code>anthropic/claude-opus-4-7</code> | 95.04/100 quality score | 95.04 | 4.96% | 3.26% | 97.91s | $0.1333 |
| 5 | <code>kimi/kimi-k2.6</code> | 93.60/100 quality score | 93.60 | 6.40% | 1.51% | 79.63s | $0.0171 |
| 6 | <code>glm/glm-ocr</code> | 82.79/100 quality score | 82.79 | 17.21% | 26.10% | 9.32s | $0.0003 |
| 7 | <code>anthropic/claude-sonnet-4-6</code> | 63.08/100 quality score | 63.08 | 36.92% | 38.25% | 82.37s | $0.0521 |
| 8 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 55.74/100 quality score | 55.74 | 44.26% | 41.64% | 178.08s | $0.0037 |
| 9 | <code>openai/gpt-5.4</code> | 38.66/100 quality score | 38.66 | 61.34% | 54.20% | 87.96s | $0.0592 |
| 10 | <code>mistral/mistral-ocr-2512</code> | 29.72/100 quality score | 29.72 | 70.28% | 74.82% | 10.18s | $0.0020 |
| 11 | <code>anthropic/claude-haiku-4-5</code> | 29.16/100 quality score | 29.16 | 70.84% | 78.84% | 157.44s | $0.0128 |
| 12 | <code>openai/gpt-5.5</code> | 15.52/100 quality score | 15.52 | 84.48% | 84.92% | 66.22s | $0.1190 |
| 13 | <code>openai/gpt-5.4-mini</code> | 12.04/100 quality score | 12.04 | 87.96% | 87.35% | 17.76s | $0.0036 |
| 14 | <code>unstructured/hi_res_and_enrichment</code> | 6.87/100 quality score | 6.87 | 93.13% | 84.76% | 92.67s | $0.0300 |
| 16 | <code>openai/gpt-5.4-nano</code> | 4.71/100 quality score | 4.71 | 95.29% | 95.62% | 23.43s | $0.0016 |
| 17 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 4.71/100 quality score | 4.71 | 95.29% | 97.14% | 8.13s | $0.0018 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | Local | 12.89 | 87.11% | 89.16% | 24.62s | $0.00 |
| <code>paddle-ocr</code> | Local | 4.83 | 95.17% | 96.37% | 0.00s | $0.00 |
| <code>tesseract</code> | Local | 4.83 | 95.17% | 96.37% | 0.03s | $0.00 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 29.16 | 70.84% | 78.84% | 157.44s | $0.0128 |
| <code>anthropic/claude-opus-4-7</code> | Third-Party Service | 95.04 | 4.96% | 3.26% | 97.91s | $0.1333 |
| <code>anthropic/claude-sonnet-4-6</code> | Third-Party Service | 63.08 | 36.92% | 38.25% | 82.37s | $0.0521 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 96.48 | 3.52% | 2.29% | 115.12s | $0.0052 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 55.74 | 44.26% | 41.64% | 178.08s | $0.0037 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | Third-Party Service | 4.71 | 95.29% | 97.14% | 8.13s | $0.0018 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 98.01 | 1.99% | 1.06% | 101.24s | $0.0387 |
| <code>glm/glm-ocr</code> | Third-Party Service | 82.79 | 17.21% | 26.10% | 9.32s | $0.0003 |
| <code>grok/grok-4.3</code> | Third-Party Service | 96.06 | 3.94% | 2.78% | 52.20s | $0.0102 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 93.60 | 6.40% | 1.51% | 79.63s | $0.0171 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 29.72 | 70.28% | 74.82% | 10.18s | $0.0020 |
| <code>openai/gpt-5.4</code> | Third-Party Service | 38.66 | 61.34% | 54.20% | 87.96s | $0.0592 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 12.04 | 87.96% | 87.35% | 17.76s | $0.0036 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 4.71 | 95.29% | 95.62% | 23.43s | $0.0016 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 15.52 | 84.48% | 84.92% | 66.22s | $0.1190 |
| <code>unstructured/hi_res_and_enrichment</code> | Third-Party Service | 6.87 | 93.13% | 84.76% | 92.67s | $0.0300 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | 1812 | 154 | 89 | 2359 |
| <code>paddle-ocr</code> | 458 | 1776 | 11 | 2359 |
| <code>tesseract</code> | 458 | 1776 | 11 | 2359 |
| <code>anthropic/claude-haiku-4-5</code> | 501 | 1124 | 46 | 2359 |
| <code>anthropic/claude-opus-4-7</code> | 77 | 14 | 26 | 2359 |
| <code>anthropic/claude-sonnet-4-6</code> | 171 | 551 | 149 | 2359 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 30 | 39 | 14 | 2359 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 659 | 232 | 153 | 2359 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | 534 | 1712 | 2 | 2359 |
| <code>gemini/gemini-3.1-pro-preview</code> | 38 | 5 | 4 | 2359 |
| <code>glm/glm-ocr</code> | 67 | 157 | 182 | 2359 |
| <code>grok/grok-4.3</code> | 42 | 25 | 26 | 2359 |
| <code>kimi/kimi-k2.6</code> | 87 | 8 | 56 | 2359 |
| <code>mistral/mistral-ocr-2512</code> | 611 | 1026 | 21 | 2359 |
| <code>openai/gpt-5.4</code> | 848 | 96 | 503 | 2359 |
| <code>openai/gpt-5.4-mini</code> | 42 | 2031 | 2 | 2359 |
| <code>openai/gpt-5.4-nano</code> | 540 | 1706 | 2 | 2359 |
| <code>openai/gpt-5.5</code> | 13 | 1980 | 0 | 2359 |
| <code>unstructured/hi_res_and_enrichment</code> | 1888 | 260 | 49 | 2359 |

## Notes

- Best local model: `ocrmypdf/ocrmypdf` scored 12.89/100.
- Best cloud service: `gemini/gemini-3.1-pro-preview` scored 98.01/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0350¢ ($0.0003).
- Fastest local model: `paddle-ocr/paddle-ocr` at 0.00s.
- Fastest cloud service: `gemini/gemini-3.1-flash-lite-preview` at 8.13s.
