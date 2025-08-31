# Transcription Options

## Outline

- [Get Transcription Cost](#get-transcription-cost)
- [Transcription Services](#transcription-services)
  - [Whisper](#whisper)
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
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --whisper tiny
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --whisper base
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --whisper small
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --whisper medium
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --whisper large-v3-turbo
```

### Whisper Diarization

The `--whisper-diarization` option combines OpenAI Whisper with advanced speaker diarization capabilities using Voice Activity Detection (VAD) and Speaker Embedding to identify different speakers in the audio. This option provides automatic speaker identification and separation.

```bash
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --whisper-diarization
```

Select model:

```bash
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --whisper-diarization medium.en
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --whisper-diarization large-v2
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --whisper-diarization base.en
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
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --deepgram
```

Select model:

```bash
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --deepgram nova-3
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --deepgram nova-2
```

Include Deepgram API key directly in CLI command instead of in `.env` file:

```bash
npm run as -- text \
  --video "https://www.youtube.com/watch?v=MORMZXEaONk" \
  --deepgram \
  --deepgramApiKey ""
```

### Assembly

```bash
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --assembly
```

Select model:

```bash
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --assembly nano
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --assembly slam-1
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --assembly universal
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
  --video "https://www.youtube.com/watch?v=MORMZXEaONk" \
  --assembly \
  --assemblyApiKey ""
```