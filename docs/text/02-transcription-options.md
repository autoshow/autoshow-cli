# Transcription Options

## Outline

- [Get Transcription Cost](#get-transcription-cost)
- [Transcription Services](#transcription-services)
  - [Whisper](#whisper)
  - [Whisper CoreML](#whisper-coreml)
  - [Whisper Diarization](#whisper-diarization)
  - [Deepgram](#deepgram)
  - [Assembly](#assembly)

## Get Transcription Cost

```bash
npm run as -- --transcriptCost "input/audio.mp3" --deepgram
npm run as -- --transcriptCost "input/audio.mp3" --assembly
```

## Transcription Services

### Whisper

If neither the `--deepgram` or `--assembly` option is included for transcription, `autoshow` will default to running the largest Whisper.cpp model. To configure the size of the Whisper model, use the `--model` option and select one of the following:

```bash
npm run as -- text --file "input/audio.mp3" --whisper tiny
npm run as -- text --file "input/audio.mp3" --whisper base
npm run as -- text --file "input/audio.mp3" --whisper small
npm run as -- text --file "input/audio.mp3" --whisper medium
npm run as -- text --file "input/audio.mp3" --whisper large-v3-turbo
```

### Whisper CoreML

```bash
npm run as -- text --file "input/audio.mp3" --whisper-coreml large-v3-turbo
```

### Whisper Diarization

The `--whisper-diarization` option combines OpenAI Whisper with advanced speaker diarization capabilities using Voice Activity Detection (VAD) and Speaker Embedding to identify different speakers in the audio. This option provides automatic speaker identification and separation.

```bash
npm run as -- text --file "input/audio.mp3" --whisper-diarization
```

Select model:

```bash
npm run as -- text --file "input/audio.mp3" --whisper-diarization medium.en
npm run as -- text --file "input/audio.mp3" --whisper-diarization large-v3
npm run as -- text --file "input/audio.mp3" --whisper-diarization base.en
```

The whisper-diarization service automatically:
- Extracts vocals from audio to improve speaker embedding accuracy
- Generates transcription using Whisper
- Corrects and aligns timestamps using forced alignment
- Uses MarbleNet for Voice Activity Detection (VAD) and segmentation
- Applies TitaNet for speaker embedding extraction
- Associates timestamps with speakers for each word and realigns using punctuation models

### Deepgram

```bash
npm run as -- text --file "input/audio.mp3" --deepgram
```

Select model:

```bash
npm run as -- text --file "input/audio.mp3" --deepgram nova-3
npm run as -- text --file "input/audio.mp3" --deepgram nova-2
```

Include Deepgram API key directly in CLI command instead of in `.env` file:

```bash
npm run as -- text \
  --file "input/audio.mp3" \
  --deepgram \
  --deepgramApiKey ""
```

### Assembly

```bash
npm run as -- text --file "input/audio.mp3" --assembly
```

Select model:

```bash
npm run as -- text --file "input/audio.mp3" --assembly nano
npm run as -- text --file "input/audio.mp3" --assembly slam-1
npm run as -- text --file "input/audio.mp3" --assembly universal
```

Include speaker labels and number of speakers:

```bash
npm run as -- text \
  --video "https://ajc.pics/audio/fsjam-short.mp3" \
  --assembly \
  --speakerLabels
```

Include Assembly API key directly in CLI command instead of in `.env` file:

```bash
npm run as -- text \
  --file "input/audio.mp3" \
  --assembly \
  --assemblyApiKey ""
```