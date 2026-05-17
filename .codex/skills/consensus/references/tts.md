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

Highest-quality rankings use roundtrip WER when available, or explicit voice-quality report data if already present. Duration, bitrate, file size, and subjective judgment are not quality proxies.
