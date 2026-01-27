# EPUB Command - EPUB Text Extraction

Extract text from EPUB files for TTS (text-to-speech) processing. Removes HTML formatting, footnotes, page numbers, and other elements that interfere with audio output.

## Outline

- [Single File Extraction](#single-file-extraction)
- [Batch Processing](#batch-processing)
- [Splitting Options](#splitting-options)
- [Output Structure](#output-structure)
- [Features](#features)
- [Examples](#examples)

## Single File Extraction

Extract text from a single EPUB file:

```bash
bun as -- extract epub input/book.epub
```

Specify custom output directory:

```bash
bun as -- extract epub input/book.epub --output output/my-book
```

## Batch Processing

Process all EPUB files in a directory:

```bash
bun as -- extract epub input/
```

Each EPUB file will be extracted to its own subdirectory within `output/`.

## Splitting Options

### Split by Character Limit (Default)

By default, output is split into files with a maximum of 39,000 characters each:

```bash
bun as -- extract epub input/book.epub
```

Specify a custom character limit:

```bash
bun as -- extract epub input/book.epub --max-chars 50000
```

### Split into N Files

Split into exactly N files of roughly equal length:

```bash
bun as -- extract epub input/book.epub --split 4
```

```bash
bun as -- extract epub input/book.epub --split 8
```

When both `--split` and `--max-chars` are provided, `--split` takes precedence.

**Options:**

| Option | Description |
|--------|-------------|
| `-o, --output <path>` | Output directory (defaults to `output/<filename>`) |
| `--max-chars <number>` | Max characters per output file (default: 39,000) |
| `--split <number>` | Split into exactly N files of roughly equal length |

## Output Structure

The command creates a directory with multiple text files:

```
output/
└── book-name/
    ├── book-name-001.txt
    ├── book-name-002.txt
    ├── book-name-003.txt
    └── book-name-004.txt
```

Files are numbered sequentially with zero-padded three-digit suffixes.

## Features

- Removes all HTML formatting
- Strips footnote references and sections
- Eliminates page numbers and headers
- Cleans excessive whitespace
- Decodes HTML entities
- Removes superscript numbers and footnote markers
- Splits output into manageable chunks for TTS processing
- Preserves paragraph structure where possible

## Examples

Extract EPUB with default settings:

```bash
bun as -- extract epub input/audiobook.epub
```

Extract EPUB into exactly 4 parts for TTS:

```bash
bun as -- extract epub input/audiobook.epub --split 4
```

Extract with larger chunk size:

```bash
bun as -- extract epub input/book.epub --max-chars 60000
```

Batch process an EPUB collection:

```bash
bun as -- extract epub input/ebooks/
```

Extract to custom location with 8-way split:

```bash
bun as -- extract epub input/long-book.epub --output output/long-book-tts --split 8
```
