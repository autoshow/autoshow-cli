# setup --sample

Generate and validate deterministic fixture files for all supported formats.

## Outline

- [Usage](#usage)
- [Overview](#overview)
- [Flags](#flags)
- [Examples](#examples)
- [Fixture matrix](#fixture-matrix)
  - [Valid fixtures](#valid-fixtures-inputsamplesvalid)
  - [Invalid fixtures](#invalid-fixtures-inputsamplesinvalid)
- [Partial toolchain environments](#partial-toolchain-environments)
- [Manifest format](#manifest-format-inputsamplesmanifestjson)
- [Notes](#notes)

## Usage

```bash
bun as setup --sample [flags]
```

## Overview

`setup --sample` creates a canonical set of test fixtures under `input/samples/` and writes a `manifest.json` tracking every file's format, support level, validity, required tools, and verification status. The test runner runs this focused setup mode as preflight before executing any tests.

## Flags

| Flag             | Default          | Description                                               |
|------------------|------------------|-----------------------------------------------------------|
| `--out`          | `input/samples`  | Output directory for fixture files                        |
| `--refresh`      | `false`          | Regenerate all fixtures even if manifest is already valid |
| `--verify-only`  | `false`          | Validate existing fixture set without regenerating        |
| `--valid-only`   | `false`          | Skip invalid fixture generation                           |

## Examples

```bash
# Generate all fixtures (default output: input/samples/)
bun as setup --sample

# Generate to a custom directory
bun as setup --sample --out /tmp/fixtures

# Verify existing fixtures only
bun as setup --sample --verify-only

# Force full regeneration
bun as setup --sample --refresh

# Generate valid fixtures only (skip intentionally-corrupt files)
bun as setup --sample --valid-only
```

## Fixture matrix

### Valid fixtures (`input/samples/valid/`)

| Fixture          | Format | Support level | Required tools |
|------------------|--------|---------------|----------------|
| `1-audio.wav`    | wav    | current       | ffmpeg         |
| `1-audio.mp3`    | mp3    | current       | ffmpeg         |
| `1-audio.m4a`    | m4a    | current       | ffmpeg         |
| `2-video.mp4`    | mp4    | current       | ffmpeg         |
| `2-video.webm`   | webm   | current       | ffmpeg         |
| `2-video.mkv`    | mkv    | current       | ffmpeg         |
| `1-audio.opus`   | opus   | current       | ffmpeg         |
| `1-audio.ogg`    | ogg    | current       | ffmpeg         |
| `1-audio.aac`    | aac    | current       | ffmpeg         |
| `2-video.mov`    | mov    | current       | ffmpeg         |
| `1-audio.flac`   | flac   | current       | ffmpeg         |
| `1-document.pdf` | pdf    | current       | —              |
| `1-document.epub`| epub   | current       | —              |
| `1-document.docx`| docx   | current       | —              |
| `1-document.pptx`| pptx   | current       | —              |
| `1-document.xlsx`| xlsx   | current       | —              |
| `1-document.odt` | odt    | current       | —              |
| `1-document.ods` | ods    | current       | —              |
| `1-document.odp` | odp    | current       | —              |
| `1-image.png`    | png    | current       | —              |
| `1-image.jpg`    | jpg    | current       | —              |
| `1-image.jpeg`   | jpeg   | current       | —              |
| `1-image.tif`    | tif    | current       | —              |
| `1-image.tiff`   | tiff   | current       | —              |
| `1-tts.md`       | md     | current       | —              |
| `2-urls.txt`     | txt    | current       | —              |
| `1-document.mobi`| mobi   | planned       | calibre        |
| `1-document.azw3`| azw3   | planned       | calibre        |
| `1-document.fb2` | fb2    | planned       | calibre        |
| `1-document.lit` | lit    | planned       | calibre        |
| `1-document.cbz` | cbz    | planned       | imagemagick    |
| `1-document.rtf` | rtf    | planned       | —              |
| `1-document.csv` | csv    | planned       | —              |
| `1-image.webp`   | webp   | planned       | imagemagick    |
| `1-image.bmp`    | bmp    | planned       | imagemagick    |
| `1-image.gif`    | gif    | planned       | imagemagick    |

### Invalid fixtures (`input/samples/invalid/`)

| Fixture          | Reason                                          |
|------------------|-------------------------------------------------|
| `corrupt.pdf`    | Truncated at byte 64 (valid header, no body)    |
| `corrupt.zip`    | Corrupt ZIP container (valid magic, garbage body) |
| `empty.mp3`      | Empty file                                      |
| `binary.png`     | Non-image bytes with `.png` extension           |
| `malformed.csv`  | Unterminated quotes                             |
| `binary.csv`     | Binary content with `.csv` extension            |

## Partial toolchain environments

Not all tools are required. The command adapts based on available tools:

| Tool                        | Required for                       | Policy                                              |
|-----------------------------|------------------------------------|-----------------------------------------------------|
| ffmpeg / ffprobe            | Media fixtures                     | **Required** — preflight fails if missing           |
| calibre (`ebook-convert`)   | MOBI/AZW3/FB2/LIT fixtures         | **Optional** — skipped with warning if missing      |
| imagemagick (`convert`)     | WebP/BMP/GIF/CBZ fixtures          | **Optional** — skipped with warning if missing      |

Skipped fixtures are recorded in `manifest.json` under `skipped[]`.

## Manifest format (`input/samples/manifest.json`)

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-03-01T12:00:00Z",
  "mode": "full",
  "fixtures": [
    {
      "path": "valid/1-document.pdf",
      "format": "pdf",
      "supportLevel": "current",
      "validity": "valid",
      "requiredTools": [],
      "verified": true
    },
    {
      "path": "invalid/corrupt.pdf",
      "format": "pdf",
      "supportLevel": "current",
      "validity": "invalid",
      "requiredTools": [],
      "verified": true,
      "invalidReason": "truncated-at-byte-64"
    }
  ],
  "skipped": [
    {
      "path": "valid/1-document.lit",
      "reason": "missing tools: calibre",
      "requiredTools": ["calibre"]
    }
  ],
  "summary": {
    "total": 43,
    "generated": 41,
    "skipped": 2,
    "verified": 41
  }
}
```

## Notes

- Determinism is enforced at file-set/name/structure level; byte-level hashes are not enforced across platforms.
- Every fixture must be structurally valid for its declared format (no placeholder stubs).
- `bun t` automatically runs `bun as setup --step sample` and then `bun as setup --sample` as preflight before executing tests.
- See [`sample-tests.md`](./sample-tests.md) for test coverage.
