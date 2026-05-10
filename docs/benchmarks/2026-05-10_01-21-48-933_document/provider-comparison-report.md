# OCR Provider Comparison Report

## Summary

- Consensus extraction: `consensus-extraction.txt` (6005 characters, 1115 words)
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
| 1 | `mistral/mistral-ocr-2512` | cloud | 96.59 | 94.71 | 100.00 | 96.92 |
| 2 | `gemini/gemini-3.1-flash-lite-preview` | cloud | 94.56 | 91.48 | 96.40 | 98.90 |
| 3 | `tesseract/tesseract` | local | 87.94 | 76.77 | 98.22 | 100.00 |
| 4 | `aws-textract/detect-text` | cloud | 87.44 | 80.09 | 91.88 | 97.69 |
| 5 | `glm/glm-ocr` | cloud | 87.09 | 79.73 | 89.00 | 99.89 |
| 6 | `ocrmypdf/ocrmypdf` | local | 86.64 | 75.07 | 96.41 | 100.00 |
| 7 | `anthropic/claude-haiku-4-5` | cloud | 85.98 | 96.59 | 56.66 | 94.09 |
| 8 | `openai/gpt-5.4` | cloud | 84.62 | 89.60 | 75.07 | 84.20 |
| 9 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | cloud | 84.23 | 91.75 | 55.03 | 98.38 |
| 10 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | cloud | 82.87 | 86.91 | 59.94 | 97.74 |
| 11 | `kimi/kimi-k2.6` | cloud | 77.34 | 90.85 | 36.24 | 91.44 |
| 12 | `openai/gpt-5.4-nano` | cloud | 76.57 | 61.88 | 83.63 | 98.90 |
| 13 | `gcloud-docai/ocr` | cloud | 76.15 | 77.67 | 51.56 | 97.69 |
| 14 | `deepinfra/PaddlePaddle/PaddleOCR-VL-0.9B` | cloud | 72.16 | 94.62 | 0.00 | 99.41 |
| 15 | `paddle-ocr/paddle-ocr` | local | 64.38 | 70.31 | 16.90 | 100.00 |
| 16 | `gemini/gemini-3.1-pro-preview` | cloud | 63.94 | 77.58 | 10.25 | 90.37 |
| 17 | `aws-textract/analyze-document` | cloud | 63.35 | 80.09 | 93.21 | 0.00 |

## Ranking

