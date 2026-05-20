# Benchmark Ranking Report

This report averages available benchmark rows into per-step third-party provider/model rankings and balanced combined scores.

Updated: 2026-05-20T04:20:37.560Z

## Source Summary

- Scanned `docs/benchmarks/{ocr,stt,tts,url}` for raw benchmark comparison reports.
- Reconciled `project/reports/results/index.json` with 24 listed dashboard report files.
- Used 11 docs benchmark comparison reports and 15 test-run dashboard reports.
- Skipped 9 project benchmark dashboard reports; 8 had matching docs benchmark reports and 1 was a historical project-only benchmark dashboard outside the scanned docs directories.
- Saw 1131 provider/test rows: included 664, excluded 382 local or non-third-party rows, omitted 85 failed rows, skipped 0 unsupported-category rows, and skipped 0 rows with no measurable metrics.
- Filled 26 raw price rows from sibling run estimates where raw comparison costs were zero or missing.
- Missing metrics among otherwise included rows: price 5, speed 0, quality 196 in quality-ranked steps.
- 58 provider/model rankings include raw comparison data; 84 include test-run dashboard data.

Contributed raw comparison reports:

- `docs/benchmarks/ocr/2026-05-10_04-27-00-431_document/provider-comparison-report.json`
- `docs/benchmarks/ocr/2026-05-10_04-30-51-795_document/provider-comparison-report.json`
- `docs/benchmarks/ocr/2026-05-10_04-32-20-328_document/provider-comparison-report.json`
- `docs/benchmarks/ocr/2026-05-18_07-37-14-374_document/provider-comparison-report.json`
- `docs/benchmarks/ocr/2026-05-18_08-51-00-874_document/provider-comparison-report.json`
- `docs/benchmarks/stt/2026-05-10_23-04-51-843_1-audio/reference-comparison-report.json`
- `docs/benchmarks/stt/2026-05-11_03-22-16-476_2022-09-30-widgets-fsjam-40-minutes/reference-comparison-report.json`
- `docs/benchmarks/stt/2026-05-11_05-05-10-260_2023-04-05-jsjam-react-miami-2023-10-minutes/reference-comparison-report.json`
- `docs/benchmarks/tts/2026-05-17_03-58-13-084_tts-long/provider-comparison-report.json`
- `docs/benchmarks/url/2026-05-13_21-18-14-082_anthony-campolos-home-page/provider-comparison-report.json`
- `docs/benchmarks/url/2026-05-13_22-06-36-105_autogenerate-show-notes-with-whisper-cpp-llama-cpp-and-node-js/provider-comparison-report.json`

Contributed test-run dashboard reports:

- `project/reports/results/2026-05-14_21-48-10_test-run-dashboard-report.json`
- `project/reports/results/2026-05-14_21-48-16_test-run-dashboard-report.json`
- `project/reports/results/2026-05-14_21-48-21_test-run-dashboard-report.json`
- `project/reports/results/2026-05-14_21-48-27_test-run-dashboard-report.json`
- `project/reports/results/2026-05-14_21-58-41_test-run-dashboard-report.json`
- `project/reports/results/2026-05-14_21-58-42_test-run-dashboard-report.json`
- `project/reports/results/2026-05-14_21-58-44_test-run-dashboard-report.json`
- `project/reports/results/2026-05-15_03-34-24_test-run-dashboard-report.json`
- `project/reports/results/2026-05-15_03-35-28_test-run-dashboard-report.json`
- `project/reports/results/2026-05-15_23-51-07_test-run-dashboard-report.json`
- `project/reports/results/2026-05-18_13-48-05_test-run-dashboard-report.json`
- `project/reports/results/2026-05-18_14-24-33_test-run-dashboard-report.json`
- `project/reports/results/2026-05-19_00-03-03_test-run-dashboard-report.json`

## Step 1 Download

No measurable third-party download rows were present in the reconciled benchmark inputs.

## Step 2 Document OCR

### Top 6 Picks

| Bucket | Provider/model | Metric | Price rank | Speed rank | Quality rank | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Fastest | mistral/mistral-ocr-2512 | 3.517 average seconds | 6 | 1 | 6 | 1 | 17 | Fastest: lowest processing time |
| Fastest | gemini/gemini-3.1-flash-lite-preview | 4.686 average seconds | 4 | 2 | 7 | 2 | 17 | Fastest: lowest processing time |
| Cheapest | unstructured/hi_res_and_enrichment | $0.000000 average cost | 1 | 13 | 14 | 1 | 5 | Cheapest: lowest cost |
| Cheapest | glm/glm-ocr | $0.000308 average cost | 2 | 6 | 4 | 2 | 9 | Cheapest: lowest cost |
| Best | gemini/gemini-3.1-pro-preview | 97.29 WER accuracy score | 13 | 12 | 1 | 1 | 5 | Best: highest quality score |
| Best | kimi/kimi-k2.6 | 96.68 WER accuracy score | 11 | 7 | 2 | 2 | 5 | Best: highest quality score |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | unstructured/hi_res_and_enrichment | 0.000000 | 5 |
| 2 | glm/glm-ocr | 0.000308 | 9 |
| 3 | openai/gpt-5.4-nano | 0.001466 | 17 |
| 4 | gemini/gemini-3.1-flash-lite-preview | 0.001748 | 17 |
| 5 | deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct | 0.002794 | 16 |
| 6 | mistral/mistral-ocr-2512 | 0.003882 | 17 |
| 7 | aws-textract/detect-text | 0.006300 | 5 |
| 8 | gcloud-docai/ocr | 0.006300 | 5 |
| 9 | deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct | 0.008954 | 5 |
| 10 | anthropic/claude-haiku-4-5 | 0.009273 | 16 |
| 11 | kimi/kimi-k2.6 | 0.010689 | 17 |
| 12 | openai/gpt-5.4-mini | 0.013760 | 5 |
| 13 | gemini/gemini-3.1-pro-preview | 0.037384 | 5 |
| 14 | openai/gpt-5.4 | 0.051517 | 5 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | mistral/mistral-ocr-2512 | 3.517 | 17 |
| 2 | gemini/gemini-3.1-flash-lite-preview | 4.686 | 17 |
| 3 | aws-textract/detect-text | 12.158 | 5 |
| 4 | openai/gpt-5.4-nano | 12.279 | 17 |
| 5 | anthropic/claude-haiku-4-5 | 15.435 | 16 |
| 6 | glm/glm-ocr | 23.955 | 9 |
| 7 | kimi/kimi-k2.6 | 27.786 | 17 |
| 8 | openai/gpt-5.4 | 38.377 | 5 |
| 9 | gcloud-docai/ocr | 38.405 | 5 |
| 10 | deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct | 45.377 | 16 |
| 11 | openai/gpt-5.4-mini | 52.892 | 5 |
| 12 | gemini/gemini-3.1-pro-preview | 75.604 | 5 |
| 13 | unstructured/hi_res_and_enrichment | 80.429 | 5 |
| 14 | deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct | 86.899 | 5 |

### Quality

