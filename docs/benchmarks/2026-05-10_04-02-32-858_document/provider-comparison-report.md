# OCR Provider Comparison Report

## Summary

- Consensus extraction: `consensus-extraction.txt` (6015 characters, 1115 words)
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
| 1 | `gemini/gemini-3.1-flash-lite-preview` | cloud | 93.00 | 91.75 | 95.48 | 93.03 |
| 2 | `mistral/mistral-ocr-2512` | cloud | 92.16 | 94.17 | 99.77 | 80.53 |
| 3 | `tesseract/tesseract` | local | 88.30 | 76.59 | 100.00 | 100.00 |
| 4 | `ocrmypdf/ocrmypdf` | local | 86.83 | 74.89 | 97.54 | 100.00 |
| 5 | `glm/glm-ocr` | cloud | 85.98 | 79.55 | 85.50 | 99.33 |
| 6 | `aws-textract/detect-text` | cloud | 84.90 | 80.63 | 92.94 | 85.40 |
| 7 | `openai/gpt-5.4-nano` | cloud | 78.61 | 71.57 | 78.79 | 92.53 |
| 8 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | cloud | 77.33 | 92.11 | 35.34 | 89.77 |
| 9 | `gcloud-docai/ocr` | cloud | 73.40 | 77.94 | 52.32 | 85.40 |
| 10 | `anthropic/claude-haiku-4-5` | cloud | 71.65 | 90.22 | 42.86 | 63.30 |
| 11 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | cloud | 65.63 | 82.96 | 10.91 | 85.69 |
| 12 | `openai/gpt-5.4` | cloud | 61.44 | 89.51 | 66.73 | 0.00 |
| 13 | `kimi/kimi-k2.6` | cloud | 61.18 | 90.94 | 17.03 | 45.81 |
| 14 | `gemini/gemini-3.1-pro-preview` | cloud | 61.07 | 96.59 | 8.48 | 42.61 |
| 15 | `paddle-ocr/paddle-ocr` | local | 60.38 | 70.76 | 0.00 | 100.00 |

## Ranking

### Local Models (3)

  - `tesseract/tesseract`
  - `ocrmypdf/ocrmypdf`
  - `paddle-ocr/paddle-ocr`

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `tesseract/tesseract` | 76.59 | 23.41% | 6.66% | 1081 | 6.17s |
| 2 | `ocrmypdf/ocrmypdf` | 74.89 | 25.11% | 7.44% | 1082 | 7.65s |
| 3 | `paddle-ocr/paddle-ocr` | 70.76 | 29.24% | 8.25% | 980 | 66.35s |
### Cloud Services (12)

  - `gemini/gemini-3.1-pro-preview`
  - `mistral/mistral-ocr-2512`
  - `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct`
  - `gemini/gemini-3.1-flash-lite-preview`
  - `kimi/kimi-k2.6`
  - `anthropic/claude-haiku-4-5`
  - `openai/gpt-5.4`
  - `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct`
  - `aws-textract/detect-text`
  - `glm/glm-ocr`
  - `gcloud-docai/ocr`
  - `openai/gpt-5.4-nano`

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `gemini/gemini-3.1-pro-preview` | 96.59 | 3.41% | 0.97% | 1105 | 61.25s | 2.9472¢ ($0.0295) |
| 2 | `mistral/mistral-ocr-2512` | 94.17 | 5.83% | 2.30% | 1087 | 6.31s | 1.0000¢ ($0.0100) |
| 3 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 92.11 | 7.89% | 3.65% | 1060 | 45.08s | 0.5253¢ ($0.0053) |
| 4 | `gemini/gemini-3.1-flash-lite-preview` | 91.75 | 8.25% | 1.85% | 1142 | 8.89s | 0.3578¢ ($0.0036) |
| 5 | `kimi/kimi-k2.6` | 90.94 | 9.06% | 2.39% | 1080 | 56.10s | 2.7828¢ ($0.0278) |
| 6 | `anthropic/claude-haiku-4-5` | 90.22 | 9.78% | 4.83% | 1051 | 40.56s | 1.8845¢ ($0.0188) |
| 7 | `openai/gpt-5.4` | 89.51 | 10.49% | 7.28% | 1036 | 26.19s | 5.1355¢ ($0.0514) |
| 8 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 82.96 | 17.04% | 4.57% | 1109 | 59.78s | 0.7348¢ ($0.0073) |
| 9 | `aws-textract/detect-text` | 80.63 | 19.37% | 4.86% | 1081 | 10.42s | 0.7500¢ ($0.0075) |
| 10 | `glm/glm-ocr` | 79.55 | 20.45% | 15.29% | 931 | 14.89s | 0.0345¢ ($0.0003) |
| 11 | `gcloud-docai/ocr` | 77.94 | 22.06% | 5.52% | 1086 | 34.86s | 0.7500¢ ($0.0075) |
| 12 | `openai/gpt-5.4-nano` | 71.57 | 28.43% | 22.53% | 855 | 18.94s | 0.3839¢ ($0.0038) |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| `tesseract/tesseract` | 219 | 19 | 23 | 1115 |
| `ocrmypdf/ocrmypdf` | 228 | 24 | 28 | 1115 |
| `paddle-ocr/paddle-ocr` | 248 | 67 | 11 | 1115 |
| `gemini/gemini-3.1-pro-preview` | 7 | 0 | 31 | 1115 |
| `mistral/mistral-ocr-2512` | 20 | 18 | 27 | 1115 |
| `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 34 | 41 | 13 | 1115 |
| `gemini/gemini-3.1-flash-lite-preview` | 26 | 3 | 63 | 1115 |
| `kimi/kimi-k2.6` | 86 | 5 | 10 | 1115 |
| `anthropic/claude-haiku-4-5` | 55 | 45 | 9 | 1115 |
| `openai/gpt-5.4` | 17 | 68 | 32 | 1115 |
| `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 137 | 14 | 39 | 1115 |
| `aws-textract/detect-text` | 194 | 6 | 16 | 1115 |
| `glm/glm-ocr` | 66 | 152 | 10 | 1115 |
| `gcloud-docai/ocr` | 169 | 19 | 58 | 1115 |
| `openai/gpt-5.4-nano` | 68 | 236 | 13 | 1115 |

## Notes

- Best overall provider: `gemini/gemini-3.1-flash-lite-preview` scored 93.00/100 using balanced overall weighting.
- Worst overall provider: `paddle-ocr/paddle-ocr` scored 60.38/100 using balanced overall weighting.
- Best local model: `tesseract/tesseract` scored 76.59/100.
- Best cloud service: `gemini/gemini-3.1-pro-preview` scored 96.59/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0345¢ ($0.0003).
- Fastest local model: `tesseract/tesseract` at 6.17s.
- Fastest cloud service: `mistral/mistral-ocr-2512` at 6.31s.
