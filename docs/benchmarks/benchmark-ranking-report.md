# Benchmark Ranking Report

This report averages available benchmark rows into per-step third-party provider/model rankings. It intentionally does not compute a combined overall score.

## Source Summary

- Reconciled `project/reports/results/index.json` with 17 listed dashboard report files.
- Used 9 raw comparison reports and 8 test-run dashboard reports.
- Skipped 9 benchmark dashboard reports because matching raw comparison reports are canonical for those runs.
- Saw 353 provider/test rows: included 228, excluded 124 local or non-third-party rows, omitted 1 failed row, skipped 0 unsupported-category rows, and skipped 0 rows with no measurable metrics.
- Filled 26 raw price rows from sibling run estimates where raw comparison costs were zero or missing.
- Missing metrics among otherwise included rows: price 2, speed 0, quality 34 in quality-ranked steps.
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

## Step 1 Download

No measurable third-party download rows were present in the reconciled benchmark inputs.

## Step 2 Document OCR

### Top 9 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Fastest | mistral/mistral-ocr-2512 | 5.405 average seconds | 1 | 5 | Fastest: lowest processing time |
| Fastest | aws-textract/detect-text | 14.279 average seconds | 4 | 3 | Fastest: lowest processing time |
| Fastest | anthropic/claude-haiku-4-5 | 27.097 average seconds | 6 | 5 | Fastest: lowest processing time |
| Cheapest | gemini/gemini-3.1-flash-lite-preview | $0.001974 average cost | 2 | 5 | Cheapest: lowest cost |
| Cheapest | openai/gpt-5.4-nano | $0.002013 average cost | 3 | 5 | Cheapest: lowest cost |
| Cheapest | deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct | $0.003284 average cost | 4 | 5 | Cheapest: lowest cost |
| Best | gemini/gemini-3.1-pro-preview | 95.78 WER accuracy score | 1 | 3 | Best: highest quality score |
| Best | kimi/kimi-k2.6 | 94.97 WER accuracy score | 2 | 3 | Best: highest quality score |
| Best | glm/glm-ocr | 87.34 WER accuracy score | 3 | 3 | Best: highest quality score |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | glm/glm-ocr | 0.000345 | 3 |
| 2 | gemini/gemini-3.1-flash-lite-preview | 0.001974 | 5 |
| 3 | openai/gpt-5.4-nano | 0.002013 | 5 |
| 4 | deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct | 0.003284 | 5 |
| 5 | mistral/mistral-ocr-2512 | 0.004800 | 5 |
| 6 | aws-textract/detect-text | 0.005000 | 3 |
| 7 | gcloud-docai/ocr | 0.005000 | 3 |
| 8 | deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct | 0.006721 | 3 |
| 9 | anthropic/claude-haiku-4-5 | 0.012703 | 5 |
| 10 | kimi/kimi-k2.6 | 0.015190 | 5 |
| 11 | gemini/gemini-3.1-pro-preview | 0.031751 | 3 |
| 12 | openai/gpt-5.4 | 0.052451 | 3 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | mistral/mistral-ocr-2512 | 5.405 | 5 |
| 2 | gemini/gemini-3.1-flash-lite-preview | 6.346 | 5 |
| 3 | openai/gpt-5.4-nano | 11.675 | 5 |
| 4 | aws-textract/detect-text | 14.279 | 3 |
| 5 | glm/glm-ocr | 15.383 | 3 |
| 6 | anthropic/claude-haiku-4-5 | 27.097 | 5 |
| 7 | deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct | 33.982 | 5 |
| 8 | gcloud-docai/ocr | 36.590 | 3 |
| 9 | openai/gpt-5.4 | 37.233 | 3 |
| 10 | kimi/kimi-k2.6 | 42.938 | 5 |
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

### Top 9 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Cheapest | zyte/zyte | $0.001600 average cost | 3 | 2 | Cheapest: lowest cost |
| Best | firecrawl/firecrawl | 98.06 URL extraction accuracy score | 1 | 2 | Best: highest quality score |
| Best | spider/spider | 96.86 URL extraction accuracy score | 2 | 2 | Best: highest quality score |
| Best | glm-reader/glm-reader | 65.70 URL extraction accuracy score | 3 | 2 | Best: highest quality score |

