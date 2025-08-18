# Music Generation Command

Generate AI-powered instrumental music using Google's Lyria RealTime model with customizable prompts, styles, and musical parameters.

## Current Status

⚠️ **Experimental Preview**: Lyria RealTime is currently in experimental preview and requires WebSocket support that isn't yet available in the Google Generative AI SDK for Node.js.

### Alternative Options
- **Web Interface**: Try the [Prompt DJ](https://aistudio.google.com/apps/bundled/promptdj) on AI Studio
- **MIDI Support**: Use the [MIDI DJ](https://aistudio.google.com/apps/bundled/promptdj-midi) for MIDI control
- **Python SDK**: The Python SDK has experimental support for Lyria RealTime
- **Placeholder Mode**: The current implementation generates test audio files for pipeline testing

## Basic Usage

### Generate Music
```bash
# Simple generation with a single prompt
npm run as -- music generate --prompt "A salsa jazz tune"

# Multiple weighted prompts
npm run as -- music generate --prompt "techno:1.0,ambient:0.5"

# With custom duration
npm run as -- music generate --prompt "meditation music" --duration 60

# With musical parameters
npm run as -- music generate --prompt "funk" --bpm 120 --brightness 0.8
```

### Check Availability
```bash
# Check if Lyria RealTime is available
npm run as -- music check
```

### List Example Prompts
```bash
# Show example prompts and usage
npm run as -- music list-prompts
```

## Command Options

### Core Options
- `-p, --prompt <text>` - **Required**. Music generation prompt(s)
- `-o, --output <path>` - Output file path (default: auto-generated in output/)
- `-d, --duration <seconds>` - Duration in seconds (default: 30)

### Musical Parameters
- `--bpm <number>` - Beats per minute (60-200)
- `--scale <scale>` - Musical scale (see scales below)
- `--guidance <number>` - How strictly to follow prompts (0.0-6.0, default: 4.0)
- `--density <number>` - Note density (0.0-1.0)
- `--brightness <number>` - Tonal brightness (0.0-1.0)

### Audio Control
- `--mute-bass` - Reduce/remove bass frequencies
- `--mute-drums` - Reduce/remove drums
- `--only-bass-drums` - Generate only bass and drums

### Generation Settings
- `--mode <mode>` - Generation mode: QUALITY, DIVERSITY, or VOCALIZATION (default: QUALITY)
- `--temperature <number>` - Sampling temperature (0.0-3.0, default: 1.1)
- `--seed <number>` - Random seed for reproducibility

## Prompt Format

### Single Prompt
```bash
--prompt "minimal techno"
```

### Weighted Prompts
Use the format `prompt:weight` to blend multiple styles:
```bash
--prompt "jazz:1.0,ambient:0.5,piano:0.3"
```

### Multiple Elements
Combine instruments, genres, and moods:
```bash
--prompt "808 drums,deep house,ethereal,female vocals:0.2"
```

## Musical Scales

Available scale options for the `--scale` parameter:

| Scale Code | Musical Key |
|------------|-------------|
| `C_MAJOR_A_MINOR` | C major / A minor |
| `D_FLAT_MAJOR_B_FLAT_MINOR` | D♭ major / B♭ minor |
| `D_MAJOR_B_MINOR` | D major / B minor |
| `E_FLAT_MAJOR_C_MINOR` | E♭ major / C minor |
| `E_MAJOR_D_FLAT_MINOR` | E major / C♯ minor |
| `F_MAJOR_D_MINOR` | F major / D minor |
| `G_FLAT_MAJOR_E_FLAT_MINOR` | G♭ major / E♭ minor |
| `G_MAJOR_E_MINOR` | G major / E minor |
| `A_FLAT_MAJOR_F_MINOR` | A♭ major / F minor |
| `A_MAJOR_G_FLAT_MINOR` | A major / F♯ minor |
| `B_FLAT_MAJOR_G_MINOR` | B♭ major / G minor |
| `B_MAJOR_A_FLAT_MINOR` | B major / G♯ minor |
| `SCALE_UNSPECIFIED` | Let the model decide |

## Example Prompts

### Instruments
- **Electronic**: 303 Acid Bass, 808 Hip Hop Beat, Moog Oscillations, TR-909 Drum Machine
- **Traditional**: Accordion, Banjo, Cello, Flamenco Guitar, Harmonica, Piano, Violin
- **World**: Bagpipes, Didgeridoo, Djembe, Koto, Sitar, Tabla, Steel Drum
- **Jazz/Blues**: Alto Saxophone, Double Bass, Rhodes Piano, Trumpet, Vibraphone

### Genres
- **Electronic**: Acid Jazz, Chillout, Deep House, Drum & Bass, Dubstep, Minimal Techno, Synthpop, Trance
- **Traditional**: Baroque, Bluegrass, Celtic Folk, Classical, Jazz Fusion, Orchestral Score
- **World**: Afrobeat, Bhangra, Bossa Nova, Cumbia, Reggae, Salsa
- **Modern**: Lo-Fi Hip Hop, Neo-Soul, Trap Beat, Vaporwave

### Moods & Styles
- **Atmosphere**: Ambient, Chill, Dreamy, Ethereal, Psychedelic
- **Energy**: Danceable, Funky, Upbeat, Tight Groove
- **Texture**: Acoustic, Lo-fi, Rich Orchestration, Saturated Tones
- **Experimental**: Glitchy Effects, Weird Noises, Unsettling

## Usage Examples

### Ambient Meditation
```bash
npm run as -- music generate \
  --prompt "meditation,tibetan bowls,ambient:1.0,peaceful:0.8" \
  --duration 300 \
  --density 0.2 \
  --brightness 0.3
```

### Dance Music
```bash
npm run as -- music generate \
  --prompt "techno:1.0,acid bass:0.5,303:0.3" \
  --bpm 128 \
  --density 0.8 \
  --mode QUALITY
```

### Jazz Session
```bash
npm run as -- music generate \
  --prompt "jazz fusion,saxophone:0.8,piano:0.6,drums:0.4" \
  --bpm 90 \
  --scale F_MAJOR_D_MINOR
```

### Experimental Soundscape
```bash
npm run as -- music generate \
  --prompt "experimental:1.0,glitch:0.5,ambient:0.3" \
  --mode DIVERSITY \
  --temperature 2.0
```

## Configuration

Add your Gemini API key to `.env`:
```env
GEMINI_API_KEY=your_gemini_api_key
```

## Output Format

Generated music files are saved as:
- **Format**: WAV (48kHz, 16-bit, stereo)
- **Location**: `output/` directory by default
- **Naming**: `lyria-{timestamp}-{random}.wav`

## Best Practices

### Effective Prompting
1. **Be Descriptive**: Use adjectives for mood, genre, and instrumentation
2. **Layer Styles**: Combine multiple prompts with weights for complex sounds
3. **Iterate Gradually**: Modify prompts incrementally for smoother transitions
4. **Experiment with Weights**: Adjust weight values to fine-tune influence

### Parameter Guidelines
- **Guidance** (0-6): Higher values = stricter prompt following, more abrupt transitions
- **Density** (0-1): Lower = sparse/minimal, Higher = busy/complex
- **Brightness** (0-1): Lower = darker/warmer, Higher = brighter/sharper
- **Temperature** (0-3): Lower = predictable, Higher = experimental

### Generation Modes
- **QUALITY**: Focus on high-quality, coherent output (default)
- **DIVERSITY**: Generate more varied and experimental patterns
- **VOCALIZATION**: Include vocalizations as instrumental elements

## Limitations

- **Instrumental Only**: Lyria generates instrumental music without lyrics
- **Safety Filters**: Prompts are checked for safety compliance
- **Watermarking**: Output includes audio watermarking for AI identification
- **Duration**: Recommended 30-300 seconds for optimal results

## Troubleshooting

### API Key Issues
```bash
# Verify API key is set
echo $GEMINI_API_KEY

# Check model availability
npm run as -- music check
```

### No Audio Generated
- Ensure GEMINI_API_KEY is valid
- Check if prompts trigger safety filters
- Verify output directory permissions

### Poor Quality Results
- Adjust guidance parameter
- Simplify prompt complexity
- Use more specific genre/instrument terms

## Future Updates

When WebSocket support is added to the SDK:
1. Real-time streaming generation
2. Live prompt steering during playback
3. Interactive music sessions
4. Continuous generation beyond fixed durations

## Additional Resources

- [Lyria Technology Overview](https://deepmind.google/technologies/lyria/)
- [AI Studio Prompt DJ](https://aistudio.google.com/apps/bundled/promptdj)
- [Google AI Music Generation Docs](https://ai.google.dev/gemini-api/docs/music-generation)
- [Responsible AI Principles](https://ai.google/responsibility/principles/)