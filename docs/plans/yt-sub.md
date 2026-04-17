# Add Opt-In YouTube Caption-First Transcript Source

## Summary
- Add a boolean CLI flag, `--youtube-captions`.
- Apply it only to direct YouTube video URLs and resolved YouTube video items from channel/playlist/feed batches.
- When enabled, inspect YouTube subtitle inventory, prefer manual English captions first, then auto-generated English captions, and use the selected track instead of running any STT provider/model.
- If no acceptable English caption track exists, keep the current STT flow unchanged.
- Keep step-1 audio acquisition unchanged in v1 so existing cache, artifact, and manifest expectations stay stable; captions replace step 2 only.

## Public Interfaces
- Add `--youtube-captions` to `transcriptionFlags`, help text, `buildOptsFromFlags`, `RuntimeOptions`, and `ProcessingOptions`.
- Add a synthetic STT provider `youtube-captions` to `TranscribeEngine`, `Step2Metadata['transcriptionService']`, STT capability maps, manifest parsers, and the STT model registry with one zero-cost model, `subtitle-track`.
- Extend `Step2Metadata` with optional caption fields: `captionKind: 'manual' | 'auto'`, `captionLanguage: string`, and `captionFormat: 'vtt'`.
- Extend `YtDlpVideoInfoSchema` to capture `subtitles` and `automatic_captions` as `Record<string, Array<{ ext: string, url: string, name?: string }>>` so caption availability can be decided from yt-dlp metadata before any subtitle download.
- Update user-facing docs and examples to describe the new flag, English-only v1 behavior, and STT fallback when captions are unavailable.

## Implementation Changes

### Caption Resolution Placement
- Caption resolution runs inside `processStt` and `processVideo` after `prepareSttMedia()` returns but before the `sttTarget()` dispatch loop begins.
- When captions are found, the dispatch loop is skipped entirely; caption resolution produces the `TranscriptionResult` directly and writes artifacts itself. It does not inject a synthetic target into the `collectSttTargets()` provider list.
- Gate caption resolution on `--youtube-captions` plus a resolved YouTube watch URL.

### Two-Phase yt-dlp Invocation
- Phase 1 (metadata): the existing `getVideoInfo()` call already runs `--dump-json`; extend `YtDlpVideoInfoSchema` to parse `subtitles` and `automatic_captions` from the same JSON response. No additional yt-dlp invocation is needed for inventory inspection.
- Phase 2 (download): after selecting a track from the metadata dictionaries, run a second yt-dlp invocation with subtitle-download args to fetch the VTT file.

### Caption Track Selection
- Select tracks from the parsed metadata with this exact policy: check `subtitles` dictionary for manual English tracks (`en` / `en.*`) first, check `automatic_captions` dictionary for auto English tracks second, otherwise return `null`.
- The `--sub-langs en.*,en` flag on the download invocation filters which tracks to fetch; it does not control preference. Preference is determined entirely by inspecting `subtitles` vs `automatic_captions` dictionaries in code before the download call.

### Subtitle Download Args
- Add a subtitle-only yt-dlp args builder using the options documented in `docs/links/yt.md`: `--skip-download`, `--write-subs` or `--write-auto-subs` (chosen based on whether the selected track is manual or auto), `--sub-langs en.*,en`, `--sub-format vtt/best`, `--convert-subs vtt`, plus the existing shared cookie/auth args.

### VTT Parsing
- Parse normalized VTT output into `TranscriptionResult`; strip VTT header, NOTE blocks, and STYLE blocks.
- Strip inline tags: `<c>` word-level timing tags, `align:start position:0%` positioning metadata on cue lines, and other WebVTT cue settings.
- Preserve cue start/end timings as `TranscriptionSegment` boundaries.
- Merge adjacent duplicate auto-caption cues (YouTube auto-captions repeat the previous line as context in the next cue).
- Handle overlapping timestamp ranges where the next cue starts before the previous cue ends by using the later cue's start time as the boundary.
- Emit no speaker labels.

