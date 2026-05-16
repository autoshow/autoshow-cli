# Benchmark Ranking Report

This report averages available benchmark rows into per-step third-party provider/model rankings. It intentionally does not compute a combined overall score.

## Source Summary

- Reconciled `project/reports/results/index.json` with 20 listed dashboard report files.
- Used 9 raw comparison reports and 11 test-run dashboard reports.
- Skipped 9 benchmark dashboard reports because matching raw comparison reports are canonical for those runs.
- Saw 677 provider/test rows: included 415, excluded 261 local or non-third-party rows, omitted 1 failed row, skipped 0 unsupported-category rows, and skipped 0 rows with no measurable metrics.
- Filled 26 raw price rows from sibling run estimates where raw comparison costs were zero or missing.
- Missing metrics among otherwise included rows: price 5, speed 0, quality 124 in quality-ranked steps.
- 54 provider/model rankings include raw comparison data; 80 include test-run dashboard data.

Contributed raw comparison reports:

- `project/reports/results/raw-benchmarks/ocr/2026-05-10_04-27-00-431_document/provider-comparison-report.json`
- `project/reports/results/raw-benchmarks/ocr/2026-05-10_04-30-51-795_document/provider-comparison-report.json`
- `project/reports/results/raw-benchmarks/ocr/2026-05-10_04-32-20-328_document/provider-comparison-report.json`
- `project/reports/results/raw-benchmarks/stt/2026-05-10_23-04-51-843_1-audio/reference-comparison-report.json`
- `project/reports/results/raw-benchmarks/stt/2026-05-11_03-22-16-476_2022-09-30-widgets-fsjam-40-minutes/reference-comparison-report.json`
- `project/reports/results/raw-benchmarks/stt/2026-05-11_05-05-10-260_2023-04-05-jsjam-react-miami-2023-10-minutes/reference-comparison-report.json`
- `project/reports/results/raw-benchmarks/tts/2026-04-25_02-36-42-642_tts-long/provider-comparison-report.json`
- `project/reports/results/raw-benchmarks/url/2026-05-13_21-18-14-082_anthony-campolos-home-page/provider-comparison-report.json`
- `project/reports/results/raw-benchmarks/url/2026-05-13_22-06-36-105_autogenerate-show-notes-with-whisper-cpp-llama-cpp-and-node-js/provider-comparison-report.json`

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

## Step 1 Download

No measurable third-party download rows were present in the reconciled benchmark inputs.

## Step 2 Document OCR

### Top 6 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Fastest | mistral/mistral-ocr-2512 | 3.643 average seconds | 1 | 11 | Fastest: lowest processing time |
| Fastest | gemini/gemini-3.1-flash-lite-preview | 4.273 average seconds | 2 | 11 | Fastest: lowest processing time |
| Cheapest | glm/glm-ocr | $0.000345 average cost | 1 | 3 | Cheapest: lowest cost |
| Cheapest | openai/gpt-5.4-nano | $0.001279 average cost | 2 | 11 | Cheapest: lowest cost |
| Best | gemini/gemini-3.1-pro-preview | 95.78 WER accuracy score | 1 | 3 | Best: highest quality score |
| Best | kimi/kimi-k2.6 | 94.97 WER accuracy score | 2 | 3 | Best: highest quality score |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | glm/glm-ocr | 0.000345 | 3 |
| 2 | openai/gpt-5.4-nano | 0.001279 | 11 |
| 3 | gemini/gemini-3.1-flash-lite-preview | 0.001389 | 11 |
| 4 | deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct | 0.001994 | 11 |
| 5 | mistral/mistral-ocr-2512 | 0.003273 | 11 |
| 6 | aws-textract/detect-text | 0.005000 | 3 |
| 7 | gcloud-docai/ocr | 0.005000 | 3 |
| 8 | deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct | 0.006721 | 3 |
| 9 | anthropic/claude-haiku-4-5 | 0.008099 | 11 |
| 10 | kimi/kimi-k2.6 | 0.009108 | 11 |
| 11 | gemini/gemini-3.1-pro-preview | 0.031751 | 3 |
| 12 | openai/gpt-5.4 | 0.052451 | 3 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | mistral/mistral-ocr-2512 | 3.643 | 11 |
| 2 | gemini/gemini-3.1-flash-lite-preview | 4.273 | 11 |
| 3 | openai/gpt-5.4-nano | 8.217 | 11 |
| 4 | aws-textract/detect-text | 14.279 | 3 |
| 5 | glm/glm-ocr | 15.383 | 3 |
| 6 | anthropic/claude-haiku-4-5 | 16.362 | 11 |
| 7 | deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct | 22.579 | 11 |
| 8 | kimi/kimi-k2.6 | 25.732 | 11 |
| 9 | gcloud-docai/ocr | 36.590 | 3 |
| 10 | openai/gpt-5.4 | 37.233 | 3 |
| 11 | deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct | 80.348 | 3 |
| 12 | gemini/gemini-3.1-pro-preview | 88.389 | 3 |

