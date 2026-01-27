# Music Generation Command

Generate AI music using ElevenLabs or MiniMax music models.

## Quick Setup

```bash
# Add API keys to .env (use one or both)
ELEVENLABS_API_KEY=xxx
MINIMAX_API_KEY=xxx
```

## Basic Usage

```bash
# Generate music with ElevenLabs (default)
bun as -- music generate --prompt "An upbeat electronic dance track"

# Generate music with MiniMax (requires lyrics)
bun as -- music generate --service minimax --prompt "Contemporary pop" \
  --lyrics "[Verse]\nHello world\n[Chorus]\nSing along"

# ElevenLabs: Instrumental only
bun as -- music generate --prompt "A peaceful piano melody" --instrumental

# ElevenLabs: With specific duration
bun as -- music generate --prompt "A dramatic orchestral piece" --duration 2m

# With lyrics from file
bun as -- music generate --service minimax --prompt "Folk ballad" --lyrics-file ./lyrics.txt

# Using a composition plan (ElevenLabs only)
bun as -- music generate --plan-file ./my-plan.json

# Create a composition plan (free, ElevenLabs only)
bun as -- music plan --prompt "A pop song about summer" --duration 2m -o plan.json

# List output formats
bun as -- music list-formats
bun as -- music list-formats --service minimax
```

## Available Services

| Service | Description | Requirements |
|---------|-------------|--------------|
| `elevenlabs` | ElevenLabs Eleven Music (default) | `ELEVENLABS_API_KEY` |
| `minimax` | MiniMax Music 2.5 | `MINIMAX_API_KEY`, lyrics required |

## Available Subcommands

| Command | Description |
|---------|-------------|
| `generate` | Generate music from a prompt or plan |
| `plan` | Create a composition plan (ElevenLabs, no credits) |
| `list-formats` | Show available output formats |

## Generate Options

```bash
--service <service>     # Music service: elevenlabs (default), minimax
--prompt <text>         # Text prompt for style/mood description
--plan-file <path>      # Use composition plan from JSON file (ElevenLabs only)
--output <path>         # Output file path
--duration <duration>   # Duration: 30s, 2m, 2:30 (ElevenLabs only)
--instrumental          # No vocals (ElevenLabs only)
--lyrics <text>         # Inline lyrics (required for MiniMax)
--lyrics-file <path>    # Lyrics from file
--format <format>       # Output format (service-specific)
--timestamps            # Include word timestamps (ElevenLabs only)
--c2pa                  # Sign with C2PA (ElevenLabs mp3 only)
--respect-durations     # Strictly follow section durations from plan (ElevenLabs only)
```

## Service Comparison

| Feature | ElevenLabs | MiniMax |
|---------|------------|---------|
| Prompt only | Yes | No |
| Lyrics required | No | Yes |
| Composition plans | Yes | No |
| Instrumental mode | Yes | No |
| Duration control | Yes | No |
| Default format | `mp3_44100_128` | `mp3_44100_256000` |

## Workflow: ElevenLabs Composition Plans

1. Create a plan (free, no credits):
   ```bash
   bun as -- music plan --prompt "Epic rock anthem" --duration 3m -o plan.json
   ```

2. Review and edit `plan.json` - adjust sections, styles, lyrics

3. Generate using the plan:
   ```bash
   bun as -- music generate --plan-file plan.json
   ```

## Workflow: MiniMax with Lyrics

1. Write lyrics with section tags:
   ```
   [Intro]
   (instrumental opening)
   
   [Verse]
   Walking down the street on a sunny day
   Everything feels right in every way
   
   [Chorus]
   This is our moment, this is our time
   Everything is falling into line
   ```

2. Generate with style prompt:
   ```bash
   bun as -- music generate --service minimax \
     --prompt "Upbeat indie pop with acoustic guitar" \
     --lyrics-file ./lyrics.txt
   ```

## Duration Formats (ElevenLabs)

- Seconds: `30s`
- Minutes: `2m`  
- Time format: `2:30`
- Milliseconds: `150000`

Valid range: 3 seconds to 5 minutes

## Notes

- MiniMax requires lyrics; use `--lyrics` or `--lyrics-file`
- Format conversion happens automatically with a warning if the format doesn't match the service
- If `--output` extension conflicts with `--format`, the explicit output path is used with a warning

## CLI Error Messages

- `Missing input. Provide --prompt or --plan-file` (ElevenLabs)
- `MiniMax requires lyrics. Use --lyrics or --lyrics-file`
- `Conflicting input. Use either --prompt or --plan-file, not both`
- `Invalid --format: <value>. Run "music list-formats" for valid values`
- `Conflicting lyrics input. Use --lyrics or --lyrics-file, not both`
- `Invalid duration: <value>. Use 30s, 2m, 2:30, or milliseconds`

## See Also

- [ElevenLabs Music Options](./02-elevenlabs-music.md) - Detailed ElevenLabs prompting guide
- [MiniMax Music Options](./03-minimax-music.md) - Detailed MiniMax prompting guide
