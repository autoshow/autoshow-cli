# MP3-Only STT Input Normalization

## Problem

`stageSourceMediaArtifact()` in `stt-media-cache.ts` uses a `CLOUD_FRIENDLY_EXTENSIONS` passthrough set (`.mp4`, `.m4a`, `.webm`, `.wav`, `.ogg`, `.opus`, `.aac`, `.flac`) that copies or renames matching files without transcoding. This means video containers like `.mp4` and `.webm` can reach cloud STT providers as the `source_media` artifact. The dual-artifact model (`source_media` + `wav16k_mono`) also doubles cache storage and complicates the `PreparedSttMedia` contract with two optional paths, two cache statuses, and two timing fields.

## Goal

Single invariant: every STT flow produces exactly one normalized `source_media.mp3` artifact. No video containers, no format passthrough, no dual artifacts.

## Implementation

### 1. `stt-media-cache.ts` — collapse to MP3-only

**`stageSourceMediaArtifact()`** (lines 269–319):
- Remove the `CLOUD_FRIENDLY_EXTENSIONS` set and all `cloudFriendlyExtension()` passthrough branches.
- Every code path (local file, direct URL, streaming URL) must end with `transcodeToMp3()` producing `source_media.mp3`. No copy/rename passthrough for any format.

**`prepareSttMedia()`** (lines 582+):
- Remove the `needsWav16k` flag and all `wav16k` artifact generation (`transcodeToWav16kMono()` calls, lines 615–622 and 740+).
- Always produce `source_media.mp3` regardless of target type (local or cloud).
- Remove `WAV16K_ARTIFACT_VERSION` constant (line 86).
- Bump `SOURCE_MEDIA_ARTIFACT_VERSION` from `1` to `2` so stale cached `.mp4`/`.m4a`/`.wav` artifacts are invalidated.

**`PreparedSttMedia` type** (lines 61–82):
- Remove `wav16kPath` from `executionArtifacts` and `outputArtifacts`.
- Remove `wav16k` from `cache` and `timings`.
- Simplify to single `sourceMediaPath` (always MP3), single cache status, single timing.

**`buildPrimaryOutputPaths()`** (lines 406–454):
- Remove all `wav16kPath` logic. `primaryFilePath` is always the MP3 path.

**Cache entries:**
- Remove `wav16k_mono` from `entry.json` artifact versions.
- Stop writing/reading `wav16k_mono.wav` files in cache directories.

### 2. `process-stt.ts` — consume MP3 everywhere

**`resolveTargetAudioPath()`** (around line 193):
- Remove the local/cloud branching. All targets receive `prepared.executionArtifacts.sourceMediaPath` (the MP3).
- Remove the `wav16kPath` fallback for cloud providers.

**Reporter/metadata output** (lines 414, 578–581):
- Remove `audio-wav` artifact reporting. `artifactFiles['audio']` points to the MP3.
- `step1Metadata.audioFileName` resolves to the MP3 filename.

### 3. `audio-splitter.ts` — MP3 segments

- Change segment output format from WAV (`pcm_s16le -ar 16000 -ac 1`) to MP3 (`-codec:a libmp3lame -q:a 2`).
- Update `AudioSegmentDescriptor` paths to use `.mp3` extension.
- Segment files become `segments/segment_NNN.mp3`.

### 4. Local runners — internal WAV conversion

**`run-whisper.ts` and `run-reverb.ts`:**
- Accept MP3 input path (the standardized artifact).
- If the underlying engine requires PCM/WAV, perform a temp `ffmpeg` conversion inside the runner function. Use a temp file that is cleaned up after the run completes.
- No persisted WAV artifact, no shared cache exposure.

### 5. `process-video.ts` — align STT-bearing flows

- For flows that include STT (write/video commands), route through `prepareSttMedia()` instead of `downloadAudio()` from `dl-audio.ts` to get the normalized MP3.
- The standalone `download` command continues to use `downloadAudio()` unchanged.

## Files Changed

| File | Change |
|------|--------|
| `step-2-stt/stt-media-cache.ts` | Remove `CLOUD_FRIENDLY_EXTENSIONS`, `wav16k` artifacts, simplify `PreparedSttMedia` type, bump artifact version |
| `process-stt.ts` | Remove local/cloud audio path branching, remove `audio-wav` reporting |
| `step-2-stt/stt-utils/audio-splitter.ts` | MP3 segment output instead of WAV |
| `step-2-stt/stt-local/whisper/run-whisper.ts` | Accept MP3, temp-convert to WAV internally if needed |
| `step-2-stt/stt-local/reverb/run-reverb.ts` | Accept MP3, temp-convert to WAV internally if needed |
| `process-video.ts` | Use `prepareSttMedia()` for STT-bearing flows |

## Output / Interface Changes

- STT output audio artifacts are `.mp3` everywhere (stt, write, video flows).
- `PreparedSttMedia` exposes one `sourceMediaPath` (always MP3), one cache status, one timing.
- No `audio-wav` in reporter output or metadata.
- Split segments under `segments/` are `.mp3` files.

## Test Plan

- **Unit — media prep normalization**: Local `.mp4`, `.m4a`, `.wav`, direct media URLs, and streaming URLs all produce `source_media.mp3`. No passthrough of non-MP3 formats.
- **Unit — no video containers**: Assert `stageSourceMediaArtifact()` never returns a path with `.mp4`/`.webm`/`.m4a` extension.
- **Unit — split segments**: `splitAudioFile()` produces `.mp3` segments, not `.wav`.
- **Unit — local runner conversion**: Whisper/Reverb runners accept MP3 input and produce valid transcriptions. Temp WAV files are cleaned up.
- **Integration — cloud STT on `.mp4` input**: Process a local `.mp4` file through a hosted provider; confirm the provider receives MP3.
- **Integration — local STT on MP3**: Whisper and Reverb transcribe from the MP3 artifact successfully.
- **Integration — auto-split**: Oversized input splits into MP3 segments and each segment transcribes correctly.
- **Integration — write/video flows**: Saved audio artifact is `.mp3`, metadata reflects `.mp3`, no `audio-wav` artifact reported.
- **Cache invalidation**: Existing cache entries with `SOURCE_MEDIA_ARTIFACT_VERSION = 1` are treated as misses after the bump to `2`.

## Assumptions

- Existing MP3 encoding policy (`libmp3lame`, `-q:a 2`, ~192 kbps) is the normalization target.
- The MP3→WAV temp conversion cost in local runners is acceptable (fast, ~0.1× realtime on modern hardware).
- Standalone `download` command behavior is unchanged.
- Cache entries with the old artifact version are rebuilt on next access, not batch-migrated.
