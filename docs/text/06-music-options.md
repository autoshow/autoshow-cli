# Music Generation Options

Generate music with ElevenLabs or MiniMax based on AI-generated lyrics from your audio/video content.

## Outline

- [Overview](#overview)
- [Environment Variables](#environment-variables)
- [Basic Usage](#basic-usage)
- [Service Comparison](#service-comparison)
- [Genre Options](#genre-options)
- [Output Format](#output-format)
- [Custom Style Hints](#custom-style-hints)
- [Combining with Other Options](#combining-with-other-options)
- [Output Files](#output-files)
- [How It Works](#how-it-works)

## Overview

The `--elevenlabs` and `--minimax` options integrate music generation into the text processing pipeline. They:

1. Transcribe your audio/video content
2. Use an LLM to generate lyrics in a specific genre style based on the transcript
3. Generate music using the selected service

**Important:** You can only use one music service at a time. Specifying both `--elevenlabs` and `--minimax` will result in an error.

## Environment Variables

Set the API key for your chosen music service in your `.env` file:

```bash
# For ElevenLabs
ELEVENLABS_API_KEY=your_api_key_here

# For MiniMax
MINIMAX_API_KEY=your_api_key_here
```

You also need an API key for at least one LLM provider since music generation requires an LLM to generate lyrics:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`

## Basic Usage

Both options require a genre and an LLM provider:

### ElevenLabs

```bash
bun as -- text --file "input/audio.mp3" --chatgpt --elevenlabs rap
```

This will:
1. Transcribe the audio file
2. Generate rap lyrics based on the transcript using ChatGPT
3. Create a composition plan and generate music with ElevenLabs

### MiniMax

```bash
bun as -- text --file "input/audio.mp3" --chatgpt --minimax rap
```

This will:
1. Transcribe the audio file
2. Generate rap lyrics based on the transcript using ChatGPT
3. Generate music directly with MiniMax Music 2.5

## Service Comparison

| Feature | ElevenLabs (`--elevenlabs`) | MiniMax (`--minimax`) |
|---------|----------------------------|----------------------|
| API Key | `ELEVENLABS_API_KEY` | `MINIMAX_API_KEY` |
| Generation method | Composition plan | Direct lyrics + prompt |
| Default format | `mp3_44100_128` | `mp3_44100_256000` |
| Vocal quality | Good | Excellent (humanized) |
| Instrumental support | Yes | No |
| Best for | Versatile generation | High-quality vocals |

### When to Use Each Service

**Use ElevenLabs when:**
- You want composition plan control
- You need instrumental music options
- You want detailed section timing control

**Use MiniMax when:**
- You want highest quality vocal synthesis
- You want genre-specific production characteristics
- You prefer simpler prompt-based workflow

## Genre Options

Six genres are supported, each with its own lyric-writing style and optimized music prompts:

### Rap

Hip-hop style with complex, multi-syllabic rhyming:

```bash
# ElevenLabs
bun as -- text --file "input/audio.mp3" --chatgpt --elevenlabs rap

# MiniMax
bun as -- text --file "input/audio.mp3" --chatgpt --minimax rap
```

### Rock

High-energy, anthemic rock with powerful imagery:

```bash
bun as -- text --file "input/audio.mp3" --chatgpt --elevenlabs rock
bun as -- text --file "input/audio.mp3" --chatgpt --minimax rock
```

### Folk

Authentic storytelling with simple, direct language:

```bash
bun as -- text --file "input/audio.mp3" --chatgpt --elevenlabs folk
bun as -- text --file "input/audio.mp3" --chatgpt --minimax folk
```

### Jazz

Sophisticated lyrics with complex emotions and poetic imagery:

```bash
bun as -- text --file "input/audio.mp3" --chatgpt --elevenlabs jazz
bun as -- text --file "input/audio.mp3" --chatgpt --minimax jazz
```

### Pop

Catchy, radio-friendly songs with memorable hooks:

```bash
bun as -- text --file "input/audio.mp3" --chatgpt --elevenlabs pop
bun as -- text --file "input/audio.mp3" --chatgpt --minimax pop
```

### Country

Heartfelt storytelling with emotionally charged lyrics:

```bash
bun as -- text --file "input/audio.mp3" --chatgpt --elevenlabs country
bun as -- text --file "input/audio.mp3" --chatgpt --minimax country
```

## Output Format

Use `--music-format` to specify a different output format. The format is service-specific.

### ElevenLabs Formats

Default: `mp3_44100_128`

```bash
bun as -- text --file "input/audio.mp3" --chatgpt --elevenlabs rock --music-format mp3_44100_192
```

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

### MiniMax Formats

Default: `mp3_44100_256000`

```bash
bun as -- text --file "input/audio.mp3" --chatgpt --minimax rock --music-format mp3_44100_128000
```

**MP3 formats** (`mp3_{sampleRate}_{bitrate}`):
- `mp3_44100_256000` - 44.1kHz, 256kbps (default, highest quality)
- `mp3_44100_128000` - 44.1kHz, 128kbps
- `mp3_44100_64000` - 44.1kHz, 64kbps
- `mp3_44100_32000` - 44.1kHz, 32kbps
- Also available with 16000, 24000, 32000 Hz sample rates

**WAV formats:**
- `wav_44100`, `wav_32000`, `wav_24000`, `wav_16000`

**PCM formats:**
- `pcm_44100`, `pcm_32000`, `pcm_24000`, `pcm_16000`

### Format Conversion

If you specify a format that doesn't match the selected service, the CLI will automatically convert to the closest available format and display a warning.

## Custom Style Hints

Use `--music-style` to add custom style hints that are appended to the genre's default prompt:

```bash
# Add 80s synth influence to a pop song
bun as -- text --file "input/audio.mp3" --chatgpt --minimax pop --music-style "80s synth influence, nostalgic feel"

# Add Celtic elements to folk
bun as -- text --file "input/audio.mp3" --chatgpt --elevenlabs folk --music-style "Celtic instruments, Irish folk influence"

# Make rock more aggressive
bun as -- text --file "input/audio.mp3" --chatgpt --minimax rock --music-style "heavy metal influence, aggressive vocals"
```

## Combining with Other Options

### With Different LLM Providers

Use any supported LLM provider:

```bash
# With Claude
bun as -- text --file "input/audio.mp3" --claude --elevenlabs jazz
bun as -- text --file "input/audio.mp3" --claude --minimax jazz

# With Gemini
bun as -- text --file "input/audio.mp3" --gemini --elevenlabs folk

# With specific model
bun as -- text --file "input/audio.mp3" --chatgpt gpt-4o --minimax pop
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
bun as -- text --video "https://youtube.com/watch?v=..." --chatgpt --minimax rap

# YouTube playlist
bun as -- text --playlist "https://youtube.com/playlist?list=..." --chatgpt --elevenlabs rock

# RSS feed
bun as -- text --rss "https://example.com/feed.xml" --chatgpt --minimax folk

# Multiple URLs
bun as -- text --urls "input/urls.txt" --chatgpt --elevenlabs jazz
```

### With Transcription Options

Specify your preferred transcription service:

```bash
bun as -- text --file "input/audio.mp3" --deepgram --chatgpt --elevenlabs country
bun as -- text --file "input/audio.mp3" --assembly --claude --minimax pop
```

## Output Files

For a command like:

```bash
bun as -- text --file "input/audio.mp3" --chatgpt --minimax rap
```

Two files are generated:

1. **Markdown file:** `output/audio-chatgpt-shownotes.md`
   - Contains the standard output (summary, chapters, etc.)
   - Includes the generated lyrics in a `## Song` section
   - Includes the transcript

2. **Music file:** `output/audio-minimax-rap.mp3` or `output/audio-elevenlabs-rap.mp3`
   - The generated music based on the lyrics
   - Filename includes the service name and genre

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
| 3. Music Gen     |  (ElevenLabs or MiniMax)
+------------------+
       |
       v
Output: .md + .mp3
```

### ElevenLabs Processing

1. Extract lyrics from LLM output
2. Create composition plan with genre style
3. Generate music from composition plan

### MiniMax Processing

1. Extract lyrics from LLM output
2. Normalize section tags to MiniMax format
3. Truncate lyrics if over 3500 character limit
4. Generate music with genre-optimized style prompt

### Genre Style Mapping

Each genre uses optimized music style prompts for each service:

#### ElevenLabs Style Prompts

| Genre   | Music Style Description |
|---------|------------------------|
| rap     | hip-hop, rap, rhythmic beats, urban flow, confident delivery |
| rock    | rock, electric guitar, powerful drums, energetic, anthemic |
| folk    | folk, acoustic guitar, authentic storytelling, organic sound |
| jazz    | jazz, sophisticated, piano, brass, swing rhythm, smooth |
| pop     | pop, catchy hooks, radio-friendly, modern production, upbeat |
| country | country, acoustic, heartfelt, Americana, storytelling |

#### MiniMax Style Prompts

MiniMax uses more detailed prompts to leverage Music 2.5's capabilities:

| Genre   | Key Characteristics |
|---------|---------------------|
| rap     | R&B/Hip-Hop, Trap influences, 808 basslines, Auto-Tune character |
| rock    | Electric guitars, saturated distortion, arena-ready production |
| folk    | Acoustic guitar, humanized vocals, warm organic sound |
| jazz    | Piano, brass, swing rhythm, rich harmonic complexity |
| pop     | Bright vocals, layered harmonies, crisp transparent mix |
| country | Pedal steel, humanized flow, Americana warmth |

### Lyrics Extraction

The system looks for lyrics in the LLM output using several patterns:
1. `## Song` section (from the standard song prompt format)
2. `Lyrics:` section
3. Verse/Chorus structure markers (e.g., `[Verse 1]`, `[Chorus]`)

### MiniMax Section Tag Normalization

For MiniMax, section tags are automatically normalized:

| Input | Normalized To |
|-------|---------------|
| `[verse 1]`, `[Verse 2]` | `[Verse]` |
| `[pre-chorus]` | `[Pre Chorus]` |
| `[post-chorus]` | `[Post Chorus]` |
| `[instrumental]` | `[Inst]` |
| `[refrain]` | `[Chorus]` |

## See Also

- [Music Command](../music/01-music-command.md) - Standalone music generation
- [ElevenLabs Music Options](../music/02-elevenlabs-music.md) - Detailed ElevenLabs guide
- [MiniMax Music Options](../music/03-minimax-music.md) - Detailed MiniMax guide
