# Benchmark Ranking Report

This report averages available benchmark rows into per-step third-party provider/model rankings. It intentionally does not compute a combined overall score.

Updated: 2026-05-19T04:54:17.148Z

## Source Summary

- Scanned `docs/benchmarks/{ocr,stt,tts,url}` for raw benchmark comparison reports.
- Reconciled `project/reports/results/index.json` with 23 listed dashboard report files.
- Used 11 docs benchmark comparison reports and 14 test-run dashboard reports.
- Skipped 9 project benchmark dashboard reports; 8 had matching docs benchmark reports and 1 was a historical project-only benchmark dashboard outside the scanned docs directories.
- Saw 991 provider/test rows: included 572, excluded 336 local or non-third-party rows, omitted 83 failed rows, skipped 0 unsupported-category rows, and skipped 0 rows with no measurable metrics.
- Filled 26 raw price rows from sibling run estimates where raw comparison costs were zero or missing.
- Missing metrics among otherwise included rows: price 5, speed 0, quality 160 in quality-ranked steps.
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

## Step 1 Download

No measurable third-party download rows were present in the reconciled benchmark inputs.

## Step 2 Document OCR

### Top 6 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Fastest | mistral/mistral-ocr-2512 | 3.624 average seconds | 1 | 15 | Fastest: lowest processing time |
| Fastest | gemini/gemini-3.1-flash-lite-preview | 4.925 average seconds | 2 | 15 | Fastest: lowest processing time |
| Cheapest | unstructured/hi_res_and_enrichment | $0.000000 average cost | 1 | 5 | Cheapest: lowest cost |
| Cheapest | glm/glm-ocr | $0.000376 average cost | 2 | 7 | Cheapest: lowest cost |
| Best | gemini/gemini-3.1-pro-preview | 97.29 WER accuracy score | 1 | 5 | Best: highest quality score |
| Best | kimi/kimi-k2.6 | 96.68 WER accuracy score | 2 | 5 | Best: highest quality score |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | unstructured/hi_res_and_enrichment | 0.000000 | 5 |
| 2 | glm/glm-ocr | 0.000376 | 7 |
| 3 | openai/gpt-5.4-nano | 0.001580 | 15 |
| 4 | gemini/gemini-3.1-flash-lite-preview | 0.001863 | 15 |
| 5 | deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct | 0.003065 | 14 |
| 6 | mistral/mistral-ocr-2512 | 0.004133 | 15 |
| 7 | aws-textract/detect-text | 0.006300 | 5 |
| 8 | gcloud-docai/ocr | 0.006300 | 5 |
| 9 | deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct | 0.008954 | 5 |
| 10 | anthropic/claude-haiku-4-5 | 0.010006 | 14 |
| 11 | kimi/kimi-k2.6 | 0.011592 | 15 |
| 12 | openai/gpt-5.4-mini | 0.013760 | 5 |
| 13 | gemini/gemini-3.1-pro-preview | 0.037384 | 5 |
| 14 | openai/gpt-5.4 | 0.051517 | 5 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | mistral/mistral-ocr-2512 | 3.624 | 15 |
| 2 | gemini/gemini-3.1-flash-lite-preview | 4.925 | 15 |
| 3 | openai/gpt-5.4-nano | 11.745 | 15 |
| 4 | glm/glm-ocr | 11.877 | 7 |
| 5 | aws-textract/detect-text | 12.158 | 5 |
| 6 | anthropic/claude-haiku-4-5 | 16.714 | 14 |
| 7 | kimi/kimi-k2.6 | 30.328 | 15 |
| 8 | openai/gpt-5.4 | 38.377 | 5 |
| 9 | gcloud-docai/ocr | 38.405 | 5 |
| 10 | deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct | 49.611 | 14 |
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

## Step 2 URL Extraction

### Top 6 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Cheapest | zyte/zyte | $0.001600 average cost | 3 | 2 | Cheapest: lowest cost |
| Cheapest | glm-reader/glm-reader | $0.010000 average cost | 4 | 3 | Cheapest: lowest cost |
| Best | firecrawl/firecrawl | 98.06 URL extraction accuracy score | 1 | 2 | Best: highest quality score |
| Best | spider/spider | 96.86 URL extraction accuracy score | 2 | 2 | Best: highest quality score |

