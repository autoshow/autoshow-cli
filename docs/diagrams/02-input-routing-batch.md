# Input Routing & Batch Orchestration

How inputs are classified and routed across single-item and batch processing paths.

## Outline

- [Top-Level Classification](#top-level-classification)
- [Single Target Input Classification](#single-target-input-classification)
- [Command + Input Kind Matrix](#command--input-kind-matrix)
- [Batch Processing Flow](#batch-processing-flow)
- [Batch Entry Points](#batch-entry-points)

## Top-Level Classification

```
src/cli/commands/process-steps/step-1-download/targets/handle-process-target.ts
→ handleProcessTarget()
         |
         |  resolvedTarget = positional arg or -- value
         |  opts = buildOptsFromFlags(skipLLM, rawFlags)
         v
┌──────────────────────────────────────────────────────────────────────────────┐
│  classifyTopLevelTarget(target)                                              │
│                                                                              │
│  Is it a directory?  ───yes──>  { kind: 'directory' }                        │
│         |no                                                                  │
│  Is it a .md/.txt file?  ──yes──>  { kind: 'input_list' }                   │
│         |no                                                                  │
│  Otherwise  ──────────────────>  { kind: 'single' }                          │
└──────────────────────────────────────────────────────────────────────────────┘
         |
         v
┌──────────────────────────────────────────────────────────────────────────────┐
│                          ROUTING BRANCHES                                     │
│                                                                              │
│  ┌─── 'directory' ──────────────────────────────────────────────────┐        │
│  │  handleDirectoryTargetBatch()                                     │        │
│  │  1. collectInputFiles() → find all media/doc/image files          │        │
│  │  2. If dir named "input/" → also read 2-urls.md for URLs          │        │
│  │  3. Filter docs-only when command='ocr'                           │        │
│  │  4. processBatch(allItems) → concurrency-limited batch run        │        │
│  └───────────────────────────────────────────────────────────────────┘        │
│                                                                              │
│  ┌─── 'input_list' ────────────────────────────────────────────────┐         │
│  │  handleInputListTargetBatch()                                    │         │
│  │  1. readInputList() → parse .md/.txt line-by-line                │         │
│  │     - Strip bullets (- / *)                                      │         │
│  │     - Parse markdown links [text](url)                           │         │
│  │     - Resolve relative file paths                                │         │
│  │  2. processBatch(items) → concurrency-limited batch run          │         │
│  └──────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  ┌─── 'single' (batch source check first) ─────────────────────────┐         │
│  │  tryResolveBatchSource()                                         │         │
│  │  1. YouTube channel/playlist? → tryEnumerateYoutubeChannel()     │         │
│  │     (URL pattern check, no network cost)                         │         │
│  │  2. Podcast RSS/Atom feed? → tryEnumeratePodcastFeed()           │         │
│  │     (URL heuristic + HEAD request)                               │         │
│  │  3. If batch source found → processBatch(items)                  │         │
│  │  4. If no match → return null (fall through to single)           │         │
│  └──────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  ┌─── 'single' ────────────────────────────────────────────────────┐         │
│  │  handleSingleTarget() → processSingleTarget()                    │         │
│  │  (see single target input classification below)                  │         │
│  └──────────────────────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Single Target Input Classification

```
src/cli/commands/process-steps/step-1-download/targets/single-target.ts
→ processSingleTarget()

                      ┌──────────────┐
                      │  Input Item  │
                      └──────┬───────┘
                             |
                    ┌────────┴────────┐
                    │  isLikelyUrl()  │
                    └────────┬────────┘
                        yes/ \no
                       /       \
                      v         v
          ┌───────────────┐  ┌─────────────────┐
          │ classifyUrl() │  │ Local file path  │
          └───────┬───────┘  └────────┬─────────┘
                  |                    |
       ┌─────────┼────────┐    ┌──────┴───────┐
       |         |        |    |              |
       v         v        v    v              v
 ┌──────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
 │url_direct│ │url_    │ │url_      │ │local_    │ │local_    │
 │_document │ │direct_ │ │streaming │ │document  │ │media     │
 │          │ │media   │ │          │ │          │ │          │
 │.pdf,.epub│ │.mp3,   │ │YouTube,  │ │.pdf,.epub│ │.wav,.mp3,│
 │.png,.jpg │ │.mp4,   │ │Twitch,   │ │.png,.jpg │ │.mp4,.mkv │
 │.tif URLs │ │.wav,   │ │TikTok    │ │.tif local│ │.mov,...  │
 │          │ │.webm   │ │(default  │ │          │ │          │
 │          │ │URLs    │ │fallback) │ │          │ │          │
 └─────┬────┘ └───┬────┘ └────┬─────┘ └─────┬───┘ └────┬─────┘
       |          |           |              |           |
       v          v           v              v           v
  ┌──────────────────────┐  ┌──────────────────────────────┐
  │  DOCUMENT PIPELINE   │  │     MEDIA PIPELINE           │
  │  metadata/download/  │  │     metadata/download/       │
  │  ocr / write         │  │     stt / write              │
  └──────────────────────┘  └──────────────────────────────┘
```

## Command + Input Kind Matrix

```
                    url_streaming   url_direct_media   url_direct_document   local_media   local_document
                   ─────────────   ────────────────   ───────────────────   ───────────   ──────────────
  metadata        │  META (0a) │    META (0a)     │    META (0b)        │  META (0a) │  META (0b)
                  │             │                  │                     │             │
  download        │  DL+META   │    DL+META       │    DL+META          │  DL+META   │  DL+META
                  │             │                  │                     │             │
  stt             │  MEDIA (1)  │     MEDIA (1)    │      ERROR (2)      │  MEDIA (1)  │   ERROR (2)
                  │             │                  │                     │             │
  write           │  MEDIA (3)  │     MEDIA (3)    │   DOCUMENT (4)      │  MEDIA (3)  │ DOCUMENT (4)
                  │             │                  │                     │             │
  ocr             │  ERROR (5)  │     ERROR (5)    │   DOCUMENT (6)      │  ERROR (7)  │ DOCUMENT (6)
                  ─────────────   ────────────────   ───────────────────   ───────────   ──────────────

  (0a) processMetadataMedia() — metadata only, no download
  (0b) processMetadataDocument() — metadata only, no download (temp file for remote docs)
  (1) processVideo() with skipLLM=true
  (2) CLIUsageError: "Use: bun as ocr or bun as write"
  (3) processVideo() with full LLM pipeline
  (4) processDocument() + buildDocumentPrompt() + LLM summary
  (5) CLIUsageError: "Use a direct document URL or local file"
  (6) processDocument() extraction only
  (7) Skipped with warning: "non-document file in ocr mode"
```

## Batch Processing Flow

```
src/cli/commands/process-steps/step-1-download/targets/target-utils.ts
→ processBatch()

  ┌──────────────────────────────────────────────────────────────────────┐
  │  Items[] from:                                                      │
  │  ├── Directory scan (collectInputFiles)                             │
  │  ├── URL list file (readInputList)                                  │
  │  └── YouTube collection (yt-dlp --flat-playlist)                    │
  └──────────────────────────────────────────┬───────────────────────────┘
                                             |
                                             v
  ┌──────────────────────────────────────────────────────────────────────┐
  │  Create batch output directory: output/YYYY-MM-DD_HH-MM-SS_<label>/│
  │  Write info.json (consolidated per-item metadata manifest)          │
  └──────────────────────────────────────────┬───────────────────────────┘
                                             |
                                             v
  ┌──────────────────────────────────────────────────────────────────────┐
  │  Process items with concurrency limit                               │
  │  (`--batch-concurrency`, default 1)                                 │
  │  ┌──────────────────────────────────────────────────────────────┐   │
  │  │  try {                                                      │   │
  │  │    processSingleTarget(command, item, batchDir, opts)       │   │
  │  │    ok++                                                     │   │
  │  │  } catch {                                                  │   │
  │  │    fail++                                                   │   │
  │  │    log error, continue to next                              │   │
  │  │  }                                                          │   │
  │  └──────────────────────────────────────────────────────────────┘   │
  │                                                                    │
  │  Result: { ok, fail }                                              │
  │  If ok=0 && fail>0 → throw Error (total batch failure)             │
  └─────────────────────────────────────────────────────────────────────┘
```

## Batch Entry Points

| Source | Handler | Item Discovery |
|--------|---------|----------------|
| Directory | `handleDirectoryTargetBatch()` | `collectInputFiles()` + optional `2-urls.md` |
| URL list (.md/.txt) | `handleInputListTargetBatch()` | `readInputList()` line-by-line parser |
| YouTube channel/playlist | `tryResolveBatchSource()` | `tryEnumerateYoutubeChannel()` via yt-dlp |
| Podcast RSS/Atom feed | `tryResolveBatchSource()` | `tryEnumeratePodcastFeed()` via feed fetch |
