# OCR Provider Comparison Report

## Summary

- Consensus extraction: `consensus-extraction.txt` (6929 characters, 1327 words)
- Total providers: 17 (3 local, 14 cloud)
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
| 1 | `gemini/gemini-3.1-flash-lite-preview` | cloud | 98.61 | 99.17 | 97.30 | 98.79 |
| 2 | `mistral/mistral-ocr-2512` | cloud | 98.55 | 98.64 | 100.00 | 96.92 |
| 3 | `tesseract/tesseract` | local | 97.89 | 96.01 | 99.56 | 100.00 |
| 4 | `ocrmypdf/ocrmypdf` | local | 97.36 | 95.86 | 97.75 | 100.00 |
| 5 | `glm/glm-ocr` | cloud | 96.24 | 98.94 | 87.20 | 99.87 |
| 6 | `aws-textract/detect-text` | cloud | 89.93 | 97.14 | 67.75 | 97.69 |
| 7 | `anthropic/claude-haiku-4-5` | cloud | 89.19 | 97.97 | 67.03 | 93.80 |
| 8 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | cloud | 88.46 | 97.36 | 61.40 | 97.72 |
| 9 | `openai/gpt-5.4` | cloud | 87.13 | 97.89 | 75.17 | 77.56 |
| 10 | `gcloud-docai/ocr` | cloud | 86.84 | 97.14 | 55.41 | 97.69 |
| 11 | `kimi/kimi-k2.6` | cloud | 84.50 | 97.89 | 51.34 | 90.87 |
| 12 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | cloud | 81.68 | 98.12 | 33.56 | 96.90 |
| 13 | `paddle-ocr/paddle-ocr` | local | 79.34 | 91.64 | 34.09 | 100.00 |
| 14 | `gemini/gemini-3.1-pro-preview` | cloud | 78.26 | 98.64 | 25.69 | 90.09 |
| 15 | `deepinfra/PaddlePaddle/PaddleOCR-VL-0.9B` | cloud | 73.28 | 96.91 | 0.00 | 99.30 |
| 16 | `aws-textract/analyze-document` | cloud | 72.42 | 97.14 | 95.41 | 0.00 |
| 17 | `openai/gpt-5.4-nano` | cloud | 66.36 | 39.19 | 88.37 | 98.72 |

## Ranking