Only 4 picks are shown because only 4 unique provider/models had eligible ranking rows for this step.

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | firecrawl/firecrawl | 0.000830 | 3 |
| 2 | spider/spider | 0.001200 | 2 |
| 3 | zyte/zyte | 0.001600 | 2 |
| 4 | glm-reader/glm-reader | 0.010000 | 2 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | firecrawl/firecrawl | 1.453 | 3 |
| 2 | spider/spider | 1.810 | 2 |
| 3 | glm-reader/glm-reader | 2.748 | 3 |
| 4 | zyte/zyte | 12.229 | 2 |

### Quality

| Rank | Provider/model | Average quality score | Quality samples | Metric |
| ---: | --- | ---: | ---: | --- |
| 1 | firecrawl/firecrawl | 98.06 | 2 | URL extraction accuracy score |
| 2 | spider/spider | 96.86 | 2 | URL extraction accuracy score |
| 3 | glm-reader/glm-reader | 65.70 | 2 | URL extraction accuracy score |
| 4 | zyte/zyte | 57.04 | 2 | URL extraction accuracy score |

## Step 2 Transcription/STT

### Top 9 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Fastest | supadata/generate | 1.772 average seconds | 1 | 1 | Fastest: lowest processing time |
| Fastest | deepgram/nova-3 | 3.513 average seconds | 2 | 4 | Fastest: lowest processing time |
| Fastest | together/openai/whisper-large-v3 | 5.025 average seconds | 3 | 3 | Fastest: lowest processing time |
| Cheapest | deepinfra/openai/whisper-large-v3-turbo | $0.002618 average cost | 1 | 4 | Cheapest: lowest cost |
| Cheapest | deepinfra/openai/whisper-large-v3 | $0.005891 average cost | 2 | 4 | Cheapest: lowest cost |
| Cheapest | grok/speech-to-text | $0.006654 average cost | 3 | 3 | Cheapest: lowest cost |
| Best | assemblyai/universal-3-pro | 96.72 speaker-aware WER score | 1 | 3 | Best: highest quality score |
| Best | mistral/voxtral-mini-2602 | 95.85 speaker-aware WER score | 2 | 3 | Best: highest quality score |
| Best | speechmatics/enhanced | 95.40 speaker-aware WER score | 3 | 3 | Best: highest quality score |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | deepinfra/openai/whisper-large-v3-turbo | 0.002618 | 4 |
| 2 | deepinfra/openai/whisper-large-v3 | 0.005891 | 4 |
| 3 | grok/speech-to-text | 0.006654 | 3 |
| 4 | deapi/WhisperLargeV3 | 0.008441 | 5 |
| 5 | groq/whisper-large-v3-turbo | 0.008727 | 4 |
| 6 | supadata/generate | 0.020000 | 1 |
| 7 | supadata/native | 0.020000 | 1 |
| 8 | soniox/stt-async-v4 | 0.021817 | 4 |
| 9 | rev/low_cost | 0.021826 | 4 |
| 10 | groq/whisper-large-v3 | 0.024217 | 4 |
| 11 | together/openai/whisper-large-v3 | 0.025689 | 3 |
| 12 | gemini-stt/gemini-3-flash-preview | 0.032881 | 3 |
| 13 | elevenlabs/scribe_v2 | 0.039119 | 5 |
| 14 | mistral/voxtral-mini-2602 | 0.039270 | 4 |
| 15 | glm-stt/glm-asr-2512 | 0.041102 | 3 |
| 16 | rev/machine | 0.043653 | 4 |
| 17 | assemblyai/universal-3-pro | 0.045815 | 4 |
| 18 | openai-stt/gpt-4o-mini-transcribe | 0.051377 | 3 |
| 19 | speechmatics/standard | 0.098176 | 4 |
| 20 | openai-stt/gpt-4o-transcribe | 0.102754 | 3 |
| 21 | deepgram/nova-3 | 0.126974 | 4 |
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
| 2 | deepgram/nova-3 | 3.513 | 4 |
| 3 | together/openai/whisper-large-v3 | 5.025 | 3 |
| 4 | supadata/native | 5.118 | 1 |
| 5 | supadata/auto | 6.174 | 3 |
| 6 | grok/speech-to-text | 8.094 | 4 |
| 7 | groq/whisper-large-v3 | 9.401 | 4 |
| 8 | deepinfra/openai/whisper-large-v3-turbo | 10.319 | 4 |
| 9 | groq/whisper-large-v3-turbo | 11.305 | 4 |
| 10 | mistral/voxtral-mini-2602 | 14.221 | 4 |
| 11 | assemblyai/universal-3-pro | 18.319 | 4 |
| 12 | deepinfra/openai/whisper-large-v3 | 20.875 | 4 |
| 13 | openai-stt/gpt-4o-mini-transcribe | 26.599 | 3 |
| 14 | gladia/default | 29.137 | 4 |
| 15 | speechmatics/standard | 30.448 | 4 |
| 16 | soniox/stt-async-v4 | 37.672 | 4 |
| 17 | deapi/WhisperLargeV3 | 43.091 | 5 |
| 18 | elevenlabs/scribe_v2 | 43.460 | 5 |
| 19 | openai-stt/gpt-4o-transcribe | 45.093 | 3 |
| 20 | speechmatics/enhanced | 46.734 | 4 |
| 21 | rev/machine | 47.839 | 4 |
| 22 | aws/standard | 73.734 | 4 |
| 23 | glm-stt/glm-asr-2512 | 75.337 | 3 |
| 24 | happyscribe/auto | 78.429 | 3 |
| 25 | rev/low_cost | 88.662 | 4 |
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

