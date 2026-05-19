# OCR Provider Comparison Report

## Summary

- Consensus extraction: `consensus-extraction.txt` (5955 characters, 1092 words)
- Compared providers:
  - `gemini/gemini-3.1-flash-lite-preview`
  - `openai/gpt-5.4`
  - `mistral/mistral-ocr-2512`
  - `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct`
  - `anthropic/claude-haiku-4-5`
  - `gemini/gemini-3.1-pro-preview`
  - `openai/gpt-5.4-mini`
  - `kimi/kimi-k2.6`
  - `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct`
  - `glm/glm-ocr`
  - `aws-textract/detect-text`
  - `gcloud-docai/ocr`
  - `tesseract/tesseract`
  - `openai/gpt-5.4-nano`
  - `ocrmypdf/ocrmypdf`
  - `paddle-ocr/paddle-ocr`
  - `unstructured/hi_res_and_enrichment`
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
- Ranking uses exact unrounded WER, with CER included for context and tie-breaking.
- Overall ranking combines all providers using accuracy score, normalized processing speed, and normalized cost efficiency. Missing timing or missing cloud cost receives a neutral 50/100 component score.
- Tier breakdown assigns local and third-party providers independently using balanced overall group rank.

## Overall Ranking

| Rank | Provider | Tier Group | Group Rank | Group Tier | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `gemini/gemini-3.1-flash-lite-preview` | thirdParty | 1 | 1 | 96.42 | 98.08 | 96.17 | 93.36 |
| 2 | `mistral/mistral-ocr-2512` | thirdParty | 2 | 1 | 92.80 | 95.33 | 100.00 | 80.53 |
| 3 | `tesseract/tesseract` | local | 1 | 1 | 87.88 | 76.47 | 98.59 | 100.00 |
| 4 | `ocrmypdf/ocrmypdf` | local | 2 | 2 | 87.14 | 75.73 | 97.08 | 100.00 |
| 5 | `glm/glm-ocr` | thirdParty | 3 | 1 | 86.71 | 80.95 | 85.62 | 99.33 |
| 6 | `aws-textract/detect-text` | thirdParty | 4 | 1 | 84.27 | 78.48 | 94.72 | 85.40 |
| 7 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | thirdParty | 5 | 2 | 83.78 | 92.86 | 59.64 | 89.76 |
| 8 | `openai/gpt-5.4-nano` | thirdParty | 6 | 2 | 82.27 | 76.47 | 83.96 | 92.19 |
| 9 | `gcloud-docai/ocr` | thirdParty | 7 | 2 | 78.11 | 77.75 | 71.56 | 85.40 |
| 10 | `anthropic/claude-haiku-4-5` | thirdParty | 8 | 2 | 77.85 | 91.48 | 65.08 | 63.36 |
| 11 | `kimi/kimi-k2.6` | thirdParty | 9 | 3 | 70.45 | 89.01 | 57.96 | 45.82 |
| 12 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | thirdParty | 10 | 3 | 70.40 | 86.81 | 22.26 | 85.73 |
| 13 | `paddle-ocr/paddle-ocr` | local | 3 | 3 | 70.24 | 69.69 | 41.57 | 100.00 |
| 14 | `openai/gpt-5.4` | thirdParty | 11 | 3 | 68.09 | 96.34 | 79.69 | 0.00 |
| 15 | `openai/gpt-5.4-mini` | thirdParty | 12 | 3 | 63.14 | 90.93 | 0.00 | 70.69 |
| 16 | `gemini/gemini-3.1-pro-preview` | thirdParty | 13 | 3 | 62.15 | 91.30 | 23.65 | 42.35 |
| 17 | `unstructured/hi_res_and_enrichment` | thirdParty | 14 | 3 | 41.05 | 1.37 | 61.47 | 100.00 |

## Tier Breakdown

Tiers split local and third-party balanced overall rankings separately. When a group count is not divisible by three, the remainder is assigned to Tier 3 for that group.

### Local Group (3)

#### Tier 1 (group rank 1)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 3 | `tesseract/tesseract` | 87.88 | 76.47 | 98.59 | 100.00 |

#### Tier 2 (group rank 2)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 2 | 4 | `ocrmypdf/ocrmypdf` | 87.14 | 75.73 | 97.08 | 100.00 |

#### Tier 3 (group rank 3)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 3 | 13 | `paddle-ocr/paddle-ocr` | 70.24 | 69.69 | 41.57 | 100.00 |


### Third-Party Group (14)

#### Tier 1 (group ranks 1-4)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 1 | `gemini/gemini-3.1-flash-lite-preview` | 96.42 | 98.08 | 96.17 | 93.36 |
| 2 | 2 | `mistral/mistral-ocr-2512` | 92.80 | 95.33 | 100.00 | 80.53 |
| 3 | 5 | `glm/glm-ocr` | 86.71 | 80.95 | 85.62 | 99.33 |
| 4 | 6 | `aws-textract/detect-text` | 84.27 | 78.48 | 94.72 | 85.40 |

#### Tier 2 (group ranks 5-8)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 5 | 7 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 83.78 | 92.86 | 59.64 | 89.76 |
| 6 | 8 | `openai/gpt-5.4-nano` | 82.27 | 76.47 | 83.96 | 92.19 |
| 7 | 9 | `gcloud-docai/ocr` | 78.11 | 77.75 | 71.56 | 85.40 |
| 8 | 10 | `anthropic/claude-haiku-4-5` | 77.85 | 91.48 | 65.08 | 63.36 |