Only 4 picks are shown because only 4 unique provider/models had eligible ranking rows for this step.

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | firecrawl/firecrawl | 0.000830 | 8 |
| 2 | spider/spider | 0.001200 | 2 |
| 3 | zyte/zyte | 0.001600 | 2 |
| 4 | glm-reader/glm-reader | 0.010000 | 3 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | firecrawl/firecrawl | 1.141 | 8 |
| 2 | spider/spider | 1.810 | 2 |
| 3 | glm-reader/glm-reader | 2.178 | 7 |
| 4 | zyte/zyte | 12.229 | 2 |

### Quality

| Rank | Provider/model | Average quality score | Quality samples | Metric |
| ---: | --- | ---: | ---: | --- |
| 1 | firecrawl/firecrawl | 98.06 | 2 | URL extraction accuracy score |
| 2 | spider/spider | 96.86 | 2 | URL extraction accuracy score |
| 3 | glm-reader/glm-reader | 65.70 | 2 | URL extraction accuracy score |
| 4 | zyte/zyte | 57.04 | 2 | URL extraction accuracy score |

## Step 2 Transcription/STT

### Diarization Models

#### Top 6 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Fastest | deepgram/nova-3 | 2.639 average seconds | 1 | 8 | Fastest: lowest processing time |
| Fastest | speechmatics/standard | 19.349 average seconds | 5 | 8 | Fastest: lowest processing time |
| Cheapest | grok/speech-to-text | $0.003788 average cost | 1 | 7 | Cheapest: lowest cost |
| Cheapest | soniox/stt-async-v4 | $0.011728 average cost | 2 | 8 | Cheapest: lowest cost |
| Best | assemblyai/universal-3-pro | 96.72 speaker-aware WER score | 1 | 3 | Best: highest quality score |
| Best | mistral/voxtral-mini-2602 | 95.85 speaker-aware WER score | 2 | 3 | Best: highest quality score |

#### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | grok/speech-to-text | 0.003788 | 7 |
| 2 | soniox/stt-async-v4 | 0.011728 | 8 |
| 3 | rev/low_cost | 0.011733 | 8 |
| 4 | elevenlabs/scribe_v2 | 0.017264 | 13 |
| 5 | mistral/voxtral-mini-2602 | 0.021110 | 8 |
| 6 | rev/machine | 0.023465 | 8 |
| 7 | assemblyai/universal-3-pro | 0.024629 | 8 |
| 8 | speechmatics/standard | 0.052775 | 8 |
| 9 | deepgram/nova-3 | 0.068256 | 8 |
| 10 | gladia/default | 0.108466 | 5 |
| 11 | speechmatics/enhanced | 0.133359 | 5 |
| 12 | gcloud/chirp_3 | 0.170700 | 5 |
| 13 | happyscribe/auto | 0.234153 | 3 |
| 14 | aws/standard | 0.256160 | 5 |

#### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | deepgram/nova-3 | 2.639 | 8 |
| 2 | grok/speech-to-text | 4.868 | 8 |
| 3 | mistral/voxtral-mini-2602 | 10.057 | 8 |
| 4 | assemblyai/universal-3-pro | 13.319 | 8 |
| 5 | speechmatics/standard | 19.349 | 8 |
| 6 | elevenlabs/scribe_v2 | 20.666 | 13 |
| 7 | soniox/stt-async-v4 | 22.739 | 8 |
| 8 | gladia/default | 27.096 | 5 |
| 9 | rev/machine | 36.572 | 8 |
| 10 | speechmatics/enhanced | 40.929 | 5 |
| 11 | rev/low_cost | 58.183 | 8 |
| 12 | aws/standard | 64.593 | 5 |
| 13 | happyscribe/auto | 78.429 | 3 |
| 14 | gcloud/chirp_3 | 176.788 | 5 |

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

### Non-Diarization Models

#### Top 6 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Fastest | supadata/generate | 1.772 average seconds | 1 | 1 | Fastest: lowest processing time |
| Fastest | together/openai/whisper-large-v3 | 5.025 average seconds | 2 | 3 | Fastest: lowest processing time |
| Cheapest | deepinfra/openai/whisper-large-v3-turbo | $0.001407 average cost | 1 | 8 | Cheapest: lowest cost |
| Cheapest | deepinfra/openai/whisper-large-v3 | $0.003167 average cost | 2 | 8 | Cheapest: lowest cost |
| Best | supadata/auto | 94.46 speaker-aware WER score | 1 | 3 | Best: highest quality score |
| Best | groq/whisper-large-v3 | 94.32 speaker-aware WER score | 2 | 3 | Best: highest quality score |

#### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | deepinfra/openai/whisper-large-v3-turbo | 0.001407 | 8 |
| 2 | deepinfra/openai/whisper-large-v3 | 0.003167 | 8 |
| 3 | groq/whisper-large-v3-turbo | 0.004691 | 8 |
| 4 | deapi/WhisperLargeV3 | 0.009351 | 13 |
| 5 | groq/whisper-large-v3 | 0.013018 | 8 |
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
| 3 | supadata/native | 5.118 | 1 |
| 4 | groq/whisper-large-v3 | 5.503 | 8 |
| 5 | supadata/auto | 6.174 | 3 |
| 6 | groq/whisper-large-v3-turbo | 6.322 | 8 |
| 7 | deepinfra/openai/whisper-large-v3-turbo | 6.401 | 8 |
| 8 | deepinfra/openai/whisper-large-v3 | 12.609 | 8 |
| 9 | deapi/WhisperLargeV3 | 22.632 | 13 |
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

## Step 3 Write/LLM

### Top 6 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Fastest | openai/gpt-5.4-mini | 1.300 average seconds | 2 | 6 | Fastest: lowest processing time |
| Fastest | openai/gpt-5.4 | 1.894 average seconds | 3 | 7 | Fastest: lowest processing time |
| Cheapest | groq/openai/gpt-oss-20b | $0.000117 average cost | 1 | 8 | Cheapest: lowest cost |
| Cheapest | minimax/MiniMax-M2.5-highspeed | $0.000275 average cost | 2 | 6 | Cheapest: lowest cost |
| Best | openai/gpt-5.4-pro | $0.013200 average cost | 15 | 3 | Best proxy: highest cost |
| Best | glm/glm-5.1 | $0.002424 average cost | 14 | 2 | Best proxy: highest cost |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | groq/openai/gpt-oss-20b | 0.000117 | 8 |
| 2 | minimax/MiniMax-M2.5-highspeed | 0.000275 | 6 |
| 3 | openai/gpt-5.4-mini | 0.000329 | 6 |
| 4 | minimax/MiniMax-M2.5 | 0.000595 | 6 |
| 5 | gemini/gemini-3.1-flash-lite-preview | 0.000676 | 6 |
| 6 | openai/gpt-5.4-nano | 0.000693 | 6 |
| 7 | gemini/gemini-3.1-pro-preview | 0.000942 | 6 |
| 8 | openai/gpt-5.4 | 0.001111 | 7 |
| 9 | anthropic/claude-sonnet-4-6 | 0.001320 | 6 |
| 10 | kimi/kimi-k2.6 | 0.002163 | 3 |
| 11 | anthropic/claude-opus-4-6 | 0.002171 | 6 |
| 12 | anthropic/claude-opus-4-7 | 0.002208 | 6 |
| 13 | anthropic/claude-haiku-4-5 | 0.002357 | 3 |
| 14 | glm/glm-5.1 | 0.002424 | 2 |
| 15 | openai/gpt-5.4-pro | 0.013200 | 3 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | groq/openai/gpt-oss-20b | 0.889 | 8 |
| 2 | openai/gpt-5.4-mini | 1.300 | 6 |
| 3 | openai/gpt-5.4 | 1.894 | 7 |
| 4 | anthropic/claude-sonnet-4-6 | 2.435 | 6 |
| 5 | gemini/gemini-3.1-flash-lite-preview | 2.517 | 6 |
| 6 | anthropic/claude-opus-4-6 | 2.586 | 6 |
| 7 | anthropic/claude-opus-4-7 | 3.477 | 6 |
| 8 | openai/gpt-5.4-nano | 5.625 | 6 |
| 9 | anthropic/claude-haiku-4-5 | 6.472 | 3 |
| 10 | gemini/gemini-3.1-pro-preview | 8.535 | 6 |
| 11 | kimi/kimi-k2.6 | 13.347 | 3 |
| 12 | minimax/MiniMax-M2.5-highspeed | 14.238 | 6 |
| 13 | glm/glm-5.1 | 14.335 | 2 |
| 14 | minimax/MiniMax-M2.5 | 24.440 | 6 |
| 15 | openai/gpt-5.4-pro | 70.926 | 3 |

