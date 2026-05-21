# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/ocr/2026-05-21_05-47-00-856_document`
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
| 1 | <code>ocrmypdf</code> | $0.00 local monetary cost | 96.33 | 3.67% | 1.63% | 10.99s | $0.00 |
| 2 | <code>paddle-ocr</code> | $0.00 local monetary cost | 92.21 | 7.79% | 1.52% | 87.01s | $0.00 |
| 3 | <code>tesseract</code> | $0.00 local monetary cost | 96.48 | 3.52% | 1.63% | 8.55s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 8.55s | 96.48 | 3.52% | 1.63% | 8.55s | $0.00 |
| 2 | <code>ocrmypdf</code> | 10.99s | 96.33 | 3.67% | 1.63% | 10.99s | $0.00 |
| 3 | <code>paddle-ocr</code> | 87.01s | 92.21 | 7.79% | 1.52% | 87.01s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 96.48/100 quality score | 96.48 | 3.52% | 1.63% | 8.55s | $0.00 |
| 2 | <code>ocrmypdf</code> | 96.33/100 quality score | 96.33 | 3.67% | 1.63% | 10.99s | $0.00 |
| 3 | <code>paddle-ocr</code> | 92.21/100 quality score | 92.21 | 7.79% | 1.52% | 87.01s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-sonnet-4-6</code> | $0.00 | 90.49 | 9.51% | 3.46% | 378.34s | $0.00 |
| 2 | <code>glm/glm-ocr</code> | $0.0003 | 98.58 | 1.42% | 1.36% | 23.37s | $0.0003 |
| 3 | <code>gemini/gemini-3.1-flash-lite-preview</code> | $0.0032 | 99.18 | 0.82% | 0.70% | 11.95s | $0.0032 |
| 4 | <code>openai/gpt-5.4-nano</code> | $0.0048 | 96.63 | 3.37% | 0.80% | 19.17s | $0.0048 |
| 5 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0058 | 97.75 | 2.25% | 0.87% | 76.46s | $0.0058 |
| 6 | <code>aws-textract/detect-text</code> | $0.0060 | 98.13 | 1.87% | 0.33% | 12.04s | $0.0060 |
| 7 | <code>gcloud-docai/ocr</code> | $0.0060 | 98.28 | 1.72% | 0.18% | 77.98s | $0.0060 |
| 8 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0079 | 99.40 | 0.60% | 0.06% | 42.59s | $0.0079 |
| 9 | <code>mistral/mistral-ocr-2512</code> | $0.0080 | 99.85 | 0.15% | 0.19% | 7.52s | $0.0080 |
| 10 | <code>anthropic/claude-haiku-4-5</code> | $0.0161 | 97.90 | 2.10% | 0.71% | 35.54s | $0.0161 |
| 11 | <code>grok/grok-4.3</code> | $0.0170 | 99.18 | 0.82% | 0.22% | 64.29s | $0.0170 |
| 12 | <code>openai/gpt-5.4-mini</code> | $0.0171 | 98.80 | 1.20% | 0.61% | 113.65s | $0.0171 |
| 13 | <code>kimi/kimi-k2.6</code> | $0.0230 | 99.10 | 0.90% | 0.49% | 47.28s | $0.0230 |
| 14 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0273 | 98.50 | 1.50% | 0.15% | 44.33s | $0.0273 |
| 15 | <code>openai/gpt-5.4</code> | $0.0584 | 97.90 | 2.10% | 0.70% | 27.91s | $0.0584 |
| 16 | <code>anthropic/claude-opus-4-7</code> | $0.0933 | 99.85 | 0.15% | 0.01% | 53.14s | $0.0933 |
| 17 | <code>unstructured/hi_res_and_enrichment</code> | $0.1200 | 0.45 | 99.55% | 99.53% | 114.56s | $0.1200 |
| 18 | <code>openai/gpt-5.5</code> | $0.1749 | 99.85 | 0.15% | 0.01% | 50.26s | $0.1749 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-2512</code> | 7.52s | 99.85 | 0.15% | 0.19% | 7.52s | $0.0080 |
| 2 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 11.95s | 99.18 | 0.82% | 0.70% | 11.95s | $0.0032 |
| 3 | <code>aws-textract/detect-text</code> | 12.04s | 98.13 | 1.87% | 0.33% | 12.04s | $0.0060 |
| 4 | <code>openai/gpt-5.4-nano</code> | 19.17s | 96.63 | 3.37% | 0.80% | 19.17s | $0.0048 |
| 5 | <code>glm/glm-ocr</code> | 23.37s | 98.58 | 1.42% | 1.36% | 23.37s | $0.0003 |
| 6 | <code>openai/gpt-5.4</code> | 27.91s | 97.90 | 2.10% | 0.70% | 27.91s | $0.0584 |
| 7 | <code>anthropic/claude-haiku-4-5</code> | 35.54s | 97.90 | 2.10% | 0.71% | 35.54s | $0.0161 |
| 8 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 42.59s | 99.40 | 0.60% | 0.06% | 42.59s | $0.0079 |
| 9 | <code>gemini/gemini-3.1-pro-preview</code> | 44.33s | 98.50 | 1.50% | 0.15% | 44.33s | $0.0273 |
| 10 | <code>kimi/kimi-k2.6</code> | 47.28s | 99.10 | 0.90% | 0.49% | 47.28s | $0.0230 |
| 11 | <code>openai/gpt-5.5</code> | 50.26s | 99.85 | 0.15% | 0.01% | 50.26s | $0.1749 |
| 12 | <code>anthropic/claude-opus-4-7</code> | 53.14s | 99.85 | 0.15% | 0.01% | 53.14s | $0.0933 |
| 13 | <code>grok/grok-4.3</code> | 64.29s | 99.18 | 0.82% | 0.22% | 64.29s | $0.0170 |
| 14 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 76.46s | 97.75 | 2.25% | 0.87% | 76.46s | $0.0058 |
| 15 | <code>gcloud-docai/ocr</code> | 77.98s | 98.28 | 1.72% | 0.18% | 77.98s | $0.0060 |
| 16 | <code>openai/gpt-5.4-mini</code> | 113.65s | 98.80 | 1.20% | 0.61% | 113.65s | $0.0171 |
| 17 | <code>unstructured/hi_res_and_enrichment</code> | 114.56s | 0.45 | 99.55% | 99.53% | 114.56s | $0.1200 |
| 18 | <code>anthropic/claude-sonnet-4-6</code> | 378.34s | 90.49 | 9.51% | 3.46% | 378.34s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-opus-4-7</code> | 99.85/100 quality score | 99.85 | 0.15% | 0.01% | 53.14s | $0.0933 |
| 2 | <code>openai/gpt-5.5</code> | 99.85/100 quality score | 99.85 | 0.15% | 0.01% | 50.26s | $0.1749 |
| 3 | <code>mistral/mistral-ocr-2512</code> | 99.85/100 quality score | 99.85 | 0.15% | 0.19% | 7.52s | $0.0080 |
| 4 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 99.40/100 quality score | 99.40 | 0.60% | 0.06% | 42.59s | $0.0079 |
| 5 | <code>grok/grok-4.3</code> | 99.18/100 quality score | 99.18 | 0.82% | 0.22% | 64.29s | $0.0170 |
| 6 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 99.18/100 quality score | 99.18 | 0.82% | 0.70% | 11.95s | $0.0032 |
| 7 | <code>kimi/kimi-k2.6</code> | 99.10/100 quality score | 99.10 | 0.90% | 0.49% | 47.28s | $0.0230 |
| 8 | <code>openai/gpt-5.4-mini</code> | 98.80/100 quality score | 98.80 | 1.20% | 0.61% | 113.65s | $0.0171 |
| 9 | <code>glm/glm-ocr</code> | 98.58/100 quality score | 98.58 | 1.42% | 1.36% | 23.37s | $0.0003 |
| 10 | <code>gemini/gemini-3.1-pro-preview</code> | 98.50/100 quality score | 98.50 | 1.50% | 0.15% | 44.33s | $0.0273 |
| 11 | <code>gcloud-docai/ocr</code> | 98.28/100 quality score | 98.28 | 1.72% | 0.18% | 77.98s | $0.0060 |
| 12 | <code>aws-textract/detect-text</code> | 98.13/100 quality score | 98.13 | 1.87% | 0.33% | 12.04s | $0.0060 |
| 13 | <code>openai/gpt-5.4</code> | 97.90/100 quality score | 97.90 | 2.10% | 0.70% | 27.91s | $0.0584 |
| 14 | <code>anthropic/claude-haiku-4-5</code> | 97.90/100 quality score | 97.90 | 2.10% | 0.71% | 35.54s | $0.0161 |
| 15 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 97.75/100 quality score | 97.75 | 2.25% | 0.87% | 76.46s | $0.0058 |
| 16 | <code>openai/gpt-5.4-nano</code> | 96.63/100 quality score | 96.63 | 3.37% | 0.80% | 19.17s | $0.0048 |
| 17 | <code>anthropic/claude-sonnet-4-6</code> | 90.49/100 quality score | 90.49 | 9.51% | 3.46% | 378.34s | $0.00 |
| 18 | <code>unstructured/hi_res_and_enrichment</code> | 0.45/100 quality score | 0.45 | 99.55% | 99.53% | 114.56s | $0.1200 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | Local | 96.33 | 3.67% | 1.63% | 10.99s | $0.00 |
| <code>paddle-ocr</code> | Local | 92.21 | 7.79% | 1.52% | 87.01s | $0.00 |
| <code>tesseract</code> | Local | 96.48 | 3.52% | 1.63% | 8.55s | $0.00 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 97.90 | 2.10% | 0.71% | 35.54s | $0.0161 |
| <code>anthropic/claude-opus-4-7</code> | Third-Party Service | 99.85 | 0.15% | 0.01% | 53.14s | $0.0933 |
| <code>anthropic/claude-sonnet-4-6</code> | Third-Party Service | 90.49 | 9.51% | 3.46% | 378.34s | $0.00 |
| <code>aws-textract/detect-text</code> | Third-Party Service | 98.13 | 1.87% | 0.33% | 12.04s | $0.0060 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 99.40 | 0.60% | 0.06% | 42.59s | $0.0079 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 97.75 | 2.25% | 0.87% | 76.46s | $0.0058 |
| <code>gcloud-docai/ocr</code> | Third-Party Service | 98.28 | 1.72% | 0.18% | 77.98s | $0.0060 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | Third-Party Service | 99.18 | 0.82% | 0.70% | 11.95s | $0.0032 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 98.50 | 1.50% | 0.15% | 44.33s | $0.0273 |
| <code>glm/glm-ocr</code> | Third-Party Service | 98.58 | 1.42% | 1.36% | 23.37s | $0.0003 |
| <code>grok/grok-4.3</code> | Third-Party Service | 99.18 | 0.82% | 0.22% | 64.29s | $0.0170 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 99.10 | 0.90% | 0.49% | 47.28s | $0.0230 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 99.85 | 0.15% | 0.19% | 7.52s | $0.0080 |
| <code>openai/gpt-5.4</code> | Third-Party Service | 97.90 | 2.10% | 0.70% | 27.91s | $0.0584 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 98.80 | 1.20% | 0.61% | 113.65s | $0.0171 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 96.63 | 3.37% | 0.80% | 19.17s | $0.0048 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 99.85 | 0.15% | 0.01% | 50.26s | $0.1749 |
| <code>unstructured/hi_res_and_enrichment</code> | Third-Party Service | 0.45 | 99.55% | 99.53% | 114.56s | $0.1200 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | 20 | 13 | 16 | 1335 |
| <code>paddle-ocr</code> | 51 | 45 | 8 | 1335 |
| <code>tesseract</code> | 17 | 12 | 18 | 1335 |
| <code>anthropic/claude-haiku-4-5</code> | 11 | 8 | 9 | 1335 |
| <code>anthropic/claude-opus-4-7</code> | 1 | 0 | 1 | 1335 |
| <code>anthropic/claude-sonnet-4-6</code> | 92 | 0 | 35 | 1335 |
| <code>aws-textract/detect-text</code> | 12 | 1 | 12 | 1335 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 4 | 0 | 4 | 1335 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 10 | 10 | 10 | 1335 |
| <code>gcloud-docai/ocr</code> | 12 | 0 | 11 | 1335 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | 0 | 10 | 1 | 1335 |
| <code>gemini/gemini-3.1-pro-preview</code> | 10 | 0 | 10 | 1335 |
| <code>glm/glm-ocr</code> | 3 | 15 | 1 | 1335 |
| <code>grok/grok-4.3</code> | 4 | 3 | 4 | 1335 |
| <code>kimi/kimi-k2.6</code> | 3 | 6 | 3 | 1335 |
| <code>mistral/mistral-ocr-2512</code> | 0 | 0 | 2 | 1335 |
| <code>openai/gpt-5.4</code> | 10 | 8 | 10 | 1335 |
| <code>openai/gpt-5.4-mini</code> | 4 | 8 | 4 | 1335 |
| <code>openai/gpt-5.4-nano</code> | 31 | 3 | 11 | 1335 |
| <code>openai/gpt-5.5</code> | 1 | 0 | 1 | 1335 |
| <code>unstructured/hi_res_and_enrichment</code> | 1 | 1328 | 0 | 1335 |

## Notes

- Best local model: `tesseract/tesseract` scored 96.48/100.
- Best cloud service: `anthropic/claude-opus-4-7` scored 99.85/100.
- The cheapest cloud provider was `anthropic/claude-sonnet-4-6` at 0.0000¢ ($0.0000).
- Fastest local model: `tesseract/tesseract` at 8.55s.
- Fastest cloud service: `mistral/mistral-ocr-2512` at 7.52s.
