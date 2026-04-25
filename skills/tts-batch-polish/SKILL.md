---
name: tts-batch-polish
description: Clean and normalize long-form plaintext for natural, service-agnostic text-to-speech narration one file at a time. Use when working on OCR-derived EPUB exports, book chapters, articles, or chapter text files that need artifact removal, paragraph repair, punctuation cleanup, footnote removal, boundary continuity checks, and pronunciation-friendly edits while preserving original meaning.
metadata:
  short-description: Polish long text for TTS narration
---

# TTS Batch Polish

## Overview

Process book or chapter text files in repeatable single-file passes. Improve TTS readiness without binding output to any single provider, voice model, or SSML dialect.

Use this workflow whenever the input is plaintext (typically `.txt`) and quality issues include OCR artifacts, noisy metadata, broken structure, or awkward read-aloud flow.

Read `references/tts-editing-rules.md` before editing. It is the source of truth for safe TTS cleanup, footnote removal, ambiguity handling, and QA.

## Workflow

1. Set the target directory that contains chapter files.
2. Select exactly one target file explicitly (for example: user-specified file or a manually chosen chapter file).
3. Edit only that file in place.
4. Check boundary continuity: verify the opening and closing lines are not in the middle of a sentence.
5. If a boundary line is mid-sentence, repair the split with the previous or next file so sentence flow is complete across files.
6. Run a quick quality check on the edited file(s).
7. Report what changed and any unresolved uncertainties.

## Commands

Use these commands from the skill directory. Replace `BOOK_DIR` with the target directory from the user or current task.

```bash
BOOK_DIR="/absolute/path/to/book-or-chapter-directory"
ls -1 "$BOOK_DIR"/*.txt | sort
```

Optional: pick a single file deterministically (first sorted file).

```bash
ls -1 "$BOOK_DIR"/*.txt | sort | head -n 1
```

Optional: use the Bun queue helper to track repeatable single-file passes.

```bash
bun scripts/tts_batch_queue.ts status --root "$BOOK_DIR"
bun scripts/tts_batch_queue.ts next --root "$BOOK_DIR" --size 1
bun scripts/tts_batch_queue.ts done --root "$BOOK_DIR" "chapter-01.txt"
```

## Editing Rules

Read and apply the editing rules reference for every file pass. Use the file as the single source of truth for TTS-safe edits.

Core constraints:

1. Preserve meaning, claims, and author voice.
2. Remove OCR noise and formatting artifacts that harm read-aloud flow.
3. Keep output provider-agnostic: no vendor-specific SSML tags.
4. Limit each run to one file unless the user explicitly asks for a different batch size.
5. Leave uncertain factual corrections unchanged unless confidence is high.
6. Exception to single-file editing: if sentence continuity is broken at file boundaries, you may edit the immediately adjacent file solely to complete the split opening/closing sentence.
7. Remove line breaks that occur mid-sentence so each sentence flows continuously.
8. Group sentences into coherent paragraphs; use line breaks only between paragraphs, not between lines within a paragraph.
9. Remove footnotes and inline footnote markers according to the reference rules unless the user explicitly asks to preserve scholarly apparatus.

## File Completion Checklist

1. Confirm exactly one selected target file was edited, unless an adjacent-file boundary fix was required.
2. Confirm no accidental deletions of meaningful content.
3. Confirm headings, lists, and punctuation read naturally when spoken.
4. Confirm first and last lines are not sentence fragments and flow correctly with neighboring files.
5. Confirm no provider-specific markup was introduced.
6. Confirm mid-sentence line breaks were removed and paragraph structure is coherent.
7. Confirm footnotes and footnote reference markers were handled according to the reference rules.

## Reporting

After each file, report:

1. Edited file list.
2. Categories of fixes applied.
3. Whether opening/closing boundary continuity was checked and whether adjacent-file repair was needed.
4. Whether mid-sentence line breaks were normalized into paragraph-form text.
5. Any unresolved pronunciation or ambiguity risks.
