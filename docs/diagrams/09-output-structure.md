# Output Directory Structure

File output layout for each command type and the runtime directory structure.

## Outline

- [Runtime Directory Structure](#runtime-directory-structure)

```
output/
└── YYYY-MM-DD_HH-MM-SS_<sanitized-title>/
    │
    │  ── Media (transcribe command) ──
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
    ├── generated-image.*          # (if --gemini-image/--openai-image/... set)
    ├── generated-video.mp4        # (if --sora-video/--gemini-video/... set)
    ├── generated-music.mp3        # (if --elevenlabs-music/--minimax-music set)
    ├── metadata.json               # { step1, step2, step3[, step4, step5, step6, step7] }
    │
    │  ── Document (extract command) ──
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