| Rank | Provider/model | Average quality score | Quality samples | Metric |
| ---: | --- | ---: | ---: | --- |
| 1 | gemini/gemini-3.1-pro-preview | 97.29 | 5 | WER accuracy score |
| 2 | kimi/kimi-k2.6 | 96.68 | 5 | WER accuracy score |
| 3 | deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct | 89.61 | 5 | WER accuracy score |
| 4 | glm/glm-ocr | 88.15 | 5 | WER accuracy score |
| 5 | openai/gpt-5.4 | 86.59 | 5 | WER accuracy score |
| 6 | mistral/mistral-ocr-2512 | 85.04 | 5 | WER accuracy score |
| 7 | gemini/gemini-3.1-flash-lite-preview | 80.90 | 5 | WER accuracy score |
| 8 | openai/gpt-5.4-mini | 78.76 | 5 | WER accuracy score |
| 9 | deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct | 72.33 | 5 | WER accuracy score |
| 10 | anthropic/claude-haiku-4-5 | 71.85 | 4 | WER accuracy score |
| 11 | gcloud-docai/ocr | 70.99 | 5 | WER accuracy score |
| 12 | aws-textract/detect-text | 68.30 | 5 | WER accuracy score |
| 13 | openai/gpt-5.4-nano | 62.91 | 5 | WER accuracy score |
| 14 | unstructured/hi_res_and_enrichment | 22.90 | 5 | WER accuracy score |

### Combined Ranking