### Local Models (3)

  - `tesseract/tesseract`
  - `ocrmypdf/ocrmypdf`
  - `paddle-ocr/paddle-ocr`

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `tesseract/tesseract` | 76.77 | 23.23% | 6.53% | 1081 | 6.25s |
| 2 | `ocrmypdf/ocrmypdf` | 75.07 | 24.93% | 7.28% | 1082 | 7.69s |
| 3 | `paddle-ocr/paddle-ocr` | 70.31 | 29.69% | 8.35% | 980 | 70.92s |
### Cloud Services (14)

  - `anthropic/claude-haiku-4-5`
  - `mistral/mistral-ocr-2512`
  - `deepinfra/PaddlePaddle/PaddleOCR-VL-0.9B`
  - `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct`
  - `gemini/gemini-3.1-flash-lite-preview`
  - `kimi/kimi-k2.6`
  - `openai/gpt-5.4`
  - `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct`
  - `aws-textract/analyze-document`
  - `aws-textract/detect-text`
  - `glm/glm-ocr`
  - `gcloud-docai/ocr`
  - `gemini/gemini-3.1-pro-preview`
  - `openai/gpt-5.4-nano`

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `anthropic/claude-haiku-4-5` | 96.59 | 3.41% | 1.21% | 1077 | 39.30s | 1.9205¢ ($0.0192) |
| 2 | `mistral/mistral-ocr-2512` | 94.71 | 5.29% | 2.08% | 1087 | 4.83s | 1.0000¢ ($0.0100) |
| 3 | `deepinfra/PaddlePaddle/PaddleOCR-VL-0.9B` | 94.62 | 5.38% | 2.03% | 1108 | 84.35s | 0.1913¢ ($0.0019) |
| 4 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 91.75 | 8.25% | 3.50% | 1057 | 40.60s | 0.5251¢ ($0.0053) |
| 5 | `gemini/gemini-3.1-flash-lite-preview` | 91.48 | 8.52% | 1.98% | 1142 | 7.70s | 0.3585¢ ($0.0036) |
| 6 | `kimi/kimi-k2.6` | 90.85 | 9.15% | 2.20% | 1080 | 55.54s | 2.7832¢ ($0.0278) |
| 7 | `openai/gpt-5.4` | 89.60 | 10.40% | 7.14% | 1036 | 24.65s | 5.1340¢ ($0.0513) |
| 8 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 86.91 | 13.09% | 3.34% | 1084 | 36.69s | 0.7347¢ ($0.0073) |
| 9 | `aws-textract/analyze-document` | 80.09 | 19.91% | 5.04% | 1081 | 10.23s | 32.5000¢ ($0.3250) |
| 10 | `aws-textract/detect-text` | 80.09 | 19.91% | 5.04% | 1081 | 11.29s | 0.7500¢ ($0.0075) |
| 11 | `glm/glm-ocr` | 79.73 | 20.27% | 15.40% | 931 | 13.58s | 0.0345¢ ($0.0003) |
| 12 | `gcloud-docai/ocr` | 77.67 | 22.33% | 5.51% | 1086 | 43.35s | 0.7500¢ ($0.0075) |
| 13 | `gemini/gemini-3.1-pro-preview` | 77.58 | 22.42% | 4.85% | 1144 | 76.20s | 3.1308¢ ($0.0313) |
| 14 | `openai/gpt-5.4-nano` | 61.88 | 38.12% | 34.58% | 732 | 17.85s | 0.3575¢ ($0.0036) |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| `tesseract/tesseract` | 219 | 18 | 22 | 1115 |
| `ocrmypdf/ocrmypdf` | 228 | 23 | 27 | 1115 |
| `paddle-ocr/paddle-ocr` | 249 | 69 | 13 | 1115 |
| `anthropic/claude-haiku-4-5` | 21 | 6 | 11 | 1115 |
| `mistral/mistral-ocr-2512` | 20 | 15 | 24 | 1115 |
| `deepinfra/PaddlePaddle/PaddleOCR-VL-0.9B` | 21 | 12 | 27 | 1115 |
| `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 39 | 43 | 10 | 1115 |
| `gemini/gemini-3.1-flash-lite-preview` | 27 | 4 | 64 | 1115 |
| `kimi/kimi-k2.6` | 88 | 4 | 10 | 1115 |
| `openai/gpt-5.4` | 19 | 67 | 30 | 1115 |
| `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 133 | 3 | 10 | 1115 |
| `aws-textract/analyze-document` | 196 | 8 | 18 | 1115 |
| `aws-textract/detect-text` | 196 | 8 | 18 | 1115 |
| `glm/glm-ocr` | 66 | 151 | 9 | 1115 |
| `gcloud-docai/ocr` | 172 | 19 | 58 | 1115 |
| `gemini/gemini-3.1-pro-preview` | 193 | 2 | 55 | 1115 |
| `openai/gpt-5.4-nano` | 60 | 357 | 8 | 1115 |

## Notes

- Best overall provider: `mistral/mistral-ocr-2512` scored 96.59/100 using balanced overall weighting.
- Worst overall provider: `aws-textract/analyze-document` scored 63.35/100 using balanced overall weighting.
- Best local model: `tesseract/tesseract` scored 76.77/100.
- Best cloud service: `anthropic/claude-haiku-4-5` scored 96.59/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0345¢ ($0.0003).
- Fastest local model: `tesseract/tesseract` at 6.25s.
- Fastest cloud service: `mistral/mistral-ocr-2512` at 4.83s.
