# Music Generation Options

Generate music with ElevenLabs based on AI-generated lyrics from your audio/video content.

## Outline

- [Overview](#overview)
- [Environment Variables](#environment-variables)
- [Basic Usage](#basic-usage)
- [Genre Options](#genre-options)
- [Output Format](#output-format)
- [Combining with Other Options](#combining-with-other-options)
- [Output Files](#output-files)
- [How It Works](#how-it-works)

## Overview

The `--elevenlabs` option integrates music generation into the text processing pipeline. It:

1. Transcribes your audio/video content
2. Uses an LLM to generate lyrics in a specific genre style based on the transcript
3. Creates a composition plan with ElevenLabs
4. Generates music using the composition plan

## Environment Variables

Set the following environment variable in your `.env` file:

```bash
ELEVENLABS_API_KEY=your_api_key_here
```

You also need an API key for at least one LLM provider since `--elevenlabs` requires an LLM to generate lyrics:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`

## Basic Usage

The `--elevenlabs` option requires both a genre and an LLM provider:

```bash
bun as -- text --file "input/audio.mp3" --chatgpt --elevenlabs rap
```

This will:
1. Transcribe the audio file
2. Generate rap lyrics based on the transcript using ChatGPT
3. Create and generate music with ElevenLabs

## Genre Options

Six genres are supported, each with its own lyric-writing style:

### Rap

Hip-hop style with complex, multi-syllabic rhyming inspired by Eminem:

```bash
bun as -- text --file "input/audio.mp3" --chatgpt --elevenlabs rap
```

### Rock

High-energy, anthemic rock with powerful imagery and themes of rebellion or freedom:

```bash
bun as -- text --file "input/audio.mp3" --chatgpt --elevenlabs rock
```

### Folk

Authentic storytelling with simple, direct language and social commentary:

```bash
bun as -- text --file "input/audio.mp3" --chatgpt --elevenlabs folk
```

### Jazz

Sophisticated lyrics with complex emotions, poetic imagery, and syncopated rhythms:

```bash
bun as -- text --file "input/audio.mp3" --chatgpt --elevenlabs jazz
```

### Pop

Catchy, radio-friendly songs with memorable hooks and relatable themes:

```bash
bun as -- text --file "input/audio.mp3" --chatgpt --elevenlabs pop
```

### Country

Heartfelt storytelling with simple, emotionally charged lyrics about life and love:

```bash
bun as -- text --file "input/audio.mp3" --chatgpt --elevenlabs country
```

## Output Format

By default, music is generated in `mp3_44100_128` format. Use `--music-format` to specify a different format:

```bash
bun as -- text --file "input/audio.mp3" --chatgpt --elevenlabs rock --music-format mp3_44100_192
```

### Available Formats

**MP3 formats:**
- `mp3_22050_32` - 22.05kHz, 32kbps
- `mp3_24000_48` - 24kHz, 48kbps
- `mp3_44100_32` - 44.1kHz, 32kbps
- `mp3_44100_64` - 44.1kHz, 64kbps
- `mp3_44100_96` - 44.1kHz, 96kbps
- `mp3_44100_128` - 44.1kHz, 128kbps (default)
- `mp3_44100_192` - 44.1kHz, 192kbps (Creator tier+)

**Opus formats:**
- `opus_48000_32` to `opus_48000_192`

**PCM formats (Pro tier+):**
- `pcm_8000` to `pcm_48000`

**Telephony formats:**
- `ulaw_8000` - u-law (Twilio)
- `alaw_8000` - A-law

## Combining with Other Options

### With Different LLM Providers

Use any supported LLM provider:

```bash
# With Claude
bun as -- text --file "input/audio.mp3" --claude --elevenlabs jazz

# With Gemini
bun as -- text --file "input/audio.mp3" --gemini --elevenlabs folk

# With specific model
bun as -- text --file "input/audio.mp3" --chatgpt gpt-5 --elevenlabs pop
```

### With Additional Prompts

The genre lyric prompt is automatically added to your prompt list. You can combine it with other prompts:

```bash
# Generate summary, chapters, AND lyrics/music
bun as -- text --file "input/audio.mp3" --chatgpt --prompt summary longChapters --elevenlabs rock
```

### With Different Input Sources

Works with all input types:

```bash
# YouTube video
bun as -- text --video "https://youtube.com/watch?v=..." --chatgpt --elevenlabs rap

# YouTube playlist
bun as -- text --playlist "https://youtube.com/playlist?list=..." --chatgpt --elevenlabs rock

# RSS feed
bun as -- text --rss "https://example.com/feed.xml" --chatgpt --elevenlabs folk

# Multiple URLs
bun as -- text --urls "input/urls.txt" --chatgpt --elevenlabs jazz
```

### With Transcription Options

Specify your preferred transcription service:

```bash
bun as -- text --file "input/audio.mp3" --deepgram --chatgpt --elevenlabs country
bun as -- text --file "input/audio.mp3" --assembly --claude --elevenlabs pop
```

## Output Files

For a command like:

```bash
bun as -- text --file "input/audio.mp3" --chatgpt --elevenlabs rap
```

Two files are generated:

1. **Markdown file:** `output/audio-chatgpt-shownotes.md`
   - Contains the standard output (summary, chapters, etc.)
   - Includes the generated lyrics in a `## Song` section
   - Includes the transcript

2. **Music file:** `output/audio-elevenlabs-rap.mp3`
   - The generated music based on the lyrics

If music generation fails (e.g., API error), the markdown file is still saved and a warning is displayed.

## How It Works

### Processing Flow

```
Input Audio/Video
       |
       v
+------------------+
| 1. Transcription |  (Whisper, Deepgram, etc.)
+------------------+
       |
       v
+------------------+
| 2. LLM Processing|  (ChatGPT, Claude, Gemini)
|    - Summary     |
|    - Chapters    |
|    - Lyrics      |  <-- Genre-specific prompt added
+------------------+
       |
       v
+------------------+
| 3. Music Gen     |  (ElevenLabs)
|    - Create plan |
|    - Generate    |
+------------------+
       |
       v
Output: .md + .mp3
```

### Genre Style Mapping

Each genre uses a specific music style when creating the composition plan:

| Genre   | Music Style Description |
|---------|------------------------|
| rap     | hip-hop, rap, rhythmic beats, urban flow, confident delivery |
| rock    | rock, electric guitar, powerful drums, energetic, anthemic |
| folk    | folk, acoustic guitar, authentic storytelling, organic sound |
| jazz    | jazz, sophisticated, piano, brass, swing rhythm, smooth |
| pop     | pop, catchy hooks, radio-friendly, modern production, upbeat |
| country | country, acoustic, heartfelt, Americana, storytelling |

### Lyrics Extraction

The system looks for lyrics in the LLM output using several patterns:
1. `## Song` section (from the standard song prompt format)
2. `Lyrics:` section
3. Verse/Chorus structure markers (e.g., `[Verse 1]`, `[Chorus]`)
