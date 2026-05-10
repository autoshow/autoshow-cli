# OCR Provider Comparison Report

## Summary

- Consensus extraction: `consensus-extraction.txt` (6980 characters, 1337 words)
- Total providers: 15 (3 local, 12 cloud)
- Ranking metric: word error rate (WER) against consensus extraction
- Score formula: `max(0, 100 * (1 - WER))`
- Overall metric: balanced-overall (50% accuracy, 25% processing speed, 25% cost efficiency)
- WER formula: `(Substitutions + Deletions + Insertions) / Reference Word Count`

## Method

- The consolidated extraction in `consensus-extraction.txt` was treated as the gold reference.
- Text normalization applied before comparison: lowercasing, curly quote/dash normalization, contraction expansion (it's -> it is), abbreviation expansion (mr. -> mister), currency symbol conversion ($50 -> 50 dollars), and remaining punctuation stripping.
- WER compares the provider's full word stream against the gold extraction word stream.
- CER compares normalized character sequences for finer-grained accuracy.
- Providers are separated into local models and cloud services for independent comparison.
- Overall ranking combines all providers using accuracy score, normalized processing speed, and normalized cost efficiency. Missing timing or missing cloud cost receives a neutral 50/100 component score.

## Overall Ranking

| Rank | Provider | Group | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `tesseract/tesseract` | local | 97.94 | 95.89 | 100.00 | 100.00 |
| 2 | `ocrmypdf/ocrmypdf` | local | 97.15 | 95.74 | 97.11 | 100.00 |
| 3 | `gemini/gemini-3.1-flash-lite-preview` | cloud | 95.93 | 98.80 | 91.47 | 94.64 |
| 4 | `mistral/mistral-ocr-2512` | cloud | 95.64 | 99.25 | 97.76 | 86.30 |
| 5 | `glm/glm-ocr` | cloud | 94.23 | 98.43 | 80.65 | 99.42 |
| 6 | `aws-textract/detect-text` | cloud | 89.86 | 97.46 | 74.80 | 89.72 |
| 7 | `openai/gpt-5.4-nano` | cloud | 89.31 | 96.04 | 73.43 | 91.75 |
| 8 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | cloud | 83.33 | 97.68 | 51.80 | 86.15 |
| 9 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | cloud | 80.39 | 97.38 | 36.92 | 89.87 |
| 10 | `gcloud-docai/ocr` | cloud | 79.96 | 97.53 | 35.04 | 89.72 |
| 11 | `anthropic/claude-haiku-4-5` | cloud | 79.62 | 97.61 | 50.89 | 72.39 |
| 12 | `kimi/kimi-k2.6` | cloud | 72.30 | 97.46 | 34.93 | 59.36 |
| 13 | `gemini/gemini-3.1-pro-preview` | cloud | 70.86 | 99.40 | 28.75 | 55.90 |
| 14 | `paddle-ocr/paddle-ocr` | local | 70.77 | 91.55 | 0.00 | 100.00 |
| 15 | `openai/gpt-5.4` | cloud | 64.81 | 97.38 | 64.46 | 0.00 |

## Ranking

### Local Models (3)

  - `tesseract/tesseract`
  - `ocrmypdf/ocrmypdf`
  - `paddle-ocr/paddle-ocr`

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `tesseract/tesseract` | 95.89 | 4.11% | 2.14% | 1352 | 6.67s |
| 2 | `ocrmypdf/ocrmypdf` | 95.74 | 4.26% | 2.15% | 1350 | 8.39s |
| 3 | `paddle-ocr/paddle-ocr` | 91.55 | 8.45% | 2.21% | 1215 | 66.52s |
### Cloud Services (12)

  - `gemini/gemini-3.1-pro-preview`
  - `mistral/mistral-ocr-2512`
  - `gemini/gemini-3.1-flash-lite-preview`
  - `glm/glm-ocr`
  - `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct`
  - `anthropic/claude-haiku-4-5`
  - `gcloud-docai/ocr`
  - `aws-textract/detect-text`
  - `kimi/kimi-k2.6`
  - `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct`
  - `openai/gpt-5.4`
  - `openai/gpt-5.4-nano`

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `gemini/gemini-3.1-pro-preview` | 99.40 | 0.60% | 0.41% | 1338 | 49.31s | 2.5742¢ ($0.0257) |
| 2 | `mistral/mistral-ocr-2512` | 99.25 | 0.75% | 0.55% | 1338 | 8.01s | 0.8000¢ ($0.0080) |
| 3 | `gemini/gemini-3.1-flash-lite-preview` | 98.80 | 1.20% | 1.03% | 1327 | 11.77s | 0.3131¢ ($0.0031) |
| 4 | `glm/glm-ocr` | 98.43 | 1.57% | 1.51% | 1313 | 18.25s | 0.0340¢ ($0.0003) |
| 5 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 97.68 | 2.32% | 0.87% | 1350 | 35.51s | 0.8088¢ ($0.0081) |
| 6 | `anthropic/claude-haiku-4-5` | 97.61 | 2.39% | 1.03% | 1329 | 36.06s | 1.6120¢ ($0.0161) |
| 7 | `gcloud-docai/ocr` | 97.53 | 2.47% | 0.87% | 1349 | 45.54s | 0.6000¢ ($0.0060) |
| 8 | `aws-textract/detect-text` | 97.46 | 2.54% | 0.84% | 1351 | 21.75s | 0.6000¢ ($0.0060) |
| 9 | `kimi/kimi-k2.6` | 97.46 | 2.54% | 1.05% | 1337 | 45.61s | 2.3724¢ ($0.0237) |
| 10 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 97.38 | 2.62% | 1.08% | 1341 | 44.42s | 0.5914¢ ($0.0059) |
| 11 | `openai/gpt-5.4` | 97.38 | 2.62% | 1.11% | 1334 | 27.94s | 5.8375¢ ($0.0584) |
| 12 | `openai/gpt-5.4-nano` | 96.04 | 3.96% | 1.52% | 1350 | 22.57s | 0.4813¢ ($0.0048) |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| `tesseract/tesseract` | 19 | 12 | 24 | 1337 |
| `ocrmypdf/ocrmypdf` | 22 | 13 | 22 | 1337 |
| `paddle-ocr/paddle-ocr` | 54 | 45 | 14 | 1337 |
| `gemini/gemini-3.1-pro-preview` | 0 | 0 | 8 | 1337 |
| `mistral/mistral-ocr-2512` | 2 | 0 | 8 | 1337 |
| `gemini/gemini-3.1-flash-lite-preview` | 4 | 8 | 4 | 1337 |
| `glm/glm-ocr` | 3 | 17 | 1 | 1337 |
| `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 10 | 3 | 18 | 1337 |
| `anthropic/claude-haiku-4-5` | 13 | 6 | 13 | 1337 |
| `gcloud-docai/ocr` | 12 | 2 | 19 | 1337 |
| `aws-textract/detect-text` | 15 | 1 | 18 | 1337 |
| `kimi/kimi-k2.6` | 14 | 6 | 14 | 1337 |
| `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 14 | 6 | 15 | 1337 |
| `openai/gpt-5.4` | 14 | 7 | 14 | 1337 |
| `openai/gpt-5.4-nano` | 29 | 3 | 21 | 1337 |

## Notes

- Best overall provider: `tesseract/tesseract` scored 97.94/100 using balanced overall weighting.
- Worst overall provider: `openai/gpt-5.4` scored 64.81/100 using balanced overall weighting.
- Best local model: `tesseract/tesseract` scored 95.89/100.
- Best cloud service: `gemini/gemini-3.1-pro-preview` scored 99.40/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0340¢ ($0.0003).
- Fastest local model: `tesseract/tesseract` at 6.67s.
- Fastest cloud service: `mistral/mistral-ocr-2512` at 8.01s.