Quality: No pure LLM quality metric is present in these benchmark files.

## Step 4 TTS

### Top 6 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Fastest | elevenlabs/eleven_turbo_v2_5 | 0.679 average seconds | 1 | 4 | Fastest: lowest processing time |
| Fastest | elevenlabs/eleven_flash_v2_5 | 0.780 average seconds | 2 | 4 | Fastest: lowest processing time |
| Cheapest | gemini/gemini-2.5-flash-preview-tts | $0.000087 average cost | 1 | 4 | Cheapest: lowest cost |
| Cheapest | deapi/Qwen3_TTS_12Hz_1_7B_Base | $0.000135 average cost | 2 | 1 | Cheapest: lowest cost |
| Best | gcloud/studio | $0.045760 average cost | 20 | 1 | Best proxy: highest cost |
| Best | runway/eleven_multilingual_v2 | $0.040000 average cost | 19 | 1 | Best proxy: highest cost |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | gemini/gemini-2.5-flash-preview-tts | 0.000087 | 4 |
| 2 | deapi/Qwen3_TTS_12Hz_1_7B_Base | 0.000135 | 1 |
| 3 | gemini/gemini-2.5-pro-preview-tts | 0.000175 | 4 |
| 4 | deapi/Chatterbox | 0.000220 | 1 |
| 5 | deapi/Kokoro | 0.000220 | 1 |
| 6 | deapi/Qwen3_TTS_12Hz_1_7B_CustomVoice | 0.000220 | 1 |
| 7 | grok/grok-tts | 0.000813 | 6 |
| 8 | mistral/voxtral-mini-tts-2603 | 0.001912 | 10 |
| 9 | openai/gpt-4o-mini-tts | 0.002227 | 21 |
| 10 | gemini/gemini-3.1-flash-tts-preview | 0.003709 | 10 |
| 11 | deepgram/aura-2-thalia-en | 0.005805 | 6 |
| 12 | groq/canopylabs/orpheus-v1-english | 0.006192 | 6 |
| 13 | gcloud/chirp3-hd | 0.008580 | 1 |
| 14 | elevenlabs/eleven_flash_v2_5 | 0.008750 | 4 |
| 15 | elevenlabs/eleven_turbo_v2_5 | 0.008750 | 4 |
| 16 | minimax/speech-2.8-turbo | 0.012720 | 3 |
| 17 | elevenlabs/eleven_v3 | 0.021200 | 3 |
| 18 | minimax/speech-2.8-hd | 0.021200 | 3 |
| 19 | runway/eleven_multilingual_v2 | 0.040000 | 1 |
| 20 | gcloud/studio | 0.045760 | 1 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | elevenlabs/eleven_turbo_v2_5 | 0.679 | 4 |
| 2 | elevenlabs/eleven_flash_v2_5 | 0.780 | 4 |
| 3 | gcloud/studio | 1.798 | 1 |
| 4 | groq/canopylabs/orpheus-v1-english | 2.666 | 6 |
| 5 | gcloud/chirp3-hd | 2.750 | 1 |
| 6 | grok/grok-tts | 3.550 | 6 |
| 7 | mistral/voxtral-mini-tts-2603 | 4.075 | 10 |
| 8 | deapi/Kokoro | 4.941 | 1 |
| 9 | gemini/gemini-2.5-flash-preview-tts | 6.116 | 4 |
| 10 | deepgram/aura-2-thalia-en | 6.402 | 6 |
| 11 | gemini/gemini-3.1-flash-tts-preview | 6.737 | 10 |
| 12 | elevenlabs/eleven_v3 | 8.703 | 3 |
| 13 | runway/eleven_multilingual_v2 | 10.972 | 1 |
| 14 | gemini/gemini-2.5-pro-preview-tts | 11.363 | 4 |
| 15 | deapi/Chatterbox | 16.030 | 1 |
| 16 | deapi/Qwen3_TTS_12Hz_1_7B_Base | 24.222 | 1 |
| 17 | minimax/speech-2.8-turbo | 28.641 | 3 |
| 18 | minimax/speech-2.8-hd | 45.754 | 3 |
| 19 | deapi/Qwen3_TTS_12Hz_1_7B_CustomVoice | 64.955 | 1 |
| 20 | openai/gpt-4o-mini-tts | 89.574 | 21 |

