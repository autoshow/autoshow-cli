# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/ocr/2026-05-21_05-43-56-514_document`
- Total providers: 18 (3 local, 15 third-party service)
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
| 1 | <code>ocrmypdf</code> | $0.00 local monetary cost | 13.18 | 86.82% | 49.74% | 14.36s | $0.00 |
| 2 | <code>paddle-ocr</code> | $0.00 local monetary cost | 1.57 | 98.43% | 89.96% | 50.89s | $0.00 |
| 3 | <code>tesseract</code> | $0.00 local monetary cost | 14.55 | 85.45% | 45.94% | 9.47s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 9.47s | 14.55 | 85.45% | 45.94% | 9.47s | $0.00 |
| 2 | <code>ocrmypdf</code> | 14.36s | 13.18 | 86.82% | 49.74% | 14.36s | $0.00 |
| 3 | <code>paddle-ocr</code> | 50.89s | 1.57 | 98.43% | 89.96% | 50.89s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 14.55/100 quality score | 14.55 | 85.45% | 45.94% | 9.47s | $0.00 |
| 2 | <code>ocrmypdf</code> | 13.18/100 quality score | 13.18 | 86.82% | 49.74% | 14.36s | $0.00 |
| 3 | <code>paddle-ocr</code> | 1.57/100 quality score | 1.57 | 98.43% | 89.96% | 50.89s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>glm/glm-ocr</code> | $0.0003 | 83.33 | 16.67% | 15.66% | 21.07s | $0.0003 |
| 2 | <code>aws-textract/detect-text</code> | $0.0015 | 61.41 | 38.59% | 21.40% | 4.95s | $0.0015 |
| 3 | <code>gcloud-docai/ocr</code> | $0.0015 | 72.95 | 27.05% | 18.06% | 5.19s | $0.0015 |
| 4 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 86.61 | 13.39% | 9.23% | 9.56s | $0.0020 |
| 5 | <code>gemini/gemini-3.1-flash-lite-preview</code> | $0.0027 | 91.12 | 8.88% | 9.14% | 7.87s | $0.0027 |
| 6 | <code>openai/gpt-5.4-nano</code> | $0.0032 | 60.18 | 39.82% | 32.32% | 15.02s | $0.0032 |
| 7 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0035 | 92.76 | 7.24% | 6.57% | 72.21s | $0.0035 |
| 8 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0049 | 95.83 | 4.17% | 3.30% | 40.36s | $0.0049 |
| 9 | <code>grok/grok-4.3</code> | $0.0077 | 97.68 | 2.32% | 1.53% | 44.00s | $0.0077 |
| 10 | <code>openai/gpt-5.4-mini</code> | $0.0109 | 97.47 | 2.53% | 2.06% | 10.72s | $0.0109 |
| 11 | <code>kimi/kimi-k2.6</code> | $0.0118 | 99.45 | 0.55% | 0.25% | 28.26s | $0.0118 |
| 12 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0269 | 91.12 | 8.88% | 6.84% | 17.48s | $0.0269 |
| 13 | <code>unstructured/hi_res_and_enrichment</code> | $0.0300 | 2.73 | 97.27% | 83.48% | 68.27s | $0.0300 |
| 14 | <code>openai/gpt-5.4</code> | $0.0363 | 96.24 | 3.76% | 2.59% | 20.35s | $0.0363 |
| 15 | <code>openai/gpt-5.5</code> | $0.1271 | 59.84 | 40.16% | 40.28% | 53.82s | $0.1271 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>aws-textract/detect-text</code> | 4.95s | 61.41 | 38.59% | 21.40% | 4.95s | $0.0015 |
| 2 | <code>gcloud-docai/ocr</code> | 5.19s | 72.95 | 27.05% | 18.06% | 5.19s | $0.0015 |
| 3 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 7.87s | 91.12 | 8.88% | 9.14% | 7.87s | $0.0027 |
| 4 | <code>mistral/mistral-ocr-2512</code> | 9.56s | 86.61 | 13.39% | 9.23% | 9.56s | $0.0020 |
| 5 | <code>openai/gpt-5.4-mini</code> | 10.72s | 97.47 | 2.53% | 2.06% | 10.72s | $0.0109 |
| 6 | <code>openai/gpt-5.4-nano</code> | 15.02s | 60.18 | 39.82% | 32.32% | 15.02s | $0.0032 |
| 7 | <code>gemini/gemini-3.1-pro-preview</code> | 17.48s | 91.12 | 8.88% | 6.84% | 17.48s | $0.0269 |
| 8 | <code>openai/gpt-5.4</code> | 20.35s | 96.24 | 3.76% | 2.59% | 20.35s | $0.0363 |
| 9 | <code>glm/glm-ocr</code> | 21.07s | 83.33 | 16.67% | 15.66% | 21.07s | $0.0003 |
| 10 | <code>kimi/kimi-k2.6</code> | 28.26s | 99.45 | 0.55% | 0.25% | 28.26s | $0.0118 |
| 11 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 40.36s | 95.83 | 4.17% | 3.30% | 40.36s | $0.0049 |
| 12 | <code>grok/grok-4.3</code> | 44.00s | 97.68 | 2.32% | 1.53% | 44.00s | $0.0077 |
| 13 | <code>openai/gpt-5.5</code> | 53.82s | 59.84 | 40.16% | 40.28% | 53.82s | $0.1271 |
| 14 | <code>unstructured/hi_res_and_enrichment</code> | 68.27s | 2.73 | 97.27% | 83.48% | 68.27s | $0.0300 |
| 15 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 72.21s | 92.76 | 7.24% | 6.57% | 72.21s | $0.0035 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>kimi/kimi-k2.6</code> | 99.45/100 quality score | 99.45 | 0.55% | 0.25% | 28.26s | $0.0118 |
| 2 | <code>grok/grok-4.3</code> | 97.68/100 quality score | 97.68 | 2.32% | 1.53% | 44.00s | $0.0077 |
| 3 | <code>openai/gpt-5.4-mini</code> | 97.47/100 quality score | 97.47 | 2.53% | 2.06% | 10.72s | $0.0109 |
| 4 | <code>openai/gpt-5.4</code> | 96.24/100 quality score | 96.24 | 3.76% | 2.59% | 20.35s | $0.0363 |
| 5 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 95.83/100 quality score | 95.83 | 4.17% | 3.30% | 40.36s | $0.0049 |
| 6 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 92.76/100 quality score | 92.76 | 7.24% | 6.57% | 72.21s | $0.0035 |
| 7 | <code>gemini/gemini-3.1-pro-preview</code> | 91.12/100 quality score | 91.12 | 8.88% | 6.84% | 17.48s | $0.0269 |
| 8 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 91.12/100 quality score | 91.12 | 8.88% | 9.14% | 7.87s | $0.0027 |
| 9 | <code>mistral/mistral-ocr-2512</code> | 86.61/100 quality score | 86.61 | 13.39% | 9.23% | 9.56s | $0.0020 |
| 10 | <code>glm/glm-ocr</code> | 83.33/100 quality score | 83.33 | 16.67% | 15.66% | 21.07s | $0.0003 |
| 11 | <code>gcloud-docai/ocr</code> | 72.95/100 quality score | 72.95 | 27.05% | 18.06% | 5.19s | $0.0015 |
| 12 | <code>aws-textract/detect-text</code> | 61.41/100 quality score | 61.41 | 38.59% | 21.40% | 4.95s | $0.0015 |
| 13 | <code>openai/gpt-5.4-nano</code> | 60.18/100 quality score | 60.18 | 39.82% | 32.32% | 15.02s | $0.0032 |
| 14 | <code>openai/gpt-5.5</code> | 59.84/100 quality score | 59.84 | 40.16% | 40.28% | 53.82s | $0.1271 |
| 15 | <code>unstructured/hi_res_and_enrichment</code> | 2.73/100 quality score | 2.73 | 97.27% | 83.48% | 68.27s | $0.0300 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | Local | 13.18 | 86.82% | 49.74% | 14.36s | $0.00 |
| <code>paddle-ocr</code> | Local | 1.57 | 98.43% | 89.96% | 50.89s | $0.00 |
| <code>tesseract</code> | Local | 14.55 | 85.45% | 45.94% | 9.47s | $0.00 |
| <code>aws-textract/detect-text</code> | Third-Party Service | 61.41 | 38.59% | 21.40% | 4.95s | $0.0015 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 95.83 | 4.17% | 3.30% | 40.36s | $0.0049 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 92.76 | 7.24% | 6.57% | 72.21s | $0.0035 |
| <code>gcloud-docai/ocr</code> | Third-Party Service | 72.95 | 27.05% | 18.06% | 5.19s | $0.0015 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | Third-Party Service | 91.12 | 8.88% | 9.14% | 7.87s | $0.0027 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 91.12 | 8.88% | 6.84% | 17.48s | $0.0269 |
| <code>glm/glm-ocr</code> | Third-Party Service | 83.33 | 16.67% | 15.66% | 21.07s | $0.0003 |
| <code>grok/grok-4.3</code> | Third-Party Service | 97.68 | 2.32% | 1.53% | 44.00s | $0.0077 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 99.45 | 0.55% | 0.25% | 28.26s | $0.0118 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 86.61 | 13.39% | 9.23% | 9.56s | $0.0020 |
| <code>openai/gpt-5.4</code> | Third-Party Service | 96.24 | 3.76% | 2.59% | 20.35s | $0.0363 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 97.47 | 2.53% | 2.06% | 10.72s | $0.0109 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 60.18 | 39.82% | 32.32% | 15.02s | $0.0032 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 59.84 | 40.16% | 40.28% | 53.82s | $0.1271 |
| <code>unstructured/hi_res_and_enrichment</code> | Third-Party Service | 2.73 | 97.27% | 83.48% | 68.27s | $0.0300 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | 959 | 298 | 14 | 1464 |
| <code>paddle-ocr</code> | 138 | 1303 | 0 | 1464 |
| <code>tesseract</code> | 1035 | 196 | 20 | 1464 |
| <code>aws-textract/detect-text</code> | 336 | 183 | 46 | 1464 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 29 | 28 | 4 | 1464 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 26 | 79 | 1 | 1464 |
| <code>gcloud-docai/ocr</code> | 201 | 86 | 109 | 1464 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | 2 | 128 | 0 | 1464 |
| <code>gemini/gemini-3.1-pro-preview</code> | 119 | 6 | 5 | 1464 |
| <code>glm/glm-ocr</code> | 25 | 209 | 10 | 1464 |
| <code>grok/grok-4.3</code> | 11 | 23 | 0 | 1464 |
| <code>kimi/kimi-k2.6</code> | 3 | 5 | 0 | 1464 |
| <code>mistral/mistral-ocr-2512</code> | 133 | 56 | 7 | 1464 |
| <code>openai/gpt-5.4</code> | 27 | 15 | 13 | 1464 |
| <code>openai/gpt-5.4-mini</code> | 10 | 26 | 1 | 1464 |
| <code>openai/gpt-5.4-nano</code> | 117 | 141 | 325 | 1464 |
| <code>openai/gpt-5.5</code> | 2 | 586 | 0 | 1464 |
| <code>unstructured/hi_res_and_enrichment</code> | 484 | 940 | 0 | 1464 |

## Notes

- Best local model: `tesseract/tesseract` scored 14.55/100.
- Best cloud service: `kimi/kimi-k2.6` scored 99.45/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0286¢ ($0.0003).
- Fastest local model: `tesseract/tesseract` at 9.47s.
- Fastest cloud service: `aws-textract/detect-text` at 4.95s.
