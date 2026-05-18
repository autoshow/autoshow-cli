# OCR Provider Comparison Report

## Summary

- Consensus extraction: `consensus-extraction.txt` (6968 characters, 1335 words)
- Compared providers:
  - `mistral/mistral-ocr-2512`
  - `gemini/gemini-3.1-flash-lite-preview`
  - `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct`
  - `glm/glm-ocr`
  - `gemini/gemini-3.1-pro-preview`
  - `anthropic/claude-haiku-4-5`
  - `gcloud-docai/ocr`
  - `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct`
  - `kimi/kimi-k2.6`
  - `aws-textract/detect-text`
  - `openai/gpt-5.4`
  - `tesseract/tesseract`
  - `ocrmypdf/ocrmypdf`
  - `paddle-ocr/paddle-ocr`
  - `openai/gpt-5.4-nano`
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
- Ranking uses exact unrounded WER, with CER included for context and tie-breaking.
- Overall ranking combines all providers using accuracy score, normalized processing speed, and normalized cost efficiency. Missing timing or missing cloud cost receives a neutral 50/100 component score.
- Tier breakdown assigns local and third-party providers independently using balanced overall group rank.

## Overall Ranking

| Rank | Provider | Tier Group | Group Rank | Group Tier | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `tesseract/tesseract` | local | 1 | 1 | 98.01 | 96.03 | 100.00 | 100.00 |
| 2 | `ocrmypdf/ocrmypdf` | local | 2 | 2 | 97.39 | 95.88 | 97.80 | 100.00 |
| 3 | `gemini/gemini-3.1-flash-lite-preview` | thirdParty | 1 | 1 | 96.08 | 98.95 | 91.74 | 94.67 |
| 4 | `mistral/mistral-ocr-2512` | thirdParty | 2 | 1 | 95.65 | 99.25 | 97.72 | 86.37 |
| 5 | `glm/glm-ocr` | thirdParty | 3 | 1 | 93.40 | 98.58 | 77.04 | 99.42 |
| 6 | `aws-textract/detect-text` | thirdParty | 4 | 1 | 93.06 | 97.53 | 87.40 | 89.78 |
| 7 | `anthropic/claude-haiku-4-5` | thirdParty | 5 | 2 | 80.30 | 97.75 | 53.17 | 72.54 |
| 8 | `gcloud-docai/ocr` | thirdParty | 6 | 2 | 80.24 | 97.68 | 35.84 | 89.78 |
| 9 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | thirdParty | 7 | 2 | 78.80 | 97.68 | 29.94 | 89.91 |
| 10 | `gemini/gemini-3.1-pro-preview` | thirdParty | 8 | 2 | 74.06 | 97.90 | 48.60 | 51.85 |
| 11 | `paddle-ocr/paddle-ocr` | local | 3 | 3 | 73.15 | 91.69 | 9.22 | 100.00 |
| 12 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | thirdParty | 9 | 3 | 70.94 | 98.73 | 0.00 | 86.29 |
| 13 | `kimi/kimi-k2.6` | thirdParty | 10 | 3 | 69.78 | 97.60 | 24.31 | 59.62 |
| 14 | `openai/gpt-5.4` | thirdParty | 11 | 3 | 65.44 | 97.53 | 66.70 | 0.00 |
| 15 | `openai/gpt-5.4-nano` | thirdParty | 12 | 3 | 64.35 | 38.73 | 85.76 | 94.19 |

## Tier Breakdown

Tiers split local and third-party balanced overall rankings separately. When a group count is not divisible by three, the remainder is assigned to Tier 3 for that group.

### Local Group (3)

#### Tier 1 (group rank 1)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 1 | `tesseract/tesseract` | 98.01 | 96.03 | 100.00 | 100.00 |

#### Tier 2 (group rank 2)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 2 | 2 | `ocrmypdf/ocrmypdf` | 97.39 | 95.88 | 97.80 | 100.00 |

#### Tier 3 (group rank 3)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 3 | 11 | `paddle-ocr/paddle-ocr` | 73.15 | 91.69 | 9.22 | 100.00 |


### Third-Party Group (12)

#### Tier 1 (group ranks 1-4)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 3 | `gemini/gemini-3.1-flash-lite-preview` | 96.08 | 98.95 | 91.74 | 94.67 |
| 2 | 4 | `mistral/mistral-ocr-2512` | 95.65 | 99.25 | 97.72 | 86.37 |
| 3 | 5 | `glm/glm-ocr` | 93.40 | 98.58 | 77.04 | 99.42 |
| 4 | 6 | `aws-textract/detect-text` | 93.06 | 97.53 | 87.40 | 89.78 |

#### Tier 2 (group ranks 5-8)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 5 | 7 | `anthropic/claude-haiku-4-5` | 80.30 | 97.75 | 53.17 | 72.54 |
| 6 | 8 | `gcloud-docai/ocr` | 80.24 | 97.68 | 35.84 | 89.78 |
| 7 | 9 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 78.80 | 97.68 | 29.94 | 89.91 |
| 8 | 10 | `gemini/gemini-3.1-pro-preview` | 74.06 | 97.90 | 48.60 | 51.85 |

