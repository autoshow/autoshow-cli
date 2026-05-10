# OCR Provider Comparison Report

## Summary

- Consensus extraction: `consensus-extraction.txt` (12655 characters, 2361 words)
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
| 1 | `glm/glm-ocr` | cloud | 88.36 | 82.76 | 88.82 | 99.10 |
| 2 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | cloud | 65.50 | 64.46 | 41.80 | 91.26 |
| 3 | `kimi/kimi-k2.6` | cloud | 63.86 | 94.11 | 13.45 | 53.74 |
| 4 | `mistral/mistral-ocr-2512` | cloud | 56.61 | 24.44 | 82.70 | 94.86 |
| 5 | `paddle-ocr/paddle-ocr` | local | 52.39 | 4.79 | 100.00 | 100.00 |
| 6 | `tesseract/tesseract` | local | 52.39 | 4.79 | 99.97 | 100.00 |
| 7 | `ocrmypdf/ocrmypdf` | local | 51.26 | 13.00 | 79.02 | 100.00 |
| 8 | `openai/gpt-5.4-nano` | cloud | 50.05 | 8.01 | 88.30 | 95.89 |
| 9 | `gemini/gemini-3.1-pro-preview` | cloud | 48.96 | 97.92 | 0.00 | 0.00 |
| 10 | `gemini/gemini-3.1-flash-lite-preview` | cloud | 47.48 | 3.68 | 90.99 | 91.55 |
| 11 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | cloud | 46.91 | 30.92 | 39.50 | 86.29 |
| 12 | `aws-textract/detect-text` | cloud | 46.21 | 4.53 | 79.65 | 96.15 |
| 13 | `gcloud-docai/ocr` | cloud | 43.06 | 5.51 | 65.08 | 96.15 |
| 14 | `openai/gpt-5.4` | cloud | 36.29 | 2.29 | 79.07 | 61.53 |
| 15 | `anthropic/claude-haiku-4-5` | cloud | 33.82 | 20.16 | 40.56 | 54.40 |

## Ranking

### Local Models (3)

  - `ocrmypdf/ocrmypdf`
  - `paddle-ocr/paddle-ocr`
  - `tesseract/tesseract`

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `ocrmypdf/ocrmypdf` | 13.00 | 87.00% | 62.94% | 2287 | 18.57s |
| 2 | `paddle-ocr/paddle-ocr` | 4.79 | 95.21% | 83.17% | 549 | 0.00s |
| 3 | `tesseract/tesseract` | 4.79 | 95.21% | 83.17% | 549 | 0.03s |
### Cloud Services (12)

  - `gemini/gemini-3.1-pro-preview`
  - `kimi/kimi-k2.6`
  - `glm/glm-ocr`
  - `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct`
  - `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct`
  - `mistral/mistral-ocr-2512`
  - `anthropic/claude-haiku-4-5`
  - `openai/gpt-5.4-nano`
  - `gcloud-docai/ocr`
  - `aws-textract/detect-text`
  - `gemini/gemini-3.1-flash-lite-preview`
  - `openai/gpt-5.4`

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `gemini/gemini-3.1-pro-preview` | 97.92 | 2.08% | 1.07% | 2307 | 88.49s | 3.8948¢ ($0.0389) |
| 2 | `kimi/kimi-k2.6` | 94.11 | 5.89% | 1.19% | 2355 | 76.58s | 1.8017¢ ($0.0180) |
| 3 | `glm/glm-ocr` | 82.76 | 17.24% | 15.32% | 2341 | 9.89s | 0.0350¢ ($0.0003) |
| 4 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 64.46 | 35.54% | 30.65% | 1737 | 51.50s | 0.3404¢ ($0.0034) |
| 5 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 30.92 | 69.08% | 57.45% | 2172 | 53.53s | 0.5341¢ ($0.0053) |
| 6 | `mistral/mistral-ocr-2512` | 24.44 | 75.56% | 56.73% | 2163 | 15.31s | 0.2000¢ ($0.0020) |
| 7 | `anthropic/claude-haiku-4-5` | 20.16 | 79.84% | 60.63% | 1815 | 52.60s | 1.7759¢ ($0.0178) |
| 8 | `openai/gpt-5.4-nano` | 8.01 | 91.99% | 84.01% | 520 | 10.35s | 0.1601¢ ($0.0016) |
| 9 | `gcloud-docai/ocr` | 5.51 | 94.49% | 68.73% | 2496 | 30.90s | 0.1500¢ ($0.0015) |
| 10 | `aws-textract/detect-text` | 4.53 | 95.47% | 71.96% | 2329 | 18.01s | 0.1500¢ ($0.0015) |
| 11 | `gemini/gemini-3.1-flash-lite-preview` | 3.68 | 96.32% | 74.75% | 2050 | 7.98s | 0.3292¢ ($0.0033) |
| 12 | `openai/gpt-5.4` | 2.29 | 97.71% | 97.02% | 65 | 18.52s | 1.4983¢ ($0.0150) |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| `ocrmypdf/ocrmypdf` | 1807 | 156 | 91 | 2361 |
| `paddle-ocr/paddle-ocr` | 461 | 1776 | 11 | 2361 |
| `tesseract/tesseract` | 461 | 1776 | 11 | 2361 |
| `gemini/gemini-3.1-pro-preview` | 37 | 6 | 6 | 2361 |
| `kimi/kimi-k2.6` | 77 | 7 | 55 | 2361 |
| `glm/glm-ocr` | 63 | 157 | 187 | 2361 |
| `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 195 | 611 | 33 | 2361 |
| `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 714 | 529 | 388 | 2361 |
| `mistral/mistral-ocr-2512` | 1567 | 197 | 20 | 2361 |
| `anthropic/claude-haiku-4-5` | 1381 | 499 | 5 | 2361 |
| `openai/gpt-5.4-nano` | 278 | 1849 | 45 | 2361 |
| `gcloud-docai/ocr` | 1855 | 82 | 294 | 2361 |
| `aws-textract/detect-text` | 2161 | 44 | 49 | 2361 |
| `gemini/gemini-3.1-flash-lite-preview` | 1879 | 395 | 0 | 2361 |
| `openai/gpt-5.4` | 9 | 2295 | 3 | 2361 |

## Notes

- Best overall provider: `glm/glm-ocr` scored 88.36/100 using balanced overall weighting.
- Worst overall provider: `anthropic/claude-haiku-4-5` scored 33.82/100 using balanced overall weighting.
- Best local model: `ocrmypdf/ocrmypdf` scored 13.00/100.
- Best cloud service: `gemini/gemini-3.1-pro-preview` scored 97.92/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0350¢ ($0.0003).
- Fastest local model: `paddle-ocr/paddle-ocr` at 0.00s.
- Fastest cloud service: `gemini/gemini-3.1-flash-lite-preview` at 7.98s.
