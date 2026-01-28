# Transcription Options

## Outline

- [Get Transcription Cost](#get-transcription-cost)
- [Transcription Services](#transcription-services)
  - [Whisper](#whisper)
  - [Whisper CoreML](#whisper-coreml)
  - [Deepgram](#deepgram)
  - [Assembly](#assembly)
  - [Reverb (ASR + Diarization)](#reverb-asr--diarization)

## Get Transcription Cost

```bash
bun as -- --transcriptCost "input/audio.mp3" --deepgram
bun as -- --transcriptCost "input/audio.mp3" --assembly
```

## Transcription Services

### Whisper

If neither the `--deepgram` or `--assembly` option is included for transcription, `autoshow` will default to running the largest Whisper.cpp model. To configure the size of the Whisper model, use the `--model` option and select one of the following:

```bash
bun as -- text --file "input/audio.mp3" --whisper tiny
bun as -- text --file "input/audio.mp3" --whisper base
bun as -- text --file "input/audio.mp3" --whisper small
bun as -- text --file "input/audio.mp3" --whisper medium
bun as -- text --file "input/audio.mp3" --whisper large-v3-turbo
```

### Whisper CoreML

```bash
bun as -- text --file "input/audio.mp3" --whisper-coreml large-v3-turbo
```

### Deepgram

```bash
bun as -- text --file "input/audio.mp3" --deepgram
```

Select model:

```bash
bun as -- text --file "input/audio.mp3" --deepgram nova-3
bun as -- text --file "input/audio.mp3" --deepgram nova-2
```

Include Deepgram API key directly in CLI command instead of in `.env` file:

```bash
bun as -- text \
  --file "input/audio.mp3" \
  --deepgram \
  --deepgramApiKey ""
```

### Assembly

```bash
bun as -- text --file "input/audio.mp3" --assembly
```

Select model:

```bash
bun as -- text --file "input/audio.mp3" --assembly nano
bun as -- text --file "input/audio.mp3" --assembly slam-1
bun as -- text --file "input/audio.mp3" --assembly universal
```

Include speaker labels and number of speakers:

```bash
bun as -- text \
  --video "https://ajc.pics/autoshow/fsjam-short.mp3" \
  --assembly \
  --speakerLabels
```

Include Assembly API key directly in CLI command instead of in `.env` file:

```bash
bun as -- text \
  --file "input/audio.mp3" \
  --assembly \
  --assemblyApiKey ""
```

### Reverb (ASR + Diarization)

Reverb always runs with diarization enabled. If you do not specify a diarization version, it defaults to `v2`.
Run `bun setup:reverb` before using this service.

```bash
bun as -- text --file "input/audio.mp3" --reverb
```

Select diarization model version:

```bash
bun as -- text --file "input/audio.mp3" --reverb --reverb-diarization v1
bun as -- text --file "input/audio.mp3" --reverb --reverb-diarization v2
```

Reverb diarization requires a HuggingFace token:

```bash
export HF_TOKEN="your_hf_token"
```
