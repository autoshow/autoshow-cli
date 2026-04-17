# links

Fetch curated provider documentation pages and write one combined markdown file to `project/links/bun-links.md`.

## Outline

- [Usage](#usage)
- [Overview](#overview)
- [Selection syntax](#selection-syntax)
- [Supported providers](#supported-providers)
- [Global sections](#global-sections)
- [Examples](#examples)
- [Output format](#output-format)
- [Flags](#flags)
- [Notes](#notes)

## Usage

```bash
bun as links
bun as links <global-section>...
bun as links --<provider> [section...]
bun as links <global-section>... --<provider> [section...] [--<provider> [section...]]
```

## Overview

`links` reads the curated URL registry from `src/cli/commands/setup-and-utilities/links/model-links.json`, fetches every matched page, and concatenates the results into a single local file.

- Output path: `project/links/bun-links.md`
- Existing output is overwritten on each run
- Duplicate URLs are removed before fetching, so overlapping selections only fetch once

## Selection syntax

- With no sections or provider selectors, `links` fetches every curated URL in the registry.
- Bare section names before the first provider selector are global selections. They fetch that section across every provider that has it.
- A provider selector such as `--openai` starts a provider-scoped selection. Bare tokens after it are treated as section names for that provider until the next provider selector.
- A provider selector with no sections fetches every curated section for that provider.
- Provider selectors and section names are case-insensitive.
- Unknown providers or unknown sections exit with a usage error.
- A valid selection can still match zero URLs if the curated list for that provider/section is currently empty. Right now `--claude stt` is accepted by the parser but resolves to no links.

## Supported providers

Accepted provider selectors are the lowercase names below.

| Provider selector | Sections |
|-------------------|----------|
| `--assembly` | `stt` |
| `--claude` | `general`, `text`, `stt` |
| `--deapi` | `general`, `stt`, `image`, `video`, `tts`, `music` |
| `--deepgram` | `stt` |
| `--elevenlabs` | `general`, `stt`, `tts`, `music`, `image`, `video` |
| `--gemini` | `general`, `text`, `tts`, `image`, `video` |
| `--gladia` | `general`, `stt` |
| `--glm` | `general`, `text`, `document`, `image`, `video`, `stt` |
| `--grok` | `general`, `text`, `image`, `video`, `tts` |
| `--groq` | `general`, `text`, `stt`, `tts` |
| `--happyscribe` | `stt` |
| `--minimax` | `general`, `text`, `tts`, `music`, `image`, `video` |
| `--openai` | `general`, `stt`, `text`, `tts`, `image`, `video` |
| `--rev` | `general`, `stt` |
| `--soniox` | `stt` |
| `--speechmatics` | `general`, `stt` |
| `--supadata` | `stt` |

## Global sections

Accepted section tokens outside provider selectors:

- `document`
- `general`
- `image`
- `music`
- `stt`
- `text`
- `tts`
- `video`

Section availability depends on the provider. For example, `document` currently only matches GLM links.

## Examples

```bash
# Fetch every curated documentation page
bun as links

# Fetch all TTS docs across every provider
bun as links tts

# Fetch every curated OpenAI doc
bun as links --openai

# Fetch only OpenAI general and text docs
bun as links --openai general text

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

If a response is empty, it writes:

```md
<!-- Empty response from https://example.com/page.md -->
```

## Flags

`links` does not define any command-specific flags. `bun as links --help` only shows framework-level global flags such as `--help`, `--version`, `--verbose`, `--quiet`, and `--json`.

Global flags like `--config-path` and `--allow-over-budget` may still appear in help output, but they do not change link selection or the output file path for this command.

## Notes

- Provider and section coverage comes entirely from `src/cli/commands/setup-and-utilities/links/model-links.json`.
- The generated file is always a single combined markdown file. There is no CLI flag to choose a different output path.
- Provider selectors are parsed manually from argv, so they are documented here even though they do not appear in the standard help flag list.