### Quality

| Rank | Provider/model | Average quality score | Quality samples | Metric |
| ---: | --- | ---: | ---: | --- |
| 1 | gemini/gemini-3.1-pro-preview | 95.78 | 3 | WER accuracy score |
| 2 | kimi/kimi-k2.6 | 94.97 | 3 | WER accuracy score |
| 3 | glm/glm-ocr | 87.34 | 3 | WER accuracy score |
| 4 | deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct | 86.18 | 3 | WER accuracy score |
| 5 | deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct | 83.49 | 3 | WER accuracy score |
| 6 | mistral/mistral-ocr-2512 | 80.52 | 3 | WER accuracy score |
| 7 | openai/gpt-5.4 | 78.36 | 3 | WER accuracy score |
| 8 | gemini/gemini-3.1-flash-lite-preview | 71.05 | 3 | WER accuracy score |
| 9 | anthropic/claude-haiku-4-5 | 69.25 | 3 | WER accuracy score |
| 10 | gcloud-docai/ocr | 60.34 | 3 | WER accuracy score |
| 11 | aws-textract/detect-text | 60.20 | 3 | WER accuracy score |
| 12 | openai/gpt-5.4-nano | 41.75 | 3 | WER accuracy score |

## Step 2 URL Extraction

### Top 6 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Cheapest | zyte/zyte | $0.001600 average cost | 3 | 2 | Cheapest: lowest cost |
| Cheapest | glm-reader/glm-reader | $0.010000 average cost | 4 | 2 | Cheapest: lowest cost |
| Best | firecrawl/firecrawl | 98.06 URL extraction accuracy score | 1 | 2 | Best: highest quality score |
| Best | spider/spider | 96.86 URL extraction accuracy score | 2 | 2 | Best: highest quality score |

Only 4 picks are shown because only 4 unique provider/models had eligible ranking rows for this step.

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | firecrawl/firecrawl | 0.000830 | 6 |
| 2 | spider/spider | 0.001200 | 2 |
| 3 | zyte/zyte | 0.001600 | 2 |
| 4 | glm-reader/glm-reader | 0.010000 | 2 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | firecrawl/firecrawl | 1.264 | 6 |
| 2 | spider/spider | 1.810 | 2 |
| 3 | glm-reader/glm-reader | 2.279 | 6 |
| 4 | zyte/zyte | 12.229 | 2 |

### Quality

| Rank | Provider/model | Average quality score | Quality samples | Metric |
| ---: | --- | ---: | ---: | --- |
| 1 | firecrawl/firecrawl | 98.06 | 2 | URL extraction accuracy score |
| 2 | spider/spider | 96.86 | 2 | URL extraction accuracy score |
| 3 | glm-reader/glm-reader | 65.70 | 2 | URL extraction accuracy score |
| 4 | zyte/zyte | 57.04 | 2 | URL extraction accuracy score |

## Step 2 Transcription/STT