#### Tier 3 (group ranks 9-12)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 9 | 12 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 70.94 | 98.73 | 0.00 | 86.29 |
| 10 | 13 | `kimi/kimi-k2.6` | 69.78 | 97.60 | 24.31 | 59.62 |
| 11 | 14 | `openai/gpt-5.4` | 65.44 | 97.53 | 66.70 | 0.00 |
| 12 | 15 | `openai/gpt-5.4-nano` | 64.35 | 38.73 | 85.76 | 94.19 |



## Ranking

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `mistral/mistral-ocr-2512` | 99.25 | 0.75% | 0.61% | 1338 | 7.99s | 0.8000¢ ($0.0080) |
| 2 | `gemini/gemini-3.1-flash-lite-preview` | 98.95 | 1.05% | 0.78% | 1327 | 11.76s | 0.3128¢ ($0.0031) |
| 3 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 98.73 | 1.27% | 0.50% | 1340 | 69.50s | 0.8048¢ ($0.0080) |
| 4 | `glm/glm-ocr` | 98.58 | 1.42% | 1.36% | 1313 | 21.01s | 0.0340¢ ($0.0003) |
| 5 | `gemini/gemini-3.1-pro-preview` | 97.90 | 2.10% | 0.56% | 1347 | 38.91s | 2.8262¢ ($0.0283) |
| 6 | `anthropic/claude-haiku-4-5` | 97.75 | 2.25% | 0.78% | 1328 | 36.03s | 1.6115¢ ($0.0161) |
| 7 | `gcloud-docai/ocr` | 97.68 | 2.32% | 0.59% | 1349 | 46.94s | 0.6000¢ ($0.0060) |
| 8 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 97.68 | 2.32% | 0.70% | 1343 | 50.66s | 0.5919¢ ($0.0059) |
| 9 | `kimi/kimi-k2.6` | 97.60 | 2.40% | 0.80% | 1342 | 54.20s | 2.3700¢ ($0.0237) |
| 10 | `aws-textract/detect-text` | 97.53 | 2.47% | 0.74% | 1351 | 14.48s | 0.6000¢ ($0.0060) |
| 11 | `openai/gpt-5.4` | 97.53 | 2.47% | 0.89% | 1344 | 27.52s | 5.8690¢ ($0.0587) |
| 12 | `tesseract/tesseract` | 96.03 | 3.97% | 1.89% | 1352 | 6.56s | 0.0000¢ ($0.0000) |
| 13 | `ocrmypdf/ocrmypdf` | 95.88 | 4.12% | 1.91% | 1350 | 7.94s | 0.0000¢ ($0.0000) |
| 14 | `paddle-ocr/paddle-ocr` | 91.69 | 8.31% | 1.94% | 1215 | 63.70s | 0.0000¢ ($0.0000) |
| 15 | `openai/gpt-5.4-nano` | 38.73 | 61.27% | 60.20% | 537 | 15.52s | 0.3407¢ ($0.0034) |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| `mistral/mistral-ocr-2512` | 0 | 0 | 10 | 1335 |
| `gemini/gemini-3.1-flash-lite-preview` | 4 | 6 | 4 | 1335 |
| `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 4 | 1 | 12 | 1335 |
| `glm/glm-ocr` | 3 | 15 | 1 | 1335 |
| `gemini/gemini-3.1-pro-preview` | 10 | 0 | 18 | 1335 |
| `anthropic/claude-haiku-4-5` | 13 | 4 | 13 | 1335 |
| `gcloud-docai/ocr` | 12 | 0 | 19 | 1335 |
| `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 12 | 3 | 16 | 1335 |
| `kimi/kimi-k2.6` | 14 | 4 | 14 | 1335 |
| `aws-textract/detect-text` | 14 | 0 | 19 | 1335 |
| `openai/gpt-5.4` | 11 | 3 | 19 | 1335 |
| `tesseract/tesseract` | 19 | 10 | 24 | 1335 |
| `ocrmypdf/ocrmypdf` | 22 | 11 | 22 | 1335 |
| `paddle-ocr/paddle-ocr` | 54 | 43 | 14 | 1335 |
| `openai/gpt-5.4-nano` | 16 | 800 | 2 | 1335 |

## Notes

- Best overall provider: `tesseract/tesseract` scored 98.01/100 using balanced overall weighting.
- Worst overall provider: `openai/gpt-5.4-nano` scored 64.35/100 using balanced overall weighting.
- Best local model: `tesseract/tesseract` scored 96.03/100.
- Best cloud service: `mistral/mistral-ocr-2512` scored 99.25/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0340¢ ($0.0003).
- Fastest local model: `tesseract/tesseract` at 6.56s.
- Fastest cloud service: `mistral/mistral-ocr-2512` at 7.99s.
