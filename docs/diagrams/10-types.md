# Type System Overview

All types organized by pipeline step, including Valibot schemas and CLI types.

```
src/types/

┌──────────────────────────────────────────────────────────────────────────────┐
│  cli-types.ts                                                                │
│                                                                              │
│  ProcessCommand = 'download' | 'transcribe' | 'write' | 'extract'           │
│                 | 'tts' | 'image' | 'music' | 'video'                        │
│  OutputFormat   = 'text' | 'json' | 'tsv' | 'hocr'                          │
│  BatchOrder     = 'newest' | 'oldest'                                        │
│                                                                              │
│  RuntimeOptions {                                                            │
│    useReverb, useOpenAI, useGemini, useAnthropic,                            │
│    llamaModel, openaiModel, groqModel, geminiModel,                          │
│    anthropicModel, minimaxModel,                                             │
│    whisperModel, groqSttModel, elevenlabsSttModel, openaiSttModel,           │
│    mistralSttModel, assemblyaiSttModel,                                     │
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
│  TtsProvider   = 'kitten'|'elevenlabs'|'minimax'|'groq'|                     │
│                  'openai'|'gemini'                                            │
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
│  └── DetectResult         'pdf'|'epub'|'image'|'docx'|'pptx'|'xlsx'|'odf'   │
│                                                                              │
│  Step 2 (Transcribe/Extract):                                                │
│  ├── TranscriptionResult  text + segments[]                                  │
│  ├── TranscriptionSegment start, end, text, speaker?                         │
│  ├── ExtractionOptions    filePath, outputDir, dpi, lang, oem, psm, ...     │
│  ├── ExtractionResult     text + pages[] + totalPages/ocrPages/textPages    │
│  ├── PageResult           pageNumber, method:'text'|'ocr'|'skipped', text    │
│  ├── ExtractionMetadata   extractionMethod, pages, processingTime, ...      │
│  ├── Step2Metadata        transcriptionService, model, time, tokenCount     │
│  │    transcriptionService: 'whisper'|'reverb'|'elevenlabs'|'groq'|'openai'|'mistral'|'assemblyai' │
│  ├── WhisperJsonOutput    whisper.cpp JSON output schema                     │
│  ├── ReverbOutput         reverb segments + speakers                         │
│  └── ElevenLabsSttResponse  ElevenLabs word/segment schema                  │
│                                                                              │
│  Step 3 (LLM):                                                               │
│  ├── Step3Metadata        llmService, llmModel, time, in/out tokens         │
│  │    llmService: 'llama.cpp'|'openai'|'groq'|'gemini'|'anthropic'|'minimax'│
│  └── LlamaResponseSchema  llama.cpp HTTP response format                     │
│                                                                              │
│  Step 4 (TTS):                                                               │
│  └── Step4Metadata        ttsService (TtsProvider), ttsModel, speaker?,     │
│       language?, processingTime, audioFileName, audioFileSize, chunkCount   │
│                                                                              │
│  Step 5 (Image Gen):                                                         │
│  └── Step5Metadata        imageService (ImageProvider), imageModel,         │
│       processingTime, imageFileName, imageFileSize, imageWidth, imageHeight  │
│                                                                              │
│  Step 6 (Video Gen):                                                         │
│  └── Step6VideoMetadata   videoGenService (VideoProvider), videoGenModel,   │
│       processingTime, videoFileName, videoFileSize, videoDuration            │
│                                                                              │
│  Step 7 (Music Gen):                                                         │
│  └── Step7MusicMetadata   musicService (MusicProvider), musicModel,         │
│       processingTime, musicFileName, musicFileSize, musicDurationMs,         │
│       lyricsSource: 'provided'|'generated'|'none'                            │
└──────────────────────────────────────────────────────────────────────────────┘
```
