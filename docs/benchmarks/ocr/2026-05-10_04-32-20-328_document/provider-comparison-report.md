# OCR Provider Comparison Report

## Summary

- Consensus extraction: `consensus-extraction.txt` (5955 characters, 1092 words)
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
- Tier breakdown assigns local and third-party providers independently using balanced overall group rank.

## Overall Ranking

| Rank | Provider | Group | Group Rank | Group Tier | Overall / 100 | Accuracy | Speed | Cost |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `gemini/gemini-3.1-flash-lite-preview` | cloud | 1 | 1 | 96.15 | 98.08 | 95.07 | 93.36 |
| 2 | `mistral/mistral-ocr-2512` | cloud | 2 | 1 | 92.80 | 95.33 | 100.00 | 80.53 |
| 3 | `tesseract/tesseract` | local | 1 | 1 | 87.78 | 76.47 | 98.18 | 100.00 |
| 4 | `ocrmypdf/ocrmypdf` | local | 2 | 2 | 86.93 | 75.73 | 96.24 | 100.00 |
| 5 | `glm/glm-ocr` | cloud | 3 | 1 | 85.68 | 80.95 | 81.50 | 99.33 |
| 6 | `aws-textract/detect-text` | cloud | 4 | 1 | 83.89 | 78.48 | 93.21 | 85.40 |
| 7 | `openai/gpt-5.4-nano` | cloud | 5 | 2 | 81.12 | 76.47 | 79.37 | 92.19 |
| 8 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | cloud | 6 | 2 | 80.89 | 92.86 | 48.08 | 89.76 |
| 9 | `gcloud-docai/ocr` | cloud | 7 | 2 | 76.08 | 77.75 | 63.41 | 85.40 |
| 10 | `anthropic/claude-haiku-4-5` | cloud | 8 | 2 | 75.35 | 91.48 | 55.07 | 63.36 |
| 11 | `kimi/kimi-k2.6` | cloud | 9 | 3 | 67.44 | 89.01 | 45.92 | 45.82 |
| 12 | `openai/gpt-5.4` | cloud | 10 | 3 | 66.64 | 96.34 | 73.88 | 0.00 |
| 13 | `paddle-ocr/paddle-ocr` | local | 3 | 3 | 66.05 | 69.69 | 24.84 | 100.00 |
| 14 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | cloud | 11 | 3 | 64.84 | 86.81 | 0.00 | 85.73 |
| 15 | `gemini/gemini-3.1-pro-preview` | cloud | 12 | 3 | 56.69 | 91.30 | 1.79 | 42.35 |

## Tier Breakdown

Tiers split local and third-party balanced overall rankings separately. When a group count is not divisible by three, the remainder is assigned to Tier 3 for that group.

### Local Group (3)

#### Tier 1 (group rank 1)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 3 | `tesseract/tesseract` | 87.78 | 76.47 | 98.18 | 100.00 |

#### Tier 2 (group rank 2)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 2 | 4 | `ocrmypdf/ocrmypdf` | 86.93 | 75.73 | 96.24 | 100.00 |

#### Tier 3 (group rank 3)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 3 | 13 | `paddle-ocr/paddle-ocr` | 66.05 | 69.69 | 24.84 | 100.00 |


### Third-Party Group (12)

#### Tier 1 (group ranks 1-4)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 1 | `gemini/gemini-3.1-flash-lite-preview` | 96.15 | 98.08 | 95.07 | 93.36 |
| 2 | 2 | `mistral/mistral-ocr-2512` | 92.80 | 95.33 | 100.00 | 80.53 |
| 3 | 5 | `glm/glm-ocr` | 85.68 | 80.95 | 81.50 | 99.33 |
| 4 | 6 | `aws-textract/detect-text` | 83.89 | 78.48 | 93.21 | 85.40 |

#### Tier 2 (group ranks 5-8)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 5 | 7 | `openai/gpt-5.4-nano` | 81.12 | 76.47 | 79.37 | 92.19 |
| 6 | 8 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 80.89 | 92.86 | 48.08 | 89.76 |
| 7 | 9 | `gcloud-docai/ocr` | 76.08 | 77.75 | 63.41 | 85.40 |
| 8 | 10 | `anthropic/claude-haiku-4-5` | 75.35 | 91.48 | 55.07 | 63.36 |

#### Tier 3 (group ranks 9-12)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 9 | 11 | `kimi/kimi-k2.6` | 67.44 | 89.01 | 45.92 | 45.82 |
| 10 | 12 | `openai/gpt-5.4` | 66.64 | 96.34 | 73.88 | 0.00 |
| 11 | 14 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 64.84 | 86.81 | 0.00 | 85.73 |
| 12 | 15 | `gemini/gemini-3.1-pro-preview` | 56.69 | 91.30 | 1.79 | 42.35 |


## Ranking

