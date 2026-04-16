## Article URL Inputs: Defuddle (Local / Free) + Firecrawl (Paid)

### Summary

Add article/HTML extraction to the document pipeline so `ocr`, document-mode `write`, `metadata`, and `download` accept normal website URLs and local `.html`/`.htm` files. Two article backends behind the same output contract:

- **Defuddle**: default local/free path. Fetch/read HTML locally, parse with `linkedom`, run `defuddle/node` with `{ markdown: true }`, feed markdown into the existing document extraction output shapes.
- **Firecrawl**: opt-in paid service path for remote URLs. Call the Firecrawl REST API directly from Bun (no `firecrawl-cli` dependency), request markdown with `onlyMainContent: true`, normalize into the same `PreparedDocument` / `ExtractionResult` contract.

User-visible behavior stays document-like: no new output modes, no STT/media fallback, same `extraction.txt` / `metadata.json` artifacts as other document inputs.

### Dependencies and Configuration

- Install `defuddle` and `linkedom` as production dependencies for the local/free path.
- Add `FIRECRAWL_API_KEY` to `.env.example` for the paid path.
- Add optional `FIRECRAWL_API_URL` so self-hosted or local Firecrawl instances can be used (when set to a non-default URL, API key auth is skipped per Firecrawl conventions).
- Do **not** add `firecrawl-cli` as a dependency. The implementation calls the Firecrawl REST API (`POST /v1/scrape`) directly via `fetch()`.

### 1. Type Changes (all in one pass)

Collect all type additions up front so the rest of the plan can reference them.

**File: `src/types/cli-dir-types.ts`**

Add `'url_html_article'` to `InputKind`:

```typescript
export type InputKind =
  | 'url_streaming'
  | 'url_direct_media'
  | 'url_direct_document'
  | 'url_html_article'      // ← new
  | 'local_media'
  | 'local_document'
```

**File: `src/types/process-steps-dir-types.ts`**

Add `'html'` to `DocFormat`:

```typescript
export type DocFormat =
  | 'pdf' | 'epub' | 'png' | 'jpg' | 'tif' | 'docx' | 'pptx' | 'xlsx' | 'odf'
  | 'mobi' | 'azw3' | 'fb2' | 'lit' | 'cbz' | 'rtf' | 'csv' | 'webp' | 'bmp' | 'gif'
  | 'html'                   // ← new
```

Add `'html'` to `DetectResult` in `src/types/process-types.ts` as well.

**File: `src/types/process-types.ts`**

Add `'html'` to the `DocumentMetadataSchema.format` picklist:

```typescript
format: v.picklist([
  'pdf', 'epub', 'png', 'jpg', 'tif', 'docx', 'pptx', 'xlsx', 'odf',
  'mobi', 'azw3', 'fb2', 'lit', 'cbz', 'rtf', 'csv', 'webp', 'bmp', 'gif',
  'html'                     // ← new
]),
```

Add article extraction methods to the `ExtractionMetadataSchema.extractionMethod` picklist:

```typescript
'html+defuddle', 'html+firecrawl'   // ← new entries
```

Add a shared backend type and extend `PreparedDocument`:

```typescript
export type HtmlArticleBackend = 'defuddle' | 'firecrawl'

export type WebArticleMetadata = {
  sourceUrl?: string
  finalUrl?: string
  title?: string
  author?: string
  site?: string
  published?: string
  language?: string
  wordCount?: number
  description?: string
}

export type PreparedDocument = {
  outputDir: string
  step1Metadata: DocumentMetadata
  effectiveFilePath?: string
  tempCleanup?: () => Promise<void>
  preparedMarkdown?: string            // ← new: pre-extracted markdown skips step 2
  htmlArticleBackend?: HtmlArticleBackend  // ← new: tracks free vs paid
  web?: WebArticleMetadata             // ← new: article-specific metadata
}
```

### 2. Extend Input Classification