### Error Handling
- If the subtitle download invocation succeeds (exit 0) but produces no `.vtt` file, or if the `.vtt` file is empty or fails to parse, treat as "no acceptable caption track" and fall through to the normal STT flow.
- Log a warning when falling through so the user understands why captions were not used.

### Artifact Writing
- When captions are used, write `transcription.txt` from parsed cues, preserve the downloaded source file as `youtube-captions.vtt`, and write caption selection metadata to `youtube-captions.json`.
- `youtube-captions.json` schema: `{ captionKind: 'manual' | 'auto', captionLanguage: string, sourceUrl: string, trackName: string | null, subtitleInventory: Record<string, Array<{ ext: string, name?: string }>>, automaticCaptionInventory: Record<string, Array<{ ext: string, name?: string }>> }`.

### Manifest and Provider Semantics
- Record caption-backed runs as `youtube-captions/subtitle-track` in step 2 so prompt generation, manifest writing, reporting, and downstream pipeline code stay on one path.
- Treat caption-backed runs as a normal single-source STT completion and do not persist the user-requested STT providers as skipped; the persisted provider set becomes the synthetic caption provider because that is the transcript source actually used.
- When `--youtube-captions` is combined with explicit STT provider flags (e.g. `--deepgram-stt`), the STT providers are silently skipped if captions are found. Log a notice listing the skipped providers so the user understands what happened.

### Cache Interaction
- Caption-backed results coexist with STT-backed results in the manifest since results are keyed by provider name. A prior STT result (e.g. `deepgram/nova-3`) is not replaced or invalidated by a subsequent caption run; both appear as separate provider entries.
- Re-running with `--youtube-captions` on a video that already has a `youtube-captions/subtitle-track` result skips the caption download (treated as cached/complete).

### Batch Resume Semantics
- On resume, a batch item that completed via `youtube-captions/subtitle-track` is treated as complete only when `--youtube-captions` is active in the current run.
- If the user re-runs the batch without `--youtube-captions`, the caption-backed completion is not counted toward the requested STT providers; the item is treated as incomplete and dispatched through the normal STT flow.

### Pricing
- Update pricing and timing helpers so `--price`, cost aggregation, and run summaries report zero STT cost for `youtube-captions/subtitle-track`, and only do the caption-availability probe when `--youtube-captions` is enabled.

## Test Plan
- Add yt-dlp arg-builder tests for manual-caption download, auto-caption download, English `--sub-langs` selection, and shared cookie/env propagation.
- Add subtitle-inventory selection tests for manual-English present, auto-English only, non-English only, mixed-language with English subset, empty inventories, and no-caption cases.
- Add VTT parser tests for timestamps, NOTE/STYLE blocks, inline `<c>` tags, cue positioning metadata, overlapping timestamp ranges, duplicate auto-caption cue collapse, and empty/malformed VTT input.
- Add process/manifest tests verifying caption-backed `stt` and `write` runs produce `transcription.txt`, `youtube-captions.vtt`, `youtube-captions.json` with correct schema, correct step-2 metadata, and zero STT cost without provider execution.
- Add regression tests verifying fallback to the current STT path when the flag is off, the input is not YouTube, no acceptable English caption track exists, or the subtitle download fails.
- Add batch/resume tests verifying that YouTube batch items can complete via captions, are persisted as complete with `--youtube-captions` active, and are treated as incomplete when re-run without `--youtube-captions`.
- Add concurrent-provider interaction tests verifying that `--youtube-captions --deepgram-stt nova-3` skips Deepgram when captions are found, logs a notice about skipped providers, and falls through to Deepgram when captions are unavailable.

## Assumptions
- V1 is opt-in only through `--youtube-captions`; default behavior does not change.
- V1 accepts creator-provided subtitles first and auto-generated captions second.
- V1 prefers English tracks only; lack of English captions triggers the existing STT path.
- V1 does not optimize away step-1 audio acquisition; skipping audio download when captions are available is a separate enhancement.