| Rank | Provider/model | Combined score | Model release date | Price score | Speed score | Quality score | Price rank | Speed rank | Quality rank |
| ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | mistral/mistral-ocr-2512 | 90.64 | [2025-12-18](https://docs.mistral.ai/resources/changelogs) | 92.46 | 100.00 | 85.04 | 6 | 1 | 6 |
| 2 | gemini/gemini-3.1-flash-lite-preview | 89.25 | [2026-03-03](https://ai.google.dev/gemini-api/docs/models/gemini) | 96.61 | 98.60 | 80.90 | 4 | 2 | 7 |
| 3 | glm/glm-ocr | 87.80 | [2026-03-11](https://arxiv.org/abs/2603.10910) | 99.40 | 75.49 | 88.15 | 2 | 6 | 4 |
| 4 | kimi/kimi-k2.6 | 85.88 | [2026-04-21](https://platform.moonshot.ai/docs/guide/use-kimi-k2.6) | 79.25 | 70.89 | 96.68 | 11 | 7 | 2 |
| 5 | aws-textract/detect-text | 78.50 | [2019-05-29](https://aws.amazon.com/blogs/aws/amazon-textract-now-generally-available/) | 87.77 | 89.64 | 68.30 | 7 | 3 | 12 |
| 6 | openai/gpt-5.4-nano | 78.12 | [2026-03-17](https://openai.com/index/introducing-gpt-5-4-mini-and-nano/) | 97.16 | 89.49 | 62.91 | 3 | 4 | 13 |
| 7 | anthropic/claude-haiku-4-5 | 77.85 | [2025-10-15](https://www.anthropic.com/news/claude-haiku-4-5) | 82.00 | 85.71 | 71.85 | 10 | 5 | 10 |
| 8 | deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct | 72.26 | [2025-10-04](https://huggingface.co/Qwen/Qwen3-VL-30B-A3B-Instruct) | 94.58 | 49.80 | 72.33 | 5 | 10 | 9 |
| 9 | gcloud-docai/ocr | 71.98 | [2020-11-18](https://cloud.google.com/blog/products/ai-machine-learning/google-cloud-announces-document-ai-platform) | 87.77 | 58.16 | 70.99 | 8 | 9 | 11 |
| 10 | openai/gpt-5.4-mini | 67.90 | [2026-03-17](https://openai.com/index/introducing-gpt-5-4-mini-and-nano/) | 73.29 | 40.78 | 78.76 | 12 | 11 | 8 |
| 11 | deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct | 65.46 | [2025-09-23](https://huggingface.co/Qwen/Qwen3-VL-235B-A22B-Instruct) | 82.62 | 0.00 | 89.61 | 9 | 14 | 3 |
| 12 | gemini/gemini-3.1-pro-preview | 58.89 | [2026-02-19](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-pro) | 27.44 | 13.55 | 97.29 | 13 | 12 | 1 |
| 13 | openai/gpt-5.4 | 57.84 | [2026-03-05](https://openai.com/index/introducing-gpt-5-4/) | 0.00 | 58.19 | 86.59 | 14 | 8 | 5 |
| 14 | unstructured/hi_res_and_enrichment | 38.39 | [2023-07-01](https://docs.unstructured.io/api-reference/workflow/models) | 100.00 | 7.76 | 22.90 | 1 | 13 | 14 |

## Step 2 URL Extraction

### Top 6 Picks

| Bucket | Provider/model | Metric | Price rank | Speed rank | Quality rank | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Cheapest | zyte/zyte | $0.001600 average cost | 3 | 4 | 4 | 3 | 2 | Cheapest: lowest cost |
| Cheapest | glm-reader/glm-reader | $0.010000 average cost | 4 | 3 | 3 | 4 | 4 | Cheapest: lowest cost |
| Best | firecrawl/firecrawl | 98.06 URL extraction accuracy score | 1 | 1 | 1 | 1 | 2 | Best: highest quality score |
| Best | spider/spider | 96.86 URL extraction accuracy score | 2 | 2 | 2 | 2 | 2 | Best: highest quality score |

Only 4 picks are shown because only 4 unique provider/models had eligible ranking rows for this step.

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | firecrawl/firecrawl | 0.000830 | 9 |
| 2 | spider/spider | 0.001200 | 2 |
| 3 | zyte/zyte | 0.001600 | 2 |
| 4 | glm-reader/glm-reader | 0.010000 | 4 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | firecrawl/firecrawl | 1.112 | 9 |
| 2 | spider/spider | 1.810 | 2 |
| 3 | glm-reader/glm-reader | 2.054 | 8 |
| 4 | zyte/zyte | 12.229 | 2 |

### Quality

| Rank | Provider/model | Average quality score | Quality samples | Metric |
| ---: | --- | ---: | ---: | --- |
| 1 | firecrawl/firecrawl | 98.06 | 2 | URL extraction accuracy score |
| 2 | spider/spider | 96.86 | 2 | URL extraction accuracy score |
| 3 | glm-reader/glm-reader | 65.70 | 2 | URL extraction accuracy score |
| 4 | zyte/zyte | 57.04 | 2 | URL extraction accuracy score |

### Combined Ranking

| Rank | Provider/model | Combined score | Model release date | Price score | Speed score | Quality score | Price rank | Speed rank | Quality rank |
| ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | firecrawl/firecrawl | 99.03 | [2024-04-17](https://www.firecrawl.dev/) | 100.00 | 100.00 | 98.06 | 1 | 1 | 1 |
| 2 | spider/spider | 95.85 | [2024-09-10](https://spider.cloud/) | 95.97 | 93.73 | 96.86 | 2 | 2 | 2 |
| 3 | glm-reader/glm-reader | 55.73 | [2025-11-04](https://docs.z.ai/) | 0.00 | 91.52 | 65.70 | 4 | 3 | 3 |
| 4 | zyte/zyte | 51.42 | [2021-10-05](https://www.zyte.com/zyte-api/) | 91.60 | 0.00 | 57.04 | 3 | 4 | 4 |

## Step 2 Transcription/STT

### Diarization Models

#### Top 6 Picks

| Bucket | Provider/model | Metric | Price rank | Speed rank | Quality rank | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Fastest | deepgram/nova-3 | 2.490 average seconds | 9 | 1 | 11 | 1 | 9 | Fastest: lowest processing time |
| Fastest | speechmatics/standard | 17.791 average seconds | 8 | 5 | 5 | 5 | 9 | Fastest: lowest processing time |
| Cheapest | grok/speech-to-text | $0.003519 average cost | 1 | 2 | 13 | 1 | 8 | Cheapest: lowest cost |
| Cheapest | soniox/stt-async-v4 | $0.010607 average cost | 2 | 7 | 7 | 2 | 9 | Cheapest: lowest cost |
| Best | assemblyai/universal-3-pro | 96.72 speaker-aware WER score | 7 | 4 | 1 | 1 | 3 | Best: highest quality score |
| Best | mistral/voxtral-mini-2602 | 95.85 speaker-aware WER score | 5 | 3 | 2 | 2 | 3 | Best: highest quality score |

#### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | grok/speech-to-text | 0.003519 | 8 |
| 2 | soniox/stt-async-v4 | 0.010607 | 9 |
| 3 | rev/low_cost | 0.010611 | 9 |
| 4 | elevenlabs/scribe_v2 | 0.015443 | 15 |
| 5 | mistral/voxtral-mini-2602 | 0.019092 | 9 |
| 6 | rev/machine | 0.021222 | 9 |
| 7 | assemblyai/universal-3-pro | 0.022274 | 9 |
| 8 | speechmatics/standard | 0.047731 | 9 |
| 9 | deepgram/nova-3 | 0.061732 | 9 |
| 10 | gladia/default | 0.092054 | 6 |
| 11 | speechmatics/enhanced | 0.113181 | 6 |
| 12 | gcloud/chirp_3 | 0.144872 | 6 |
| 13 | aws/standard | 0.217400 | 6 |
| 14 | happyscribe/auto | 0.234153 | 3 |

#### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | deepgram/nova-3 | 2.490 | 9 |
| 2 | grok/speech-to-text | 4.515 | 9 |
| 3 | mistral/voxtral-mini-2602 | 9.441 | 9 |
| 4 | assemblyai/universal-3-pro | 12.750 | 9 |
| 5 | speechmatics/standard | 17.791 | 9 |
| 6 | elevenlabs/scribe_v2 | 18.454 | 15 |
| 7 | soniox/stt-async-v4 | 21.080 | 9 |
| 8 | gladia/default | 25.580 | 6 |
| 9 | rev/machine | 35.323 | 9 |
| 10 | speechmatics/enhanced | 35.651 | 6 |
| 11 | rev/low_cost | 54.512 | 9 |
| 12 | aws/standard | 58.399 | 6 |
| 13 | happyscribe/auto | 78.429 | 3 |
| 14 | gcloud/chirp_3 | 148.011 | 6 |

#### Quality

| Rank | Provider/model | Average quality score | Quality samples | Metric |
| ---: | --- | ---: | ---: | --- |
| 1 | assemblyai/universal-3-pro | 96.72 | 3 | speaker-aware WER score |
| 2 | mistral/voxtral-mini-2602 | 95.85 | 3 | speaker-aware WER score |
| 3 | speechmatics/enhanced | 95.40 | 3 | speaker-aware WER score |
| 4 | gladia/default | 95.22 | 3 | speaker-aware WER score |
| 5 | speechmatics/standard | 94.32 | 3 | speaker-aware WER score |
| 6 | gcloud/chirp_3 | 94.06 | 3 | speaker-aware WER score |
| 7 | soniox/stt-async-v4 | 93.87 | 3 | speaker-aware WER score |
| 8 | elevenlabs/scribe_v2 | 92.70 | 3 | speaker-aware WER score |
| 9 | aws/standard | 92.17 | 3 | speaker-aware WER score |
| 10 | rev/machine | 92.06 | 3 | speaker-aware WER score |
| 11 | deepgram/nova-3 | 91.69 | 3 | speaker-aware WER score |
| 12 | rev/low_cost | 91.66 | 3 | speaker-aware WER score |
| 13 | grok/speech-to-text | 88.06 | 3 | speaker-aware WER score |
| 14 | happyscribe/auto | 78.00 | 3 | speaker-aware WER score |

#### Combined Ranking

| Rank | Provider/model | Combined score | Model release date | Price score | Speed score | Quality score | Price rank | Speed rank | Quality rank |
| ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | mistral/voxtral-mini-2602 | 95.04 | [2026-02-01](https://docs.mistral.ai/capabilities/audio/) | 93.25 | 95.22 | 95.85 | 5 | 3 | 2 |
| 2 | assemblyai/universal-3-pro | 94.56 | [2026-02-03](https://www.assemblyai.com/blog/introducing-universal-3-pro) | 91.87 | 92.95 | 96.72 | 7 | 4 | 1 |
| 3 | grok/speech-to-text | 93.68 | [2026-03-16](https://docs.x.ai/docs/guides/audio) | 100.00 | 98.61 | 88.06 | 1 | 2 | 13 |
| 4 | soniox/stt-async-v4 | 92.97 | [2025-11-15](https://soniox.com/docs/) | 96.93 | 87.23 | 93.87 | 2 | 7 | 7 |
| 5 | elevenlabs/scribe_v2 | 92.32 | [2026-01-09](https://elevenlabs.io/blog/introducing-scribe-v2/) | 94.83 | 89.03 | 92.70 | 4 | 6 | 8 |
| 6 | speechmatics/standard | 89.74 | [2020-09-15](https://docs.speechmatics.com/) | 80.83 | 89.49 | 94.32 | 8 | 5 | 5 |
| 7 | deepgram/nova-3 | 89.53 | [2025-02-12](https://deepgram.com/changelog/introducing-nova-3) | 74.76 | 100.00 | 91.69 | 9 | 1 | 11 |
| 8 | rev/machine | 88.47 | [2018-02-28](https://www.rev.com/api) | 92.32 | 77.44 | 92.06 | 6 | 9 | 10 |
| 9 | rev/low_cost | 86.12 | [2018-02-28](https://www.rev.com/api) | 96.93 | 64.25 | 91.66 | 3 | 11 | 12 |
| 10 | gladia/default | 84.05 | [2023-04-25](https://docs.gladia.io/) | 61.61 | 84.13 | 95.22 | 10 | 8 | 4 |
| 11 | speechmatics/enhanced | 80.12 | [2020-09-15](https://docs.speechmatics.com/) | 52.45 | 77.21 | 95.40 | 11 | 10 | 3 |
| 12 | aws/standard | 63.30 | [2018-04-04](https://aws.amazon.com/blogs/aws/amazon-transcribe-now-generally-available/) | 7.26 | 61.58 | 92.17 | 13 | 12 | 9 |
| 13 | gcloud/chirp_3 | 56.71 | [2025-03-17](https://cloud.google.com/speech-to-text/docs/models/chirp-3) | 38.71 | 0.00 | 94.06 | 12 | 14 | 6 |
| 14 | happyscribe/auto | 50.95 | [2020-05-01](https://www.happyscribe.com/api) | 0.00 | 47.82 | 78.00 | 14 | 13 | 14 |

### Non-Diarization Models

#### Top 6 Picks

| Bucket | Provider/model | Metric | Price rank | Speed rank | Quality rank | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Fastest | supadata/generate | 1.772 average seconds | 6 | 1 | 7 | 1 | 1 | Fastest: lowest processing time |
| Fastest | together/openai/whisper-large-v3 | 5.025 average seconds | 8 | 2 | 6 | 2 | 3 | Fastest: lowest processing time |
| Cheapest | deepinfra/openai/whisper-large-v3-turbo | $0.001273 average cost | 1 | 6 | 3 | 1 | 9 | Cheapest: lowest cost |
| Cheapest | deepinfra/openai/whisper-large-v3 | $0.002864 average cost | 2 | 8 | 4 | 2 | 9 | Cheapest: lowest cost |
| Best | supadata/auto | 94.46 speaker-aware WER score | 13 | 7 | 1 | 1 | 3 | Best: highest quality score |
| Best | groq/whisper-large-v3 | 94.32 speaker-aware WER score | 5 | 3 | 2 | 2 | 3 | Best: highest quality score |

#### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | deepinfra/openai/whisper-large-v3-turbo | 0.001273 | 9 |
| 2 | deepinfra/openai/whisper-large-v3 | 0.002864 | 9 |
| 3 | groq/whisper-large-v3-turbo | 0.004243 | 9 |
| 4 | deapi/WhisperLargeV3 | 0.009427 | 15 |
| 5 | groq/whisper-large-v3 | 0.011774 | 9 |
| 6 | supadata/generate | 0.020000 | 1 |
| 7 | supadata/native | 0.020000 | 1 |
| 8 | together/openai/whisper-large-v3 | 0.025689 | 3 |
| 9 | gemini-stt/gemini-3-flash-preview | 0.032881 | 3 |
| 10 | glm-stt/glm-asr-2512 | 0.041102 | 3 |
| 11 | openai-stt/gpt-4o-mini-transcribe | 0.051377 | 3 |
| 12 | openai-stt/gpt-4o-transcribe | 0.102754 | 3 |
| 13 | supadata/auto | 0.342560 | 3 |

#### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | supadata/generate | 1.772 | 1 |
| 2 | together/openai/whisper-large-v3 | 5.025 | 3 |
| 3 | groq/whisper-large-v3 | 5.082 | 9 |
| 4 | supadata/native | 5.118 | 1 |
| 5 | groq/whisper-large-v3-turbo | 5.757 | 9 |
| 6 | deepinfra/openai/whisper-large-v3-turbo | 5.891 | 9 |
| 7 | supadata/auto | 6.174 | 3 |
| 8 | deepinfra/openai/whisper-large-v3 | 11.485 | 9 |
| 9 | deapi/WhisperLargeV3 | 20.975 | 15 |
| 10 | openai-stt/gpt-4o-mini-transcribe | 26.599 | 3 |
| 11 | openai-stt/gpt-4o-transcribe | 45.093 | 3 |
| 12 | glm-stt/glm-asr-2512 | 75.337 | 3 |
| 13 | gemini-stt/gemini-3-flash-preview | 120.498 | 3 |

#### Quality

| Rank | Provider/model | Average quality score | Quality samples | Metric |
| ---: | --- | ---: | ---: | --- |
| 1 | supadata/auto | 94.46 | 3 | speaker-aware WER score |
| 2 | groq/whisper-large-v3 | 94.32 | 3 | speaker-aware WER score |
| 3 | deepinfra/openai/whisper-large-v3-turbo | 94.07 | 3 | speaker-aware WER score |
| 4 | deepinfra/openai/whisper-large-v3 | 94.04 | 3 | speaker-aware WER score |
| 5 | groq/whisper-large-v3-turbo | 93.97 | 3 | speaker-aware WER score |
| 6 | together/openai/whisper-large-v3 | 93.46 | 3 | speaker-aware WER score |
| 7 | supadata/generate | 92.34 | 1 | speaker-aware WER score |
| 8 | supadata/native | 92.34 | 1 | speaker-aware WER score |
| 9 | glm-stt/glm-asr-2512 | 91.90 | 3 | speaker-aware WER score |
| 10 | openai-stt/gpt-4o-transcribe | 91.32 | 3 | speaker-aware WER score |
| 11 | openai-stt/gpt-4o-mini-transcribe | 90.38 | 3 | speaker-aware WER score |
| 12 | gemini-stt/gemini-3-flash-preview | 84.11 | 3 | speaker-aware WER score |
| 13 | deapi/WhisperLargeV3 | 78.72 | 3 | speaker-aware WER score |

#### Combined Ranking

| Rank | Provider/model | Combined score | Model release date | Price score | Speed score | Quality score | Price rank | Speed rank | Quality rank |
| ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | deepinfra/openai/whisper-large-v3-turbo | 96.17 | [2024-10-09](https://groq.com/whisper-large-v3-turbo-now-available-on-groq-combining-speed-quality-for-speech-recognition) | 100.00 | 96.53 | 94.07 | 1 | 6 | 3 |
| 2 | groq/whisper-large-v3-turbo | 95.93 | [2024-10-09](https://groq.com/whisper-large-v3-turbo-now-available-on-groq-combining-speed-quality-for-speech-recognition) | 99.13 | 96.64 | 93.97 | 3 | 5 | 5 |
| 3 | groq/whisper-large-v3 | 95.69 | [2023-11-06](https://github.com/openai/whisper) | 96.92 | 97.21 | 94.32 | 5 | 3 | 2 |
| 4 | deepinfra/openai/whisper-large-v3 | 94.86 | [2023-11-06](https://github.com/openai/whisper) | 99.53 | 91.82 | 94.04 | 2 | 8 | 4 |
| 5 | supadata/generate | 94.80 | [2024-11-01](https://supadata.ai/) | 94.51 | 100.00 | 92.34 | 6 | 1 | 7 |
| 6 | together/openai/whisper-large-v3 | 94.25 | [2023-11-06](https://github.com/openai/whisper) | 92.85 | 97.26 | 93.46 | 8 | 2 | 6 |
| 7 | supadata/native | 94.09 | [2024-11-01](https://supadata.ai/) | 94.51 | 97.18 | 92.34 | 7 | 4 | 8 |
| 8 | openai-stt/gpt-4o-mini-transcribe | 86.29 | [2025-03-20](https://openai.com/index/introducing-our-next-generation-audio-models/) | 85.32 | 79.09 | 90.38 | 11 | 10 | 11 |
| 9 | deapi/WhisperLargeV3 | 84.72 | [2023-11-06](https://github.com/openai/whisper) | 97.61 | 83.83 | 78.72 | 4 | 9 | 13 |
| 10 | openai-stt/gpt-4o-transcribe | 79.11 | [2025-03-20](https://openai.com/index/introducing-our-next-generation-audio-models/) | 70.27 | 63.51 | 91.32 | 12 | 11 | 10 |
| 11 | glm-stt/glm-asr-2512 | 77.54 | [2025-12-01](https://docs.z.ai/) | 88.33 | 38.04 | 91.90 | 10 | 12 | 9 |
| 12 | supadata/auto | 71.30 | [2024-11-01](https://supadata.ai/) | 0.00 | 96.29 | 94.46 | 13 | 7 | 1 |
| 13 | gemini-stt/gemini-3-flash-preview | 64.74 | [2025-12-11](https://ai.google.dev/gemini-api/docs/models/gemini) | 90.74 | 0.00 | 84.11 | 9 | 13 | 12 |

## Step 3 Write/LLM

### Top 6 Picks

| Bucket | Provider/model | Metric | Price rank | Speed rank | Quality rank | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Fastest | openai/gpt-5.4-mini | 1.237 average seconds | 3 | 2 | n/a | 2 | 7 | Fastest: lowest processing time |
| Fastest | openai/gpt-5.4 | 1.879 average seconds | 8 | 3 | n/a | 3 | 8 | Fastest: lowest processing time |
| Cheapest | groq/openai/gpt-oss-20b | $0.000122 average cost | 1 | 1 | n/a | 1 | 9 | Cheapest: lowest cost |
| Cheapest | minimax/MiniMax-M2.5-highspeed | $0.000275 average cost | 2 | 13 | n/a | 2 | 7 | Cheapest: lowest cost |
| Best | openai/gpt-5.4-pro | $0.013215 average cost | 15 | 15 | n/a | 15 | 4 | Best proxy: highest cost |
| Best | anthropic/claude-haiku-4-5 | $0.002435 average cost | 14 | 9 | n/a | 14 | 4 | Best proxy: highest cost |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | groq/openai/gpt-oss-20b | 0.000122 | 9 |
| 2 | minimax/MiniMax-M2.5-highspeed | 0.000275 | 7 |
| 3 | openai/gpt-5.4-mini | 0.000328 | 7 |
| 4 | minimax/MiniMax-M2.5 | 0.000610 | 7 |
| 5 | gemini/gemini-3.1-flash-lite-preview | 0.000680 | 7 |
| 6 | openai/gpt-5.4-nano | 0.000700 | 7 |
| 7 | gemini/gemini-3.1-pro-preview | 0.000947 | 7 |
| 8 | openai/gpt-5.4 | 0.001111 | 8 |
| 9 | anthropic/claude-sonnet-4-6 | 0.001320 | 7 |
| 10 | kimi/kimi-k2.6 | 0.002083 | 4 |
| 11 | anthropic/claude-opus-4-6 | 0.002175 | 7 |
| 12 | anthropic/claude-opus-4-7 | 0.002204 | 7 |
| 13 | glm/glm-5.1 | 0.002418 | 3 |
| 14 | anthropic/claude-haiku-4-5 | 0.002435 | 4 |
| 15 | openai/gpt-5.4-pro | 0.013215 | 4 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | groq/openai/gpt-oss-20b | 0.994 | 9 |
| 2 | openai/gpt-5.4-mini | 1.237 | 7 |
| 3 | openai/gpt-5.4 | 1.879 | 8 |
| 4 | anthropic/claude-opus-4-6 | 2.509 | 7 |
| 5 | gemini/gemini-3.1-flash-lite-preview | 2.529 | 7 |
| 6 | anthropic/claude-sonnet-4-6 | 2.853 | 7 |
| 7 | anthropic/claude-opus-4-7 | 3.828 | 7 |
| 8 | openai/gpt-5.4-nano | 5.502 | 7 |
| 9 | anthropic/claude-haiku-4-5 | 6.495 | 4 |
| 10 | gemini/gemini-3.1-pro-preview | 8.270 | 7 |
| 11 | kimi/kimi-k2.6 | 11.178 | 4 |
| 12 | glm/glm-5.1 | 13.886 | 3 |
| 13 | minimax/MiniMax-M2.5-highspeed | 14.349 | 7 |
| 14 | minimax/MiniMax-M2.5 | 21.724 | 7 |
| 15 | openai/gpt-5.4-pro | 66.625 | 4 |

Quality: No pure LLM quality metric is present in these benchmark files.

### Combined Ranking

| Rank | Provider/model | Combined score | Model release date | Price score | Speed score | Quality score | Price rank | Speed rank | Quality rank |
| ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | groq/openai/gpt-oss-20b | 100.00 | [2025-08-05](https://openai.com/index/introducing-gpt-oss) | 100.00 | 100.00 | n/a | 1 | 1 | n/a |
| 2 | openai/gpt-5.4-mini | 99.03 | [2026-03-17](https://openai.com/index/introducing-gpt-5-4-mini-and-nano/) | 98.42 | 99.63 | n/a | 3 | 2 | n/a |
| 3 | gemini/gemini-3.1-flash-lite-preview | 96.70 | [2026-03-03](https://ai.google.dev/gemini-api/docs/models/gemini) | 95.74 | 97.66 | n/a | 5 | 5 | n/a |
| 4 | openai/gpt-5.4 | 95.55 | [2026-03-05](https://openai.com/index/introducing-gpt-5-4/) | 92.45 | 98.65 | n/a | 8 | 3 | n/a |
| 5 | openai/gpt-5.4-nano | 94.36 | [2026-03-17](https://openai.com/index/introducing-gpt-5-4-mini-and-nano/) | 95.58 | 93.13 | n/a | 6 | 8 | n/a |
| 6 | anthropic/claude-sonnet-4-6 | 94.01 | [2026-02-17](https://www.anthropic.com/news/claude-sonnet-4-6) | 90.85 | 97.17 | n/a | 9 | 6 | n/a |
| 7 | gemini/gemini-3.1-pro-preview | 91.30 | [2026-02-19](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-pro) | 93.70 | 88.91 | n/a | 7 | 10 | n/a |
| 8 | anthropic/claude-opus-4-6 | 91.01 | [2026-02-05](https://www.anthropic.com/claude/opus) | 84.32 | 97.69 | n/a | 11 | 4 | n/a |
| 9 | anthropic/claude-opus-4-7 | 89.89 | [2026-04-16](https://www.anthropic.com/news/claude-opus-4-7) | 84.10 | 95.68 | n/a | 12 | 7 | n/a |
| 10 | minimax/MiniMax-M2.5-highspeed | 89.24 | [2026-02-12](https://www.minimax.io/news/minimax-m25) | 98.83 | 79.65 | n/a | 2 | 13 | n/a |
| 11 | anthropic/claude-haiku-4-5 | 86.98 | [2025-10-15](https://www.anthropic.com/news/claude-haiku-4-5) | 82.33 | 91.62 | n/a | 14 | 9 | n/a |
| 12 | kimi/kimi-k2.6 | 84.75 | [2026-04-21](https://platform.moonshot.ai/docs/guide/use-kimi-k2.6) | 85.02 | 84.48 | n/a | 10 | 11 | n/a |
| 13 | minimax/MiniMax-M2.5 | 82.34 | [2026-02-12](https://www.minimax.io/news/minimax-m25) | 96.27 | 68.41 | n/a | 4 | 14 | n/a |
| 14 | glm/glm-5.1 | 81.41 | [2026-04-07](https://docs.z.ai/release-notes/new-released) | 82.47 | 80.36 | n/a | 13 | 12 | n/a |
| 15 | openai/gpt-5.4-pro | 0.00 | [2026-03-05](https://openai.com/index/introducing-gpt-5-4/) | 0.00 | 0.00 | n/a | 15 | 15 | n/a |

## Step 4 TTS

### Top 6 Picks

| Bucket | Provider/model | Metric | Price rank | Speed rank | Quality rank | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Fastest | elevenlabs/eleven_turbo_v2_5 | 0.679 average seconds | 15 | 1 | n/a | 1 | 4 | Fastest: lowest processing time |
| Fastest | elevenlabs/eleven_flash_v2_5 | 0.780 average seconds | 14 | 2 | n/a | 2 | 4 | Fastest: lowest processing time |
| Cheapest | gemini/gemini-2.5-flash-preview-tts | $0.000087 average cost | 1 | 9 | n/a | 1 | 4 | Cheapest: lowest cost |
| Cheapest | deapi/Qwen3_TTS_12Hz_1_7B_Base | $0.000135 average cost | 2 | 17 | n/a | 2 | 2 | Cheapest: lowest cost |
| Best | gcloud/studio | $0.045760 average cost | 20 | 3 | n/a | 20 | 1 | Best proxy: highest cost |
| Best | runway/eleven_multilingual_v2 | $0.040000 average cost | 19 | 13 | n/a | 19 | 1 | Best proxy: highest cost |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | gemini/gemini-2.5-flash-preview-tts | 0.000087 | 4 |
| 2 | deapi/Qwen3_TTS_12Hz_1_7B_Base | 0.000135 | 2 |
| 3 | gemini/gemini-2.5-pro-preview-tts | 0.000175 | 4 |
| 4 | deapi/Chatterbox | 0.000220 | 1 |
| 5 | deapi/Kokoro | 0.000220 | 1 |
| 6 | deapi/Qwen3_TTS_12Hz_1_7B_CustomVoice | 0.000220 | 1 |
| 7 | grok/grok-tts | 0.000802 | 7 |
| 8 | mistral/voxtral-mini-tts-2603 | 0.001912 | 12 |
| 9 | openai/gpt-4o-mini-tts | 0.002217 | 25 |
| 10 | gemini/gemini-3.1-flash-tts-preview | 0.003670 | 12 |
| 11 | deepgram/aura-2-thalia-en | 0.005726 | 7 |
| 12 | groq/canopylabs/orpheus-v1-english | 0.006107 | 7 |
| 13 | gcloud/chirp3-hd | 0.008580 | 1 |
| 14 | elevenlabs/eleven_flash_v2_5 | 0.008750 | 4 |
| 15 | elevenlabs/eleven_turbo_v2_5 | 0.008750 | 4 |
| 16 | minimax/speech-2.8-turbo | 0.012165 | 4 |
| 17 | elevenlabs/eleven_v3 | 0.020275 | 4 |
| 18 | minimax/speech-2.8-hd | 0.020275 | 4 |
| 19 | runway/eleven_multilingual_v2 | 0.040000 | 1 |
| 20 | gcloud/studio | 0.045760 | 1 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | elevenlabs/eleven_turbo_v2_5 | 0.679 | 4 |
| 2 | elevenlabs/eleven_flash_v2_5 | 0.780 | 4 |
| 3 | gcloud/studio | 1.798 | 1 |
| 4 | groq/canopylabs/orpheus-v1-english | 2.630 | 7 |
| 5 | gcloud/chirp3-hd | 2.750 | 1 |
| 6 | grok/grok-tts | 3.539 | 7 |
| 7 | mistral/voxtral-mini-tts-2603 | 4.140 | 12 |
| 8 | deapi/Kokoro | 4.941 | 1 |
| 9 | gemini/gemini-2.5-flash-preview-tts | 6.116 | 4 |
| 10 | deepgram/aura-2-thalia-en | 6.275 | 7 |
| 11 | gemini/gemini-3.1-flash-tts-preview | 6.451 | 12 |
| 12 | elevenlabs/eleven_v3 | 7.839 | 4 |
| 13 | runway/eleven_multilingual_v2 | 10.972 | 1 |
| 14 | gemini/gemini-2.5-pro-preview-tts | 11.363 | 4 |
| 15 | deapi/Chatterbox | 16.030 | 1 |
| 16 | minimax/speech-2.8-turbo | 24.371 | 4 |
| 17 | deapi/Qwen3_TTS_12Hz_1_7B_Base | 29.398 | 2 |
| 18 | minimax/speech-2.8-hd | 36.210 | 4 |
| 19 | deapi/Qwen3_TTS_12Hz_1_7B_CustomVoice | 64.955 | 1 |
| 20 | openai/gpt-4o-mini-tts | 75.763 | 25 |

Quality: No TTS quality ranking is shown because roundtrip WER is null in the current raw TTS comparison and dashboard rows do not contain a pure TTS quality metric.

### Combined Ranking

| Rank | Provider/model | Combined score | Model release date | Price score | Speed score | Quality score | Price rank | Speed rank | Quality rank |
| ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | grok/grok-tts | 97.31 | [2026-03-16](https://docs.x.ai/docs/guides/audio) | 98.44 | 96.19 | n/a | 7 | 6 | n/a |
| 2 | deapi/Kokoro | 97.02 | [2024-12-14](https://huggingface.co/hexgrad/Kokoro-82M) | 99.71 | 94.32 | n/a | 5 | 8 | n/a |
| 3 | gemini/gemini-2.5-flash-preview-tts | 96.38 | [2025-05-20](https://ai.google.dev/gemini-api/docs/speech-generation) | 100.00 | 92.76 | n/a | 1 | 9 | n/a |
| 4 | mistral/voxtral-mini-tts-2603 | 95.70 | [2026-03-01](https://docs.mistral.ai/capabilities/audio/) | 96.01 | 95.39 | n/a | 8 | 7 | n/a |
| 5 | gemini/gemini-2.5-pro-preview-tts | 92.79 | [2025-05-20](https://ai.google.dev/gemini-api/docs/speech-generation) | 99.81 | 85.77 | n/a | 3 | 14 | n/a |
| 6 | gemini/gemini-3.1-flash-tts-preview | 92.24 | [2026-04-15](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-tts/) | 92.16 | 92.31 | n/a | 10 | 11 | n/a |
| 7 | groq/canopylabs/orpheus-v1-english | 92.11 | [2025-03-12](https://huggingface.co/canopylabs/orpheus-3b-0.1-ft) | 86.82 | 97.40 | n/a | 12 | 4 | n/a |
| 8 | elevenlabs/eleven_turbo_v2_5 | 90.52 | [2024-07-19](https://elevenlabs.io/blog/introducing-turbo-v25) | 81.03 | 100.00 | n/a | 15 | 1 | n/a |
| 9 | elevenlabs/eleven_flash_v2_5 | 90.45 | [2024-07-19](https://elevenlabs.io/blog/introducing-turbo-v25) | 81.03 | 99.87 | n/a | 14 | 2 | n/a |
| 10 | deepgram/aura-2-thalia-en | 90.10 | [2025-04-15](https://www.businesswire.com/news/home/20250415446781/en/Deepgram-Unveils-Aura-2-The-Worlds-Most-Professional-Cost-Effective-and-Enterprise-Grade-Text-to-Speech-Model) | 87.66 | 92.55 | n/a | 11 | 10 | n/a |
| 11 | deapi/Chatterbox | 89.63 | [2025-06-17](https://github.com/resemble-ai/chatterbox) | 99.71 | 79.56 | n/a | 4 | 15 | n/a |
| 12 | gcloud/chirp3-hd | 89.32 | [2025-03-17](https://cloud.google.com/text-to-speech/docs/chirp3-hd) | 81.41 | 97.24 | n/a | 13 | 5 | n/a |
| 13 | deapi/Qwen3_TTS_12Hz_1_7B_Base | 80.82 | [2025-06-05](https://huggingface.co/Qwen) | 99.90 | 61.75 | n/a | 2 | 17 | n/a |
| 14 | elevenlabs/eleven_v3 | 73.13 | [2026-02-02](https://elevenlabs.io/blog) | 55.80 | 90.46 | n/a | 17 | 12 | n/a |
| 15 | minimax/speech-2.8-turbo | 71.00 | [2026-01-20](https://platform.minimax.io/docs/guides/text-to-speech) | 73.56 | 68.45 | n/a | 16 | 16 | n/a |
| 16 | deapi/Qwen3_TTS_12Hz_1_7B_CustomVoice | 57.05 | [2025-06-05](https://huggingface.co/Qwen) | 99.71 | 14.39 | n/a | 6 | 19 | n/a |
| 17 | minimax/speech-2.8-hd | 54.24 | [2026-01-20](https://platform.minimax.io/docs/guides/text-to-speech) | 55.80 | 52.68 | n/a | 18 | 18 | n/a |
| 18 | runway/eleven_multilingual_v2 | 49.45 | [2023-08-22](https://elevenlabs.io/docs/models/) | 12.61 | 86.29 | n/a | 19 | 13 | n/a |
| 19 | gcloud/studio | 49.26 | [2024-02-26](https://cloud.google.com/text-to-speech/docs/release-notes) | 0.00 | 98.51 | n/a | 20 | 3 | n/a |
| 20 | openai/gpt-4o-mini-tts | 47.67 | [2025-03-20](https://openai.com/index/introducing-our-next-generation-audio-models/) | 95.34 | 0.00 | n/a | 9 | 20 | n/a |

## Step 5 Image

### Top 6 Picks

| Bucket | Provider/model | Metric | Price rank | Speed rank | Quality rank | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Fastest | grok/grok-imagine-image | 3.030 average seconds | 10 | 1 | n/a | 1 | 4 | Fastest: lowest processing time |
| Fastest | gemini/imagen-4.0-fast-generate-001 | 4.253 average seconds | 6 | 2 | n/a | 2 | 4 | Fastest: lowest processing time |
| Cheapest | deapi/Flux1schnell | $0.001360 average cost | 1 | 7 | n/a | 1 | 7 | Cheapest: lowest cost |
| Cheapest | deapi/Flux_2_Klein_4B_BF16 | $0.001860 average cost | 2 | 5 | n/a | 2 | 7 | Cheapest: lowest cost |
| Best | openai/gpt-image-1.5 | $0.080000 average cost | 15 | 14 | n/a | 15 | 4 | Best proxy: highest cost |
| Best | gemini/imagen-4.0-ultra-generate-001 | $0.060000 average cost | 14 | 4 | n/a | 14 | 4 | Best proxy: highest cost |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | deapi/Flux1schnell | 0.001360 | 7 |
| 2 | deapi/Flux_2_Klein_4B_BF16 | 0.001860 | 7 |
| 3 | minimax/image-01 | 0.003500 | 7 |
| 4 | deapi/ZImageTurbo_INT8 | 0.004050 | 7 |
| 5 | openai/gpt-image-2 | 0.005000 | 12 |
| 6 | gemini/imagen-4.0-fast-generate-001 | 0.020000 | 4 |
| 7 | openai/gpt-image-1-mini | 0.020000 | 1 |
| 8 | bfl/flux-2-pro-preview | 0.030000 | 4 |
| 9 | gemini/gemini-3-pro-image-preview | 0.030000 | 1 |
| 10 | grok/grok-imagine-image | 0.032500 | 4 |
| 11 | gemini/imagen-4.0-generate-001 | 0.040000 | 4 |
| 12 | openai/gpt-image-1 | 0.040000 | 1 |
| 13 | runway/gen4_image | 0.050000 | 4 |
| 14 | gemini/imagen-4.0-ultra-generate-001 | 0.060000 | 4 |
| 15 | openai/gpt-image-1.5 | 0.080000 | 4 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | grok/grok-imagine-image | 3.030 | 4 |
| 2 | gemini/imagen-4.0-fast-generate-001 | 4.253 | 4 |
| 3 | gemini/imagen-4.0-generate-001 | 5.675 | 4 |
| 4 | gemini/imagen-4.0-ultra-generate-001 | 8.953 | 4 |
| 5 | deapi/Flux_2_Klein_4B_BF16 | 9.732 | 7 |
| 6 | bfl/flux-2-pro-preview | 11.863 | 4 |
| 7 | deapi/Flux1schnell | 12.258 | 7 |
| 8 | gemini/gemini-3-pro-image-preview | 14.210 | 1 |
| 9 | minimax/image-01 | 14.516 | 7 |
| 10 | openai/gpt-image-1-mini | 21.644 | 1 |
| 11 | openai/gpt-image-2 | 26.422 | 12 |
| 12 | deapi/ZImageTurbo_INT8 | 29.444 | 7 |
| 13 | runway/gen4_image | 31.036 | 4 |
| 14 | openai/gpt-image-1.5 | 45.853 | 4 |
| 15 | openai/gpt-image-1 | 64.423 | 1 |

Quality: No pure image quality metric is present in these benchmark files.

### Combined Ranking

| Rank | Provider/model | Combined score | Model release date | Price score | Speed score | Quality score | Price rank | Speed rank | Quality rank |
| ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | deapi/Flux_2_Klein_4B_BF16 | 94.22 | [2025-11-25](https://docs.bfl.ml/release-notes) | 99.36 | 89.08 | n/a | 2 | 5 | n/a |
| 2 | deapi/Flux1schnell | 92.48 | [2024-08-01](https://bfl.ai/announcing-black-forest-labs) | 100.00 | 84.97 | n/a | 1 | 7 | n/a |
| 3 | minimax/image-01 | 89.28 | [2025-02-28](https://www.minimax.io/news/image-01) | 97.28 | 81.29 | n/a | 3 | 9 | n/a |
| 4 | gemini/imagen-4.0-fast-generate-001 | 87.15 | [2025-05-20](https://ai.google.dev/gemini-api/docs/imagen) | 76.30 | 98.01 | n/a | 6 | 2 | n/a |
| 5 | grok/grok-imagine-image | 80.20 | [2025-07-28](https://docs.x.ai/docs/models/grok-imagine-image) | 60.40 | 100.00 | n/a | 10 | 1 | n/a |
| 6 | openai/gpt-image-2 | 78.63 | [2026-04-21](https://openai.com/index/introducing-chatgpt-images-2-0/) | 95.37 | 61.90 | n/a | 5 | 11 | n/a |
| 7 | deapi/ZImageTurbo_INT8 | 76.78 | [2025-12-01](https://huggingface.co/collections/Z-Image/z-image-69278f79d4e04b4f51374444) | 96.58 | 56.97 | n/a | 4 | 12 | n/a |
| 8 | bfl/flux-2-pro-preview | 74.60 | [2025-11-25](https://docs.bfl.ml/release-notes) | 63.58 | 85.61 | n/a | 8 | 6 | n/a |
| 9 | gemini/imagen-4.0-generate-001 | 73.28 | [2025-05-20](https://ai.google.dev/gemini-api/docs/imagen) | 50.86 | 95.69 | n/a | 11 | 3 | n/a |
| 10 | openai/gpt-image-1-mini | 72.99 | [2025-04-23](https://openai.com/index/image-generation-api/) | 76.30 | 69.68 | n/a | 7 | 10 | n/a |
| 11 | gemini/gemini-3-pro-image-preview | 72.68 | [2026-02-19](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-pro) | 63.58 | 81.79 | n/a | 9 | 8 | n/a |
| 12 | gemini/imagen-4.0-ultra-generate-001 | 57.89 | [2025-05-20](https://ai.google.dev/gemini-api/docs/imagen) | 25.43 | 90.35 | n/a | 14 | 4 | n/a |
| 13 | runway/gen4_image | 46.27 | [2025-05-16](https://runwayml.com/news/introducing-runway-api-for-gen-4-images) | 38.15 | 54.38 | n/a | 13 | 13 | n/a |
| 14 | openai/gpt-image-1 | 25.43 | [2025-04-23](https://openai.com/index/image-generation-api/) | 50.86 | 0.00 | n/a | 12 | 15 | n/a |
| 15 | openai/gpt-image-1.5 | 15.12 | [2025-12-16](https://openai.com/index/new-chatgpt-images-is-here/) | 0.00 | 30.25 | n/a | 15 | 14 | n/a |

## Step 6 Video

### Top 6 Picks

| Bucket | Provider/model | Metric | Price rank | Speed rank | Quality rank | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Fastest | gemini/veo-3.1-lite-generate-preview | 31.487 average seconds | 4 | 2 | n/a | 2 | 3 | Fastest: lowest processing time |
| Fastest | minimax/MiniMax-Hailuo-02 | 83.901 average seconds | 5 | 5 | n/a | 5 | 3 | Fastest: lowest processing time |
| Cheapest | deapi/Ltxv_13B_0_9_8_Distilled_FP8 | $0.000868 average cost | 1 | 1 | n/a | 1 | 3 | Cheapest: lowest cost |
| Cheapest | minimax/T2V-01 | $0.190000 average cost | 2 | 8 | n/a | 2 | 3 | Cheapest: lowest cost |
| Best | gemini/veo-3.1-generate-preview | $1.600000 average cost | 8 | 4 | n/a | 8 | 3 | Best proxy: highest cost |
| Best | gemini/veo-3.1-fast-generate-preview | $0.400000 average cost | 7 | 3 | n/a | 7 | 3 | Best proxy: highest cost |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | deapi/Ltxv_13B_0_9_8_Distilled_FP8 | 0.000868 | 3 |
| 2 | minimax/T2V-01 | 0.190000 | 3 |
| 3 | minimax/T2V-01-Director | 0.190000 | 3 |
| 4 | gemini/veo-3.1-lite-generate-preview | 0.200000 | 3 |
| 5 | minimax/MiniMax-Hailuo-02 | 0.280000 | 3 |
| 6 | minimax/MiniMax-Hailuo-2.3 | 0.280000 | 3 |
| 7 | gemini/veo-3.1-fast-generate-preview | 0.400000 | 3 |
| 8 | gemini/veo-3.1-generate-preview | 1.600000 | 3 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | deapi/Ltxv_13B_0_9_8_Distilled_FP8 | 12.325 | 3 |
| 2 | gemini/veo-3.1-lite-generate-preview | 31.487 | 3 |
| 3 | gemini/veo-3.1-fast-generate-preview | 34.974 | 3 |
| 4 | gemini/veo-3.1-generate-preview | 41.593 | 3 |
| 5 | minimax/MiniMax-Hailuo-02 | 83.901 | 3 |
| 6 | minimax/MiniMax-Hailuo-2.3 | 90.412 | 3 |
| 7 | minimax/T2V-01-Director | 144.739 | 3 |
| 8 | minimax/T2V-01 | 144.772 | 3 |

Quality: No pure video quality metric is present in these benchmark files.

### Combined Ranking

| Rank | Provider/model | Combined score | Model release date | Price score | Speed score | Quality score | Price rank | Speed rank | Quality rank |
| ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | deapi/Ltxv_13B_0_9_8_Distilled_FP8 | 100.00 | [2025-07-15](https://github.com/Lightricks/LTX-Video) | 100.00 | 100.00 | n/a | 1 | 1 | n/a |
| 2 | gemini/veo-3.1-lite-generate-preview | 86.54 | [2026-03-01](https://ai.google.dev/gemini-api/docs/models/veo-3.1-lite-generate-preview) | 87.55 | 85.53 | n/a | 4 | 2 | n/a |
| 3 | gemini/veo-3.1-fast-generate-preview | 78.97 | [2026-01-14](https://ai.google.dev/gemini-api/docs/video) | 75.04 | 82.90 | n/a | 7 | 3 | n/a |
| 4 | minimax/MiniMax-Hailuo-02 | 64.25 | [2025-06-18](https://www.minimax.io/news/minimax-hailuo-02) | 82.54 | 45.96 | n/a | 5 | 5 | n/a |
| 5 | minimax/MiniMax-Hailuo-2.3 | 61.79 | [2025-10-28](https://www.minimax.io/news/minimax-hailuo-23) | 82.54 | 41.04 | n/a | 6 | 6 | n/a |
| 6 | minimax/T2V-01-Director | 44.10 | [2024-09-02](https://www.minimax.io/news/video-01) | 88.17 | 0.02 | n/a | 3 | 7 | n/a |
| 7 | minimax/T2V-01 | 44.09 | [2024-09-02](https://www.minimax.io/news/video-01) | 88.17 | 0.00 | n/a | 2 | 8 | n/a |
| 8 | gemini/veo-3.1-generate-preview | 38.95 | [2026-01-14](https://ai.google.dev/gemini-api/docs/video) | 0.00 | 77.90 | n/a | 8 | 4 | n/a |

## Step 7 Music

### Top 6 Picks

| Bucket | Provider/model | Metric | Price rank | Speed rank | Quality rank | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Cheapest | elevenlabs/music_v1 | $0.014000 average cost | 1 | 1 | n/a | 1 | 7 | Cheapest: lowest cost |
| Cheapest | gemini/lyria-3-clip-preview | $0.040000 average cost | 2 | 2 | n/a | 2 | 3 | Cheapest: lowest cost |
| Best | minimax/music-2.5 | $0.150000 average cost | 4 | 4 | n/a | 4 | 6 | Best proxy: highest cost |
| Best | gemini/lyria-3-pro-preview | $0.080000 average cost | 3 | 3 | n/a | 3 | 2 | Best proxy: highest cost |

Only 4 picks are shown because only 4 unique provider/models had eligible ranking rows for this step.

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | elevenlabs/music_v1 | 0.014000 | 7 |
| 2 | gemini/lyria-3-clip-preview | 0.040000 | 3 |
| 3 | gemini/lyria-3-pro-preview | 0.080000 | 2 |
| 4 | minimax/music-2.5 | 0.150000 | 6 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | elevenlabs/music_v1 | 6.302 | 7 |
| 2 | gemini/lyria-3-clip-preview | 9.595 | 3 |
| 3 | gemini/lyria-3-pro-preview | 32.481 | 2 |
| 4 | minimax/music-2.5 | 95.553 | 6 |

Quality: No pure music quality metric is present in these benchmark files.

### Combined Ranking

| Rank | Provider/model | Combined score | Model release date | Price score | Speed score | Quality score | Price rank | Speed rank | Quality rank |
| ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | elevenlabs/music_v1 | 100.00 | [2026-04-29](https://elevenlabs.io/blog) | 100.00 | 100.00 | n/a | 1 | 1 | n/a |
| 2 | gemini/lyria-3-clip-preview | 88.60 | [2026-02-23](https://ai.google.dev/gemini-api/docs/music-generation) | 80.88 | 96.31 | n/a | 2 | 2 | n/a |
| 3 | gemini/lyria-3-pro-preview | 61.07 | [2026-03-25](https://blog.google/innovation-and-ai/technology/ai/lyria-3-pro) | 51.47 | 70.67 | n/a | 3 | 3 | n/a |
| 4 | minimax/music-2.5 | 0.00 | [2026-02-18](https://www.minimax.io/news/minimax-music-25) | 0.00 | 0.00 | n/a | 4 | 4 | n/a |

## Footnotes

- Price averages use USD per successful measurable row. Raw comparison rows use positive actual costs first, then positive reported costs, then positive sibling `run.json` `metadata.cost.estimated.steps` estimates when raw costs are zero or missing; raw cents are converted to USD and dashboard costs already reported in USD are used as-is.
- Speed averages use actual processing time where present, converted from milliseconds to seconds.
- Quality rankings are shown only for pure quality metrics: OCR WER-derived accuracy, URL extraction accuracy, and STT speaker-aware WER scores. Dashboard smoke/e2e rows do not contain pure quality metrics and therefore contribute only price and speed.
- Combined rankings normalize lower-is-better price and speed to 0-100. Sections with quality use 50% quality, 25% speed, and 25% price; sections without quality renormalize across price and speed. Missing active metrics contribute a neutral 50 and show `n/a` for that metric rank.
- Combined ranking release dates come from the generator metadata map. Report generation fails if any ranked provider/model lacks a `YYYY-MM-DD` release date and source URL.
- STT rankings are split by diarization support using raw STT `supportsDiarization` metadata; dashboard-only STT rows use the service defaults from the benchmark ranking generator.
- Zero-cost third-party rows remain in price rankings. Local and non-third-party services are excluded, including `unknown`, `extract`, `ocrmypdf`, `paddle-ocr`, `tesseract`, `whisper`, `kitten`, `llama.cpp`, `defuddle`, and `reverb`.
- Omitted 85 failed rows. Missing metric counts are reported in the source summary and those missing values were omitted only from the affected metric average.

