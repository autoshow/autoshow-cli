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
    ├── run.json                    # { step1 } — metadata only, no downloaded files
    │
    │  ── Media (extract command routed to STT) ──
    ├── audio.(mp3|m4a|ogg|flac)    # normalized compressed audio-only artifact
    ├── transcription.txt           # [HH:MM:SS] timestamped text
    ├── prompt.md                   # Formatted prompt for LLM
    ├── run.json                    # { step1, step2 }
    │
    │  ── Media (write command) ──
    ├── audio.(mp3|m4a|ogg|flac)
    ├── transcription.txt
    ├── prompt.md
    ├── text.json                   # structured write output
    ├── speech.wav                  # (if --tts provider[=model] set)
    ├── generated-image.*           # (if --image provider[=model] set)
    ├── generated-video.mp4         # (if --video provider[=model] set)
    ├── generated-music.mp3         # (if --music provider[=model] set)
    ├── run.json                    # { step1, step2, step3[, step4, step5, step6, step7] }
    │
    │  ── Document (extract command routed to OCR) ──
    ├── extraction.txt              # if --format text (default)
    ├── result.json                 # if --format json
    ├── extraction.tsv              # if --format tsv
    ├── extraction.hocr             # if --format hocr
    ├── run.json                    # { step1, step2 }
    │                               # EPUB inspect mode writes run.json only
    │
    │  ── Article URL / HTML (extract command) ──
    ├── extraction.txt              # single-backend --format text
    ├── result.json                 # single-backend --format json
    ├── extraction.tsv              # single-backend --format tsv
    ├── extraction.hocr             # single-backend --format hocr
    ├── providers/<backend>/        # route-aware --all-providers artifacts
    │   ├── extraction.txt
    │   └── result.json
    ├── run.json                    # { step1, step2, completionStatus?, providerStates? }
    │
    │  ── Document (write command) ──
    ├── extraction.<requested-format>
    ├── prompt.md
    ├── text.json                   # structured write output
    ├── run.json                    # { step1, step2, step3 }
    │
    │  ── Standalone commands (tts / image / music / video) ──
    ├── speech.wav                  # (tts command output)
    ├── generated-image.*           # (image command output)
    ├── generated-video.mp4         # (video command output)
    ├── generated-music.mp3         # (hosted music command output)
    ├── run.json                    # generation metadata, timing, and cost
    │
    │  ── Music lyric-video mode ──
    ├── <stem>.mp4                  # rendered lyric video
    ├── <stem>.vtt                  # editable captions
    ├── <stem>.srt                  # editable captions
    ├── run.json                    # kind "music", mode "lyric-video"
    │
    │  ── Batch Processing ──
    └── output/YYYY-MM-DD_HH-MM-SS_<batch-label>/
        ├── extract-batch.json      # Parent routed batch manifest for `extract`
        ├── media/batch.json        # Child extract batch when media items are present
        ├── document/batch.json     # Child extract batch when document/article items are present
        ├── x-space/batch.json      # Child extract batch when X Space items are present
        └── YYYY-MM-DD_HH-MM-SS_<item-title>/
            └── (individual item output files)