**File: `src/cli/commands/process-steps/step-1-download/targets/target-utils.ts`**

Add `.html` and `.htm` to `DOCUMENT_EXTENSIONS` so local HTML files are detected by `isDocumentByExtension()` and included in directory scans for `ocr` mode.

**File: `src/cli/commands/process-steps/step-1-download/targets/single-target.ts`**

Make `classifyUrlInput()` async. Before the final `'url_streaming'` fallback, probe the URL with an HTTP HEAD request:

```typescript
const classifyUrlInput = async (url: string): Promise<InputKind> => {
  if (isDocumentUrl(url)) return 'url_direct_document'
  if (isDirectMediaUrl(url)) return 'url_direct_media'
  if (isStreamingUrl(url)) return 'url_streaming'

  // Probe unrecognized URLs via HEAD to distinguish HTML articles from media
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal })
    clearTimeout(timeout)

    const ct = (res.headers.get('content-type') ?? '').toLowerCase()
    const cd = (res.headers.get('content-disposition') ?? '').toLowerCase()

    // Check Content-Disposition for document filenames
    if (cd && DOCUMENT_EXTENSIONS.some(ext => cd.includes(ext))) return 'url_direct_document'
    // Known document MIME types
    if (ct.includes('application/pdf') || ct.includes('application/epub+zip')) return 'url_direct_document'
    // Direct media
    if (ct.startsWith('audio/') || ct.startsWith('video/')) return 'url_direct_media'
    // HTML article
    if (ct.includes('text/html') || ct.includes('application/xhtml+xml')) return 'url_html_article'
  } catch {
    // HEAD failed or timed out — fall through to streaming (yt-dlp will handle or error)
  }

  return 'url_streaming'
}
```

**Notes:**
- Some servers don't support HEAD. If HEAD returns a non-2xx status, consider retrying with a ranged GET (`Range: bytes=0-0`) before falling back. This is optional — most article servers handle HEAD fine, and the fallback to `url_streaming` is safe.
- Update all call sites of `classifyUrlInput` to `await` the result (there are only a few, and callers are already async).

### 3. Create Article Preparation Module

**File: `src/cli/commands/process-steps/step-1-download/document/prepare-html-article.ts`**

Single exported function:

```typescript
export async function prepareHtmlArticle(
  source: string,           // URL or local file path
  outputDir: string,
  backend: HtmlArticleBackend
): Promise<PreparedDocument>
```

Implementation:

1. **Resolve source kind**
   - `source` starts with `http` → remote URL
   - Otherwise → local file, always force `backend = 'defuddle'` (warn if Firecrawl was requested for a local file)

2. **Defuddle path** (local and remote)
   - Remote: `fetch(source)` with a User-Agent header and 15s timeout → get HTML string
   - Local: `await Bun.file(source).text()` → get HTML string
   - Parse: `const { document } = parseHTML(html)` (from `linkedom`)
   - Extract: `const result = await Defuddle(document, source, { markdown: true })` (from `defuddle/node`)
   - Validate: if `result.content` is empty or under ~50 chars, throw with a message suggesting `--url-backend firecrawl` for JS-heavy pages

3. **Firecrawl path** (remote only)
   - Resolve API base URL from `FIRECRAWL_API_URL` (default: `https://api.firecrawl.dev`)
   - If using the default hosted URL: require `FIRECRAWL_API_KEY`, fail with a clear setup error if missing
   - If using a custom URL (self-hosted): API key is optional per Firecrawl conventions
   - Call `POST {baseUrl}/v1/scrape` with body: `{ url: source, formats: ['markdown'], onlyMainContent: true }`
   - Set headers: `Authorization: Bearer ${apiKey}` (when key is present), `Content-Type: application/json`
   - Parse response: extract `data.markdown` from the JSON response
   - Validate: if markdown is empty, throw with a clear error