### Top 6 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Fastest | supadata/generate | 1.772 average seconds | 1 | 1 | Fastest: lowest processing time |
| Fastest | deepgram/nova-3 | 2.618 average seconds | 2 | 7 | Fastest: lowest processing time |
| Cheapest | deepinfra/openai/whisper-large-v3-turbo | $0.001580 average cost | 1 | 7 | Cheapest: lowest cost |
| Cheapest | deepinfra/openai/whisper-large-v3 | $0.003556 average cost | 2 | 7 | Cheapest: lowest cost |
| Best | assemblyai/universal-3-pro | 96.72 speaker-aware WER score | 1 | 3 | Best: highest quality score |
| Best | mistral/voxtral-mini-2602 | 95.85 speaker-aware WER score | 2 | 3 | Best: highest quality score |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | deepinfra/openai/whisper-large-v3-turbo | 0.001580 | 7 |
| 2 | deepinfra/openai/whisper-large-v3 | 0.003556 | 7 |
| 3 | grok/speech-to-text | 0.004146 | 6 |
| 4 | groq/whisper-large-v3-turbo | 0.005268 | 7 |
| 5 | deapi/WhisperLargeV3 | 0.009248 | 11 |
| 6 | soniox/stt-async-v4 | 0.013169 | 7 |
| 7 | rev/low_cost | 0.013175 | 7 |
| 8 | groq/whisper-large-v3 | 0.014618 | 7 |
| 9 | elevenlabs/scribe_v2 | 0.019748 | 11 |
| 10 | supadata/generate | 0.020000 | 1 |
| 11 | supadata/native | 0.020000 | 1 |
| 12 | mistral/voxtral-mini-2602 | 0.023704 | 7 |
| 13 | together/openai/whisper-large-v3 | 0.025689 | 3 |
| 14 | rev/machine | 0.026349 | 7 |
| 15 | assemblyai/universal-3-pro | 0.027655 | 7 |
| 16 | gemini-stt/gemini-3-flash-preview | 0.032881 | 3 |
| 17 | glm-stt/glm-asr-2512 | 0.041102 | 3 |
| 18 | openai-stt/gpt-4o-mini-transcribe | 0.051377 | 3 |
| 19 | speechmatics/standard | 0.059261 | 7 |
| 20 | deepgram/nova-3 | 0.076644 | 7 |
| 21 | openai-stt/gpt-4o-transcribe | 0.102754 | 3 |
| 22 | gladia/default | 0.133083 | 4 |
| 23 | speechmatics/enhanced | 0.163626 | 4 |
| 24 | gcloud/chirp_3 | 0.209442 | 4 |
| 25 | happyscribe/auto | 0.234153 | 3 |
| 26 | aws/standard | 0.314300 | 4 |
| 27 | supadata/auto | 0.342560 | 3 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | supadata/generate | 1.772 | 1 |
| 2 | deepgram/nova-3 | 2.618 | 7 |
| 3 | together/openai/whisper-large-v3 | 5.025 | 3 |
| 4 | supadata/native | 5.118 | 1 |
| 5 | grok/speech-to-text | 5.332 | 7 |
| 6 | groq/whisper-large-v3 | 6.041 | 7 |
| 7 | supadata/auto | 6.174 | 3 |
| 8 | deepinfra/openai/whisper-large-v3-turbo | 6.947 | 7 |
| 9 | groq/whisper-large-v3-turbo | 7.035 | 7 |
| 10 | mistral/voxtral-mini-2602 | 10.747 | 7 |
| 11 | assemblyai/universal-3-pro | 14.015 | 7 |
| 12 | deepinfra/openai/whisper-large-v3 | 14.022 | 7 |
| 13 | speechmatics/standard | 19.623 | 7 |
| 14 | elevenlabs/scribe_v2 | 23.525 | 11 |
| 15 | soniox/stt-async-v4 | 24.875 | 7 |
| 16 | deapi/WhisperLargeV3 | 24.956 | 11 |
| 17 | openai-stt/gpt-4o-mini-transcribe | 26.599 | 3 |
| 18 | gladia/default | 29.137 | 4 |
| 19 | rev/machine | 38.179 | 7 |
| 20 | openai-stt/gpt-4o-transcribe | 45.093 | 3 |
| 21 | speechmatics/enhanced | 46.734 | 4 |
| 22 | rev/low_cost | 62.903 | 7 |
| 23 | aws/standard | 73.734 | 4 |
| 24 | glm-stt/glm-asr-2512 | 75.337 | 3 |
| 25 | happyscribe/auto | 78.429 | 3 |
| 26 | gemini-stt/gemini-3-flash-preview | 120.498 | 3 |
| 27 | gcloud/chirp_3 | 219.864 | 4 |

