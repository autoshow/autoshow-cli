# OCR Provider Comparison Report

## Summary

- Consensus extraction: `consensus-extraction.txt` (12631 characters, 2360 words)
- Total providers: 14 (3 local, 11 cloud)
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

  - `ocrmypdf/ocrmypdf`
  - `paddle-ocr/paddle-ocr`
  - `tesseract/tesseract`

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `ocrmypdf/ocrmypdf` | 13.01 | 86.99% | 62.91% | 2287 | 18.40s |
| 2 | `paddle-ocr/paddle-ocr` | 4.79 | 95.21% | 83.16% | 549 | 7.55s |
| 3 | `tesseract/tesseract` | 4.79 | 95.21% | 83.16% | 549 | 0.03s |
### Cloud Services (11)

  - `gemini/gemini-3.1-pro-preview`
  - `anthropic/claude-opus-4-7`
  - `kimi/kimi-k2.6`
  - `glm/glm-ocr`
  - `anthropic/claude-sonnet-4-6`
  - `mistral/mistral-ocr-2512`
  - `openai/gpt-5.4`
  - `anthropic/claude-haiku-4-5`
  - `openai/gpt-5.4-mini`
  - `openai/gpt-5.4-nano`
  - `gemini/gemini-3.1-flash-lite-preview`

| Rank | Provider | Score / 100 | WER | CER | Token Est. | Processing Time | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `gemini/gemini-3.1-pro-preview` | 97.92 | 2.08% | 1.04% | 2303 | 115.64s | n/a |
| 2 | `anthropic/claude-opus-4-7` | 95.17 | 4.83% | 3.40% | 2305 | 115.05s | n/a |
| 3 | `kimi/kimi-k2.6` | 94.03 | 5.97% | 1.37% | 2358 | 96.36s | n/a |
| 4 | `glm/glm-ocr` | 82.84 | 17.16% | 15.33% | 2342 | 6.64s | n/a |
| 5 | `anthropic/claude-sonnet-4-6` | 61.44 | 38.56% | 30.17% | 2005 | 88.40s | n/a |
| 6 | `mistral/mistral-ocr-2512` | 47.08 | 52.92% | 41.86% | 1749 | 8.76s | n/a |
| 7 | `openai/gpt-5.4` | 46.57 | 53.43% | 40.90% | 1745 | 62.63s | n/a |
| 8 | `anthropic/claude-haiku-4-5` | 26.10 | 73.90% | 59.42% | 1746 | 39.22s | n/a |
| 9 | `openai/gpt-5.4-mini` | 14.32 | 85.68% | 84.58% | 383 | 8.08s | n/a |
| 10 | `openai/gpt-5.4-nano` | 11.99 | 88.01% | 85.84% | 385 | 8.39s | n/a |
| 11 | `gemini/gemini-3.1-flash-lite-preview` | 4.66 | 95.34% | 82.94% | 609 | 8.04s | n/a |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| `ocrmypdf/ocrmypdf` | 1813 | 152 | 88 | 2360 |
| `paddle-ocr/paddle-ocr` | 461 | 1775 | 11 | 2360 |
| `tesseract/tesseract` | 461 | 1775 | 11 | 2360 |
| `gemini/gemini-3.1-pro-preview` | 38 | 7 | 4 | 2360 |
| `anthropic/claude-opus-4-7` | 58 | 31 | 25 | 2360 |
| `kimi/kimi-k2.6` | 81 | 6 | 54 | 2360 |
| `glm/glm-ocr` | 62 | 156 | 187 | 2360 |
| `anthropic/claude-sonnet-4-6` | 330 | 443 | 137 | 2360 |
| `mistral/mistral-ocr-2512` | 578 | 629 | 42 | 2360 |
| `openai/gpt-5.4` | 556 | 645 | 60 | 2360 |
| `anthropic/claude-haiku-4-5` | 1048 | 640 | 56 | 2360 |
| `openai/gpt-5.4-mini` | 37 | 1977 | 8 | 2360 |
| `openai/gpt-5.4-nano` | 70 | 1987 | 20 | 2360 |
| `gemini/gemini-3.1-flash-lite-preview` | 540 | 1709 | 1 | 2360 |

## Notes

- Best local model: `ocrmypdf/ocrmypdf` scored 13.01/100.
- Best cloud service: `gemini/gemini-3.1-pro-preview` scored 97.92/100.
- Fastest local model: `tesseract/tesseract` at 0.03s.
- Fastest cloud service: `glm/glm-ocr` at 6.64s.
