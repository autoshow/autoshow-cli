# TTS Consensus

Use this category for AutoShow text-to-speech runs with `run.json` metadata, generated audio files in the run directory root, and the original input text.

## Packet

```bash
bun scripts/run.ts tts build-packet "$RUN_DIR" --input-text /path/to/input.txt --out "$TMP_PACKET"
```

The packet verifies audio artifacts and records measurable metadata such as duration, speaking rate, processing time, and cost.

## Evaluation

Write `consensus-evaluation.txt` as plain text. Do not claim to have listened to audio or assessed voice quality unless an explicit voice-quality report already provides that metric.

## Report

```bash
bun scripts/run.ts tts build-report "$RUN_DIR" --input-text /path/to/input.txt
```

With local roundtrip STT transcripts already present:

```bash
bun scripts/run.ts tts build-report "$RUN_DIR" --input-text /path/to/input.txt --roundtrip-dir /path/to/roundtrip
```

TTS reports expose complete local and third-party service rankings for `price`, `speed`, `automatedQuality`, and `humanQuality`. These TTS arrays are not capped at three providers.

Compatibility aliases are preserved:

1. `fastest` is the same ranking as `speed`.
2. `cheapest` is the same ranking as `price`.
3. `highestQuality` is the same ranking as `humanQuality` when human scores are present, otherwise `automatedQuality`.

Automated quality uses roundtrip WER-derived accuracy when available, including median roundtrip WER from `voice-quality-report.json`. Human quality uses `humanSpeechScore` from `voice-quality-report.json`. Duration, bitrate, file size, and subjective judgment are not quality proxies.

Markdown should use Local Models and Third-Party Service Models sections and should not describe TTS ranking surfaces as “Top 3”.
