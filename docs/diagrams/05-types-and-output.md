# Types, Metadata & Output Layout

Reference for filesystem outputs, runtime directories, and the full type system organized by pipeline step.

## Outline

- [Output Directory Structure](#output-directory-structure)
- [Runtime Directory Structure](#runtime-directory-structure)
- [Type System Overview](#type-system-overview)

## Output Directory Structure

```
output/
└── YYYY-MM-DD_HH-MM-SS_<sanitized-title>/
    │
    │  ── Metadata (metadata command, with --save) ──
    ├── metadata.json               # { step1 } — metadata only, no downloaded files
    │
    │  ── Media (stt command) ──
    ├── audio.wav                   # 16kHz mono PCM audio
    ├── transcription.txt           # [HH:MM:SS] timestamped text
    ├── prompt.md                   # Formatted prompt for LLM
    ├── metadata.json               # { step1, step2 }
    │
    │  ── Media (write command) ──
    ├── audio.wav
    ├── transcription.txt
    ├── prompt.md
    ├── text.json                   # structured service write output (default)
    ├── text.md                     # local or legacy markdown write output
    ├── speech.wav                  # (if --kitten-tts/--elevenlabs-tts/... set)
    ├── generated-image.*           # (if --gemini-image/--openai-image/... set)
    ├── generated-video.mp4         # (if --sora-video/--gemini-video/... set)
    ├── generated-music.mp3         # (if --elevenlabs-music/--minimax-music set)
    ├── metadata.json               # { step1, step2, step3[, step4, step5, step6, step7] }
    │
    │  ── Document (ocr command) ──
    ├── extraction.txt              # if --out text
    ├── extraction.json             # if --out json
    ├── extraction.tsv              # if --out tsv
    ├── extraction.hocr             # if --out hocr
    ├── metadata.json               # { step1, step2 }
    │                               # EPUB inspect mode writes metadata.json only
    │
    │  ── Document (write command) ──
    ├── extraction.<requested-format>
    ├── prompt.md
    ├── text.json                   # structured service write output (default)
    ├── text.md                     # local or legacy markdown write output
    ├── metadata.json               # { step1, step2, step3 }
    │
    │  ── Standalone commands (tts / image / music / video) ──
    ├── speech.wav                  # (tts command output)
    ├── generated-image.*           # (image command output)
    ├── generated-video.mp4         # (video command output)
    ├── generated-music.mp3         # (music command output)
    │
    │  ── Batch Processing ──
    └── output/YYYY-MM-DD_HH-MM-SS_<batch-label>/
        ├── info.json               # Batch manifest
        └── YYYY-MM-DD_HH-MM-SS_<item-title>/
            └── (individual item output files)
```

## Runtime Directory Structure

```
runtime/
├── bin/
│   ├── whisper-cli                 # Whisper.cpp binary
│   ├── llama-server                # llama.cpp server binary
│   ├── reverb/                     # Reverb ASR Python env
│   ├── kitten-tts/                 # Kitten TTS Python venv
│   └── lib/                        # Shared libraries
├── build/
│   └── whisper.cpp/                # Build artifacts
└── models/
    ├── whisper/                    # .bin model files (tiny, base, ...)
    ├── llama/                      # llama.cpp models (optional)
    └── reverb/                     # Reverb + diarization models
```

## Type System Overview

```
src/types/

┌──────────────────────────────────────────────────────────────────────────────┐
│  cli-types.ts                                                                │
│                                                                              │
│  ProcessCommand = 'metadata' | 'download' | 'stt' | 'write' | 'ocr'         │
│                 | 'tts' | 'image' | 'music' | 'video'                        │
│  OutputFormat   = 'text' | 'json' | 'tsv' | 'hocr'                          │
│  BatchOrder     = 'newest' | 'oldest'                                        │
│                                                                              │
│  RuntimeOptions {                                                            │
│    useReverb, useOpenAI, useGemini, useAnthropic,                            │
│    llamaModel, openaiModel, groqModel, geminiModel,                          │
│    anthropicModel, minimaxModel,                                             │
│    whisperModel, groqSttModel, elevenlabsSttModel, openaiSttModel,           │
│    mistralSttModel, assemblyaiSttModel,                                      │
│    diarizationSpeakerCount,                                                  │
│    price, allowOverBudget,                                                   │
│    reverbVerbatimicity, split, skipLLM,                                      │
│    dpi, lang, psm, oem, out, password, pageSeparator,                        │
│    preserveSpaces, rotate, useOcrmypdf, usePaddleOcr,                        │
│    batchLimit, batchAll, batchOrder, batchConcurrency,                       │
│    ttsSpeaker, kittenTtsModel, groqTtsModel, groqVoiceId,                    │
│    openaiTtsModel, openaiVoiceId, geminiTtsModel, geminiVoiceId,             │
│    elevenlabsTtsModel, elevenlabsVoiceId, minimaxTtsModel, minimaxTtsVoice,  │
│    geminiImageModel, openaiImageModel, minimaxImageModel,                    │
│    imageAspectRatio, imageSize, imageQuality, imageFormat, imageBackground,  │
│    imagenCount,                                                              │
│    elevenlabsMusicModel, minimaxMusicModel, musicDuration,                   │
│    musicLyricsFile, musicInstrumental,                                       │
│    soraVideoModel, geminiVideoModel, minimaxVideoModel,                      │
│    videoDuration, videoSize, videoAspectRatio, videoResolution,              │
│    prompts                                                                   │
│  }                                                                           │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  provider-types.ts                                                           │
│                                                                              │
│  TtsProvider   = 'kitten'|'elevenlabs'|'minimax'|'groq'|                    │
│                  'openai'|'gemini'                                           │
│  ImageProvider = 'gemini'|'openai'|'minimax'                                 │
│  VideoProvider = 'sora'|'gemini'|'minimax'                                   │
│  MusicProvider = 'elevenlabs'|'minimax'                                      │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  process-types.ts  (all validated with Valibot schemas)                      │
│                                                                              │
│  Step 1 (Download):                                                          │
│  ├── ProcessingOptions    url|filePath, whisper/llama/openai models, ...     │
│  ├── VideoMetadata        title, duration, author, url, publishDate, ...     │
│  ├── YtDlpVideoInfo       raw yt-dlp JSON output                             │
│  ├── Step1Metadata        videoUrl, videoTitle, channelTitle, audioFileName  │
│  ├── DocumentMetadata     title, author, pageCount, format, fileSize         │
│  └── DetectResult         'pdf'|'epub'|'image'|'docx'|'pptx'|'xlsx'|'odf'    │
│                                                                              │
│  Step 2 (Transcribe/Extract):                                                │
│  ├── TranscriptionResult  text + segments[]                                  │
│  ├── TranscriptionSegment start, end, text, speaker?                         │
│  ├── ExtractionOptions    filePath, outputDir, dpi, lang, oem, psm, ...      │
│  ├── ExtractionResult     text + pages[] + totalPages/ocrPages/textPages     │
│  ├── PageResult           pageNumber, method:'text'|'ocr'|'skipped', text    │
│  ├── ExtractionMetadata   extractionMethod, pages, processingTime, ...       │
│  ├── Step2Metadata        transcriptionService, model, time, tokenCount      │
│  │    transcriptionService: 'whisper'|'reverb'|'elevenlabs'|'groq'|'openai'|'mistral'|'assemblyai' │
│  ├── WhisperJsonOutput    whisper.cpp JSON output schema                     │
│  ├── ReverbOutput         reverb segments + speakers                         │
│  └── ElevenLabsSttResponse  ElevenLabs word/segment schema                   │
│                                                                              │
│  Step 3 (LLM):                                                               │
│  ├── Step3Metadata        llmService, llmModel, time, in/out tokens          │
│  │    llmService: 'llama.cpp'|'openai'|'groq'|'gemini'|'anthropic'|'minimax'│
│  └── LlamaResponseSchema  llama.cpp HTTP response format                     │
│                                                                              │
│  Step 4 (TTS):                                                               │
│  └── Step4Metadata        ttsService (TtsProvider), ttsModel, speaker?,      │
│       language?, processingTime, audioFileName, audioFileSize, chunkCount    │
│                                                                              │
│  Step 5 (Image Gen):                                                         │
│  └── Step5Metadata        imageService (ImageProvider), imageModel,          │
│       processingTime, imageFileName, imageFileSize, imageWidth, imageHeight  │
│                                                                              │
│  Step 6 (Video Gen):                                                         │
│  └── Step6VideoMetadata   videoGenService (VideoProvider), videoGenModel,    │
│       processingTime, videoFileName, videoFileSize, videoDuration            │
│                                                                              │
│  Step 7 (Music Gen):                                                         │
│  └── Step7MusicMetadata   musicService (MusicProvider), musicModel,          │
│       processingTime, musicFileName, musicFileSize, musicDurationMs,         │
│       lyricsSource: 'provided'|'generated'|'none'                            │
└──────────────────────────────────────────────────────────────────────────────┘
```