### Quality

| Rank | Provider/model | Average quality score | Quality samples | Metric |
| ---: | --- | ---: | ---: | --- |
| 1 | assemblyai/universal-3-pro | 96.72 | 3 | speaker-aware WER score |
| 2 | mistral/voxtral-mini-2602 | 95.85 | 3 | speaker-aware WER score |
| 3 | speechmatics/enhanced | 95.40 | 3 | speaker-aware WER score |
| 4 | gladia/default | 95.22 | 3 | speaker-aware WER score |
| 5 | supadata/auto | 94.46 | 3 | speaker-aware WER score |
| 6 | speechmatics/standard | 94.32 | 3 | speaker-aware WER score |
| 7 | groq/whisper-large-v3 | 94.32 | 3 | speaker-aware WER score |
| 8 | deepinfra/openai/whisper-large-v3-turbo | 94.07 | 3 | speaker-aware WER score |
| 9 | gcloud/chirp_3 | 94.06 | 3 | speaker-aware WER score |
| 10 | deepinfra/openai/whisper-large-v3 | 94.04 | 3 | speaker-aware WER score |
| 11 | groq/whisper-large-v3-turbo | 93.97 | 3 | speaker-aware WER score |
| 12 | soniox/stt-async-v4 | 93.87 | 3 | speaker-aware WER score |
| 13 | together/openai/whisper-large-v3 | 93.46 | 3 | speaker-aware WER score |
| 14 | elevenlabs/scribe_v2 | 92.70 | 3 | speaker-aware WER score |
| 15 | supadata/generate | 92.34 | 1 | speaker-aware WER score |
| 16 | supadata/native | 92.34 | 1 | speaker-aware WER score |
| 17 | aws/standard | 92.17 | 3 | speaker-aware WER score |
| 18 | rev/machine | 92.06 | 3 | speaker-aware WER score |
| 19 | glm-stt/glm-asr-2512 | 91.90 | 3 | speaker-aware WER score |
| 20 | deepgram/nova-3 | 91.69 | 3 | speaker-aware WER score |
| 21 | rev/low_cost | 91.66 | 3 | speaker-aware WER score |
| 22 | openai-stt/gpt-4o-transcribe | 91.32 | 3 | speaker-aware WER score |
| 23 | openai-stt/gpt-4o-mini-transcribe | 90.38 | 3 | speaker-aware WER score |
| 24 | grok/speech-to-text | 88.06 | 3 | speaker-aware WER score |
| 25 | gemini-stt/gemini-3-flash-preview | 84.11 | 3 | speaker-aware WER score |
| 26 | deapi/WhisperLargeV3 | 78.72 | 3 | speaker-aware WER score |
| 27 | happyscribe/auto | 78.00 | 3 | speaker-aware WER score |

## Step 3 Write/LLM

