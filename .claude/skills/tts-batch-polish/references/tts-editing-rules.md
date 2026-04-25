# TTS Editing Rules

Use these rules to normalize plaintext for natural, robust text-to-speech across providers.

## Priority Order

1. Preserve meaning.
2. Improve spoken clarity.
3. Keep edits minimal and deterministic.
4. Avoid provider-specific markup.

## Safe, High-Value Fixes

Apply these by default.

1. Remove obvious OCR garbage and scanning artifacts.
2. Remove repeated headers/footers and page-number fragments.
3. Fix broken words split by OCR or line-wrap artifacts.
4. Normalize whitespace to single spaces within lines.
5. Keep paragraph breaks where they represent real topic shifts.
6. Convert dotted TOC leaders and layout noise to readable lines.
7. Replace malformed punctuation that breaks sentence flow.
8. Normalize inconsistent quotation and apostrophe characters when broken.
9. Remove all footnotes and their inline reference numbers (see Footnote Removal below).

## Structure for Read-Aloud

1. Keep headings on their own lines.
2. Add a blank line between major sections when structure is unclear.
3. Convert dense list-like fragments into one-item-per-line when clear.
4. Keep chapter and section numbering explicit (for navigation in audio).

## Pronunciation-Oriented Rules

1. Expand or rewrite abbreviations only when meaning is certain.
2. Keep acronyms readable; prefer unambiguous forms over stylized punctuation.
3. Rewrite number formats that are likely to be read incorrectly.
4. Normalize obvious date formats to stable spoken forms.
5. Keep symbols readable in plain text (for example, `=` as "equals" when needed for comprehension).

## What Not to Change

1. Do not rewrite arguments, claims, or tone.
2. Do not modernize style unless the original is clearly corrupted.
3. Do not remove content only because it is controversial.
4. Do not invent facts to repair uncertain names, places, or citations.
5. Do not insert SSML, XML, or vendor tags.

## Footnote Removal

Remove footnotes entirely — they interrupt spoken flow and are not meaningful in audio.

1. Remove inline footnote reference numbers from body text. These appear as superscript digits immediately after a word or punctuation mark (e.g. `word.1`, `word,2`, `word3`). Delete the digit only; leave the surrounding word and punctuation intact.
2. Remove footnote definition blocks. These are the numbered entries that define the footnote content, typically appearing at the bottom of a page or after a section. A footnote block starts with a standalone digit (the footnote number) followed by the footnote text. Remove the entire block, including all continuation lines, up to the next blank line.
3. When a footnote block sits between two halves of a split sentence (a page-break artifact), remove the block and rejoin the sentence halves with a single blank line removed — do not leave a blank line where the footnote was if the surrounding text is part of the same paragraph.
4. Do not remove numbers that are part of the body text (dates, statistics, list items). Only remove numbers that function as footnote markers — i.e., a digit attached directly to a word or punctuation with no space, or a standalone digit at the start of a line followed by the footnote text.

## Ambiguity Handling

1. If a correction is uncertain, prefer the original text.
2. If uncertain but likely OCR damage, make the smallest safe fix.
3. Report unresolved ambiguities after each file pass.

## File QA Checklist

Run this check before marking a file done.

1. Read the first 3-5 paragraphs and one random middle section aloud (or silently as speech).
2. Confirm sentence boundaries are clear.
3. Confirm no obvious OCR junk remains in headings and section starts.
4. Confirm tables-of-contents fragments are not mixed into body prose.
5. Confirm output remains plain text and service-agnostic.