```

Hosted STT also reuses an internal cached `source_media.(m4a|mp3)` execution artifact. `.m4a` is the default shared mono AAC upload, while low-bitrate mono `.mp3` stays on a stream-copy cleanup fast path. This stays out of the public run schema.

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
│  ProcessCommand = 'metadata' | 'download' | 'extract' | 'write'              │
│                 | 'tts' | 'image' | 'music' | 'video'                        │
│  Note: `music --audio` / `music --batch` use the local lyric-video runner.   │
│  OutputFormat   = 'text' | 'json' | 'tsv' | 'hocr'                          │
│  BatchOrder     = 'newest' | 'oldest'                                        │
│                                                                              │
│  RuntimeOptions includes normalized provider selections for:                 │
│    STT/OCR provider models and local booleans, LLM provider models,          │
│    URL article backends, TTS/image/video/music provider models,              │
│    provider-specific voice, synthesis, generation, concurrency, batch,       │
│    cost, and prompt controls.                                                │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  provider-types.ts                                                           │
│                                                                              │
│  TtsProvider   = 'kitten'|'elevenlabs'|'minimax'|'groq'|'grok'|             │
│                  'mistral'|'openai'|'gemini'|'deepgram'|'speechify'|        │
│                  'hume'|'cartesia'                                          │
│  ImageProvider = 'gemini'|'openai'|'grok'|'bfl'|'reve'                       │
│  VideoProvider = 'gemini'|'minimax'|'glm'|'grok'|'runway'                    │
│  MusicProvider = 'elevenlabs'|'minimax'|'gemini'                             │
│                                                                              │
│  OcrProvider   = 'tesseract'|'ocrmypdf'|'paddle-ocr'|'mistral'|'glm'|       │
│                  'kimi'|'openai'|'grok'|'anthropic'|'gemini'|'deepinfra'|    │
│                  'unstructured'                                             │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  process-types.ts  (all validated with Valibot schemas)                      │
│                                                                              │
│  Step 1 (Download):                                                          │
│  ├── ProcessingOptions    url|filePath, whisper/llama/openai models, ...     │
│  ├── VideoMetadata        title, duration, author, url, publishDate, ...     │
│  ├── YtDlpVideoInfo       raw yt-dlp JSON output                             │
│  ├── Step1Metadata        VideoMetadata & { slug, audioFileName, audioFileSize } │
│  ├── DocumentMetadata     title, slug, author, pageCount, format, fileSize   │
│  └── DetectResult         'pdf'|'epub'|'image'|'docx'|'pptx'|'xlsx'|'odf'    │
│                                                                              │
│  Step 2 (Transcribe/Extract):                                                │
│  ├── TranscriptionResult  text + segments[]                                  │
│  ├── TranscriptionSegment start, end, text, speaker?                         │
│  ├── ExtractionOptions    filePath, outputDir, dpi, languages, format, ...   │
│  ├── ExtractionResult     text + pages[] + totalPages/ocrPages/textPages     │
│  ├── PageResult           pageNumber, method:'text'|'ocr'|'skipped', text    │
│  ├── ExtractionMetadata   extractionMethod, pages, processingTime, ...       │
│  ├── Step2Metadata        transcriptionService, model, time, tokenCount      │
│  │    transcriptionService: 'whisper'|'reverb'|'elevenlabs'|'groq'|'grok'|'openai-stt'|'mistral'|... │
│  ├── WhisperJsonOutput    whisper.cpp JSON output schema                     │
│  ├── ReverbOutput         reverb segments + speakers                         │
│  └── ElevenLabsSttResponse  ElevenLabs word/segment schema                   │
│                                                                              │
│  Step 3 (LLM):                                                               │
│  ├── Step3Metadata        llmService, llmModel, time, in/out tokens,         │
│  │                        outputFileName, outputFormat: 'json',              │
│  │                        structuredMode: 'native'|'schema-guided',          │
│  │                        structuredPresetNames: string[]                     │
│  │    llmService: 'llama.cpp'|'openai'|'groq'|'gemini'|'anthropic'|'minimax'|'grok'|'glm'|'kimi'│
│  └── LlamaResponseSchema  llama.cpp HTTP response format                     │
│                                                                              │
│  Step 4 (TTS):                                                               │
│  └── Step4Metadata        ttsService (TtsProvider), ttsModel, speaker?,      │
│       language?, processingTime, audioFileName, audioFileSize, chunkCount,   │
│       clonedVoiceId?, cloneCostCents?                                        │
│                                                                              │
│  Step 5 (Image Gen):                                                         │
│  └── Step5Metadata        imageService (ImageProvider), imageModel,          │
│       processingTime, imageCount, imageFileNames[], imageFileSize,           │
│       imageWidth, imageHeight, imageSize?, imageQuality?, imageFormat?,      │
│       revisedPrompt?, providerReturnedModel?,                                │
│       requestMode: 'generation'|'edit', usageCostRaw?,                       │
│       groundingMetadata?, providerModeration?,                               │
│       providerCostCents?, providerCostSource?                                │
│                                                                              │
│  Step 6 (Video Gen):                                                         │
│  └── Step6VideoMetadata   videoGenService (VideoProvider), videoGenModel,    │
│       processingTime, videoFileName, videoFileSize, videoDuration,           │
│       requestMode?, videoResolution?, videoAspectRatio?,                     │
│       inputImage?, lastFrameImage?, referenceImages?, inputVideo?,           │
│       providerRequestId?, providerReturnedModel?,                            │
│       providerVideoUrl?, providerVideoUri?, providerProgress?,              │
│       providerModeration?, providerFileOutput?, providerStorageError?,       │
│       providerCostCents?, providerCostSource?                                │
│                                                                              │
│  Step 7 (Music Gen):                                                         │
│  └── Step7MusicMetadata   musicService (MusicProvider), musicModel,          │
│       processingTime, musicFileName, musicFileSize, musicDurationMs,         │
│       lyricsSource: 'provided'|'generated'|'none', providerCost*,            │
│       providerRequestId?, providerTraceId?, audioMimeType?,                  │
│       audioSampleRate?, audioChannelCount?, audioBitrate?,                   │
│       providerAudioByteSize?, inferenceSteps?, guidanceScale?, seed?,        │
│       outputFormat?, generatedLyrics?, generatedSongTitle?,                  │
│       generatedStyleTags?, generatedText?                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```