### Top 6 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Fastest | openai/gpt-5.4-mini | 1.143 average seconds | 2 | 4 | Fastest: lowest processing time |
| Fastest | openai/gpt-5.4 | 1.876 average seconds | 3 | 5 | Fastest: lowest processing time |
| Cheapest | groq/openai/gpt-oss-20b | $0.000113 average cost | 1 | 5 | Cheapest: lowest cost |
| Cheapest | minimax/MiniMax-M2.5-highspeed | $0.000275 average cost | 2 | 4 | Cheapest: lowest cost |
| Best | openai/gpt-5.4-pro | $0.013080 average cost | 14 | 1 | Best proxy: highest cost |
| Best | kimi/kimi-k2.6 | $0.002891 average cost | 13 | 1 | Best proxy: highest cost |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | groq/openai/gpt-oss-20b | 0.000113 | 5 |
| 2 | minimax/MiniMax-M2.5-highspeed | 0.000275 | 4 |
| 3 | openai/gpt-5.4-mini | 0.000328 | 4 |
| 4 | minimax/MiniMax-M2.5 | 0.000592 | 4 |
| 5 | gemini/gemini-3.1-flash-lite-preview | 0.000679 | 4 |
| 6 | openai/gpt-5.4-nano | 0.000690 | 4 |
| 7 | gemini/gemini-3.1-pro-preview | 0.000956 | 4 |
| 8 | openai/gpt-5.4 | 0.001108 | 5 |
| 9 | anthropic/claude-sonnet-4-6 | 0.001320 | 4 |
| 10 | anthropic/claude-opus-4-6 | 0.002156 | 4 |
| 11 | anthropic/claude-opus-4-7 | 0.002213 | 4 |
| 12 | anthropic/claude-haiku-4-5 | 0.002460 | 1 |
| 13 | kimi/kimi-k2.6 | 0.002891 | 1 |
| 14 | openai/gpt-5.4-pro | 0.013080 | 1 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | groq/openai/gpt-oss-20b | 0.861 | 5 |
| 2 | openai/gpt-5.4-mini | 1.143 | 4 |
| 3 | openai/gpt-5.4 | 1.876 | 5 |
| 4 | anthropic/claude-opus-4-6 | 2.382 | 4 |
| 5 | gemini/gemini-3.1-flash-lite-preview | 2.467 | 4 |
| 6 | anthropic/claude-sonnet-4-6 | 2.554 | 4 |
| 7 | anthropic/claude-opus-4-7 | 2.917 | 4 |
| 8 | minimax/MiniMax-M2.5 | 5.527 | 4 |
| 9 | openai/gpt-5.4-nano | 5.843 | 4 |
| 10 | anthropic/claude-haiku-4-5 | 6.801 | 1 |
| 11 | gemini/gemini-3.1-pro-preview | 9.335 | 4 |
| 12 | minimax/MiniMax-M2.5-highspeed | 15.735 | 4 |
| 13 | kimi/kimi-k2.6 | 16.736 | 1 |
| 14 | openai/gpt-5.4-pro | 51.259 | 1 |

Quality: No pure LLM quality metric is present in these benchmark files.

## Step 4 TTS

### Top 6 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Fastest | elevenlabs/eleven_turbo_v2_5 | 0.808 average seconds | 1 | 5 | Fastest: lowest processing time |
| Fastest | elevenlabs/eleven_flash_v2_5 | 0.999 average seconds | 2 | 5 | Fastest: lowest processing time |
| Cheapest | gemini/gemini-2.5-flash-preview-tts | $0.000131 average cost | 1 | 5 | Cheapest: lowest cost |
| Cheapest | gemini/gemini-2.5-pro-preview-tts | $0.000262 average cost | 2 | 5 | Cheapest: lowest cost |
| Best | elevenlabs/eleven_v3 | $0.045470 average cost | 14 | 2 | Best proxy: highest cost |
| Best | runway/eleven_multilingual_v2 | $0.040000 average cost | 13 | 1 | Best proxy: highest cost |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | gemini/gemini-2.5-flash-preview-tts | 0.000131 | 5 |
| 2 | gemini/gemini-2.5-pro-preview-tts | 0.000262 | 5 |
| 3 | grok/grok-tts | 0.000735 | 4 |
| 4 | mistral/voxtral-mini-tts-2603 | 0.001912 | 8 |
| 5 | openai/gpt-4o-mini-tts | 0.002481 | 17 |
| 6 | gemini/gemini-3.1-flash-tts-preview | 0.004517 | 9 |
| 7 | deepgram/aura-2-thalia-en | 0.007872 | 5 |
| 8 | groq/canopylabs/orpheus-v1-english | 0.008397 | 5 |
| 9 | elevenlabs/eleven_flash_v2_5 | 0.014344 | 5 |
| 10 | elevenlabs/eleven_turbo_v2_5 | 0.014344 | 5 |
| 11 | minimax/speech-2.8-turbo | 0.023610 | 2 |
| 12 | minimax/speech-2.8-hd | 0.039350 | 2 |
| 13 | runway/eleven_multilingual_v2 | 0.040000 | 1 |
| 14 | elevenlabs/eleven_v3 | 0.045470 | 2 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | elevenlabs/eleven_turbo_v2_5 | 0.808 | 5 |
| 2 | elevenlabs/eleven_flash_v2_5 | 0.999 | 5 |
| 3 | grok/grok-tts | 3.268 | 4 |
| 4 | groq/canopylabs/orpheus-v1-english | 3.547 | 5 |
| 5 | mistral/voxtral-mini-tts-2603 | 4.119 | 8 |
| 6 | gemini/gemini-3.1-flash-tts-preview | 7.730 | 9 |
| 7 | gemini/gemini-2.5-flash-preview-tts | 7.876 | 5 |
| 8 | deepgram/aura-2-thalia-en | 8.157 | 5 |
| 9 | runway/eleven_multilingual_v2 | 10.972 | 1 |
| 10 | elevenlabs/eleven_v3 | 11.776 | 2 |
| 11 | minimax/speech-2.8-turbo | 15.357 | 2 |
| 12 | gemini/gemini-2.5-pro-preview-tts | 15.857 | 5 |
| 13 | minimax/speech-2.8-hd | 17.654 | 2 |
| 14 | openai/gpt-4o-mini-tts | 55.300 | 17 |