### Local Models (3)

  - `tesseract/tesseract`
  - `ocrmypdf/ocrmypdf`
  - `paddle-ocr/paddle-ocr`

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `tesseract/tesseract` | 96.01 | 3.99% | 2.10% | 1352 | 6.62s |
| 2 | `ocrmypdf/ocrmypdf` | 95.86 | 4.14% | 2.11% | 1350 | 8.24s |
| 3 | `paddle-ocr/paddle-ocr` | 91.64 | 8.36% | 2.17% | 1215 | 65.46s |
### Cloud Services (14)

  - `gemini/gemini-3.1-flash-lite-preview`
  - `glm/glm-ocr`
  - `mistral/mistral-ocr-2512`
  - `gemini/gemini-3.1-pro-preview`
  - `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct`
  - `anthropic/claude-haiku-4-5`
  - `kimi/kimi-k2.6`
  - `openai/gpt-5.4`
  - `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct`
  - `gcloud-docai/ocr`
  - `aws-textract/analyze-document`
  - `aws-textract/detect-text`
  - `deepinfra/PaddlePaddle/PaddleOCR-VL-0.9B`
  - `openai/gpt-5.4-nano`

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `gemini/gemini-3.1-flash-lite-preview` | 99.17 | 0.83% | 0.57% | 1323 | 8.64s | 0.3144¢ ($0.0031) |
| 2 | `glm/glm-ocr` | 98.94 | 1.06% | 1.04% | 1313 | 17.72s | 0.0340¢ ($0.0003) |
| 3 | `mistral/mistral-ocr-2512` | 98.64 | 1.36% | 1.16% | 1338 | 6.22s | 0.8000¢ ($0.0080) |
| 4 | `gemini/gemini-3.1-pro-preview` | 98.64 | 1.36% | 1.25% | 1338 | 73.01s | 2.5778¢ ($0.0258) |
| 5 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 98.12 | 1.88% | 1.06% | 1340 | 65.93s | 0.8048¢ ($0.0080) |
| 6 | `anthropic/claude-haiku-4-5` | 97.97 | 2.03% | 0.57% | 1329 | 35.85s | 1.6125¢ ($0.0161) |
| 7 | `kimi/kimi-k2.6` | 97.89 | 2.11% | 0.57% | 1344 | 49.96s | 2.3732¢ ($0.0237) |
| 8 | `openai/gpt-5.4` | 97.89 | 2.11% | 0.57% | 1341 | 28.53s | 5.8345¢ ($0.0583) |
| 9 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 97.36 | 2.64% | 1.04% | 1343 | 40.91s | 0.5919¢ ($0.0059) |
| 10 | `gcloud-docai/ocr` | 97.14 | 2.86% | 1.12% | 1349 | 46.29s | 0.6000¢ ($0.0060) |
| 11 | `aws-textract/analyze-document` | 97.14 | 2.86% | 1.19% | 1351 | 10.34s | 26.0000¢ ($0.2600) |
| 12 | `aws-textract/detect-text` | 97.14 | 2.86% | 1.19% | 1351 | 35.20s | 0.6000¢ ($0.0060) |
| 13 | `deepinfra/PaddlePaddle/PaddleOCR-VL-0.9B` | 96.91 | 3.09% | 1.56% | 1354 | 96.10s | 0.1821¢ ($0.0018) |
| 14 | `openai/gpt-5.4-nano` | 39.19 | 60.81% | 59.95% | 533 | 16.67s | 0.3337¢ ($0.0033) |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| `tesseract/tesseract` | 13 | 9 | 31 | 1327 |
| `ocrmypdf/ocrmypdf` | 16 | 10 | 29 | 1327 |
| `paddle-ocr/paddle-ocr` | 56 | 38 | 17 | 1327 |
| `gemini/gemini-3.1-flash-lite-preview` | 0 | 2 | 9 | 1327 |
| `glm/glm-ocr` | 0 | 10 | 4 | 1327 |
| `mistral/mistral-ocr-2512` | 0 | 0 | 18 | 1327 |
| `gemini/gemini-3.1-pro-preview` | 0 | 0 | 18 | 1327 |
| `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 4 | 1 | 20 | 1327 |
| `anthropic/claude-haiku-4-5` | 10 | 0 | 17 | 1327 |
| `kimi/kimi-k2.6` | 10 | 0 | 18 | 1327 |
| `openai/gpt-5.4` | 10 | 0 | 18 | 1327 |
| `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 10 | 2 | 23 | 1327 |
| `gcloud-docai/ocr` | 11 | 0 | 27 | 1327 |
| `aws-textract/analyze-document` | 11 | 0 | 27 | 1327 |
| `aws-textract/detect-text` | 11 | 0 | 27 | 1327 |
| `deepinfra/PaddlePaddle/PaddleOCR-VL-0.9B` | 11 | 1 | 29 | 1327 |
| `openai/gpt-5.4-nano` | 14 | 792 | 1 | 1327 |

## Notes

- Best overall provider: `gemini/gemini-3.1-flash-lite-preview` scored 98.61/100 using balanced overall weighting.
- Worst overall provider: `openai/gpt-5.4-nano` scored 66.36/100 using balanced overall weighting.
- Best local model: `tesseract/tesseract` scored 96.01/100.
- Best cloud service: `gemini/gemini-3.1-flash-lite-preview` scored 99.17/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0340¢ ($0.0003).
- Fastest local model: `tesseract/tesseract` at 6.62s.
- Fastest cloud service: `mistral/mistral-ocr-2512` at 6.22s.