Quality: No TTS quality ranking is shown because roundtrip WER is null in the current raw TTS comparison and dashboard rows do not contain a pure TTS quality metric.

## Step 5 Image

### Top 6 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Fastest | grok/grok-imagine-image | 3.173 average seconds | 1 | 3 | Fastest: lowest processing time |
| Fastest | gemini/imagen-4.0-fast-generate-001 | 4.490 average seconds | 2 | 3 | Fastest: lowest processing time |
| Cheapest | deapi/Flux1schnell | $0.001360 average cost | 1 | 6 | Cheapest: lowest cost |
| Cheapest | deapi/Flux_2_Klein_4B_BF16 | $0.001860 average cost | 2 | 6 | Cheapest: lowest cost |
| Best | openai/gpt-image-1.5 | $0.080000 average cost | 15 | 3 | Best proxy: highest cost |
| Best | gemini/imagen-4.0-ultra-generate-001 | $0.060000 average cost | 14 | 3 | Best proxy: highest cost |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | deapi/Flux1schnell | 0.001360 | 6 |
| 2 | deapi/Flux_2_Klein_4B_BF16 | 0.001860 | 6 |
| 3 | minimax/image-01 | 0.003500 | 6 |
| 4 | deapi/ZImageTurbo_INT8 | 0.004050 | 6 |
| 5 | openai/gpt-image-2 | 0.005000 | 11 |
| 6 | gemini/imagen-4.0-fast-generate-001 | 0.020000 | 3 |
| 7 | openai/gpt-image-1-mini | 0.020000 | 1 |
| 8 | bfl/flux-2-pro-preview | 0.030000 | 3 |
| 9 | gemini/gemini-3-pro-image-preview | 0.030000 | 1 |
| 10 | grok/grok-imagine-image | 0.036667 | 3 |
| 11 | gemini/imagen-4.0-generate-001 | 0.040000 | 3 |
| 12 | openai/gpt-image-1 | 0.040000 | 1 |
| 13 | runway/gen4_image | 0.050000 | 3 |
| 14 | gemini/imagen-4.0-ultra-generate-001 | 0.060000 | 3 |
| 15 | openai/gpt-image-1.5 | 0.080000 | 3 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | grok/grok-imagine-image | 3.173 | 3 |
| 2 | gemini/imagen-4.0-fast-generate-001 | 4.490 | 3 |
| 3 | gemini/imagen-4.0-generate-001 | 5.089 | 3 |
| 4 | gemini/imagen-4.0-ultra-generate-001 | 8.856 | 3 |
| 5 | deapi/Flux_2_Klein_4B_BF16 | 10.183 | 6 |
| 6 | deapi/Flux1schnell | 11.204 | 6 |
| 7 | bfl/flux-2-pro-preview | 11.909 | 3 |
| 8 | gemini/gemini-3-pro-image-preview | 14.210 | 1 |
| 9 | minimax/image-01 | 14.573 | 6 |
| 10 | openai/gpt-image-1-mini | 21.644 | 1 |
| 11 | openai/gpt-image-2 | 27.692 | 11 |
| 12 | runway/gen4_image | 31.061 | 3 |
| 13 | deapi/ZImageTurbo_INT8 | 32.386 | 6 |
| 14 | openai/gpt-image-1.5 | 49.422 | 3 |
| 15 | openai/gpt-image-1 | 64.423 | 1 |

Quality: No pure image quality metric is present in these benchmark files.

## Step 6 Video

