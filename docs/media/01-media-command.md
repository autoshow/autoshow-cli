# Media Command

The media command provides audio/video file operations including downloading from URLs and converting local files to optimized formats.

## Outline

- [download - Download Audio from URLs](#download---download-audio-from-urls)
- [convert - Convert Local Audio/Video Files](#convert---convert-local-audiovideo-files)

## download - Download Audio from URLs

Download audio from URLs listed in a markdown file using yt-dlp.

```bash
bun as -- media download --urls "input/example-urls.md"
```

Display detailed output during download:

```bash
bun as -- media download --urls "input/example-urls.md" --verbose
```

### Input File Format

The markdown file should contain URLs, one per line or embedded in text:

```markdown
# Video URLs to Download

https://www.youtube.com/watch?v=MORMZXEaONk
https://www.youtube.com/watch?v=nXtaETBZ29g

You can also include URLs in sentences like this: https://www.youtube.com/watch?v=example
```

### Output

Downloaded files are saved to the `output` directory with the format:
- `YYYY-MM-DD-title.mp3`

## convert - Convert Local Audio/Video Files

Convert local audio or video files to optimized MP3 format using ffmpeg.

```bash
bun as -- media convert --files "input/videos"
```

Convert single file:

```bash
bun as -- media convert --files "input/audio.mp3"
```

Specify custom output directory:

```bash
bun as -- media convert --files "input/videos" --output "output/audio"
```

Display detailed output during conversion:

```bash
bun as -- media convert --files "input/videos" --verbose
```

### Supported Input Formats

**Video**: .mp4, .mkv, .avi, .mov, .flv, .wmv, .webm
**Audio**: .mp3, .wav, .m4a, .flac, .ogg

### Output Configuration

- **Format**: MP3
- **Quality**: 0 (highest)
- **Encoding**: libmp3lame
- **Output**: Mono channel, optimized for speech

### Output Structure

```
output/
├── downloaded-video-1.mp3
├── downloaded-video-2.mp3
├── converted-local-file-1.mp3
└── converted-local-file-2.mp3
```

## Examples

### Download YouTube Audio

```bash
# Create URLs file
echo "https://www.youtube.com/watch?v=MORMZXEaONk" > input/videos.md

# Download audio
bun as -- media download --urls "input/videos.md"
```

### Convert Local Media

```bash
# Convert all videos in a directory
bun as -- media convert --files "input/recordings"

# Convert single file with verbose output
bun as -- media convert --files "presentation.mp4" --verbose
```

### Integration with Text Command

The media command works alongside the text processing pipeline:

```bash
# 1. Download audio from URLs
bun as -- media download --urls "input/podcast-urls.md"

# 2. Process downloaded audio with text command
bun as -- text --file "input/2024-01-15-podcast-episode.mp3" --chatgpt
```

## Requirements

- **yt-dlp**: For downloading audio from URLs
- **ffmpeg**: For audio/video conversion

Both are installed automatically during setup on macOS.