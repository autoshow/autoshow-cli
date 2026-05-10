# OCR Provider Comparison Report

## Summary

- Consensus extraction: `consensus-extraction.txt` (6989 characters, 1337 words)
- Total providers: 20 (3 local, 17 cloud)
- Ranking metric: word error rate (WER) against consensus extraction
- Score formula: `max(0, 100 * (1 - WER))`
- WER formula: `(Substitutions + Deletions + Insertions) / Reference Word Count`

## Method

- The consolidated extraction in `consensus-extraction.txt` was treated as the gold reference.
- Text normalization applied before comparison: lowercasing, curly quote/dash normalization, contraction expansion (it's -> it is), abbreviation expansion (mr. -> mister), currency symbol conversion ($50 -> 50 dollars), and remaining punctuation stripping.
- WER compares the provider's full word stream against the gold extraction word stream.
- CER compares normalized character sequences for finer-grained accuracy.
- Providers are separated into local models and cloud services for independent comparison.

## Ranking

### Local Models (3)

  - `tesseract/tesseract`
  - `ocrmypdf/ocrmypdf`
  - `paddle-ocr/paddle-ocr`

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `tesseract/tesseract` | 95.89 | 4.11% | 2.14% | 1352 | 6.49s |
| 2 | `ocrmypdf/ocrmypdf` | 95.74 | 4.26% | 2.15% | 1350 | 7.92s |
| 3 | `paddle-ocr/paddle-ocr` | 91.55 | 8.45% | 2.21% | 1215 | 63.60s |
### Cloud Services (17)

  - `gemini/gemini-3.1-pro-preview`
  - `mistral/mistral-ocr-2512`
  - `anthropic/claude-opus-4-7`
  - `gemini/gemini-3.1-flash-lite-preview`
  - `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct`
  - `glm/glm-ocr`
  - `kimi/kimi-k2.6`
  - `anthropic/claude-haiku-4-5`
  - `gcloud-docai/ocr`
  - `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct`
  - `aws-textract/analyze-document`
  - `aws-textract/detect-text`
  - `openai/gpt-5.4`
  - `deepinfra/PaddlePaddle/PaddleOCR-VL-0.9B`
  - `openai/gpt-5.4-mini`
  - `openai/gpt-5.4-nano`
  - `gcloud-docai/layout-parser`

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `gemini/gemini-3.1-pro-preview` | 99.40 | 0.60% | 0.41% | 1339 | 72.71s | 2.5862¢ ($0.0259) |
| 2 | `mistral/mistral-ocr-2512` | 99.25 | 0.75% | 0.55% | 1338 | 6.54s | 0.8000¢ ($0.0080) |
| 3 | `anthropic/claude-opus-4-7` | 99.18 | 0.82% | 0.69% | 1337 | 71.58s | 9.3145¢ ($0.0931) |
| 4 | `gemini/gemini-3.1-flash-lite-preview` | 98.80 | 1.20% | 1.03% | 1327 | 10.23s | 0.3135¢ ($0.0031) |
| 5 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 98.43 | 1.57% | 0.80% | 1340 | 34.96s | 0.8048¢ ($0.0080) |
| 6 | `glm/glm-ocr` | 98.43 | 1.57% | 1.51% | 1313 | 19.88s | 0.0340¢ ($0.0003) |
| 7 | `kimi/kimi-k2.6` | 97.61 | 2.39% | 0.96% | 1349 | 47.76s | 2.3732¢ ($0.0237) |
| 8 | `anthropic/claude-haiku-4-5` | 97.61 | 2.39% | 1.03% | 1328 | 35.69s | 1.6120¢ ($0.0161) |
| 9 | `gcloud-docai/ocr` | 97.53 | 2.47% | 0.87% | 1349 | 31.34s | 0.6000¢ ($0.0060) |
| 10 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 97.53 | 2.47% | 0.96% | 1343 | 44.42s | 0.5920¢ ($0.0059) |
| 11 | `aws-textract/analyze-document` | 97.46 | 2.54% | 0.84% | 1351 | 17.40s | 26.0000¢ ($0.2600) |
| 12 | `aws-textract/detect-text` | 97.46 | 2.54% | 0.84% | 1351 | 11.20s | 0.6000¢ ($0.0060) |
| 13 | `openai/gpt-5.4` | 97.46 | 2.54% | 1.15% | 1333 | 32.58s | 5.8255¢ ($0.0583) |
| 14 | `deepinfra/PaddlePaddle/PaddleOCR-VL-0.9B` | 97.01 | 2.99% | 1.31% | 1358 | 47.46s | 0.1811¢ ($0.0018) |
| 15 | `openai/gpt-5.4-mini` | 96.86 | 3.14% | 1.56% | 1331 | 135.34s | 1.7611¢ ($0.0176) |
| 16 | `openai/gpt-5.4-nano` | 58.56 | 41.44% | 39.20% | 825 | 32.69s | 0.3908¢ ($0.0039) |
| 17 | `gcloud-docai/layout-parser` | 0.00 | 100.00% | 100.00% | 0 | 26.85s | 0.0000¢ ($0.0000) |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| `tesseract/tesseract` | 19 | 12 | 24 | 1337 |
| `ocrmypdf/ocrmypdf` | 22 | 13 | 22 | 1337 |
| `paddle-ocr/paddle-ocr` | 54 | 45 | 14 | 1337 |
| `gemini/gemini-3.1-pro-preview` | 0 | 0 | 8 | 1337 |
| `mistral/mistral-ocr-2512` | 2 | 0 | 8 | 1337 |
| `anthropic/claude-opus-4-7` | 2 | 1 | 8 | 1337 |
| `gemini/gemini-3.1-flash-lite-preview` | 4 | 8 | 4 | 1337 |
| `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 5 | 3 | 13 | 1337 |
| `glm/glm-ocr` | 3 | 17 | 1 | 1337 |
| `kimi/kimi-k2.6` | 14 | 4 | 14 | 1337 |
| `anthropic/claude-haiku-4-5` | 13 | 6 | 13 | 1337 |
| `gcloud-docai/ocr` | 12 | 2 | 19 | 1337 |
| `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 12 | 5 | 16 | 1337 |
| `aws-textract/analyze-document` | 15 | 1 | 18 | 1337 |
| `aws-textract/detect-text` | 15 | 1 | 18 | 1337 |
| `openai/gpt-5.4` | 13 | 8 | 13 | 1337 |
| `deepinfra/PaddlePaddle/PaddleOCR-VL-0.9B` | 17 | 1 | 22 | 1337 |
| `openai/gpt-5.4-mini` | 16 | 12 | 14 | 1337 |
| `openai/gpt-5.4-nano` | 25 | 521 | 8 | 1337 |
| `gcloud-docai/layout-parser` | 0 | 1337 | 0 | 1337 |

## Notes

- Best local model: `tesseract/tesseract` scored 95.89/100.
- Best cloud service: `gemini/gemini-3.1-pro-preview` scored 99.40/100.
- The cheapest cloud provider was `gcloud-docai/layout-parser` at 0.0000¢ ($0.0000).
- Fastest local model: `tesseract/tesseract` at 6.49s.
- Fastest cloud service: `mistral/mistral-ocr-2512` at 6.54s.