### Top 9 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Fastest | openai/gpt-5.4 | 1.970 average seconds | 3 | 2 | Fastest: lowest processing time |
| Fastest | anthropic/claude-opus-4-7 | 2.290 average seconds | 4 | 1 | Fastest: lowest processing time |
| Fastest | gemini/gemini-3.1-flash-lite-preview | 2.305 average seconds | 5 | 1 | Fastest: lowest processing time |
| Cheapest | groq/openai/gpt-oss-20b | $0.000030 average cost | 1 | 1 | Cheapest: lowest cost |
| Cheapest | minimax/MiniMax-M2.5-highspeed | $0.000274 average cost | 2 | 1 | Cheapest: lowest cost |
| Cheapest | openai/gpt-5.4-mini | $0.000331 average cost | 3 | 1 | Cheapest: lowest cost |
| Best | openai/gpt-5.4-pro | $0.013080 average cost | 14 | 1 | Best proxy: highest cost |
| Best | kimi/kimi-k2.6 | $0.002891 average cost | 13 | 1 | Best proxy: highest cost |
| Best | anthropic/claude-haiku-4-5 | $0.002460 average cost | 12 | 1 | Best proxy: highest cost |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | groq/openai/gpt-oss-20b | 0.000030 | 1 |
| 2 | minimax/MiniMax-M2.5-highspeed | 0.000274 | 1 |
| 3 | openai/gpt-5.4-mini | 0.000331 | 1 |
| 4 | minimax/MiniMax-M2.5 | 0.000604 | 1 |
| 5 | gemini/gemini-3.1-flash-lite-preview | 0.000666 | 1 |
| 6 | openai/gpt-5.4-nano | 0.000708 | 1 |
| 7 | gemini/gemini-3.1-pro-preview | 0.000944 | 1 |
| 8 | openai/gpt-5.4 | 0.001097 | 2 |
| 9 | anthropic/claude-sonnet-4-6 | 0.001335 | 1 |
| 10 | anthropic/claude-opus-4-6 | 0.002175 | 1 |
| 11 | anthropic/claude-opus-4-7 | 0.002225 | 1 |
| 12 | anthropic/claude-haiku-4-5 | 0.002460 | 1 |
| 13 | kimi/kimi-k2.6 | 0.002891 | 1 |
| 14 | openai/gpt-5.4-pro | 0.013080 | 1 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | groq/openai/gpt-oss-20b | 0.236 | 1 |
| 2 | openai/gpt-5.4-mini | 1.199 | 1 |
| 3 | openai/gpt-5.4 | 1.970 | 2 |
| 4 | anthropic/claude-opus-4-7 | 2.290 | 1 |
| 5 | gemini/gemini-3.1-flash-lite-preview | 2.305 | 1 |
| 6 | anthropic/claude-sonnet-4-6 | 2.570 | 1 |
| 7 | anthropic/claude-opus-4-6 | 2.682 | 1 |
| 8 | openai/gpt-5.4-nano | 6.730 | 1 |
| 9 | anthropic/claude-haiku-4-5 | 6.801 | 1 |
| 10 | minimax/MiniMax-M2.5 | 7.500 | 1 |
| 11 | gemini/gemini-3.1-pro-preview | 7.834 | 1 |
| 12 | minimax/MiniMax-M2.5-highspeed | 13.775 | 1 |
| 13 | kimi/kimi-k2.6 | 16.736 | 1 |
| 14 | openai/gpt-5.4-pro | 51.259 | 1 |