4. **Build metadata** (shared for both backends)
   - `format: 'html'`
   - `pageCount: 1`
   - `title` / `author` / `site` / `published` / `language` / `wordCount` from whichever backend produced the article (Defuddle returns these directly; Firecrawl returns them in `data.metadata`)
   - `slug`: derive from URL hostname + pathname (for remote) or filename (for local)
   - `fileSize`: byte length of the original HTML (Defuddle local) or the fetched body

5. **Return** a `PreparedDocument` with:
   - `step1Metadata` populated
   - `preparedMarkdown` containing the extracted markdown
   - `htmlArticleBackend` set to the resolved backend
   - `web` populated with article metadata

### 4. Short-Circuit Step 2 for Prepared Markdown

**File: `src/cli/commands/process-steps/step-2-document/run-extract.ts`**

At the top of `runExtract()`, before the existing format-based dispatch, check for pre-extracted markdown. This requires passing the `PreparedDocument` (or at minimum the `preparedMarkdown` field) through to `runExtract`. Two options:

**Option A (minimal change):** Add an optional `preparedMarkdown?: string` to `ExtractionOptions`. The caller sets it when the input is an HTML article. Inside `runExtract`:

```typescript
if (opts.preparedMarkdown) {
  pages = [{ pageNumber: 1, method: 'text' as const, text: opts.preparedMarkdown }]
  extractionMethod = step1Metadata.format === 'html'
    ? `html+${/* backend from opts or metadata */}`
    : 'text'
  // Skip all format-specific extraction
}
```

**Option B (cleaner):** Add `preparedMarkdown` to the function signature. Either way, the key behavior is: when markdown is already extracted, skip all file-based extraction and OCR.

Set `ExtractionMetadata` fields:
- `extractionMethod`: `'html+defuddle'` or `'html+firecrawl'`
- `inputFamily`: `'html'`
- `outputFidelity`: `'markdown'`
- `totalPages`: 1, `textPages`: 1, `ocrPages`: 0

### 5. Wire Into `processSingleTarget()`

**File: `src/cli/commands/process-steps/step-1-download/targets/single-target.ts`**

Add handling for `'url_html_article'` in each command branch:

- **`ocr` command**: resolve backend → `prepareHtmlArticle()` → `processExtractSingle()` (or the equivalent document extraction path) with the prepared document
- **`write` command (document mode)**: `prepareHtmlArticle()` → `runDocumentWrite()` with the prepared document — the LLM step receives markdown just like any other document extraction
- **`metadata` command**: `prepareHtmlArticle()` → return step-1 metadata (title, author, format, pageCount, web metadata)
- **`download` command**: `prepareHtmlArticle()` → write `metadata.json` only (same contract as other document downloads)

For local `.html`/`.htm` files: the updated `isDocumentByExtension()` routes them into the document path. In `prepareDocumentMetadata()` (or a new branch before it), detect the `.html`/`.htm` extension and delegate to `prepareHtmlArticle()` with forced `defuddle` backend, instead of trying `detectDocumentFormat()` which uses magic bytes and won't recognize HTML.

### 6. Backend Selection

Add a `--url-backend <defuddle|firecrawl>` CLI flag (or `--article-backend`):

- Local `.html`/`.htm` files → always Defuddle (warn if Firecrawl was requested)
- Remote article URLs → Defuddle by default
- `--url-backend firecrawl` → switches remote article URLs to Firecrawl
- `AUTOSHOW_URL_BACKEND=firecrawl` env var provides a default for users who always want the hosted path
- CLI flag overrides env var

### 7. OCR Flag Warnings

When the input is classified as `'url_html_article'` or local HTML:

