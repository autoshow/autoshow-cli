# OCR Provider Comparison Report

## Summary

- Consensus extraction: `consensus-extraction.txt` (12591 characters, 2359 words)
- Compared providers:
  - `kimi/kimi-k2.6`
  - `gemini/gemini-3.1-pro-preview`
  - `glm/glm-ocr`
  - `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct`
  - `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct`
  - `mistral/mistral-ocr-2512`
  - `openai/gpt-5.4`
  - `anthropic/claude-haiku-4-5`
  - `gemini/gemini-3.1-flash-lite-preview`
  - `ocrmypdf/ocrmypdf`
  - `openai/gpt-5.4-mini`
  - `openai/gpt-5.4-nano`
  - `unstructured/hi_res_and_enrichment`
  - `gcloud-docai/ocr`
  - `paddle-ocr/paddle-ocr`
  - `tesseract/tesseract`
  - `aws-textract/detect-text`
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
| 1 | `glm/glm-ocr` | thirdParty | 1 | 1 | 90.00 | 82.49 | 95.74 | 99.26 |
| 2 | `kimi/kimi-k2.6` | thirdParty | 2 | 1 | 76.21 | 98.30 | 42.78 | 65.47 |
| 3 | `mistral/mistral-ocr-2512` | thirdParty | 3 | 1 | 70.75 | 46.97 | 93.28 | 95.77 |
| 4 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | thirdParty | 4 | 1 | 69.04 | 59.94 | 63.48 | 92.80 |
| 5 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | thirdParty | 5 | 2 | 68.38 | 73.00 | 37.64 | 89.88 |
| 6 | `gemini/gemini-3.1-flash-lite-preview` | thirdParty | 6 | 2 | 56.24 | 16.11 | 95.93 | 96.81 |
| 7 | `gemini/gemini-3.1-pro-preview` | thirdParty | 7 | 2 | 54.31 | 98.13 | 0.00 | 20.97 |
| 8 | `ocrmypdf/ocrmypdf` | local | 1 | 1 | 53.18 | 12.93 | 86.87 | 100.00 |
| 9 | `openai/gpt-5.4-nano` | thirdParty | 8 | 2 | 52.44 | 10.05 | 92.45 | 97.22 |
| 10 | `paddle-ocr/paddle-ocr` | local | 2 | 2 | 52.42 | 4.83 | 100.00 | 100.00 |
| 11 | `tesseract/tesseract` | local | 3 | 3 | 52.41 | 4.83 | 99.98 | 100.00 |
| 12 | `aws-textract/detect-text` | thirdParty | 9 | 3 | 48.45 | 4.58 | 87.80 | 96.83 |
| 13 | `gcloud-docai/ocr` | thirdParty | 10 | 3 | 46.84 | 5.60 | 79.36 | 96.83 |
| 14 | `openai/gpt-5.4-mini` | thirdParty | 11 | 3 | 44.18 | 12.12 | 64.61 | 87.86 |
| 15 | `anthropic/claude-haiku-4-5` | thirdParty | 12 | 3 | 40.61 | 18.52 | 67.99 | 57.41 |
| 16 | `unstructured/hi_res_and_enrichment` | thirdParty | 13 | 3 | 36.19 | 6.87 | 31.02 | 100.00 |
| 17 | `openai/gpt-5.4` | thirdParty | 14 | 3 | 35.56 | 41.20 | 59.84 | 0.00 |

## Tier Breakdown

Tiers split local and third-party balanced overall rankings separately. When a group count is not divisible by three, the remainder is assigned to Tier 3 for that group.

### Local Group (3)

#### Tier 1 (group rank 1)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 8 | `ocrmypdf/ocrmypdf` | 53.18 | 12.93 | 86.87 | 100.00 |

#### Tier 2 (group rank 2)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 2 | 10 | `paddle-ocr/paddle-ocr` | 52.42 | 4.83 | 100.00 | 100.00 |

#### Tier 3 (group rank 3)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 3 | 11 | `tesseract/tesseract` | 52.41 | 4.83 | 99.98 | 100.00 |


### Third-Party Group (14)

#### Tier 1 (group ranks 1-4)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 1 | `glm/glm-ocr` | 90.00 | 82.49 | 95.74 | 99.26 |
| 2 | 2 | `kimi/kimi-k2.6` | 76.21 | 98.30 | 42.78 | 65.47 |
| 3 | 3 | `mistral/mistral-ocr-2512` | 70.75 | 46.97 | 93.28 | 95.77 |
| 4 | 4 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 69.04 | 59.94 | 63.48 | 92.80 |

#### Tier 2 (group ranks 5-8)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 5 | 5 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 68.38 | 73.00 | 37.64 | 89.88 |
| 6 | 6 | `gemini/gemini-3.1-flash-lite-preview` | 56.24 | 16.11 | 95.93 | 96.81 |
| 7 | 7 | `gemini/gemini-3.1-pro-preview` | 54.31 | 98.13 | 0.00 | 20.97 |
| 8 | 9 | `openai/gpt-5.4-nano` | 52.44 | 10.05 | 92.45 | 97.22 |