Quality: No pure LLM quality metric is present in these benchmark files.

## Step 4 TTS

### Top 9 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Fastest | elevenlabs/eleven_turbo_v2_5 | 1.058 average seconds | 1 | 2 | Fastest: lowest processing time |
| Fastest | elevenlabs/eleven_flash_v2_5 | 1.286 average seconds | 2 | 2 | Fastest: lowest processing time |
| Fastest | mistral/voxtral-mini-tts-2603 | 3.797 average seconds | 4 | 2 | Fastest: lowest processing time |
| Cheapest | gemini/gemini-2.5-flash-preview-tts | $0.000197 average cost | 1 | 2 | Cheapest: lowest cost |
| Cheapest | gemini/gemini-2.5-pro-preview-tts | $0.000393 average cost | 2 | 2 | Cheapest: lowest cost |
| Cheapest | grok/grok-tts | $0.000735 average cost | 3 | 1 | Cheapest: lowest cost |
| Best | elevenlabs/eleven_v3 | $0.045470 average cost | 14 | 2 | Best proxy: highest cost |
| Best | runway/eleven_multilingual_v2 | $0.040000 average cost | 13 | 1 | Best proxy: highest cost |
| Best | minimax/speech-2.8-hd | $0.039350 average cost | 12 | 2 | Best proxy: highest cost |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | gemini/gemini-2.5-flash-preview-tts | 0.000197 | 2 |
| 2 | gemini/gemini-2.5-pro-preview-tts | 0.000393 | 2 |
| 3 | grok/grok-tts | 0.000735 | 1 |
| 4 | mistral/voxtral-mini-tts-2603 | 0.001912 | 2 |
| 5 | openai/gpt-4o-mini-tts | 0.003258 | 5 |
| 6 | gemini/gemini-3.1-flash-tts-preview | 0.006601 | 3 |
| 7 | deepgram/aura-2-thalia-en | 0.011805 | 2 |
| 8 | groq/canopylabs/orpheus-v1-english | 0.012592 | 2 |
| 9 | elevenlabs/eleven_flash_v2_5 | 0.022735 | 2 |
| 10 | elevenlabs/eleven_turbo_v2_5 | 0.022735 | 2 |
| 11 | minimax/speech-2.8-turbo | 0.023610 | 2 |
| 12 | minimax/speech-2.8-hd | 0.039350 | 2 |
| 13 | runway/eleven_multilingual_v2 | 0.040000 | 1 |
| 14 | elevenlabs/eleven_v3 | 0.045470 | 2 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | elevenlabs/eleven_turbo_v2_5 | 1.058 | 2 |
| 2 | elevenlabs/eleven_flash_v2_5 | 1.286 | 2 |
| 3 | grok/grok-tts | 3.330 | 1 |
| 4 | mistral/voxtral-mini-tts-2603 | 3.797 | 2 |
| 5 | openai/gpt-4o-mini-tts | 5.051 | 5 |
| 6 | groq/canopylabs/orpheus-v1-english | 5.332 | 2 |
| 7 | gemini/gemini-2.5-flash-preview-tts | 10.342 | 2 |
| 8 | gemini/gemini-3.1-flash-tts-preview | 10.932 | 3 |
| 9 | runway/eleven_multilingual_v2 | 10.972 | 1 |
| 10 | elevenlabs/eleven_v3 | 11.776 | 2 |
| 11 | deepgram/aura-2-thalia-en | 11.935 | 2 |
| 12 | minimax/speech-2.8-turbo | 15.357 | 2 |
| 13 | minimax/speech-2.8-hd | 17.654 | 2 |
| 14 | gemini/gemini-2.5-pro-preview-tts | 22.476 | 2 |

Quality: No TTS quality ranking is shown because roundtrip WER is null in the current raw TTS comparison and dashboard rows do not contain a pure TTS quality metric.

## Step 5 Image

### Top 9 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Fastest | gemini/imagen-4.0-fast-generate-001 | 4.408 average seconds | 2 | 1 | Fastest: lowest processing time |
| Fastest | gemini/imagen-4.0-generate-001 | 4.745 average seconds | 3 | 1 | Fastest: lowest processing time |
| Fastest | deapi/ZImageTurbo_INT8 | 7.512 average seconds | 5 | 1 | Fastest: lowest processing time |
| Cheapest | deapi/Flux1schnell | $0.001360 average cost | 1 | 1 | Cheapest: lowest cost |
| Cheapest | deapi/Flux_2_Klein_4B_BF16 | $0.001860 average cost | 2 | 1 | Cheapest: lowest cost |
| Cheapest | minimax/image-01 | $0.003500 average cost | 3 | 1 | Cheapest: lowest cost |
| Best | openai/gpt-image-1.5 | $0.080000 average cost | 15 | 1 | Best proxy: highest cost |
| Best | grok/grok-imagine-image | $0.070000 average cost | 14 | 1 | Best proxy: highest cost |
| Best | gemini/imagen-4.0-ultra-generate-001 | $0.060000 average cost | 13 | 1 | Best proxy: highest cost |

