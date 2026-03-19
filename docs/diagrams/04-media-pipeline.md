# Media Processing Pipeline

Step-by-step diagram of audio download, transcription, and LLM summarization for media inputs.

```
src/process-steps/process-video.ts

┌──────────────────────────────────────────────────────────────────────────────┐
│                      STEP 1: Download Audio                                  │
│                      src/process-steps/step-1-download/                      │
│                                                                              │
│  extractSourceMetadata()                                                     │
│  ├── URL → yt-dlp --dump-json → title, duration, author, publishDate, ...   │
│  ├── Local file → ffprobe → duration; filename → title                       │
│  └── Fallback metadata if extraction fails                                   │
│                                                                              │
│  createUniqueDirectoryName(title)                                            │
│  └── output/YYYY-MM-DD_HH-MM-SS_<sanitized-title>/                          │
│                                                                              │
│  downloadAudio()                                                             │
│  ├── url_streaming → yt-dlp -x --audio-format wav                            │
│  ├── url_direct_media → fetch() → save to disk                               │
│  └── local file → use as-is                                                  │
│                                                                              │
│  Convert to WAV: ffmpeg -i <input> -ar 16000 -ac 1 -c:a pcm_s16le audio.wav │
│                                                                              │
│  Output: audio.wav + Step1Metadata                                           │
└──────────────────────────────────────────────────────────────────────────────┘
                                    |
                                    v
┌──────────────────────────────────────────────────────────────────────────────┐
│                      STEP 2: Transcribe                                      │
│                      src/process-steps/step-2/stt/run-transcribe.ts          │
│                                                                              │
│  resolveTranscribeEngine() — picks exactly one engine:                       │
│                                                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐│
│  │ --reverb   │ │--elevenlabs│ │--groq-stt  │ │--openai-stt│ │--mistral-  │ │--assemblyai- ││
│  │ Reverb ASR │ │-stt        │ │ Groq       │ │ OpenAI STT │ │stt         │ │stt           ││
│  │ (local)    │ │ ElevenLabs │ │ Whisper    │ │ (API)      │ │ Mistral    │ │ AssemblyAI   ││
│  │ diarization│ │ Scribe(API)│ │ (API)      │ │ diarization│ │ STT (API)  │ │ STT (API)    ││
│  │ --reverb-  │ │ diarization│ │            │ │ w/speaker- │ │ diarization│ │ diarization  ││
│  │ verbatimic.│ │ w/speaker- │ │            │ │ count hint │ │            │ │ w/speaker-   ││
│  │            │ │ count hint │ │            │ │            │ │            │ │ count hint   ││
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └──────┬───────┘│
│        └───────────────┴──────────────┴──────────────┴──────────────┴────────────────┘       │
│                                    │                                         │
│           (no engine flag) → Whisper.cpp (local binary)                     │
│           --whisper MODEL: tiny|base|small|medium|large-v3-turbo|           │
│                                                                             │
│           --split: split audio into 10-min chunks, transcribe each          │
│                                    │                                         │
│                                    v                                         │
│  ┌──────────────────────────────────────────────┐                            │
│  │  TranscriptionResult                          │                           │
│  │  ├── text: full transcription                 │                           │
│  │  └── segments[]: { start, end, text, speaker? }│                          │
│  └──────────────────────────────────────────────┘                            │
│                                                                              │
│  Output: transcription.txt + Step2Metadata                                   │
└──────────────────────────────────────────────────────────────────────────────┘
                                    |
                        ┌───────────┴───────────┐
                        |                       |
                  skipLLM=true            skipLLM=false
                  (transcribe cmd)         (write cmd)
                        |                       |
                        v                       v
                ┌───────────────┐  ┌────────────────────────────────────┐
                │ Write prompt  │  │  STEP 3: LLM Summary               │
                │ file only     │  │  src/process-steps/step-3-write/    │
                │               │  │                                    │
                │ prompt.md     │  │  buildPrompt()                     │
                │ metadata.json │  │  ├── Video metadata                │
                │ (step1+step2) │  │  ├── Transcription segments        │
                │               │  │  ├── Speaker labels (if diarized)  │
                │ DONE          │  │  └── Formatting instructions       │
                └───────────────┘  │                                    │
                                   │  Output: prompt.md                 │
                                   │                                    │
                                   │  runLLM() → Provider Selection:    │
                                   │  (see 06-llm-providers.md)         │
                                   │                                    │
                                   │  Output: text.md + Step3Metadata   │
                                   └────────────────────────────────────┘
                                                    |
                                        ┌───────────┴──────────────────┐
                                        │  Optional steps 4–7          │
                                        │  (triggered by flags on      │
                                        │   write cmd)                 │
                                        │                              │
                                        │  Step 4: TTS (--kitten-tts,  │
                                        │   --elevenlabs-tts,          │
                                        │   --minimax-tts,             │
                                        │   --groq-tts,                │
                                        │   --openai-tts,              │
                                        │   --gemini-tts)              │
                                        │  Step 5: Image (--gemini-    │
                                        │   image, --openai-image, ...) │
                                        │  Step 6: Video (--sora-video,│
                                        │   --gemini-video, ...)       │
                                        │  Step 7: Music (--elevenlabs-│
                                        │   music, --minimax-music)    │
                                        └──────────────────────────────┘
                                                    |
                                                    v
                                          ┌──────────────────┐
                                          │  metadata.json   │
                                          │  {step1,step2,   │
                                          │   step3[,step4,  │
                                          │   step5,step6,   │
                                          │   step7]}        │
                                          │                  │
                                          │  DONE            │
                                          └──────────────────┘
```