Quality: No TTS quality ranking is shown because roundtrip WER is null in the current raw TTS comparison and dashboard rows do not contain a pure TTS quality metric.

## Step 5 Image

### Top 6 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Fastest | gemini/imagen-4.0-fast-generate-001 | 4.408 average seconds | 2 | 1 | Fastest: lowest processing time |
| Fastest | gemini/imagen-4.0-generate-001 | 4.745 average seconds | 3 | 1 | Fastest: lowest processing time |
| Cheapest | deapi/Flux1schnell | $0.001360 average cost | 1 | 4 | Cheapest: lowest cost |
| Cheapest | deapi/Flux_2_Klein_4B_BF16 | $0.001860 average cost | 2 | 4 | Cheapest: lowest cost |
| Best | openai/gpt-image-1.5 | $0.080000 average cost | 15 | 1 | Best proxy: highest cost |
| Best | grok/grok-imagine-image | $0.070000 average cost | 14 | 1 | Best proxy: highest cost |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | deapi/Flux1schnell | 0.001360 | 4 |
| 2 | deapi/Flux_2_Klein_4B_BF16 | 0.001860 | 4 |
| 3 | minimax/image-01 | 0.003500 | 4 |
| 4 | deapi/ZImageTurbo_INT8 | 0.004050 | 4 |
| 5 | openai/gpt-image-2 | 0.005000 | 8 |
| 6 | gemini/imagen-4.0-fast-generate-001 | 0.020000 | 1 |
| 7 | openai/gpt-image-1-mini | 0.020000 | 1 |
| 8 | bfl/flux-2-pro-preview | 0.030000 | 1 |
| 9 | gemini/gemini-3-pro-image-preview | 0.030000 | 1 |
| 10 | gemini/imagen-4.0-generate-001 | 0.040000 | 1 |
| 11 | openai/gpt-image-1 | 0.040000 | 1 |
| 12 | runway/gen4_image | 0.050000 | 1 |
| 13 | gemini/imagen-4.0-ultra-generate-001 | 0.060000 | 1 |
| 14 | grok/grok-imagine-image | 0.070000 | 1 |
| 15 | openai/gpt-image-1.5 | 0.080000 | 1 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | grok/grok-imagine-image | 2.970 | 1 |
| 2 | gemini/imagen-4.0-fast-generate-001 | 4.408 | 1 |
| 3 | gemini/imagen-4.0-generate-001 | 4.745 | 1 |
| 4 | deapi/Flux1schnell | 9.043 | 4 |
| 5 | gemini/imagen-4.0-ultra-generate-001 | 10.611 | 1 |
| 6 | deapi/Flux_2_Klein_4B_BF16 | 10.648 | 4 |
| 7 | bfl/flux-2-pro-preview | 11.713 | 1 |
| 8 | gemini/gemini-3-pro-image-preview | 14.210 | 1 |
| 9 | minimax/image-01 | 14.578 | 4 |
| 10 | openai/gpt-image-1-mini | 21.644 | 1 |
| 11 | openai/gpt-image-2 | 29.127 | 8 |
| 12 | deapi/ZImageTurbo_INT8 | 29.433 | 4 |
| 13 | runway/gen4_image | 30.984 | 1 |
| 14 | openai/gpt-image-1.5 | 48.361 | 1 |
| 15 | openai/gpt-image-1 | 64.423 | 1 |

Quality: No pure image quality metric is present in these benchmark files.

## Step 6 Video

