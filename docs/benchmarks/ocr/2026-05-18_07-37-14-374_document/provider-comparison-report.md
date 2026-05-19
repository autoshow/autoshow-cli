# OCR Provider Comparison Report

## Summary

- Consensus extraction: `consensus-extraction.txt` (8960 characters, 1459 words)
- Compared providers:
  - `gemini/gemini-3.1-pro-preview`
  - `kimi/kimi-k2.6`
  - `openai/gpt-5.4`
  - `openai/gpt-5.4-mini`
  - `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct`
  - `gemini/gemini-3.1-flash-lite-preview`
  - `openai/gpt-5.4-nano`
  - `mistral/mistral-ocr-2512`
  - `glm/glm-ocr`
  - `gcloud-docai/ocr`
  - `aws-textract/detect-text`
  - `tesseract/tesseract`
  - `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct`
  - `ocrmypdf/ocrmypdf`
  - `unstructured/hi_res_and_enrichment`
  - `paddle-ocr/paddle-ocr`
- Total providers: 16 (3 local, 13 cloud)
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
| 1 | `gemini/gemini-3.1-flash-lite-preview` | thirdParty | 1 | 1 | 93.56 | 91.36 | 99.08 | 92.42 |
| 2 | `mistral/mistral-ocr-2512` | thirdParty | 2 | 1 | 92.00 | 87.05 | 99.45 | 94.45 |
| 3 | `openai/gpt-5.4-nano` | thirdParty | 3 | 1 | 91.42 | 89.31 | 95.13 | 91.94 |
| 4 | `glm/glm-ocr` | thirdParty | 4 | 1 | 90.32 | 83.62 | 94.84 | 99.20 |
| 5 | `openai/gpt-5.4-mini` | thirdParty | 5 | 2 | 88.95 | 93.97 | 97.42 | 70.44 |
| 6 | `gcloud-docai/ocr` | thirdParty | 6 | 2 | 86.60 | 75.94 | 98.70 | 95.83 |
| 7 | `kimi/kimi-k2.6` | thirdParty | 7 | 2 | 83.26 | 98.49 | 70.17 | 65.86 |
| 8 | `aws-textract/detect-text` | thirdParty | 8 | 2 | 79.73 | 61.55 | 100.00 | 95.83 |
| 9 | `gemini/gemini-3.1-pro-preview` | thirdParty | 9 | 3 | 79.48 | 99.11 | 94.87 | 24.83 |
| 10 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | thirdParty | 10 | 3 | 78.43 | 91.84 | 43.40 | 86.63 |
| 11 | `openai/gpt-5.4` | thirdParty | 11 | 3 | 71.10 | 97.88 | 88.64 | 0.00 |
| 12 | `tesseract/tesseract` | local | 1 | 1 | 57.01 | 14.60 | 98.83 | 100.00 |
| 13 | `ocrmypdf/ocrmypdf` | local | 2 | 2 | 55.79 | 13.23 | 96.69 | 100.00 |
| 14 | `paddle-ocr/paddle-ocr` | local | 3 | 3 | 47.39 | 1.58 | 86.41 | 100.00 |
| 15 | `unstructured/hi_res_and_enrichment` | thirdParty | 12 | 3 | 44.91 | 6.44 | 66.77 | 100.00 |
| 16 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | thirdParty | 13 | 3 | 28.83 | 14.46 | 0.00 | 86.38 |

## Tier Breakdown

Tiers split local and third-party balanced overall rankings separately. When a group count is not divisible by three, the remainder is assigned to Tier 3 for that group.

### Local Group (3)

#### Tier 1 (group rank 1)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 12 | `tesseract/tesseract` | 57.01 | 14.60 | 98.83 | 100.00 |

#### Tier 2 (group rank 2)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 2 | 13 | `ocrmypdf/ocrmypdf` | 55.79 | 13.23 | 96.69 | 100.00 |

#### Tier 3 (group rank 3)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 3 | 14 | `paddle-ocr/paddle-ocr` | 47.39 | 1.58 | 86.41 | 100.00 |


### Third-Party Group (13)

#### Tier 1 (group ranks 1-4)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 1 | `gemini/gemini-3.1-flash-lite-preview` | 93.56 | 91.36 | 99.08 | 92.42 |
| 2 | 2 | `mistral/mistral-ocr-2512` | 92.00 | 87.05 | 99.45 | 94.45 |
| 3 | 3 | `openai/gpt-5.4-nano` | 91.42 | 89.31 | 95.13 | 91.94 |
| 4 | 4 | `glm/glm-ocr` | 90.32 | 83.62 | 94.84 | 99.20 |

#### Tier 2 (group ranks 5-8)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 5 | 5 | `openai/gpt-5.4-mini` | 88.95 | 93.97 | 97.42 | 70.44 |
| 6 | 6 | `gcloud-docai/ocr` | 86.60 | 75.94 | 98.70 | 95.83 |
| 7 | 7 | `kimi/kimi-k2.6` | 83.26 | 98.49 | 70.17 | 65.86 |
| 8 | 8 | `aws-textract/detect-text` | 79.73 | 61.55 | 100.00 | 95.83 |

