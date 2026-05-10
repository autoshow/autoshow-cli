# OCR Provider Comparison Report

## Summary

- Consensus extraction: `consensus-extraction.txt` (12676 characters, 2407 words)
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
| 1 | `glm/glm-ocr` | cloud | 88.83 | 79.56 | 96.75 | 99.46 |
| 2 | `kimi/kimi-k2.6` | cloud | 85.04 | 98.09 | 71.71 | 72.28 |
| 3 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | cloud | 80.65 | 72.29 | 85.64 | 92.36 |
| 4 | `mistral/mistral-ocr-2512` | cloud | 72.92 | 48.86 | 97.02 | 96.92 |
| 5 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | cloud | 67.34 | 58.37 | 57.85 | 94.78 |
| 6 | `ocrmypdf/ocrmypdf` | local | 55.71 | 14.08 | 94.68 | 100.00 |
| 7 | `paddle-ocr/paddle-ocr` | local | 52.39 | 4.78 | 100.00 | 100.00 |
| 8 | `tesseract/tesseract` | local | 52.39 | 4.78 | 99.99 | 100.00 |
| 9 | `openai/gpt-5.4-nano` | cloud | 51.37 | 4.74 | 97.43 | 98.57 |
| 10 | `openai/gpt-5.4` | cloud | 51.04 | 49.31 | 80.67 | 24.87 |
| 11 | `aws-textract/detect-text` | cloud | 51.02 | 5.36 | 95.68 | 97.69 |
| 12 | `gemini/gemini-3.1-flash-lite-preview` | cloud | 49.97 | 3.91 | 97.08 | 94.97 |
| 13 | `gcloud-docai/ocr` | cloud | 49.95 | 6.52 | 89.08 | 97.69 |
| 14 | `anthropic/claude-haiku-4-5` | cloud | 48.52 | 18.53 | 86.63 | 70.38 |
| 15 | `gemini/gemini-3.1-pro-preview` | cloud | 46.06 | 4.65 | 96.27 | 78.68 |
| 16 | `deepinfra/PaddlePaddle/PaddleOCR-VL-0.9B` | cloud | 31.03 | 13.46 | 0.00 | 97.18 |
| 17 | `aws-textract/analyze-document` | cloud | 26.62 | 5.36 | 95.75 | 0.00 |

## Ranking

