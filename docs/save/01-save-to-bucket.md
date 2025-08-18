# Save to Cloud Storage

## Overview

The `--save` option uploads generated markdown files to cloud storage after processing.

Supported services:
- **s3** - Amazon S3
- **r2** - Cloudflare R2

## Usage

Add `--save` to any text processing command:

```bash
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --save s3

npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --save r2

npm run as -- text --rss "https://feeds.transistor.fm/fsjam-podcast" --last 3 --save r2

npm run as -- text --file "input/examples/audio.mp3" --claude --save s3
```

## Custom Bucket Prefix

Use `--s3-bucket-prefix` to customize the bucket name prefix (works for both S3 and R2):

```bash
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --save s3 --s3-bucket-prefix "my-podcast"

npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --save r2 --s3-bucket-prefix "my-content"
```

## Examples

### Process Playlist
```bash
npm run as -- text --playlist "https://www.youtube.com/playlist?list=PLCVnrVv4KhXPz0SoAVu8Rc1emAdGPbSbr" \
  --whisper large-v3-turbo \
  --chatgpt gpt-4o-mini \
  --save s3
```

### Process RSS Feed
```bash
npm run as -- text --rss "https://ajcwebdev.substack.com/feed" \
  --last 5 \
  --deepgram \
  --claude claude-3-5-haiku-latest \
  --save r2 \
  --s3-bucket-prefix "podcast-archives"
```

### Process Channel with Date Filter
```bash
npm run as -- text --channel "https://www.youtube.com/@ajcwebdev" \
  --date 2025-01-01 2025-01-15 \
  --whisper large-v3-turbo \
  --gemini \
  --save r2
```

## Output

After upload, URLs are displayed in the console:

**S3**: `https://autoshow-123456789012-us-west-2.s3.amazonaws.com/1755334409936/video-title-chatgpt-shownotes.md`

**R2**: `https://c6494d4164a5eb0cd3848193bd552d68.r2.cloudflarestorage.com/autoshow-c6494d4164a5eb0cd3848193bd552d68-auto/1755334409936/video-title-chatgpt-shownotes.md`