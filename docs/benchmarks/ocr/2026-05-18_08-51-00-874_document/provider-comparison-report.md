# OCR Provider Comparison Report

## Summary

- Consensus extraction: `consensus-extraction.txt` (15005 characters, 1744 words)
- Compared providers:
  - `gemini/gemini-3.1-flash-lite-preview`
  - `gemini/gemini-3.1-pro-preview`
  - `kimi/kimi-k2.6`
  - `openai/gpt-5.4`
  - `openai/gpt-5.4-nano`
  - `paddle-ocr/paddle-ocr`
  - `tesseract/tesseract`
  - `openai/gpt-5.4-mini`
  - `aws-textract/detect-text`
  - `unstructured/hi_res_and_enrichment`
  - `gcloud-docai/ocr`
  - `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct`
  - `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct`
  - `mistral/mistral-ocr-2512`
  - `glm/glm-ocr`
  - `ocrmypdf/ocrmypdf`
  - `anthropic/claude-haiku-4-5`
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
| 1 | `paddle-ocr/paddle-ocr` | local | 1 | 1 | 100.00 | 100.00 | 100.00 | 100.00 |
| 2 | `tesseract/tesseract` | local | 2 | 2 | 99.99 | 100.00 | 99.97 | 100.00 |
| 3 | `gemini/gemini-3.1-flash-lite-preview` | thirdParty | 1 | 1 | 95.40 | 100.00 | 94.10 | 87.50 |
| 4 | `glm/glm-ocr` | thirdParty | 2 | 1 | 95.39 | 95.13 | 93.10 | 98.20 |
| 5 | `unstructured/hi_res_and_enrichment` | thirdParty | 3 | 1 | 94.74 | 98.68 | 81.59 | 100.00 |
| 6 | `ocrmypdf/ocrmypdf` | local | 3 | 3 | 94.59 | 91.57 | 95.21 | 100.00 |
| 7 | `openai/gpt-5.4-nano` | thirdParty | 4 | 1 | 93.60 | 100.00 | 82.96 | 91.46 |
| 8 | `aws-textract/detect-text` | thirdParty | 5 | 2 | 92.50 | 99.37 | 94.50 | 76.78 |
| 9 | `mistral/mistral-ocr-2512` | thirdParty | 6 | 2 | 90.28 | 96.62 | 98.86 | 69.04 |
| 10 | `openai/gpt-5.4-mini` | thirdParty | 7 | 2 | 88.81 | 99.77 | 86.57 | 69.14 |
| 11 | `gcloud-docai/ocr` | thirdParty | 8 | 2 | 84.96 | 97.99 | 67.09 | 76.78 |
| 12 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | thirdParty | 9 | 3 | 82.85 | 97.65 | 66.73 | 69.36 |
| 13 | `openai/gpt-5.4` | thirdParty | 10 | 3 | 69.38 | 100.00 | 76.93 | 0.57 |
| 14 | `anthropic/claude-haiku-4-5` | thirdParty | 11 | 3 | 68.71 | 79.64 | 81.89 | 33.64 |
| 15 | `kimi/kimi-k2.6` | thirdParty | 12 | 3 | 68.69 | 100.00 | 57.67 | 17.08 |
| 16 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | thirdParty | 13 | 3 | 67.72 | 96.73 | 0.00 | 77.41 |
| 17 | `gemini/gemini-3.1-pro-preview` | thirdParty | 14 | 3 | 64.22 | 100.00 | 56.89 | 0.00 |

## Tier Breakdown

Tiers split local and third-party balanced overall rankings separately. When a group count is not divisible by three, the remainder is assigned to Tier 3 for that group.

### Local Group (3)

#### Tier 1 (group rank 1)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 1 | `paddle-ocr/paddle-ocr` | 100.00 | 100.00 | 100.00 | 100.00 |

#### Tier 2 (group rank 2)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 2 | 2 | `tesseract/tesseract` | 99.99 | 100.00 | 99.97 | 100.00 |

#### Tier 3 (group rank 3)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 3 | 6 | `ocrmypdf/ocrmypdf` | 94.59 | 91.57 | 95.21 | 100.00 |


### Third-Party Group (14)

#### Tier 1 (group ranks 1-4)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 3 | `gemini/gemini-3.1-flash-lite-preview` | 95.40 | 100.00 | 94.10 | 87.50 |
| 2 | 4 | `glm/glm-ocr` | 95.39 | 95.13 | 93.10 | 98.20 |
| 3 | 5 | `unstructured/hi_res_and_enrichment` | 94.74 | 98.68 | 81.59 | 100.00 |
| 4 | 7 | `openai/gpt-5.4-nano` | 93.60 | 100.00 | 82.96 | 91.46 |

#### Tier 2 (group ranks 5-8)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 5 | 8 | `aws-textract/detect-text` | 92.50 | 99.37 | 94.50 | 76.78 |
| 6 | 9 | `mistral/mistral-ocr-2512` | 90.28 | 96.62 | 98.86 | 69.04 |
| 7 | 10 | `openai/gpt-5.4-mini` | 88.81 | 99.77 | 86.57 | 69.14 |
| 8 | 11 | `gcloud-docai/ocr` | 84.96 | 97.99 | 67.09 | 76.78 |

