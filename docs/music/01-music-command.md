# Music Generation Command

Generate AI music using ElevenLabs Eleven Music model.

## Quick Setup

```bash
# Add API key to .env
ELEVENLABS_API_KEY=xxx
```

## Basic Usage

```bash
# Generate music from a prompt
bun as -- music generate --prompt "An upbeat electronic dance track"

# Instrumental only
bun as -- music generate --prompt "A peaceful piano melody" --instrumental

# With specific duration
bun as -- music generate --prompt "A dramatic orchestral piece" --duration 2m

# With inline lyrics
bun as -- music generate --prompt "Upbeat pop song" --lyrics "Walking down the street on a sunny day..."

# With lyrics from file
bun as -- music generate --prompt "Folk ballad" --lyrics-file ./lyrics.txt

# Using a composition plan
bun as -- music generate --plan-file ./my-plan.json

# Create a composition plan (free)
bun as -- music plan --prompt "A pop song about summer" --duration 2m -o plan.json

# List output formats
bun as -- music list-formats
```

## Available Subcommands

| Command | Description |
|---------|-------------|
| `generate` | Generate music from a prompt or plan |
| `plan` | Create a composition plan (no credits) |
| `list-formats` | Show available output formats |

## Generate Options

```bash
--prompt <text>         # Text prompt (required unless --plan-file used)
--plan-file <path>      # Use composition plan from JSON file
--output <path>         # Output file path
--duration <duration>   # Duration (30s, 2m, 2:30)
--instrumental          # No vocals
--lyrics <text>         # Inline lyrics
--lyrics-file <path>    # Lyrics from file
--format <format>       # Output format (default: mp3_44100_128)
--timestamps            # Include word timestamps
--c2pa                  # Sign with C2PA (mp3 only)
--respect-durations     # Strictly follow section durations from plan
```

## Workflow: Using Composition Plans

1. Create a plan (free, no credits):
   ```bash
   bun as -- music plan --prompt "Epic rock anthem" --duration 3m -o plan.json
   ```

2. Review and edit `plan.json` - adjust sections, styles, lyrics

3. Generate using the plan:
   ```bash
   bun as -- music generate --plan-file plan.json
   ```

## Duration Formats

- Seconds: `30s`
- Minutes: `2m`  
- Time format: `2:30`
- Milliseconds: `150000`

Valid range: 3 seconds to 5 minutes

## Notes

- The detailed endpoint used by `--timestamps` may return JSON or multipart; parsing should follow the actual `content-type` response.
- If `--output` conflicts with `--format` (e.g. `.wav` with `mp3_44100_128`), prefer the explicit output path and warn.

## CLI Error Messages

- `Missing input. Provide --prompt or --plan-file`
- `Conflicting input. Use either --prompt or --plan-file, not both`
- `Invalid --format: <value>. Run "music list-formats" for valid values`
- `Conflicting lyrics input. Use --lyrics or --lyrics-file, not both`
- `Invalid duration: <value>. Use 30s, 2m, 2:30, or milliseconds`
- `Invalid duration: <value>. Must be between 3 seconds and 5 minutes (3000-600000ms)`

## See Also

- [ElevenLabs Music Options](./02-elevenlabs-music.md) - Detailed prompting guide
