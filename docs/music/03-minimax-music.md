# MiniMax Music 2.5 Options

Detailed options for MiniMax Music 2.5 generation.

## API Requirements

```bash
MINIMAX_API_KEY=your_api_key
```

Get your API key from [MiniMax Platform](https://platform.minimax.io/user-center/basic-information/interface-key).

## Key Differences from ElevenLabs

| Feature | MiniMax | ElevenLabs |
|---------|---------|------------|
| Lyrics | **Required** | Optional |
| Composition plans | Not supported | Supported |
| Instrumental mode | Not supported | Supported |
| Duration control | Not supported | Supported |
| Style prompt | Optional (0-2000 chars) | Required |
| Lyrics limit | 3500 characters | Varies |

## Output Formats

### MP3 (Default)

Format: `mp3_{sampleRate}_{bitrate}`

| Format | Description |
|--------|-------------|
| `mp3_44100_256000` | Highest quality (default) |
| `mp3_44100_128000` | High quality |
| `mp3_44100_64000` | Standard quality |
| `mp3_44100_32000` | Lower quality |

Sample rates: `16000`, `24000`, `32000`, `44100`  
Bitrates: `32000`, `64000`, `128000`, `256000`

### WAV

Format: `wav_{sampleRate}`

| Format | Description |
|--------|-------------|
| `wav_44100` | CD quality, uncompressed |
| `wav_32000` | 32kHz |
| `wav_24000` | 24kHz |
| `wav_16000` | 16kHz |

### PCM

Format: `pcm_{sampleRate}`

| Format | Description |
|--------|-------------|
| `pcm_44100` | Raw 44.1kHz audio |
| `pcm_32000` | Raw 32kHz audio |
| `pcm_24000` | Raw 24kHz audio |
| `pcm_16000` | Raw 16kHz audio |

## Lyrics Format

MiniMax supports structured lyrics with section tags for better arrangement control.

### Supported Section Tags

| Tag | Description |
|-----|-------------|
| `[Intro]` | Instrumental opening |
| `[Verse]` | Main verse sections |
| `[Pre Chorus]` | Build-up before chorus |
| `[Chorus]` | Main hook/refrain |
| `[Post Chorus]` | After chorus section |
| `[Bridge]` | Contrasting section |
| `[Interlude]` | Instrumental break |
| `[Outro]` | Closing section |
| `[Hook]` | Catchy repeated phrase |
| `[Build Up]` | Energy building section |
| `[Break]` | Pause or breakdown |
| `[Transition]` | Between sections |
| `[Inst]` | Instrumental section |
| `[Solo]` | Instrumental solo |

### Example Lyrics

```
[Intro]
(soft piano)

[Verse]
Walking through the rain on empty streets
Memories of you in everyone I meet
The city lights blur through my tears
Echoes of our love across the years

[Pre Chorus]
I keep holding on to what we had
Even though I know it makes me sad

[Chorus]
But I'll find my way back home
Through the darkness all alone
Every step I take reminds me
Of the love we left behind me

[Bridge]
Time moves on but hearts remember
Every moment, every ember

[Outro]
(fading instrumental)
```

### Tag Normalization

The CLI automatically normalizes common tag variants:

| Input | Normalized To |
|-------|---------------|
| `[verse 1]`, `[Verse 2]` | `[Verse]` |
| `[pre-chorus]`, `[prechorus]` | `[Pre Chorus]` |
| `[post-chorus]` | `[Post Chorus]` |
| `[build-up]`, `[buildup]` | `[Build Up]` |
| `[instrumental]` | `[Inst]` |
| `[end]`, `[ending]` | `[Outro]` |
| `[start]`, `[opening]` | `[Intro]` |
| `[refrain]` | `[Chorus]` |

## Prompting Best Practices

The `--prompt` option describes the overall style, mood, and production characteristics.

### Style Description

MiniMax Music 2.5 excels at detailed style prompts. Include:

- **Genre**: "Contemporary R&B", "Indie Folk", "Modern Rock"
- **Mood**: "melancholic", "upbeat", "introspective"
- **Instrumentation**: "acoustic guitar", "808 basslines", "orchestral strings"
- **Production style**: "polished", "raw", "lo-fi", "radio-ready"
- **Vocal character**: "breathy", "powerful", "intimate"

### Example Prompts by Genre

**Pop:**
```bash
bun as -- music generate --service minimax \
  --prompt "Contemporary Pop with catchy hooks, modern production, and radio-ready polish. Features bright clear vocals, layered harmonies, upbeat energy, and crisp transparent mix." \
  --lyrics-file pop-song.txt
```

**Hip-Hop:**
```bash
bun as -- music generate --service minimax \
  --prompt "Contemporary R&B/Hip-Hop with Trap influences, confident energy. Features rhythmic vocal delivery, 808 basslines, intricate hi-hat patterns, and atmospheric synth pads." \
  --lyrics-file rap-song.txt
```

**Rock:**
```bash
bun as -- music generate --service minimax \
  --prompt "Modern Rock with powerful electric guitars, driving drums, and anthemic energy. Features saturated distortion, dynamic builds, and arena-ready production." \
  --lyrics-file rock-song.txt
```

**Folk:**
```bash
bun as -- music generate --service minimax \
  --prompt "Indie Folk with acoustic guitar, authentic storytelling, and organic warmth. Features intimate humanized vocals, natural instrumentation, and warm production." \
  --lyrics-file folk-song.txt
```

**Jazz:**
```bash
bun as -- music generate --service minimax \
  --prompt "Sophisticated Jazz with piano, brass, and swing rhythm. Features smooth expressive vocals, classic warm production, and rich harmonic complexity." \
  --lyrics-file jazz-song.txt
```

## MiniMax Music 2.5 Strengths

According to MiniMax documentation, Music 2.5 excels in:

### Instrumentation & Mixing
- Expanded high-sample-rate sound library (orchestral, traditional instruments)
- Optimized soundstage algorithms for transparent listening
- Complete spectral characteristics for vocals and accompaniment

### Vocal Performance
- Deep optimization targeting AI synthesis artifacts
- Humanized timbre simulation
- Enhanced Flow expressiveness for authentic "real voice" quality

### Structural Precision
- Full section tag control (14+ structure variants)
- Dynamic evolution control for section-by-section emotion/technique tuning
- Precise control over orchestration and sound texture

### Sound Design
- Genre-specific mixing characteristics
- Automatic identification of physical characteristics per genre:
  - Rock's saturated distortion
  - 80s "Minneapolis Sound"
  - Modern electronic's wide-frequency transients
  - Classic jazz's warm low-pass feel

## Limitations

- **Lyrics required**: Cannot generate instrumental-only tracks
- **No duration control**: Song length determined by lyrics
- **No composition plans**: Direct prompt + lyrics only
- **Character limits**: Lyrics max 3500 chars, prompt max 2000 chars
- **URL expiration**: Generated audio URLs expire after 24 hours (CLI downloads automatically)

## Error Codes

| Code | Meaning |
|------|---------|
| 1002 | Rate limit triggered, retry later |
| 1004 | Authentication failed, check API key |
| 1008 | Insufficient balance in account |
| 1026 | Content flagged for sensitive material |
| 2013 | Invalid parameters, check lyrics/prompt |
| 2049 | Invalid API key |

## Example Commands

```bash
# Basic generation
bun as -- music generate --service minimax \
  --prompt "Upbeat summer pop" \
  --lyrics "[Verse]\nSunshine on my face\n[Chorus]\nThis is the place"

# With lyrics file and high quality format
bun as -- music generate --service minimax \
  --prompt "Emotional ballad with piano" \
  --lyrics-file ./ballad.txt \
  --format mp3_44100_256000

# WAV output for further processing
bun as -- music generate --service minimax \
  --prompt "Rock anthem" \
  --lyrics-file ./rock.txt \
  --format wav_44100 \
  --output ./output/rock-anthem.wav
```

## Integration with Text Pipeline

Generate music from transcribed content:

```bash
# Generate rap song from video transcript
bun as -- text --video "https://youtube.com/..." \
  --whisper --chatgpt gpt-4o \
  --minimax rap

# With custom style hints
bun as -- text --video "https://youtube.com/..." \
  --whisper --claude \
  --minimax pop \
  --music-style "80s synth influence, nostalgic feel"
```

The text pipeline uses optimized genre prompts automatically. Use `--music-style` to append additional style hints.

## See Also

- [Music Command Overview](./01-music-command.md)
- [ElevenLabs Music Options](./02-elevenlabs-music.md)
- [MiniMax API Documentation](https://platform.minimax.io/docs)