#### Tier 3 (group ranks 9-14)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 9 | 12 | `aws-textract/detect-text` | 48.45 | 4.58 | 87.80 | 96.83 |
| 10 | 13 | `gcloud-docai/ocr` | 46.84 | 5.60 | 79.36 | 96.83 |
| 11 | 14 | `openai/gpt-5.4-mini` | 44.18 | 12.12 | 64.61 | 87.86 |
| 12 | 15 | `anthropic/claude-haiku-4-5` | 40.61 | 18.52 | 67.99 | 57.41 |
| 13 | 16 | `unstructured/hi_res_and_enrichment` | 36.19 | 6.87 | 31.02 | 100.00 |
| 14 | 17 | `openai/gpt-5.4` | 35.56 | 41.20 | 59.84 | 0.00 |



## Ranking

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `kimi/kimi-k2.6` | 98.30 | 1.70% | 0.96% | 2304 | 85.16s | 1.6337¢ ($0.0163) |
| 2 | `gemini/gemini-3.1-pro-preview` | 98.13 | 1.87% | 0.94% | 2307 | 148.84s | 3.7388¢ ($0.0374) |
| 3 | `glm/glm-ocr` | 82.49 | 17.51% | 15.47% | 2341 | 6.34s | 0.0350¢ ($0.0003) |
| 4 | `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 73.00 | 27.00% | 24.98% | 1781 | 92.81s | 0.4787¢ ($0.0048) |
| 5 | `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 59.94 | 40.06% | 34.21% | 1717 | 54.35s | 0.3404¢ ($0.0034) |
| 6 | `mistral/mistral-ocr-2512` | 46.97 | 53.03% | 41.57% | 1755 | 10.00s | 0.2000¢ ($0.0020) |
| 7 | `openai/gpt-5.4` | 41.20 | 58.80% | 42.33% | 1984 | 59.78s | 4.7307¢ ($0.0473) |
| 8 | `anthropic/claude-haiku-4-5` | 18.52 | 81.48% | 61.72% | 2165 | 47.64s | 2.0149¢ ($0.0201) |
| 9 | `gemini/gemini-3.1-flash-lite-preview` | 16.11 | 83.89% | 79.55% | 553 | 6.05s | 0.1507¢ ($0.0015) |
| 10 | `ocrmypdf/ocrmypdf` | 12.93 | 87.07% | 62.93% | 2287 | 19.55s | 0.0000¢ ($0.0000) |
| 11 | `openai/gpt-5.4-mini` | 12.12 | 87.88% | 94.13% | 743 | 52.67s | 0.5742¢ ($0.0057) |
| 12 | `openai/gpt-5.4-nano` | 10.05 | 89.95% | 83.12% | 441 | 11.23s | 0.1314¢ ($0.0013) |
| 13 | `unstructured/hi_res_and_enrichment` | 6.87 | 93.13% | 84.76% | 2116 | 102.67s | 0.0000¢ ($0.0000) |
| 14 | `gcloud-docai/ocr` | 5.60 | 94.40% | 68.79% | 2496 | 30.73s | 0.1500¢ ($0.0015) |
| 15 | `paddle-ocr/paddle-ocr` | 4.83 | 95.17% | 83.16% | 549 | 0.00s | 0.0000¢ ($0.0000) |
| 16 | `tesseract/tesseract` | 4.83 | 95.17% | 83.16% | 549 | 0.03s | 0.0000¢ ($0.0000) |
| 17 | `aws-textract/detect-text` | 4.58 | 95.42% | 72.00% | 2329 | 18.16s | 0.1500¢ ($0.0015) |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| `kimi/kimi-k2.6` | 28 | 6 | 6 | 2359 |
| `gemini/gemini-3.1-pro-preview` | 29 | 7 | 8 | 2359 |
| `glm/glm-ocr` | 67 | 157 | 189 | 2359 |
| `deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct` | 75 | 546 | 16 | 2359 |
| `deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct` | 278 | 634 | 33 | 2359 |
| `mistral/mistral-ocr-2512` | 586 | 620 | 45 | 2359 |
| `openai/gpt-5.4` | 939 | 389 | 59 | 2359 |
| `anthropic/claude-haiku-4-5` | 1738 | 168 | 16 | 2359 |
| `gemini/gemini-3.1-flash-lite-preview` | 60 | 1855 | 64 | 2359 |
| `ocrmypdf/ocrmypdf` | 1813 | 152 | 89 | 2359 |
| `openai/gpt-5.4-mini` | 224 | 1729 | 120 | 2359 |
| `openai/gpt-5.4-nano` | 210 | 1906 | 6 | 2359 |
| `unstructured/hi_res_and_enrichment` | 1888 | 260 | 49 | 2359 |
| `gcloud-docai/ocr` | 1823 | 95 | 309 | 2359 |
| `paddle-ocr/paddle-ocr` | 460 | 1774 | 11 | 2359 |
| `tesseract/tesseract` | 460 | 1774 | 11 | 2359 |
| `aws-textract/detect-text` | 2158 | 43 | 50 | 2359 |

## Notes

- Best overall provider: `glm/glm-ocr` scored 90.00/100 using balanced overall weighting.
- Worst overall provider: `openai/gpt-5.4` scored 35.56/100 using balanced overall weighting.
- Best local model: `ocrmypdf/ocrmypdf` scored 12.93/100.
- Best cloud service: `kimi/kimi-k2.6` scored 98.30/100.
- The cheapest cloud provider was `unstructured/hi_res_and_enrichment` at 0.0000¢ ($0.0000).
- Fastest local model: `paddle-ocr/paddle-ocr` at 0.00s.
- Fastest cloud service: `gemini/gemini-3.1-flash-lite-preview` at 6.05s.
