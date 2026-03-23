# Batch Processing Flow

Diagram of directory, URL list, and YouTube/RSS collection batch processing flows.

## Outline

- [Batch Entry Points](#batch-entry-points)

```
src/cli/commands/process-steps/step-1-download/targets/target-utils.ts
→ processBatch()

  ┌──────────────────────────────────────────────────────────────────────┐
  │  Items[] from:                                                      │
  │  ├── Directory scan (collectInputFiles)                              │
  │  ├── URL list file (readInputList)                                   │
  │  └── YouTube collection (yt-dlp --flat-playlist)                     │
  └──────────────────────────────────────────┬───────────────────────────┘
                                             |
                                             v
  ┌──────────────────────────────────────────────────────────────────────┐
  │  Create batch output directory: output/YYYY-MM-DD_HH-MM-SS_<label>/│
  │  Write info.json (batch manifest)                                   │
  └──────────────────────────────────────────┬───────────────────────────┘
                                             |
                                             v
  ┌──────────────────────────────────────────────────────────────────────┐
  │  Process items with concurrency limit                               │
  │  (`--batch-concurrency`, default 1)                                 │
  │  ┌──────────────────────────────────────────────────────────────┐   │
  │  │  try {                                                       │   │
  │  │    processSingleTarget(command, item, batchDir, opts)         │   │
  │  │    ok++                                                      │   │
  │  │  } catch {                                                   │   │
  │  │    fail++                                                    │   │
  │  │    log error, continue to next                               │   │
  │  │  }                                                           │   │
  │  └──────────────────────────────────────────────────────────────┘   │
  │                                                                     │
  │  Result: { ok, fail }                                               │
  │  If ok=0 && fail>0 → throw Error (total batch failure)              │
  └─────────────────────────────────────────────────────────────────────┘
```

## Batch Entry Points

| Source | Handler | Item Discovery |
|--------|---------|----------------|
| Directory | `handleDirectoryTargetBatch()` | `collectInputFiles()` + optional `2-urls.md` |
| URL list (.md/.txt) | `handleInputListTargetBatch()` | `readInputList()` line-by-line parser |
| YouTube channel/playlist | `tryResolveBatchSource()` | `tryEnumerateYoutubeChannel()` via yt-dlp |
| Podcast RSS/Atom feed | `tryResolveBatchSource()` | `tryEnumeratePodcastFeed()` via feed fetch |