### Local Models (3)

  - `ocrmypdf/ocrmypdf`
  - `paddle-ocr/paddle-ocr`
  - `tesseract/tesseract`

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `ocrmypdf/ocrmypdf` | 14.08 | 85.92% | 62.74% | 2287 | 17.64s |
| 2 | `paddle-ocr/paddle-ocr` | 4.78 | 95.22% | 83.18% | 549 | 0.00s |
| 3 | `tesseract/tesseract` | 4.78 | 95.22% | 83.18% | 549 | 0.02s |
### Cloud Services (14)

  - `kimi/kimi-k2.6`
  - `glm/glm-ocr`
  - `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct`
  - `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct`
  - `openai/gpt-5.4`
  - `mistral/mistral-ocr-2512`
  - `anthropic/claude-haiku-4-5`
  - `deepinfra/PaddlePaddle/PaddleOCR-VL-0.9B`
  - `gcloud-docai/ocr`
  - `aws-textract/analyze-document`
  - `aws-textract/detect-text`
  - `openai/gpt-5.4-nano`
  - `gemini/gemini-3.1-pro-preview`
  - `gemini/gemini-3.1-flash-lite-preview`

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `kimi/kimi-k2.6` | 98.09 | 1.91% | 0.82% | 2357 | 93.78s | 1.8017¢ ($0.0180) |
| 2 | `glm/glm-ocr` | 79.56 | 20.44% | 15.63% | 2341 | 10.78s | 0.0350¢ ($0.0004) |
| 3 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 72.29 | 27.71% | 24.85% | 1775 | 47.60s | 0.4965¢ ($0.0050) |
| 4 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 58.37 | 41.63% | 34.45% | 1685 | 139.76s | 0.3396¢ ($0.0034) |
| 5 | `openai/gpt-5.4` | 49.31 | 50.69% | 36.66% | 2022 | 64.08s | 4.8837¢ ($0.0488) |
| 6 | `mistral/mistral-ocr-2512` | 48.86 | 51.14% | 36.64% | 2140 | 9.87s | 0.2000¢ ($0.0020) |
| 7 | `anthropic/claude-haiku-4-5` | 18.53 | 81.47% | 62.62% | 2077 | 44.33s | 1.9254¢ ($0.0193) |
| 8 | `deepinfra/PaddlePaddle/PaddleOCR-VL-0.9B` | 13.46 | 86.54% | 68.33% | 1312 | 331.56s | 0.1832¢ ($0.0018) |
| 9 | `gcloud-docai/ocr` | 6.52 | 93.48% | 68.48% | 2496 | 36.22s | 0.1500¢ ($0.0015) |
| 10 | `aws-textract/analyze-document` | 5.36 | 94.64% | 71.76% | 2329 | 14.11s | 6.5000¢ ($0.0650) |
| 11 | `aws-textract/detect-text` | 5.36 | 94.64% | 71.76% | 2329 | 14.34s | 0.1500¢ ($0.0015) |
| 12 | `openai/gpt-5.4-nano` | 4.74 | 95.26% | 92.03% | 199 | 8.51s | 0.0931¢ ($0.0009) |
| 13 | `gemini/gemini-3.1-pro-preview` | 4.65 | 95.35% | 82.98% | 609 | 12.37s | 1.3856¢ ($0.0139) |
| 14 | `gemini/gemini-3.1-flash-lite-preview` | 3.91 | 96.09% | 74.78% | 2022 | 9.68s | 0.3270¢ ($0.0033) |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| `ocrmypdf/ocrmypdf` | 1811 | 184 | 73 | 2407 |
| `paddle-ocr/paddle-ocr` | 461 | 1821 | 10 | 2407 |
| `tesseract/tesseract` | 461 | 1821 | 10 | 2407 |
| `kimi/kimi-k2.6` | 30 | 7 | 9 | 2407 |
| `glm/glm-ocr` | 110 | 199 | 183 | 2407 |
| `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 57 | 599 | 11 | 2407 |
| `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 262 | 708 | 32 | 2407 |
| `openai/gpt-5.4` | 797 | 389 | 34 | 2407 |
| `mistral/mistral-ocr-2512` | 638 | 412 | 181 | 2407 |
| `anthropic/claude-haiku-4-5` | 1504 | 368 | 89 | 2407 |
| `deepinfra/PaddlePaddle/PaddleOCR-VL-0.9B` | 973 | 1077 | 33 | 2407 |
| `gcloud-docai/ocr` | 1880 | 102 | 268 | 2407 |
| `aws-textract/analyze-document` | 2147 | 86 | 45 | 2407 |
| `aws-textract/detect-text` | 2147 | 86 | 45 | 2407 |
| `openai/gpt-5.4-nano` | 92 | 2191 | 10 | 2407 |
| `gemini/gemini-3.1-pro-preview` | 534 | 1758 | 3 | 2407 |
| `gemini/gemini-3.1-flash-lite-preview` | 1851 | 462 | 0 | 2407 |

## Notes

- Best overall provider: `glm/glm-ocr` scored 88.83/100 using balanced overall weighting.
- Worst overall provider: `aws-textract/analyze-document` scored 26.62/100 using balanced overall weighting.
- Best local model: `ocrmypdf/ocrmypdf` scored 14.08/100.
- Best cloud service: `kimi/kimi-k2.6` scored 98.09/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0350¢ ($0.0004).
- Fastest local model: `paddle-ocr/paddle-ocr` at 0.00s.
- Fastest cloud service: `openai/gpt-5.4-nano` at 8.51s.