#### Tier 3 (group ranks 9-13)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 9 | 9 | `gemini/gemini-3.1-pro-preview` | 79.48 | 99.11 | 94.87 | 24.83 |
| 10 | 10 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 78.43 | 91.84 | 43.40 | 86.63 |
| 11 | 11 | `openai/gpt-5.4` | 71.10 | 97.88 | 88.64 | 0.00 |
| 12 | 15 | `unstructured/hi_res_and_enrichment` | 44.91 | 6.44 | 66.77 | 100.00 |
| 13 | 16 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 28.83 | 14.46 | 0.00 | 86.38 |



## Ranking

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `gemini/gemini-3.1-pro-preview` | 99.11 | 0.89% | 0.36% | 1466 | 15.82s | 2.7070¢ ($0.0271) |
| 2 | `kimi/kimi-k2.6` | 98.49 | 1.51% | 0.50% | 1495 | 65.11s | 1.2292¢ ($0.0123) |
| 3 | `openai/gpt-5.4` | 97.88 | 2.12% | 1.31% | 1450 | 28.26s | 3.6010¢ ($0.0360) |
| 4 | `openai/gpt-5.4-mini` | 93.97 | 6.03% | 5.08% | 1454 | 10.73s | 1.0646¢ ($0.0106) |
| 5 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 91.84 | 8.16% | 8.39% | 1343 | 118.56s | 0.4813¢ ($0.0048) |
| 6 | `gemini/gemini-3.1-flash-lite-preview` | 91.36 | 8.64% | 8.96% | 1339 | 7.42s | 0.2728¢ ($0.0027) |
| 7 | `openai/gpt-5.4-nano` | 89.31 | 10.69% | 8.56% | 1466 | 15.29s | 0.2902¢ ($0.0029) |
| 8 | `mistral/mistral-ocr-2512` | 87.05 | 12.95% | 8.37% | 1447 | 6.68s | 0.2000¢ ($0.0020) |
| 9 | `glm/glm-ocr` | 83.62 | 16.38% | 15.43% | 1266 | 15.88s | 0.0286¢ ($0.0003) |
| 10 | `gcloud-docai/ocr` | 75.94 | 24.06% | 14.60% | 1512 | 8.17s | 0.1500¢ ($0.0015) |
| 11 | `aws-textract/detect-text` | 61.55 | 38.45% | 21.53% | 1329 | 5.58s | 0.1500¢ ($0.0015) |
| 12 | `tesseract/tesseract` | 14.60 | 85.40% | 45.84% | 1314 | 7.92s | 0.0000¢ ($0.0000) |
| 13 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 14.46 | 85.54% | 106.93% | 2594 | 205.18s | 0.4905¢ ($0.0049) |
| 14 | `ocrmypdf/ocrmypdf` | 13.23 | 86.77% | 49.63% | 1206 | 12.19s | 0.0000¢ ($0.0000) |
| 15 | `unstructured/hi_res_and_enrichment` | 6.44 | 93.56% | 71.79% | 911 | 71.90s | 0.0000¢ ($0.0000) |
| 16 | `paddle-ocr/paddle-ocr` | 1.58 | 98.42% | 89.94% | 159 | 32.70s | 0.0000¢ ($0.0000) |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| `gemini/gemini-3.1-pro-preview` | 5 | 2 | 6 | 1459 |
| `kimi/kimi-k2.6` | 12 | 4 | 6 | 1459 |
| `openai/gpt-5.4` | 13 | 12 | 6 | 1459 |
| `openai/gpt-5.4-mini` | 67 | 14 | 7 | 1459 |
| `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 6 | 113 | 0 | 1459 |
| `gemini/gemini-3.1-flash-lite-preview` | 3 | 122 | 1 | 1459 |
| `openai/gpt-5.4-nano` | 126 | 28 | 2 | 1459 |
| `mistral/mistral-ocr-2512` | 138 | 32 | 19 | 1459 |
| `glm/glm-ocr` | 26 | 203 | 10 | 1459 |
| `gcloud-docai/ocr` | 212 | 54 | 85 | 1459 |
| `aws-textract/detect-text` | 337 | 178 | 46 | 1459 |
| `tesseract/tesseract` | 1035 | 191 | 20 | 1459 |
| `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 101 | 11 | 1136 | 1459 |
| `ocrmypdf/ocrmypdf` | 959 | 293 | 14 | 1459 |
| `unstructured/hi_res_and_enrichment` | 728 | 637 | 0 | 1459 |
| `paddle-ocr/paddle-ocr` | 138 | 1298 | 0 | 1459 |

## Notes

- Best overall provider: `gemini/gemini-3.1-flash-lite-preview` scored 93.56/100 using balanced overall weighting.
- Worst overall provider: `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` scored 28.83/100 using balanced overall weighting.
- Best local model: `tesseract/tesseract` scored 14.60/100.
- Best cloud service: `gemini/gemini-3.1-pro-preview` scored 99.11/100.
- The cheapest cloud provider was `unstructured/hi_res_and_enrichment` at 0.0000¢ ($0.0000).
- Fastest local model: `tesseract/tesseract` at 7.92s.
- Fastest cloud service: `aws-textract/detect-text` at 5.58s.