### Local Models (3)

  - `tesseract/tesseract`
  - `ocrmypdf/ocrmypdf`
  - `paddle-ocr/paddle-ocr`

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `tesseract/tesseract` | 76.47 | 23.53% | 6.61% | 1081 | 6.53s |
| 2 | `ocrmypdf/ocrmypdf` | 75.73 | 24.27% | 6.89% | 1082 | 7.96s |
| 3 | `paddle-ocr/paddle-ocr` | 69.69 | 30.31% | 8.81% | 980 | 60.47s |
### Cloud Services (12)

  - `gemini/gemini-3.1-flash-lite-preview`
  - `openai/gpt-5.4`
  - `mistral/mistral-ocr-2512`
  - `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct`
  - `anthropic/claude-haiku-4-5`
  - `gemini/gemini-3.1-pro-preview`
  - `kimi/kimi-k2.6`
  - `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct`
  - `glm/glm-ocr`
  - `aws-textract/detect-text`
  - `gcloud-docai/ocr`
  - `openai/gpt-5.4-nano`

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `gemini/gemini-3.1-flash-lite-preview` | 98.08 | 1.92% | 0.89% | 1062 | 8.82s | 0.3409¢ ($0.0034) |
| 2 | `openai/gpt-5.4` | 96.34 | 3.66% | 1.84% | 1036 | 24.41s | 5.1355¢ ($0.0514) |
| 3 | `mistral/mistral-ocr-2512` | 95.33 | 4.67% | 1.80% | 1087 | 5.20s | 1.0000¢ ($0.0100) |
| 4 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 92.86 | 7.14% | 3.15% | 1065 | 43.38s | 0.5261¢ ($0.0053) |
| 5 | `anthropic/claude-haiku-4-5` | 91.48 | 8.52% | 3.76% | 1043 | 38.23s | 1.8815¢ ($0.0188) |
| 6 | `gemini/gemini-3.1-pro-preview` | 91.30 | 8.70% | 2.66% | 1134 | 77.42s | 2.9604¢ ($0.0296) |
| 7 | `kimi/kimi-k2.6` | 89.01 | 10.99% | 3.27% | 1080 | 44.97s | 2.7824¢ ($0.0278) |
| 8 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 86.81 | 13.19% | 3.81% | 1096 | 78.73s | 0.7327¢ ($0.0073) |
| 9 | `glm/glm-ocr` | 80.95 | 19.05% | 14.60% | 931 | 18.80s | 0.0345¢ ($0.0003) |
| 10 | `aws-textract/detect-text` | 78.48 | 21.52% | 5.89% | 1081 | 10.19s | 0.7500¢ ($0.0075) |
| 11 | `gcloud-docai/ocr` | 77.75 | 22.25% | 5.21% | 1086 | 32.10s | 0.7500¢ ($0.0075) |
| 12 | `openai/gpt-5.4-nano` | 76.47 | 23.53% | 17.07% | 962 | 20.37s | 0.4011¢ ($0.0040) |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| `tesseract/tesseract` | 216 | 7 | 34 | 1092 |
| `ocrmypdf/ocrmypdf` | 224 | 7 | 34 | 1092 |
| `paddle-ocr/paddle-ocr` | 248 | 58 | 25 | 1092 |
| `gemini/gemini-3.1-flash-lite-preview` | 10 | 1 | 10 | 1092 |
| `openai/gpt-5.4` | 14 | 20 | 6 | 1092 |
| `mistral/mistral-ocr-2512` | 17 | 1 | 33 | 1092 |
| `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 35 | 23 | 20 | 1092 |
| `anthropic/claude-haiku-4-5` | 56 | 25 | 12 | 1092 |
| `gemini/gemini-3.1-pro-preview` | 17 | 0 | 78 | 1092 |
| `kimi/kimi-k2.6` | 91 | 0 | 29 | 1092 |
| `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 100 | 1 | 43 | 1092 |
| `glm/glm-ocr` | 63 | 132 | 13 | 1092 |
| `aws-textract/detect-text` | 194 | 4 | 37 | 1092 |
| `gcloud-docai/ocr` | 169 | 6 | 68 | 1092 |
| `openai/gpt-5.4-nano` | 84 | 128 | 45 | 1092 |

## Notes

- Best overall provider: `gemini/gemini-3.1-flash-lite-preview` scored 96.15/100 using balanced overall weighting.
- Worst overall provider: `gemini/gemini-3.1-pro-preview` scored 56.69/100 using balanced overall weighting.
- Best local model: `tesseract/tesseract` scored 76.47/100.
- Best cloud service: `gemini/gemini-3.1-flash-lite-preview` scored 98.08/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0345¢ ($0.0003).
- Fastest local model: `tesseract/tesseract` at 6.53s.
- Fastest cloud service: `mistral/mistral-ocr-2512` at 5.20s.