### Top 6 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Fastest | gemini/veo-3.1-lite-generate-preview | 31.530 average seconds | 2 | 2 | Fastest: lowest processing time |
| Fastest | minimax/MiniMax-Hailuo-02 | 79.264 average seconds | 5 | 2 | Fastest: lowest processing time |
| Cheapest | deapi/Ltxv_13B_0_9_8_Distilled_FP8 | $0.000868 average cost | 1 | 2 | Cheapest: lowest cost |
| Cheapest | minimax/T2V-01 | $0.190000 average cost | 2 | 2 | Cheapest: lowest cost |
| Best | gemini/veo-3.1-generate-preview | $1.600000 average cost | 8 | 2 | Best proxy: highest cost |
| Best | gemini/veo-3.1-fast-generate-preview | $0.400000 average cost | 7 | 2 | Best proxy: highest cost |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | deapi/Ltxv_13B_0_9_8_Distilled_FP8 | 0.000868 | 2 |
| 2 | minimax/T2V-01 | 0.190000 | 2 |
| 3 | minimax/T2V-01-Director | 0.190000 | 2 |
| 4 | gemini/veo-3.1-lite-generate-preview | 0.200000 | 2 |
| 5 | minimax/MiniMax-Hailuo-02 | 0.280000 | 2 |
| 6 | minimax/MiniMax-Hailuo-2.3 | 0.280000 | 2 |
| 7 | gemini/veo-3.1-fast-generate-preview | 0.400000 | 2 |
| 8 | gemini/veo-3.1-generate-preview | 1.600000 | 2 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | deapi/Ltxv_13B_0_9_8_Distilled_FP8 | 12.241 | 2 |
| 2 | gemini/veo-3.1-lite-generate-preview | 31.530 | 2 |
| 3 | gemini/veo-3.1-fast-generate-preview | 36.749 | 2 |
| 4 | gemini/veo-3.1-generate-preview | 41.693 | 2 |
| 5 | minimax/MiniMax-Hailuo-02 | 79.264 | 2 |
| 6 | minimax/MiniMax-Hailuo-2.3 | 88.807 | 2 |
| 7 | minimax/T2V-01 | 144.740 | 2 |
| 8 | minimax/T2V-01-Director | 144.828 | 2 |

Quality: No pure video quality metric is present in these benchmark files.

## Step 7 Music

### Top 6 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Cheapest | elevenlabs/music_v1 | $0.014000 average cost | 1 | 5 | Cheapest: lowest cost |
| Cheapest | gemini/lyria-3-clip-preview | $0.040000 average cost | 2 | 2 | Cheapest: lowest cost |
| Best | minimax/music-2.5 | $0.150000 average cost | 4 | 4 | Best proxy: highest cost |
| Best | gemini/lyria-3-pro-preview | $0.080000 average cost | 3 | 1 | Best proxy: highest cost |

Only 4 picks are shown because only 4 unique provider/models had eligible ranking rows for this step.

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | elevenlabs/music_v1 | 0.014000 | 5 |
| 2 | gemini/lyria-3-clip-preview | 0.040000 | 2 |
| 3 | gemini/lyria-3-pro-preview | 0.080000 | 1 |
| 4 | minimax/music-2.5 | 0.150000 | 4 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | elevenlabs/music_v1 | 6.248 | 5 |
| 2 | gemini/lyria-3-clip-preview | 8.578 | 2 |
| 3 | gemini/lyria-3-pro-preview | 43.554 | 1 |
| 4 | minimax/music-2.5 | 103.587 | 4 |

Quality: No pure music quality metric is present in these benchmark files.

## Footnotes

- Price averages use USD per successful measurable row. Raw comparison rows use positive actual costs first, then positive reported costs, then positive sibling `run.json` `metadata.cost.estimated.steps` estimates when raw costs are zero or missing; raw cents are converted to USD and dashboard costs already reported in USD are used as-is.
- Speed averages use actual processing time where present, converted from milliseconds to seconds.
- Quality rankings are shown only for pure quality metrics: OCR WER-derived accuracy, URL extraction accuracy, and STT speaker-aware WER scores. Dashboard smoke/e2e rows do not contain pure quality metrics and therefore contribute only price and speed.
- STT rankings are split by diarization support using raw STT `supportsDiarization` metadata; dashboard-only STT rows use the service defaults from the benchmark ranking generator.
- Zero-cost third-party rows remain in price rankings. Local and non-third-party services are excluded, including `unknown`, `extract`, `ocrmypdf`, `paddle-ocr`, `tesseract`, `whisper`, `kitten`, `llama.cpp`, `defuddle`, and `reverb`.
- Omitted 83 failed rows. Missing metric counts are reported in the source summary and those missing values were omitted only from the affected metric average.