### Top 6 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Fastest | gemini/veo-3.1-lite-generate-preview | 31.424 average seconds | 2 | 1 | Fastest: lowest processing time |
| Fastest | minimax/MiniMax-Hailuo-02 | 74.589 average seconds | 5 | 1 | Fastest: lowest processing time |
| Cheapest | deapi/Ltxv_13B_0_9_8_Distilled_FP8 | $0.000868 average cost | 1 | 1 | Cheapest: lowest cost |
| Cheapest | minimax/T2V-01 | $0.190000 average cost | 2 | 1 | Cheapest: lowest cost |
| Best | gemini/veo-3.1-generate-preview | $1.600000 average cost | 8 | 1 | Best proxy: highest cost |
| Best | gemini/veo-3.1-fast-generate-preview | $0.400000 average cost | 7 | 1 | Best proxy: highest cost |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | deapi/Ltxv_13B_0_9_8_Distilled_FP8 | 0.000868 | 1 |
| 2 | minimax/T2V-01 | 0.190000 | 1 |
| 3 | minimax/T2V-01-Director | 0.190000 | 1 |
| 4 | gemini/veo-3.1-lite-generate-preview | 0.200000 | 1 |
| 5 | minimax/MiniMax-Hailuo-02 | 0.280000 | 1 |
| 6 | minimax/MiniMax-Hailuo-2.3 | 0.280000 | 1 |
| 7 | gemini/veo-3.1-fast-generate-preview | 0.400000 | 1 |
| 8 | gemini/veo-3.1-generate-preview | 1.600000 | 1 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | deapi/Ltxv_13B_0_9_8_Distilled_FP8 | 12.224 | 1 |
| 2 | gemini/veo-3.1-lite-generate-preview | 31.424 | 1 |
| 3 | gemini/veo-3.1-generate-preview | 41.530 | 1 |
| 4 | gemini/veo-3.1-fast-generate-preview | 41.734 | 1 |
| 5 | minimax/MiniMax-Hailuo-02 | 74.589 | 1 |
| 6 | minimax/MiniMax-Hailuo-2.3 | 104.601 | 1 |
| 7 | minimax/T2V-01 | 145.014 | 1 |
| 8 | minimax/T2V-01-Director | 145.047 | 1 |

Quality: No pure video quality metric is present in these benchmark files.

## Step 7 Music

### Top 6 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Cheapest | elevenlabs/music_v1 | $0.014000 average cost | 1 | 2 | Cheapest: lowest cost |
| Best | minimax/music-2.5 | $0.150000 average cost | 3 | 1 | Best proxy: highest cost |
| Best | gemini/lyria-3-clip-preview | $0.040000 average cost | 2 | 1 | Best proxy: highest cost |

Only 3 picks are shown because only 3 unique provider/models had eligible ranking rows for this step.

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | elevenlabs/music_v1 | 0.014000 | 2 |
| 2 | gemini/lyria-3-clip-preview | 0.040000 | 1 |
| 3 | minimax/music-2.5 | 0.150000 | 1 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | elevenlabs/music_v1 | 6.494 | 2 |
| 2 | gemini/lyria-3-clip-preview | 8.806 | 1 |
| 3 | minimax/music-2.5 | 210.236 | 1 |

Quality: No pure music quality metric is present in these benchmark files.

## Footnotes

- Price averages use USD per successful measurable row. Raw comparison rows use positive actual costs first, then positive reported costs, then positive sibling `run.json` `metadata.cost.estimated.steps` estimates when raw costs are zero or missing; raw cents are converted to USD and dashboard costs already reported in USD are used as-is.
- Speed averages use actual processing time where present, converted from milliseconds to seconds.
- Quality rankings are shown only for pure quality metrics: OCR WER-derived accuracy, URL extraction accuracy, and STT speaker-aware WER scores. Dashboard smoke/e2e rows do not contain pure quality metrics and therefore contribute only price and speed.
- Zero-cost third-party rows remain in price rankings. Local and non-third-party services are excluded, including `unknown`, `extract`, `ocrmypdf`, `paddle-ocr`, `tesseract`, `whisper`, `kitten`, `llama.cpp`, `defuddle`, and `reverb`.
- Omitted 1 failed row. Missing metric counts are reported in the source summary and those missing values were omitted only from the affected metric average.