- If `--ocrmypdf`, `--paddle-ocr`, or `--mistral-ocr` flags are present, log a warning that OCR flags are ignored for HTML/article inputs (markdown extraction doesn't use OCR)
- If Firecrawl was explicitly selected, log which backend is being used
- Do **not** create provider fan-out directories
- Do **not** route article inputs into the media/STT pipeline

**Important**: do **not** auto-failover from Defuddle to Firecrawl. Silent fallback would turn a free/local operation into a paid network call. Instead, fail with a clear message suggesting `--url-backend firecrawl` when Defuddle cannot extract meaningful content.

### 8. Pricing

**File: `src/utils/pricing/aggregate-pricing.ts`**

- Classify article URLs as document-like, not media/STT
- `--price` should report document-style outputs and no STT step
- Defuddle-backed inputs: no extraction-provider cost (free/local)
- Firecrawl-backed inputs: print a note like "Firecrawl credits apply; exact cost not estimated locally" rather than showing $0
- Expected output files: `extraction.txt`, `metadata.json` (same as `ocr` document outputs)

### 9. Output Compatibility

No changes needed. The existing `writeExtractionArtifact()` handles all formats given an `ExtractionResult`:

- `--out text`: writes markdown into `extraction.txt`
- `--out json`: writes markdown in `text` and `pages[0].text`
- `--out tsv`: emits one row (page 1)
- `--out hocr`: wraps the markdown in the page wrapper format

### Assumptions

- Defuddle is the default because it is local/free
- Firecrawl is opt-in and treated as a paid service
- Local `.html`/`.htm` inputs never go to Firecrawl
- Firecrawl integration uses `fetch()` against `POST /v1/scrape` — no SDK or CLI dependency
- When `FIRECRAWL_API_URL` points at a self-hosted instance, API key auth is optional
- Defuddle and Firecrawl markdown are both normalized into the same extraction contract
- Do not add `--out markdown` — markdown is delivered through the existing output shapes
- The HEAD-based URL probe adds one extra request per unrecognized URL; this is acceptable since the alternative is a yt-dlp failure that takes longer
- HTML detection for local files happens at the extension level (`.html`/`.htm`), not via magic bytes in `detectDocumentFormat()` — HTML is text and doesn't have reliable magic bytes

### Test Plan

- **Single URL routing**
  - `bun as ocr <article-url>` defaults to Defuddle and produces markdown extraction with `extractionMethod: 'html+defuddle'`
  - `bun as ocr --url-backend firecrawl <article-url>` produces markdown extraction with `extractionMethod: 'html+firecrawl'`
  - `bun as write <article-url>` follows the document pipeline, not the media/STT pipeline
  - `bun as write --price <article-url>` reports document-style outputs and no STT step
- **Local HTML**
  - `bun as ocr page.html` produces markdown extraction via Defuddle
  - `bun as ocr --url-backend firecrawl page.html` warns and still uses Defuddle
  - Directory scan in `ocr` mode includes `.html` and `.htm` files
- **Backend setup**
  - Firecrawl selection without `FIRECRAWL_API_KEY` (and default API URL) fails clearly
  - Firecrawl selection with `FIRECRAWL_API_URL=http://localhost:3002` can proceed without an API key
- **URL probe classification**
  - URL returning `Content-Type: application/pdf` without a `.pdf` extension routes to direct-document flow
  - URL returning `Content-Type: text/html` routes to article flow
  - URL probe timeout/failure falls back to streaming
- **Output compatibility**
  - `--out text`, `json`, `tsv`, and `hocr` all succeed on article inputs under both backends
- **Batch behavior**
  - URL-list with mixed article URLs and PDF URLs succeeds
  - `metadata` and `download` recognize article URLs as document inputs
- **Flag / pricing behavior**
  - `--ocrmypdf` on an article URL warns and is ignored
  - No provider fan-out directories are created for article inputs
  - `--price` omits extraction cost for Defuddle inputs
  - `--price` marks Firecrawl inputs as paid/external rather than free
- **Failure behavior**
  - Defuddle failure on a remote article URL does not silently invoke Firecrawl
  - The user gets a clear next step to retry with `--url-backend firecrawl`
