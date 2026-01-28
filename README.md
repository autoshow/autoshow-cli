<div align="center">
  <h1>AutoShow CLI</h1>
  <img alt="autoshow logo" src="https://ajc.pics/autoshow/autoshow-cover-01.webp" width="300" />
</div>

## Outline

- [Project Overview](#project-overview)
  - [Prompts and Content Formats](#prompts-and-content-formats)
  - [Key Features](#key-features)
  - [AutoShow Pipeline](#autoshow-pipeline)
- [Setup](#setup)
- [Core AutoShow Commands](#core-autoshow-commands)
  - [Process Options](#process-options)
  - [Transcription and LLM Options](#transcription-and-llm-options)
- [Contributors](#contributors)

## Project Overview

AutoShow automates the processing of audio and video content from various sources, including YouTube videos, playlists, podcast RSS feeds, and local media files. It leverages advanced transcription services and language models (LLMs) to perform transcription, summarization, and chapter generation.

### Prompts and Content Formats

AutoShow can generate diverse content formats including:

- **Summaries and Chapters:**
  - Concise summaries
  - Detailed chapter descriptions
  - Bullet-point summaries
  - Chapter titles with timestamps
- **Social Media Posts:**
  - X (Twitter)
  - Facebook
  - LinkedIn
- **Creative Content:**
  - Rap songs
  - Rock songs
  - Country songs
- **Educational and Informative Content:**
  - Key takeaways
  - Comprehension questions
  - Frequently asked questions (FAQs)
  - Curated quotes
  - Blog outlines and drafts

### Key Features

- Support for multiple input types (YouTube links, RSS feeds, local video and audio files)
- Integration with various:
  - LLMs (ChatGPT, Claude, Gemini)
  - Transcription services (Whisper.cpp, Deepgram, Assembly, Reverb ASR + diarization)
- Customizable prompts for generating titles, summaries, chapter titles/descriptions, key takeaways, and questions to test comprehension
- Markdown output with metadata and formatted content
- Workflow management for processing content from `./workflows` subdirectory.

### AutoShow Pipeline

1. The user provides a content input (video URL, playlist, RSS feed, or local file) or triggers a workflow. Front matter is created based on the content's metadata.
2. The audio is downloaded (if necessary).
3. Transcription is performed using the selected transcription service.
4. A customizable prompt is inserted containing instructions for the show notes or other content forms.
5. The transcript is processed by the selected LLM service to generate the desired output based on the selected prompts.

## Setup

The `setup.sh` script checks for a `.env` file, installs Node dependencies, and builds `whisper.cpp`:

```bash
bun setup
```

## Core AutoShow Commands

Example commands for all available CLI options can be found in [`docs`](/docs/README.md).

### Process Options

Run on a single YouTube video.

```bash
bun as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk"
```

Run on a YouTube playlist.

```bash
bun as -- text --playlist "https://www.youtube.com/playlist?list=PLCVnrVv4KhXPz0SoAVu8Rc1emAdGPbSbr"
```

Run on a list of arbitrary URLs from a file.

```bash
bun as -- text --urls "./input/example-urls.md"
```

Run on a local audio or video file.

```bash
bun as -- text --file "./input/audio.mp3"
```

Run on a podcast RSS feed.

```bash
bun as -- text --rss "https://ajcwebdev.substack.com/feed"
```

For more granular control (e.g., specific RSS items, date filtering, order, skip, last), use options like `--item <url>`, `--date <YYYY-MM-DD>`, `--order newest|oldest`, `--last <num>`, `--days <num>`.

Use `--info` to fetch metadata without full processing for URLs, playlists, channels, or RSS feeds.

```bash
bun as -- text --urls "./input/example-urls.md" --info
```

### Transcription and LLM Options

Specify transcription service (default is Whisper `base`):

```bash
bun as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --whisper large-v3-turbo
bun as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --deepgram nova-2
bun as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --groq-whisper whisper-large-v3-turbo
bun as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --assembly universal --speakerLabels
bun as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --reverb --reverb-diarization v2
```

Specify LLM service:

```bash
bun as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --chatgpt gpt-5-nano
bun as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --claude claude-sonnet-4-20250514
bun as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --gemini gemini-2.5-flash
```

Customize prompts:

```bash
bun as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --prompt summary shortChapters --chatgpt
bun as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --customPrompt ./my-custom-prompt.md --chatgpt
```

For a full list of options, run:

```bash
bun as -- --help
```

## Contributors

- ✨Hello beautiful human! ✨[Jenn Junod](https://jennjunod.dev/) host of [Teach Jenn Tech](https://teachjenntech.com/) & [Shit2TalkAbout](https://shit2talkabout.com)
