# Extract Command - PDF Text Extraction

## Outline

- [pdf - Extract Text from Single PDF](#pdf-extract-text-from-single-pdf)
- [batch - Process Multiple PDFs](#batch-process-multiple-pdfs)
- [Services](#services)
  - [Zerox (AI-OCR)](#zerox-ai-ocr)
  - [Unpdf (Local)](#unpdf-local)
  - [Textract (AWS)](#textract-aws)

## pdf - Extract Text from Single PDF

Extract text from a single PDF file using AI-powered OCR:

```bash
bun as -- extract pdf input/document.pdf
```

Use local extraction (free, no API keys required):

```bash
bun as -- extract pdf input/document.pdf --service unpdf
```

Use AWS Textract for OCR:

```bash
bun as -- extract pdf input/document.pdf --service textract
```

Specify custom output location:

```bash
bun as -- extract pdf input/document.pdf --output extracted_text.txt
```

Include page break markers:

```bash
bun as -- extract pdf input/document.pdf --page-breaks
```

Use high-quality model for better OCR:

```bash
bun as -- extract pdf input/document.pdf --model gpt-4.1
```

## batch - Process Multiple PDFs

Process all PDF files in a directory:

```bash
bun as -- extract batch input/pdfs/
```

Specify output directory:

```bash
bun as -- extract batch input/pdfs/ --output output/extracted/
```

Use local extraction for batch processing:

```bash
bun as -- extract batch input/pdfs/ --service unpdf
```

Include page breaks in all extracted files:

```bash
bun as -- extract batch input/pdfs/ --page-breaks
```

## Services

### Zerox (AI-OCR)

AI-powered OCR using OpenAI vision models. Provides high-quality text extraction from complex documents.

**Requirements:**
- `OPENAI_API_KEY` environment variable
- GraphicsMagick: `brew install graphicsmagick`

**Models:**
- `gpt-4.1-mini` (default) - Cost-effective, good quality
- `gpt-4.1` - Higher quality, more expensive
- `gpt-4o-mini` - Fast processing
- `gpt-4o` - Premium quality

**Usage:**
```bash
bun as -- extract pdf document.pdf --service zerox --model gpt-4.1
```

### Unpdf (Local)

Local text extraction using the unpdf library. Free to use, no API keys required.

**Requirements:**
- None (included in dependencies)

**Usage:**
```bash
bun as -- extract pdf document.pdf --service unpdf
```

### Textract (AWS)

AWS managed OCR service with high accuracy for documents.

**Requirements:**
- `AWS_ACCESS_KEY_ID` environment variable
- `AWS_SECRET_ACCESS_KEY` environment variable
- `AWS_REGION` environment variable (optional, defaults to us-east-1)
- GraphicsMagick: `brew install graphicsmagick`

**Usage:**
```bash
bun as -- extract pdf document.pdf --service textract
```

## Examples

Extract text from research paper:

```bash
bun as -- extract pdf input/document.pdf --service zerox --model gemini-2.0-flash
```

Process multiple invoices with page breaks:

```bash
bun as -- extract batch input/invoices/ --service textract --page-breaks
```

Quick local extraction:

```bash
bun as -- extract pdf input/document.pdf --service unpdf --output quick_extract.txt
```

High-quality extraction for complex document:

```bash
bun as -- extract pdf input/complex-document.pdf --service zerox --model gpt-4.1 --page-breaks
```