#### Tier 3 (group ranks 9-14)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 9 | 12 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 82.85 | 97.65 | 66.73 | 69.36 |
| 10 | 13 | `openai/gpt-5.4` | 69.38 | 100.00 | 76.93 | 0.57 |
| 11 | 14 | `anthropic/claude-haiku-4-5` | 68.71 | 79.64 | 81.89 | 33.64 |
| 12 | 15 | `kimi/kimi-k2.6` | 68.69 | 100.00 | 57.67 | 17.08 |
| 13 | 16 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 67.72 | 96.73 | 0.00 | 77.41 |
| 14 | 17 | `gemini/gemini-3.1-pro-preview` | 64.22 | 100.00 | 56.89 | 0.00 |



## Ranking

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `gemini/gemini-3.1-flash-lite-preview` | 100.00 | 0.00% | 0.00% | 1641 | 13.29s | 0.8076¢ ($0.0081) |
| 2 | `gemini/gemini-3.1-pro-preview` | 100.00 | 0.00% | 0.00% | 1641 | 97.04s | 6.4594¢ ($0.0646) |
| 3 | `kimi/kimi-k2.6` | 100.00 | 0.00% | 0.00% | 1642 | 95.27s | 5.3559¢ ($0.0536) |
| 4 | `openai/gpt-5.4` | 100.00 | 0.00% | 0.00% | 1641 | 51.93s | 6.4225¢ ($0.0642) |
| 5 | `openai/gpt-5.4-nano` | 100.00 | 0.00% | 0.00% | 1641 | 38.36s | 0.5519¢ ($0.0055) |
| 6 | `paddle-ocr/paddle-ocr` | 100.00 | 0.00% | 0.00% | 1641 | 0.00s | 0.0000¢ ($0.0000) |
| 7 | `tesseract/tesseract` | 100.00 | 0.00% | 0.00% | 1641 | 0.07s | 0.0000¢ ($0.0000) |
| 8 | `openai/gpt-5.4-mini` | 99.77 | 0.23% | 0.20% | 1637 | 30.23s | 1.9933¢ ($0.0199) |
| 9 | `aws-textract/detect-text` | 99.37 | 0.63% | 0.10% | 1658 | 12.38s | 1.5000¢ ($0.0150) |
| 10 | `unstructured/hi_res_and_enrichment` | 98.68 | 1.32% | 0.53% | 1640 | 41.45s | 0.0000¢ ($0.0000) |
| 11 | `gcloud-docai/ocr` | 97.99 | 2.01% | 2.08% | 1641 | 74.08s | 1.5000¢ ($0.0150) |
| 12 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 97.65 | 2.35% | 2.52% | 1606 | 74.89s | 1.9794¢ ($0.0198) |
| 13 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 96.73 | 3.27% | 2.92% | 1600 | 225.08s | 1.4595¢ ($0.0146) |
| 14 | `mistral/mistral-ocr-2512` | 96.62 | 3.38% | 3.43% | 1698 | 2.57s | 2.0000¢ ($0.0200) |
| 15 | `glm/glm-ocr` | 95.13 | 4.87% | 4.90% | 1586 | 15.54s | 0.1165¢ ($0.0012) |
| 16 | `ocrmypdf/ocrmypdf` | 91.57 | 8.43% | 7.10% | 1682 | 10.78s | 0.0000¢ ($0.0000) |
| 17 | `anthropic/claude-haiku-4-5` | 79.64 | 20.36% | 53.91% | 1639 | 40.75s | 4.2863¢ ($0.0429) |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| `gemini/gemini-3.1-flash-lite-preview` | 0 | 0 | 0 | 1744 |
| `gemini/gemini-3.1-pro-preview` | 0 | 0 | 0 | 1744 |
| `kimi/kimi-k2.6` | 0 | 0 | 0 | 1744 |
| `openai/gpt-5.4` | 0 | 0 | 0 | 1744 |
| `openai/gpt-5.4-nano` | 0 | 0 | 0 | 1744 |
| `paddle-ocr/paddle-ocr` | 0 | 0 | 0 | 1744 |
| `tesseract/tesseract` | 0 | 0 | 0 | 1744 |
| `openai/gpt-5.4-mini` | 0 | 4 | 0 | 1744 |
| `aws-textract/detect-text` | 10 | 0 | 1 | 1744 |
| `unstructured/hi_res_and_enrichment` | 15 | 3 | 5 | 1744 |
| `gcloud-docai/ocr` | 1 | 17 | 17 | 1744 |
| `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 1 | 40 | 0 | 1744 |
| `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 10 | 47 | 0 | 1744 |
| `mistral/mistral-ocr-2512` | 3 | 6 | 50 | 1744 |
| `glm/glm-ocr` | 9 | 69 | 7 | 1744 |
| `ocrmypdf/ocrmypdf` | 92 | 32 | 23 | 1744 |
| `anthropic/claude-haiku-4-5` | 0 | 179 | 176 | 1744 |

## Notes

- Best overall provider: `paddle-ocr/paddle-ocr` scored 100.00/100 using balanced overall weighting.
- Worst overall provider: `gemini/gemini-3.1-pro-preview` scored 64.22/100 using balanced overall weighting.
- Best local model: `paddle-ocr/paddle-ocr` scored 100.00/100.
- Best cloud service: `gemini/gemini-3.1-flash-lite-preview` scored 100.00/100.
- The cheapest cloud provider was `unstructured/hi_res_and_enrichment` at 0.0000¢ ($0.0000).
- Fastest local model: `paddle-ocr/paddle-ocr` at 0.00s.
- Fastest cloud service: `mistral/mistral-ocr-2512` at 2.57s.