### Price

| Rank | Provider/model | Average cost (USD) | Samples |
| ---: | --- | ---: | ---: |
| 1 | deapi/Flux1schnell | 0.001360 | 1 |
| 2 | deapi/Flux_2_Klein_4B_BF16 | 0.001860 | 1 |
| 3 | minimax/image-01 | 0.003500 | 1 |
| 4 | deapi/ZImageTurbo_INT8 | 0.004050 | 1 |
| 5 | openai/gpt-image-2 | 0.005000 | 2 |
| 6 | gemini/imagen-4.0-fast-generate-001 | 0.020000 | 1 |
| 7 | bfl/flux-2-pro-preview | 0.030000 | 1 |
| 8 | gemini/imagen-4.0-generate-001 | 0.040000 | 1 |
| 9 | runway/gen4_image | 0.050000 | 1 |
| 10 | gemini/imagen-4.0-ultra-generate-001 | 0.060000 | 1 |
| 11 | grok/grok-imagine-image | 0.070000 | 1 |
| 12 | openai/gpt-image-1.5 | 0.080000 | 1 |

### Speed

| Rank | Provider/model | Average seconds | Samples |
| ---: | --- | ---: | ---: |
| 1 | grok/grok-imagine-image | 2.970 | 1 |
| 2 | gemini/imagen-4.0-fast-generate-001 | 4.408 | 1 |
| 3 | gemini/imagen-4.0-generate-001 | 4.745 | 1 |
| 4 | deapi/Flux_2_Klein_4B_BF16 | 6.602 | 1 |
| 5 | deapi/ZImageTurbo_INT8 | 7.512 | 1 |
| 6 | deapi/Flux1schnell | 7.904 | 1 |
| 7 | gemini/imagen-4.0-ultra-generate-001 | 10.611 | 1 |
| 8 | bfl/flux-2-pro-preview | 11.713 | 1 |
| 9 | minimax/image-01 | 14.835 | 1 |
| 10 | runway/gen4_image | 30.984 | 1 |
| 11 | openai/gpt-image-2 | 34.853 | 2 |
| 12 | openai/gpt-image-1.5 | 48.361 | 1 |

Quality: No pure image quality metric is present in these benchmark files.

## Step 6 Video

### Top 9 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Fastest | gemini/veo-3.1-lite-generate-preview | 31.424 average seconds | 2 | 1 | Fastest: lowest processing time |
| Fastest | minimax/MiniMax-Hailuo-2.3 | 104.601 average seconds | 6 | 1 | Fastest: lowest processing time |
| Cheapest | deapi/Ltxv_13B_0_9_8_Distilled_FP8 | $0.000868 average cost | 1 | 1 | Cheapest: lowest cost |
| Cheapest | minimax/T2V-01 | $0.190000 average cost | 2 | 1 | Cheapest: lowest cost |
| Cheapest | minimax/T2V-01-Director | $0.190000 average cost | 3 | 1 | Cheapest: lowest cost |
| Best | gemini/veo-3.1-generate-preview | $1.600000 average cost | 8 | 1 | Best proxy: highest cost |
| Best | gemini/veo-3.1-fast-generate-preview | $0.400000 average cost | 7 | 1 | Best proxy: highest cost |
| Best | minimax/MiniMax-Hailuo-02 | $0.280000 average cost | 5 | 1 | Best proxy: highest cost |

Only 8 picks are shown because only 8 unique provider/models had eligible ranking rows for this step.

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

### Top 9 Picks

| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |
| --- | --- | --- | ---: | ---: | --- |
| Best | minimax/music-2.5 | $0.150000 average cost | 3 | 1 | Best proxy: highest cost |
| Best | gemini/lyria-3-clip-preview | $0.040000 average cost | 2 | 1 | Best proxy: highest cost |
| Best | elevenlabs/music_v1 | $0.014000 average cost | 1 | 2 | Best proxy: highest cost |

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

