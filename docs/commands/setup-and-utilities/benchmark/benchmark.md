# benchmark

Benchmark STT transcription quality across audio compression levels and playback speeds, or score voice quality for an existing TTS run.

## Outline

- [Usage](#usage)
- [Modes](#modes)
- [Flags](#flags)
- [Examples](#examples)
- [TTS voice-quality mode](#tts-voice-quality-mode)
- [How it works](#how-it-works)
  - [Phase 1: Prepare source audio](#phase-1-prepare-source-audio)
  - [Phase 2: Generate audio variants](#phase-2-generate-audio-variants)
  - [Phase 3: Reference transcription](#phase-3-reference-transcription)
  - [Phase 4: Transcribe variants](#phase-4-transcribe-variants)
  - [Phase 5: Compute quality scores](#phase-5-compute-quality-scores)
  - [Phase 6: Generate report](#phase-6-generate-report)
- [Compression spectrum](#compression-spectrum)
- [Speed spectrum](#speed-spectrum)
- [Word Error Rate (WER)](#word-error-rate-wer)
- [Output structure](#output-structure)
- [Report format](#report-format)
- [Service availability](#service-availability)
- [Notes](#notes)

## Usage

```bash
bun as benchmark <audio-file> [flags]
bun as benchmark <tts-run-dir> --tts [flags]
```

## Modes

Default STT mode takes an audio file, generates a spectrum of degraded versions (lower bitrates and faster playback speeds), transcribes each version through all available STT services, and produces a JSON report comparing transcription quality via Word Error Rate (WER). This identifies at what point compression or speed-up causes transcription quality to degrade for each service.

TTS mode is selected with `--tts`. It takes an existing AutoShow TTS run directory, reads `run.json`, derives the source text from `metadata.input`, scores all `metadata.tts[]` audio files, and writes voice quality reports beside the run.

## Flags

### STT flags

| Flag                 | Default                        | Description                                     |
|----------------------|--------------------------------|-------------------------------------------------|
| `--bitrates`         | `128,96,64,48,32,24,16,8`     | Comma-separated bitrate list in kbps            |
| `--speeds`           | `1.25,1.5,2.0,2.5,3.0`        | Comma-separated speed multipliers               |
| `--stt-services`     | all available                  | Comma-separated STT services to test            |
| `--reference-stt`    | `deepgram:nova-3`              | Service:model pair for reference transcription  |
| `--skip-compression` | `false`                        | Skip compression spectrum tests                 |
| `--skip-speed`       | `false`                        | Skip speed spectrum tests                       |
| `--output-dir`       | `output/benchmark/<timestamp>` | Custom output directory for STT benchmark files |

### TTS flags

| Flag                        | Default                  | Description                                                                    |
|-----------------------------|--------------------------|--------------------------------------------------------------------------------|
| `--tts`                     | `false`                  | Score an existing TTS run instead of running the STT compression/speed benchmark |
| `--tts-input-text`          | `metadata.input`         | Original source text, or a text file path, for older runs without `metadata.input` |
| `--tts-mode`                | `full`                   | `full` may call paid STT/audio judge APIs when credentials exist; `local` never does |
| `--tts-roundtrip-dir`       | none                     | Directory of existing roundtrip transcripts                                    |
| `--tts-metric-fixtures`     | none                     | JSON fixtures with precomputed model metrics and transcripts                    |
| `--tts-audio-judge-model`   | `gpt-audio`              | OpenAI audio-capable chat model for paid rubric judging                         |
| `--tts-keep-temp`           | `false`                  | Keep temporary normalized audio files                                           |

## Examples

```bash
# Full benchmark with all available STT services
bun as benchmark https://ajc.pics/autoshow/examples/1-audio.mp3

# Benchmark with local Whisper only (free, no API keys needed)
bun as benchmark https://ajc.pics/autoshow/examples/1-audio.mp3 --stt-services whisper

# Compression-only benchmark with select cloud services
bun as benchmark audio.mp3 --stt-services deepgram,groq --skip-speed

# Speed-only benchmark
bun as benchmark audio.mp3 --stt-services whisper,openai-stt --skip-compression

# Custom bitrate and speed ranges
bun as benchmark audio.mp3 --bitrates 96,64,32,16 --speeds 1.5,2.0,3.0

# Use a specific reference service
bun as benchmark audio.mp3 --reference-stt openai-stt:gpt-4o-transcribe

# Custom output location
bun as benchmark audio.mp3 --output-dir output/my-benchmark

# Score an existing TTS run with full scoring
bun as benchmark docs/benchmarks/tts/<run> --tts

# Score an existing TTS run without paid calls
bun as benchmark docs/benchmarks/tts/<run> --tts --tts-mode local

# Score a TTS run with existing roundtrip transcripts
bun as benchmark docs/benchmarks/tts/<run> --tts --tts-roundtrip-dir <dir>
```

## TTS voice-quality mode

`bun as benchmark <tts-run-dir> --tts` is analysis-only. It does not generate new TTS samples. The run directory must contain a TTS `run.json` with `metadata.tts[]`; each entry's `audioFileName` is resolved relative to the run directory.

By default, `--tts` uses `--tts-mode full`. Full mode computes local signal/prosody heuristics, uses any supplied fixtures or roundtrip transcripts, and may call OpenAI audio judging plus AssemblyAI/OpenAI roundtrip STT when the corresponding API keys are configured. Configured paid scoring calls are strict in full mode: if OpenAI judging or paid roundtrip STT is attempted and fails, the benchmark exits non-zero instead of recording a warning. Missing paid credentials still skip those metrics. Use `--tts-mode local` for a no-paid, warning-tolerant pass.

Outputs are written beside the run:

```
<tts-run-dir>/
  voice-quality-report.json
  voice-quality-report.md
  voice-quality-roundtrip/        # created only when full mode runs paid STT
```

The voice-quality score excludes cost, provider processing speed, and provider latency. It combines naturalness signals with speech-quality/intelligibility signals and records missing metrics per provider.

## How it works

### Phase 1: Prepare source audio

The input audio file is probed with ffprobe and normalized to a high-quality m4a baseline (128kbps, mono, AAC-LC). This source file serves as the starting point for all variant generation.

### Phase 2: Generate audio variants

Two spectrums of degraded audio are created using ffmpeg:

- **Compression variants**: The source is re-encoded at each specified bitrate (e.g., 128k, 96k, 64k, 48k, 32k, 24k, 16k, 8k) using AAC-LC in the m4a container.
- **Speed variants**: The source is sped up at each specified multiplier (e.g., 1.25x, 1.5x, 2.0x, 2.5x, 3.0x) using the ffmpeg `atempo` filter.

### Phase 3: Reference transcription

The original source audio is transcribed using the reference STT service (default: `deepgram:nova-3`). This transcription serves as the ground truth against which all variant transcriptions are compared.

### Phase 4: Transcribe variants

Each audio variant is transcribed through every available (or selected) STT service and model combination. Transcriptions are run sequentially per variant. Failed transcriptions are logged but do not halt the benchmark.

### Phase 5: Compute quality scores

Each variant transcription is compared against the reference using Word Error Rate (WER). Scores are computed per variant per service/model combination.

### Phase 6: Generate report

A JSON report is written containing all WER scores plus a summary section identifying:

- The lowest bitrate where each service stays below 10% WER (compression threshold)
- The highest speed where each service stays below 10% WER (speed threshold)
- Overall service rankings by average WER

## Compression spectrum

Default bitrates (kbps): `128, 96, 64, 48, 32, 24, 16, 8`

All compression variants are encoded as mono AAC-LC audio in the m4a (ipod) container format, matching the project's existing hosted STT normalization pipeline. The current pipeline default is 96kbps; this benchmark tests how far below that threshold each service can tolerate.

FFmpeg command per variant:

```bash
ffmpeg -i source.m4a -c:a aac -profile:a aac_low -b:a <bitrate> -ac 1 -f ipod <output>.m4a
```

## Speed spectrum

Default speed multipliers: `1.25, 1.5, 2.0, 2.5, 3.0`

Speed variants use the ffmpeg `atempo` audio filter. Since `atempo` only accepts values between 0.5 and 2.0, speeds above 2.0x are achieved by chaining multiple filters:

| Speed | Filter chain                   |
|-------|-------------------------------|
| 1.25x | `atempo=1.25`                 |
| 1.5x  | `atempo=1.5`                  |
| 2.0x  | `atempo=2.0`                  |
| 2.5x  | `atempo=2.0,atempo=1.25`      |
| 3.0x  | `atempo=2.0,atempo=1.5`       |

Speed variants are encoded at 96kbps to isolate the effect of speed from compression.

## Word Error Rate (WER)

WER is computed as:

```
WER = (Substitutions + Deletions + Insertions) / Reference Word Count
```

Before comparison, both reference and hypothesis texts are normalized: lowercased, punctuation stripped, whitespace collapsed. The algorithm uses standard Levenshtein distance on word-level tokens via dynamic programming.

A WER of 0.0 (0%) indicates a perfect match. A WER of 0.10 (10%) is used as the default threshold for identifying quality degradation. WER can exceed 1.0 for severely degraded transcriptions.

## Output structure

```
output/benchmark/<timestamp>/
  source.m4a                              # Normalized source audio
  variants/
    compression/
      128k.m4a                            # Compression variants
      96k.m4a
      ...
      8k.m4a
    speed/
      1.25x.m4a                           # Speed variants
      1.5x.m4a
      ...
      3.0x.m4a
  transcriptions/
    <variant-label>/
      <service>-<model>/
        benchmark-attempt.json              # Started/success/error status for this attempt
        transcription.txt                 # Per-variant per-service transcription
        result.json
        metadata.json
  report.json                             # Final benchmark report
```

## Report format

The `report.json` file contains:

```json
{
  "timestamp": "2026-04-25T12-00-00",
  "sourceAudio": "1-audio.mp3",
  "referenceService": "deepgram",
  "referenceModel": "nova-3",
  "referenceWordCount": 1234,
  "variants": [
    { "kind": "compression", "label": "32k", "bitrateKbps": 32 }
  ],
  "services": [
    { "service": "deepgram", "model": "nova-3" }
  ],
  "attempts": {
    "total": 1,
    "succeeded": 1,
    "failed": 0
  },
  "errors": [],
  "compressionResults": [
    {
      "variant": { "kind": "compression", "label": "32k", "bitrateKbps": 32 },
      "service": "deepgram",
      "model": "nova-3",
      "wer": 0.023,
      "substitutions": 12,
      "deletions": 8,
      "insertions": 5,
      "referenceWordCount": 1234,
      "processingTimeMs": 3200
    }
  ],
  "speedResults": [],
  "summary": {
    "bestCompressionThreshold": {
      "service": "deepgram",
      "model": "nova-3",
      "minBitrateKbps": 16,
      "werAtThreshold": 0.045
    },
    "bestSpeedThreshold": {
      "service": "openai-stt",
      "model": "gpt-4o-transcribe",
      "maxSpeed": 2.5,
      "werAtThreshold": 0.078
    },
    "serviceRankings": [
      { "service": "deepgram", "model": "nova-3", "averageWer": 0.031 },
      { "service": "openai-stt", "model": "gpt-4o-transcribe", "averageWer": 0.042 }
    ]
  }
}
```

Every scheduled service/model/variant writes `benchmark-attempt.json` before provider execution starts, then overwrites it with `success` or `error`. If a run is interrupted or a provider fails before creating `result.json`, inspect this file to distinguish a started-but-incomplete attempt from a provider that was never scheduled.

## Service availability

The benchmark automatically detects which STT services are available based on environment variables and installed CLI tools:

| Service       | Requires                    |
|---------------|-----------------------------|
| whisper       | `whisper-cpp` binary        |
| deepgram      | `DEEPGRAM_API_KEY`          |
| groq          | `GROQ_API_KEY`              |
| grok          | `XAI_API_KEY`               |
| deepinfra     | `DEEPINFRA_API_KEY`         |
| openai-stt    | `OPENAI_API_KEY`            |
| gemini-stt    | `GEMINI_API_KEY`            |
| glm-stt       | `GLM_API_KEY`               |
| elevenlabs    | `ELEVENLABS_API_KEY`        |
| mistral       | `MISTRAL_API_KEY`           |
| assemblyai    | `ASSEMBLYAI_API_KEY`        |
| soniox        | `SONIOX_API_KEY`            |
| speechmatics  | `SPEECHMATICS_API_KEY`      |
| rev           | `REVAI_ACCESS_TOKEN`        |
| gladia        | `GLADIA_API_KEY`            |
| happyscribe   | `HAPPYSCRIBE_API_KEY`       |
| deapi         | `DEAPI_API_KEY`             |
| gcloud        | `gcloud` CLI                |
| aws           | `aws` CLI                   |

Services that require URLs (`youtube-captions`, `supadata`, `scrapecreators`) are excluded since the benchmark works with locally-generated audio files.

Use `--stt-services` to restrict to a subset (e.g., `--stt-services whisper,deepgram,groq`).

## Notes

- Running all services across all variants generates many API calls. Use `--stt-services` to limit scope and control costs.
- The benchmark reuses the project's existing `sttTarget()` dispatch infrastructure, so all service-specific behaviors (auto-splitting, retry logic, async polling) apply.
- For a free initial test, use `--stt-services whisper` which runs entirely locally.
- The reference transcription quality matters: choose a high-quality service as the reference to ensure meaningful WER comparisons.
- Speed variants test how well services handle faster speech, not content changes. The same words are spoken in all speed variants.
