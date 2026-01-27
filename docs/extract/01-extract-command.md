# Extract Command

The `extract` command provides text extraction capabilities for PDF and EPUB files.

## Subcommands

| Command | Description |
|---------|-------------|
| `extract pdf` | Extract text from a single PDF file |
| `extract batch` | Process multiple PDF files from a directory |
| `extract epub` | Extract text from EPUB files for TTS processing |

## Quick Examples

```bash
# Extract text from PDF
bun as -- extract pdf input/document.pdf

# Batch process PDFs
bun as -- extract batch input/pdfs/

# Extract EPUB for TTS
bun as -- extract epub input/book.epub --split 4
```

See the individual command documentation for detailed options:

- [PDF Command](./02-pdf-command.md) - PDF text extraction with OCR services
- [EPUB Command](./03-epub-command.md) - EPUB text extraction for TTS
