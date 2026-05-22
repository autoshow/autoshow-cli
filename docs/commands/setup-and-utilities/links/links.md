# links

Fetch curated provider documentation pages and write one combined markdown file to a selection-based path under `project/links/`.

## Outline

- [Usage](#usage)
- [Overview](#overview)
- [Selection syntax](#selection-syntax)
- [Input file mode](#input-file-mode)
- [Supported providers](#supported-providers)
- [Global sections](#global-sections)
- [Examples](#examples)
- [Output format](#output-format)
- [Flags](#flags)
- [Notes](#notes)

## Usage

```bash
bun as links
bun as links urls.md
bun as links <global-section>...
bun as links --<provider> [section...]
bun as links <global-section>... --<provider> [section...] [--<provider> [section...]]
```

## Overview

`links` reads the curated URL registry from `src/cli/commands/setup-and-utilities/links/model-links/`, fetches every matched page, and concatenates the results into a single local file. It can also read a standalone local `.md` or `.txt` file containing remote documentation URLs.

- Output path: `project/links/<normalized-selection>-links.md`
- Examples: `project/links/all-all-links.md`, `project/links/all-stt-links.md`, `project/links/gemini-all-links.md`, `project/links/gemini-general-tts-links.md`, `project/links/spider-all-links.md`, `project/links/spider-url-links.md`
- Existing output is overwritten on each run
- Duplicate URLs are removed before fetching, so overlapping selections only fetch once
- Raw markdown/text docs are appended as-is; HTML docs pages are converted to markdown locally before they are appended

Input file mode uses `project/links/<input-basename>-links.md`; for example, `bun as links urls.md` writes `project/links/urls-links.md`.

## Selection syntax

- With no sections or provider selectors, `links` fetches every curated URL in the registry.
- Bare section names before the first provider selector are global selections. They fetch that section across every provider that has it.
- A provider selector such as `--openai` starts a provider-scoped selection. Bare tokens after it are treated as section names for that provider until the next provider selector.
- A provider selector with no sections fetches every curated section for that provider.
- Provider selectors and section names are case-insensitive.
- Unknown providers or unknown sections exit with a usage error.
- If a valid selection resolves to no URLs, the command exits with `No documentation links matched the provided selections`.

## Input file mode

Pass one local `.md` or `.txt` file to fetch URLs from that file instead of the curated registry:

```bash
bun as links urls.md
```

The file may contain bare `http://` or `https://` URLs, markdown links like `[docs](https://example.com/docs)`, and `blob:http://` or `blob:https://` documentation URLs. Headings, comments, blank lines, bullets, and non-URL prose are ignored. Duplicate URLs are fetched once in first-seen order.

Input file mode is standalone. Do not combine it with provider selectors or section selectors.

## Supported providers

Accepted provider selectors are the lowercase names below.

| Provider selector | Sections |
|-------------------|----------|
| `--assembly` | `stt` |
| `--aws` | `stt`, `ocr` |
| `--better-auth` | `general` |
| `--bfl` | `image` |
| `--cartesia` | `general`, `tts` |
| `--claude` | `general`, `text`, `ocr` |
| `--deepgram` | `stt`, `tts` |
| `--deepinfra` | `general`, `stt`, `ocr` |
| `--drive` | `general` |
| `--elevenlabs` | `general`, `music`, `stt`, `tts` |
| `--firecrawl` | `general`, `url` |
| `--gcloud` | `ocr`, `stt`, `tts` |
| `--gemini` | `general`, `image`, `music`, `ocr`, `stt`, `text`, `tts`, `video` |
| `--gladia` | `general`, `stt` |
| `--glm` | `general`, `ocr`, `stt`, `text`, `url`, `video` |
| `--grok` | `general`, `image`, `stt`, `text`, `tts`, `video` |
| `--groq` | `general`, `stt`, `text`, `tts` |
| `--happyscribe` | `stt` |
| `--hume` | `general`, `tts` |
| `--kimi` | `general`, `ocr`, `text` |
| `--minimax` | `general`, `music`, `text`, `tts`, `video` |
| `--mistral` | `general`, `ocr`, `stt`, `tts` |
| `--openai` | `general`, `image`, `ocr`, `stt`, `text`, `tts` |
| `--resend` | `general` |
| `--rev` | `general`, `stt` |
| `--runway` | `general` |
| `--scrapecreators` | `general`, `stt`, `url` |
| `--soniox` | `stt` |
| `--speechify` | `tts` |
| `--speechmatics` | `general`, `stt` |
| `--spider` | `general`, `url` |
| `--supadata` | `general`, `stt`, `url` |
| `--together` | `general`, `stt` |
| `--unstructured` | `ocr` |
| `--x` | `general`, `url` |
| `--zyte` | `general`, `url` |

## Global sections

Accepted section tokens outside provider selectors:

- `ocr`
- `general`
- `image`
- `music`
- `stt`
- `text`
- `tts`
- `url`
- `video`

Section availability depends on the provider.

## Examples

```bash
# Fetch every curated documentation page
bun as links

# Fetch all TTS docs across every provider
bun as links tts

# Fetch remote docs listed in urls.md
bun as links urls.md

# Fetch every curated OpenAI doc
bun as links --openai

# Fetch Better Auth documentation
bun as links --better-auth

# Fetch DeepInfra OCR docs, including normal HTML doc pages
bun as links --deepinfra ocr

# Fetch Unstructured OCR docs
bun as links --unstructured ocr

# Fetch Kimi text and OCR docs
bun as links --kimi text ocr

# Fetch Mistral STT, OCR, and TTS docs
bun as links --mistral stt ocr tts

# Fetch Hume and Cartesia TTS docs
bun as links --hume tts --cartesia tts

# Fetch only OpenAI general and text docs
bun as links --openai general text

# Fetch Spider URL scraping and crawling docs
bun as links --spider url

# Mix a global section with provider-specific sections
bun as links tts --openai general text --minimax video
```

## Output format

Each fetched page is appended to the combined file with a source marker:

```md
<!-- Source: https://developers.openai.com/api/docs/pricing.md -->
```

If a fetch fails, the command keeps going and writes:

```md
<!-- Failed to fetch https://example.com/page.md -->
```

Fetches are retried for transient network failures, timeouts, `408`, `425`, `429`, and `5xx` responses before this placeholder is written. Each attempt has a 60 second timeout by default; override it with `AUTOSHOW_LINKS_FETCH_TIMEOUT_MS`.

If a response is empty, it writes:

```md
<!-- Empty response from https://example.com/page.md -->
```

## Flags

`links` does not define any command-specific flags. `bun as links --help` only shows framework-level global flags such as `--help`, `--version`, `--verbose`, `--quiet`, and `--json`.

Global flags like `--config-path` and `--allow-over-budget` may still appear in help output, but they do not change link selection or the output file path for this command.

## Notes

- Provider and section coverage comes entirely from `src/cli/commands/setup-and-utilities/links/model-links/`.
- The generated file is always a single combined markdown file. There is no CLI flag to choose a different output path.
- Curated `.md` / `.txt` endpoints and normal HTML docs pages can be mixed in the same provider/section selection. HTML pages are converted locally first; if that extraction fails, the command falls back to Firecrawl article extraction before marking the URL failed.
- Input file entries must be remote documentation/page URLs; local file entries inside the input file are ignored.
- Documentation links with a `blob:https://` or `blob:http://` wrapper are fetched through the underlying HTTP URL while preserving the original source marker in the output.
- The filename is derived from the normalized provider and section selections, lowercased, deduped, and sorted into a stable order.
- Provider selectors are parsed manually from argv, so they are documented here even though they do not appear in the standard help flag list.