#### Tier 3 (group ranks 9-14)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 9 | 11 | `kimi/kimi-k2.6` | 70.45 | 89.01 | 57.96 | 45.82 |
| 10 | 12 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 70.40 | 86.81 | 22.26 | 85.73 |
| 11 | 14 | `openai/gpt-5.4` | 68.09 | 96.34 | 79.69 | 0.00 |
| 12 | 15 | `openai/gpt-5.4-mini` | 63.14 | 90.93 | 0.00 | 70.69 |
| 13 | 16 | `gemini/gemini-3.1-pro-preview` | 62.15 | 91.30 | 23.65 | 42.35 |
| 14 | 17 | `unstructured/hi_res_and_enrichment` | 41.05 | 1.37 | 61.47 | 100.00 |



## Ranking

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `gemini/gemini-3.1-flash-lite-preview` | 98.08 | 1.92% | 0.89% | 1062 | 8.82s | 0.3409¢ ($0.0034) |
| 2 | `openai/gpt-5.4` | 96.34 | 3.66% | 1.84% | 1036 | 24.41s | 5.1355¢ ($0.0514) |
| 3 | `mistral/mistral-ocr-2512` | 95.33 | 4.67% | 1.80% | 1087 | 5.20s | 1.0000¢ ($0.0100) |
| 4 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 92.86 | 7.14% | 3.15% | 1065 | 43.38s | 0.5261¢ ($0.0053) |
| 5 | `anthropic/claude-haiku-4-5` | 91.48 | 8.52% | 3.76% | 1043 | 38.23s | 1.8815¢ ($0.0188) |
| 6 | `gemini/gemini-3.1-pro-preview` | 91.30 | 8.70% | 2.66% | 1134 | 77.42s | 2.9604¢ ($0.0296) |
| 7 | `openai/gpt-5.4-mini` | 90.93 | 9.07% | 6.30% | 1001 | 99.79s | 1.5051¢ ($0.0151) |
| 8 | `kimi/kimi-k2.6` | 89.01 | 10.99% | 3.27% | 1080 | 44.97s | 2.7824¢ ($0.0278) |
| 9 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 86.81 | 13.19% | 3.81% | 1096 | 78.73s | 0.7327¢ ($0.0073) |
| 10 | `glm/glm-ocr` | 80.95 | 19.05% | 14.60% | 931 | 18.80s | 0.0345¢ ($0.0003) |
| 11 | `aws-textract/detect-text` | 78.48 | 21.52% | 5.89% | 1081 | 10.19s | 0.7500¢ ($0.0075) |
| 12 | `gcloud-docai/ocr` | 77.75 | 22.25% | 5.21% | 1086 | 32.10s | 0.7500¢ ($0.0075) |
| 13 | `tesseract/tesseract` | 76.47 | 23.53% | 6.61% | 1081 | 6.53s | 0.0000¢ ($0.0000) |
| 14 | `openai/gpt-5.4-nano` | 76.47 | 23.53% | 17.07% | 962 | 20.37s | 0.4011¢ ($0.0040) |
| 15 | `ocrmypdf/ocrmypdf` | 75.73 | 24.27% | 6.89% | 1082 | 7.96s | 0.0000¢ ($0.0000) |
| 16 | `paddle-ocr/paddle-ocr` | 69.69 | 30.31% | 8.81% | 980 | 60.47s | 0.0000¢ ($0.0000) |
| 17 | `unstructured/hi_res_and_enrichment` | 1.37 | 98.63% | 98.76% | 34 | 41.65s | 0.0000¢ ($0.0000) |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| `gemini/gemini-3.1-flash-lite-preview` | 10 | 1 | 10 | 1092 |
| `openai/gpt-5.4` | 14 | 20 | 6 | 1092 |
| `mistral/mistral-ocr-2512` | 17 | 1 | 33 | 1092 |
| `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 35 | 23 | 20 | 1092 |
| `anthropic/claude-haiku-4-5` | 56 | 25 | 12 | 1092 |
| `gemini/gemini-3.1-pro-preview` | 17 | 0 | 78 | 1092 |
| `openai/gpt-5.4-mini` | 31 | 63 | 5 | 1092 |
| `kimi/kimi-k2.6` | 91 | 0 | 29 | 1092 |
| `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 100 | 1 | 43 | 1092 |
| `glm/glm-ocr` | 63 | 132 | 13 | 1092 |
| `aws-textract/detect-text` | 194 | 4 | 37 | 1092 |
| `gcloud-docai/ocr` | 169 | 6 | 68 | 1092 |
| `tesseract/tesseract` | 216 | 7 | 34 | 1092 |
| `openai/gpt-5.4-nano` | 84 | 128 | 45 | 1092 |
| `ocrmypdf/ocrmypdf` | 224 | 7 | 34 | 1092 |
| `paddle-ocr/paddle-ocr` | 248 | 58 | 25 | 1092 |
| `unstructured/hi_res_and_enrichment` | 10 | 1067 | 0 | 1092 |

## Notes

- Best overall provider: `gemini/gemini-3.1-flash-lite-preview` scored 96.42/100 using balanced overall weighting.
- Worst overall provider: `unstructured/hi_res_and_enrichment` scored 41.05/100 using balanced overall weighting.
- Best local model: `tesseract/tesseract` scored 76.47/100.
- Best cloud service: `gemini/gemini-3.1-flash-lite-preview` scored 98.08/100.
- The cheapest cloud provider was `unstructured/hi_res_and_enrichment` at 0.0000¢ ($0.0000).
- Fastest local model: `tesseract/tesseract` at 6.53s.
- Fastest cloud service: `mistral/mistral-ocr-2512` at 5.20s.
