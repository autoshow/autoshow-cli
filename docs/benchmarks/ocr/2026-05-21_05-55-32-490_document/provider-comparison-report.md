# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/ocr/2026-05-21_05-55-32-490_document`
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
| 1 | <code>ocrmypdf</code> | $0.00 local monetary cost | 75.52 | 24.48% | 7.00% | 9.09s | $0.00 |
| 2 | <code>paddle-ocr</code> | $0.00 local monetary cost | 71.12 | 28.88% | 7.76% | 64.94s | $0.00 |
| 3 | <code>tesseract</code> | $0.00 local monetary cost | 77.22 | 22.78% | 6.22% | 7.35s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 7.35s | 77.22 | 22.78% | 6.22% | 7.35s | $0.00 |
| 2 | <code>ocrmypdf</code> | 9.09s | 75.52 | 24.48% | 7.00% | 9.09s | $0.00 |
| 3 | <code>paddle-ocr</code> | 64.94s | 71.12 | 28.88% | 7.76% | 64.94s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 77.22/100 quality score | 77.22 | 22.78% | 6.22% | 7.35s | $0.00 |
| 2 | <code>ocrmypdf</code> | 75.52/100 quality score | 75.52 | 24.48% | 7.00% | 9.09s | $0.00 |
| 3 | <code>paddle-ocr</code> | 71.12/100 quality score | 71.12 | 28.88% | 7.76% | 64.94s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>glm/glm-ocr</code> | $0.0003 | 80.36 | 19.64% | 15.28% | 15.17s | $0.0003 |
| 2 | <code>gemini/gemini-3.1-flash-lite-preview</code> | $0.0033 | 98.65 | 1.35% | 0.40% | 6.26s | $0.0033 |
| 3 | <code>openai/gpt-5.4-nano</code> | $0.0039 | 58.12 | 41.88% | 28.95% | 53.85s | $0.0039 |
| 4 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0052 | 91.21 | 8.79% | 2.99% | 70.58s | $0.0052 |
| 5 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0071 | 84.84 | 15.16% | 4.04% | 44.17s | $0.0071 |
| 6 | <code>aws-textract/detect-text</code> | $0.0075 | 80.72 | 19.28% | 4.41% | 14.61s | $0.0075 |
| 7 | <code>gcloud-docai/ocr</code> | $0.0075 | 77.67 | 22.33% | 5.12% | 74.10s | $0.0075 |
| 8 | <code>mistral/mistral-ocr-2512</code> | $0.0100 | 96.05 | 3.95% | 1.54% | 6.32s | $0.0100 |
| 9 | <code>openai/gpt-5.4-mini</code> | $0.0104 | 28.34 | 71.66% | 69.47% | 16.08s | $0.0104 |
| 10 | <code>anthropic/claude-haiku-4-5</code> | $0.0191 | 96.86 | 3.14% | 0.81% | 38.37s | $0.0191 |
| 11 | <code>grok/grok-4.3</code> | $0.0202 | 98.74 | 1.26% | 0.24% | 83.79s | $0.0202 |
| 12 | <code>kimi/kimi-k2.6</code> | $0.0274 | 89.33 | 10.67% | 1.85% | 54.20s | $0.0274 |
| 13 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0287 | 94.17 | 5.83% | 0.90% | 127.83s | $0.0287 |
| 14 | <code>openai/gpt-5.4</code> | $0.0513 | 88.88 | 11.12% | 7.43% | 26.84s | $0.0513 |
| 15 | <code>anthropic/claude-sonnet-4-6</code> | $0.0581 | 98.92 | 1.08% | 0.17% | 66.18s | $0.0581 |
| 16 | <code>anthropic/claude-opus-4-7</code> | $0.1097 | 98.74 | 1.26% | 0.21% | 54.98s | $0.1097 |
| 17 | <code>unstructured/hi_res_and_enrichment</code> | $0.1500 | 1.35 | 98.65% | 98.76% | 36.83s | $0.1500 |
| 18 | <code>openai/gpt-5.5</code> | $0.1853 | 96.95 | 3.05% | 0.43% | 51.40s | $0.1853 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 6.26s | 98.65 | 1.35% | 0.40% | 6.26s | $0.0033 |
| 2 | <code>mistral/mistral-ocr-2512</code> | 6.32s | 96.05 | 3.95% | 1.54% | 6.32s | $0.0100 |
| 3 | <code>aws-textract/detect-text</code> | 14.61s | 80.72 | 19.28% | 4.41% | 14.61s | $0.0075 |
| 4 | <code>glm/glm-ocr</code> | 15.17s | 80.36 | 19.64% | 15.28% | 15.17s | $0.0003 |
| 5 | <code>openai/gpt-5.4-mini</code> | 16.08s | 28.34 | 71.66% | 69.47% | 16.08s | $0.0104 |
| 6 | <code>openai/gpt-5.4</code> | 26.84s | 88.88 | 11.12% | 7.43% | 26.84s | $0.0513 |
| 7 | <code>unstructured/hi_res_and_enrichment</code> | 36.83s | 1.35 | 98.65% | 98.76% | 36.83s | $0.1500 |
| 8 | <code>anthropic/claude-haiku-4-5</code> | 38.37s | 96.86 | 3.14% | 0.81% | 38.37s | $0.0191 |
| 9 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 44.17s | 84.84 | 15.16% | 4.04% | 44.17s | $0.0071 |
| 10 | <code>openai/gpt-5.5</code> | 51.40s | 96.95 | 3.05% | 0.43% | 51.40s | $0.1853 |
| 11 | <code>openai/gpt-5.4-nano</code> | 53.85s | 58.12 | 41.88% | 28.95% | 53.85s | $0.0039 |
| 12 | <code>kimi/kimi-k2.6</code> | 54.20s | 89.33 | 10.67% | 1.85% | 54.20s | $0.0274 |
| 13 | <code>anthropic/claude-opus-4-7</code> | 54.98s | 98.74 | 1.26% | 0.21% | 54.98s | $0.1097 |
| 14 | <code>anthropic/claude-sonnet-4-6</code> | 66.18s | 98.92 | 1.08% | 0.17% | 66.18s | $0.0581 |
| 15 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 70.58s | 91.21 | 8.79% | 2.99% | 70.58s | $0.0052 |
| 16 | <code>gcloud-docai/ocr</code> | 74.10s | 77.67 | 22.33% | 5.12% | 74.10s | $0.0075 |
| 17 | <code>grok/grok-4.3</code> | 83.79s | 98.74 | 1.26% | 0.24% | 83.79s | $0.0202 |
| 18 | <code>gemini/gemini-3.1-pro-preview</code> | 127.83s | 94.17 | 5.83% | 0.90% | 127.83s | $0.0287 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-sonnet-4-6</code> | 98.92/100 quality score | 98.92 | 1.08% | 0.17% | 66.18s | $0.0581 |
| 2 | <code>anthropic/claude-opus-4-7</code> | 98.74/100 quality score | 98.74 | 1.26% | 0.21% | 54.98s | $0.1097 |
| 3 | <code>grok/grok-4.3</code> | 98.74/100 quality score | 98.74 | 1.26% | 0.24% | 83.79s | $0.0202 |
| 4 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 98.65/100 quality score | 98.65 | 1.35% | 0.40% | 6.26s | $0.0033 |
| 5 | <code>openai/gpt-5.5</code> | 96.95/100 quality score | 96.95 | 3.05% | 0.43% | 51.40s | $0.1853 |
| 6 | <code>anthropic/claude-haiku-4-5</code> | 96.86/100 quality score | 96.86 | 3.14% | 0.81% | 38.37s | $0.0191 |
| 7 | <code>mistral/mistral-ocr-2512</code> | 96.05/100 quality score | 96.05 | 3.95% | 1.54% | 6.32s | $0.0100 |
| 8 | <code>gemini/gemini-3.1-pro-preview</code> | 94.17/100 quality score | 94.17 | 5.83% | 0.90% | 127.83s | $0.0287 |
| 9 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 91.21/100 quality score | 91.21 | 8.79% | 2.99% | 70.58s | $0.0052 |
| 10 | <code>kimi/kimi-k2.6</code> | 89.33/100 quality score | 89.33 | 10.67% | 1.85% | 54.20s | $0.0274 |
| 11 | <code>openai/gpt-5.4</code> | 88.88/100 quality score | 88.88 | 11.12% | 7.43% | 26.84s | $0.0513 |
| 12 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 84.84/100 quality score | 84.84 | 15.16% | 4.04% | 44.17s | $0.0071 |
| 13 | <code>aws-textract/detect-text</code> | 80.72/100 quality score | 80.72 | 19.28% | 4.41% | 14.61s | $0.0075 |
| 14 | <code>glm/glm-ocr</code> | 80.36/100 quality score | 80.36 | 19.64% | 15.28% | 15.17s | $0.0003 |
| 15 | <code>gcloud-docai/ocr</code> | 77.67/100 quality score | 77.67 | 22.33% | 5.12% | 74.10s | $0.0075 |
| 16 | <code>openai/gpt-5.4-nano</code> | 58.12/100 quality score | 58.12 | 41.88% | 28.95% | 53.85s | $0.0039 |
| 17 | <code>openai/gpt-5.4-mini</code> | 28.34/100 quality score | 28.34 | 71.66% | 69.47% | 16.08s | $0.0104 |
| 18 | <code>unstructured/hi_res_and_enrichment</code> | 1.35/100 quality score | 1.35 | 98.65% | 98.76% | 36.83s | $0.1500 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | Local | 75.52 | 24.48% | 7.00% | 9.09s | $0.00 |
| <code>paddle-ocr</code> | Local | 71.12 | 28.88% | 7.76% | 64.94s | $0.00 |
| <code>tesseract</code> | Local | 77.22 | 22.78% | 6.22% | 7.35s | $0.00 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 96.86 | 3.14% | 0.81% | 38.37s | $0.0191 |
| <code>anthropic/claude-opus-4-7</code> | Third-Party Service | 98.74 | 1.26% | 0.21% | 54.98s | $0.1097 |
| <code>anthropic/claude-sonnet-4-6</code> | Third-Party Service | 98.92 | 1.08% | 0.17% | 66.18s | $0.0581 |
| <code>aws-textract/detect-text</code> | Third-Party Service | 80.72 | 19.28% | 4.41% | 14.61s | $0.0075 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 84.84 | 15.16% | 4.04% | 44.17s | $0.0071 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 91.21 | 8.79% | 2.99% | 70.58s | $0.0052 |
| <code>gcloud-docai/ocr</code> | Third-Party Service | 77.67 | 22.33% | 5.12% | 74.10s | $0.0075 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | Third-Party Service | 98.65 | 1.35% | 0.40% | 6.26s | $0.0033 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 94.17 | 5.83% | 0.90% | 127.83s | $0.0287 |
| <code>glm/glm-ocr</code> | Third-Party Service | 80.36 | 19.64% | 15.28% | 15.17s | $0.0003 |
| <code>grok/grok-4.3</code> | Third-Party Service | 98.74 | 1.26% | 0.24% | 83.79s | $0.0202 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 89.33 | 10.67% | 1.85% | 54.20s | $0.0274 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 96.05 | 3.95% | 1.54% | 6.32s | $0.0100 |
| <code>openai/gpt-5.4</code> | Third-Party Service | 88.88 | 11.12% | 7.43% | 26.84s | $0.0513 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 28.34 | 71.66% | 69.47% | 16.08s | $0.0104 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 58.12 | 41.88% | 28.95% | 53.85s | $0.0039 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 96.95 | 3.05% | 0.43% | 51.40s | $0.1853 |
| <code>unstructured/hi_res_and_enrichment</code> | Third-Party Service | 1.35 | 98.65% | 98.76% | 36.83s | $0.1500 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | 225 | 27 | 21 | 1115 |
| <code>paddle-ocr</code> | 242 | 73 | 7 | 1115 |
| <code>tesseract</code> | 216 | 22 | 16 | 1115 |
| <code>anthropic/claude-haiku-4-5</code> | 21 | 11 | 3 | 1115 |
| <code>anthropic/claude-opus-4-7</code> | 5 | 7 | 2 | 1115 |
| <code>anthropic/claude-sonnet-4-6</code> | 6 | 3 | 3 | 1115 |
| <code>aws-textract/detect-text</code> | 199 | 8 | 8 | 1115 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 130 | 24 | 15 | 1115 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 62 | 27 | 9 | 1115 |
| <code>gcloud-docai/ocr</code> | 172 | 24 | 53 | 1115 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | 12 | 3 | 0 | 1115 |
| <code>gemini/gemini-3.1-pro-preview</code> | 20 | 0 | 45 | 1115 |
| <code>glm/glm-ocr</code> | 63 | 149 | 7 | 1115 |
| <code>grok/grok-4.3</code> | 13 | 0 | 1 | 1115 |
| <code>kimi/kimi-k2.6</code> | 90 | 7 | 22 | 1115 |
| <code>mistral/mistral-ocr-2512</code> | 15 | 15 | 14 | 1115 |
| <code>openai/gpt-5.4</code> | 13 | 79 | 32 | 1115 |
| <code>openai/gpt-5.4-mini</code> | 9 | 787 | 3 | 1115 |
| <code>openai/gpt-5.4-nano</code> | 167 | 287 | 13 | 1115 |
| <code>openai/gpt-5.5</code> | 13 | 3 | 18 | 1115 |
| <code>unstructured/hi_res_and_enrichment</code> | 10 | 1090 | 0 | 1115 |

## Notes

- Best local model: `tesseract/tesseract` scored 77.22/100.
- Best cloud service: `anthropic/claude-sonnet-4-6` scored 98.92/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0346¢ ($0.0003).
- Fastest local model: `tesseract/tesseract` at 7.35s.
- Fastest cloud service: `gemini/gemini-3.1-flash-lite-preview` at 6.26s.
