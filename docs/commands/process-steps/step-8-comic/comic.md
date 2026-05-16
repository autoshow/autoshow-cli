# comic

Draft comic scene JSON, build panel prompt bundles, generate review sketches and final panel/page images, and create reusable character sketch references from project-root inputs.

## Outline

- [Overview](#overview)
- [Setup](#setup)
- [Runtime Paths](#runtime-paths)
- [Usage](#usage)
- [Walkthrough: 01-co-work-smarter](#walkthrough-01-co-work-smarter)
- [draft-scenes](#draft-scenes)
- [generate-images](#generate-images)
- [character-sketch](#character-sketch)
- [Output](#output)
- [Supported Models](#supported-models)
- [Notes](#notes)

## Overview

`comic` is a staged pipeline:

1. Draft structured scene JSON from episode scripts.
2. Optionally generate reusable character sketch references.
3. Build panel prompts, review sketches, final panel images, and grouped page images.

The public subcommands are:

```bash
bun as comic draft-scenes
bun as comic generate-images
bun as comic character-sketch
```

## Setup

`comic` uses hosted text and image models for generation stages. Set the relevant provider key before running real generation:

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
```

- `OPENAI_API_KEY` is required for OpenAI text and image models.
- `GEMINI_API_KEY` is required for Gemini text and image models.
- `--price` is side-effect-free and does not call image or LLM generation APIs.

## Runtime Paths

Canonical project-root paths:

| Artifact | Path |
|----------|------|
| Episode scripts | `input/episode-scripts/ep02-scripts/*.md` |
| Character source images | `input/characters/` |
| Generated prompts and scenes | `output/episode-prompts/` |
| Comic images | `output/episode-comics/` |
| Character sketches | `output/characters/sketches/` |

## Usage

```bash
bun as comic draft-scenes <script-path> [--only structure|prompt|scene|panel-prompts] [--price]
bun as comic generate-images <script-path> [--target images|sketches|both] [--panels <all|range|list>] [--variation <name[,name...]>] [--force] [--price]
bun as comic character-sketch --image <source-image|sketch-dir> [--force] [--revise --notes <text>] [--price]
```

## Walkthrough: 01-co-work-smarter

This walkthrough starts from:

```text
input/episode-scripts/ep02-scripts/01-co-work-smarter.md
```

To run the complete script-to-page pipeline:

```bash
bun as comic generate-images input/episode-scripts/ep02-scripts/01-co-work-smarter.md --target images --panels 1-16
```

This writes grouped final page images under `output/episode-comics/episode-02-comic-images/01-co-work-smarter/pages/`.

### 1. Create structured script JSON

```bash
bun as comic draft-scenes input/episode-scripts/ep02-scripts/01-co-work-smarter.md --only structure
```

### 2. Build the scene-drafting prompt

```bash
bun as comic draft-scenes input/episode-scripts/ep02-scripts/01-co-work-smarter.md --only prompt
```

### 3. Draft scene JSON

```bash
bun as comic draft-scenes input/episode-scripts/ep02-scripts/01-co-work-smarter.md --only scene
```

This stage calls the selected text model. Use `--price` first when you want a side-effect-free cost estimate.

### 4. Optionally create character sketch references

Generate reusable sketch refs for any character sources you want staged into panel prompts:

```bash
bun as comic character-sketch --image input/characters/03-duco.webp
```

If a character already has a complete sketch directory, combine it into a sheet without calling an image API:

```bash
bun as comic character-sketch --image output/characters/sketches/03-duco
```

### 5. Build stable panel prompt bundles

```bash
bun as comic draft-scenes input/episode-scripts/ep02-scripts/01-co-work-smarter.md --only panel-prompts
```

Review these prompt bundles before spending image-generation cost.

### 6. Generate review sketches

```bash
bun as comic generate-images input/episode-scripts/ep02-scripts/01-co-work-smarter.md --target sketches
```

Panel prompt bundles from the previous step are detected automatically and reused. Use `--force` to rebuild them.

### 7. Generate final panel images

```bash
bun as comic generate-images input/episode-scripts/ep02-scripts/01-co-work-smarter.md --target images
```

To generate review sketches and final panel images in one run after scene JSON exists, use:

```bash
bun as comic generate-images input/episode-scripts/ep02-scripts/01-co-work-smarter.md --target both
```

## draft-scenes

`draft-scenes` runs script markdown through structured script JSON, draft prompt bundles, scene JSON panel objects, and stable panel prompt bundles.

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--only <stage>` | Run only `structure`, `prompt`, `scene`, or `panel-prompts` | none (runs all stages) |
| `--price` | Estimate API-backed stages without making API calls | `false` |

### Advanced Options

| Flag | Description | Default |
|------|-------------|---------|
| `--llm-model <model>` | Use a supported OpenAI or Gemini text model | `gpt-5.4` |

### Examples

```bash
bun as comic draft-scenes input/episode-scripts/ep02-scripts/01-co-work-smarter.md
bun as comic draft-scenes input/episode-scripts/ep02-scripts/01-co-work-smarter.md --only structure
bun as comic draft-scenes input/episode-scripts/ep02-scripts/01-co-work-smarter.md --only prompt
bun as comic draft-scenes input/episode-scripts/ep02-scripts/01-co-work-smarter.md --only scene
bun as comic draft-scenes input/episode-scripts/ep02-scripts/01-co-work-smarter.md --only panel-prompts
```

### Behavior

- The full run executes `structure`, `prompt`, `scene`, and `panel-prompts` in order.
- `--only structure` creates or reviews structured script JSON.
- `--only prompt` builds the scene-drafting prompt bundle and does not call an API.
- `--only scene` drafts scene JSON from an existing prompt bundle.
- `--only panel-prompts` builds stable panel prompt bundles from existing scene JSON and does not call an API.
- Scene drafting validates generated JSON before writing it.

## generate-images

`generate-images` turns scene JSON into stable panel prompt bundles, optional black-and-white review sketches, and final comic panel images.

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--target <target>` | `images`, `sketches`, or `both` | `images` |
| `--panels <all\|range\|list>` | Panels to process: `all`, a range like `1-8`, a list like `1,3,7`, or mixed like `1-4,9`; overlong contiguous ranges clamp to available panels | `all` |
| `-f, --force` | Rebuild panel prompts and overwrite existing generated PNGs | `false` |
| `--price` | Estimate image-generation costs without making API calls | `false` |

### Advanced Options

| Flag | Description | Default |
|------|-------------|---------|
| `--llm-model <model>` | Use a supported text model (see [Supported Models](#supported-models)) | `gpt-5.4` |
| `--image-model <model[,model...]>` | Use one or more supported image models (see [Supported Models](#supported-models)) | `gpt-image-1.5` |
| `--variation <name[,name...]>` | Generate final images with one or more prompt variations: `canonical`, `animation-polish`, `cinematic-depth` | none |
| `--size <size>` | Image size such as `1536x1024`, `1024x1024`, `1024x1536`, or `auto` | `1536x1024` |
| `--quality <quality>` | `low`, `medium`, `high`, or `auto`; Gemini ignores this compatibility flag | `high` |
| `--panels-per-image <n>` | Number of ordered panels per page image; values greater than 1 trigger page generation mode | `4` |

### Examples

```bash
bun as comic generate-images input/episode-scripts/ep02-scripts/01-co-work-smarter.md --target sketches
bun as comic generate-images input/episode-scripts/ep02-scripts/01-co-work-smarter.md --target images
bun as comic generate-images input/episode-scripts/ep02-scripts/01-co-work-smarter.md --target both
bun as comic generate-images input/episode-scripts/ep02-scripts/01-co-work-smarter.md --target images --panels 1-16
bun as comic generate-images input/episode-scripts/ep02-scripts/01-co-work-smarter.md --target images --panels 1,3,7
bun as comic generate-images input/episode-scripts/ep02-scripts/01-co-work-smarter.md --target sketches --panels 5-8
bun as comic generate-images input/episode-scripts/ep02-scripts/01-co-work-smarter.md --target images --image-model gpt-image-2
bun as comic generate-images input/episode-scripts/ep02-scripts/01-co-work-smarter.md --target images --image-model gpt-image-2,gemini-3.1-flash-image-preview
bun as comic generate-images input/episode-scripts/ep02-scripts/01-co-work-smarter.md --target images --variation animation-polish,cinematic-depth
```

### Behavior

- Panel prompt bundles are auto-detected: if they already exist for the target scope, the rebuild is skipped. Use `--force` during image generation or `draft-scenes --only panel-prompts` to rebuild stable bundles explicitly.
- `--target sketches` builds panel prompt bundles if missing, then generates review sketches.
- `--target images` builds panel prompt bundles if missing, then generates final panel images.
- `--target both` builds panel prompt bundles if missing, generates sketches, then generates final images.
- `--panels` selects which panels to process for any target (images, sketches, or both). A contiguous range that extends past the last available panel is clamped to the overlap, so `--panels 9-16` on an 11-panel scene processes panels 9-11.
- Review sketch selections must be contiguous because each sketch output is one panel range; use `--target images` for non-contiguous final panel lists like `1,3,7`.
- Non-overlapping panel selections, non-contiguous missing panels, and likely typos such as `--panels 1,99` still fail.
- When `--panels-per-image` is greater than 1, the images target produces grouped page images instead of individual panel images.
- `--variation` only applies to final images (`--target images` or `--target both`). When omitted, legacy final image paths are preserved. When provided, outputs are grouped under `pages/<variation>/<model>/` or `panels/<variation>/<model>/`.
- Review sketches and final images use the defaults shown above (`gpt-image-1.5`, `1536x1024`, `high`).
- Multi-model runs write model-specific filenames.

## character-sketch

`character-sketch` generates three reusable outline-only character references from a source image, or combines an existing sketch directory into one reference sheet.

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--image <path>` | Source image under `input/characters/`, or a sketch directory under `output/characters/sketches/` | required |
| `-f, --force` | Overwrite existing generated sketch PNGs | `false` |
| `-r, --revise` | Revise existing sketches using the source image and existing sketch refs | `false` |
| `--notes <text>` | Revision instructions; required with `--revise` | none |
| `--price` | Estimate image-generation costs without making API calls | `false` |

### Advanced Options

| Flag | Description | Default |
|------|-------------|---------|
| `--image-model <model[,model...]>` | Use one or more supported OpenAI or Gemini image models | `gpt-image-1.5` |
| `--size <size>` | Image size such as `1024x1536`, `1024x1024`, `1536x1024`, or `auto` | `1024x1536` |
| `--quality <quality>` | `low`, `medium`, `high`, or `auto`; Gemini ignores this compatibility flag | `medium` |

### Examples

```bash
bun as comic character-sketch --image input/characters/03-duco.webp
bun as comic character-sketch --image input/characters/01-peaches.webp --price
bun as comic character-sketch --image output/characters/sketches/03-duco
```

### Behavior

- Source-image mode writes front, three-quarter, and profile outline references under `output/characters/sketches/<character-stem>/`.
- Sketch-directory mode combines a complete three-view sketch set into one horizontal sheet and does not call an image API.
- Uses the defaults shown above (`gpt-image-1.5`, `1024x1536`, `medium`).
- After generating or updating character sketch refs, rerun `draft-scenes --only panel-prompts` for affected scenes so stable panel bundles stage the new refs.

## Output

For the `ep02` examples above, expected output roots include:

```text
output/episode-prompts/ep02-structured-scripts/
output/episode-prompts/ep02-draft-prompts/
output/episode-prompts/ep02-scenes/
output/episode-prompts/ep02-panel-prompts/
output/episode-comics/episode-02-comic-images/01-co-work-smarter/pages/
output/episode-comics/episode-02-comic-images/01-co-work-smarter/panels/
output/episode-comics/episode-02-comic-images/01-co-work-smarter/sketches/
output/characters/sketches/
```

## Supported Models

### Image Models

| Model | Provider | Notes |
|-------|----------|-------|
| `gpt-image-1.5` | OpenAI | Default. Good balance of quality and cost. |
| `gpt-image-2` | OpenAI | Higher quality, higher cost. |
| `gemini-3.1-flash-image-preview` | Google | Gemini native image generation. |

Pass multiple models with `--image-model` to generate each panel with every model for comparison:

```bash
--image-model gpt-image-2,gemini-3.1-flash-image-preview
```

### Text Models (LLM)

| Model | Provider | Notes |
|-------|----------|-------|
| `gpt-5.4` | OpenAI | Default. Used for scene drafting and panel prompts. |
| `gpt-5.4-pro` | OpenAI | Highest quality, slowest and most expensive. |
| `gpt-5.4-mini` | OpenAI | Faster and cheaper, slightly lower quality. |
| `gpt-5.4-nano` | OpenAI | Fastest and cheapest. |
| `gemini-3.1-pro-preview` | Google | Gemini pro-tier text model. |
| `gemini-3.1-flash-lite-preview` | Google | Gemini lightweight text model. |

## Notes

- Real `draft-scenes`, `generate-images`, and source-image `character-sketch` runs can call OpenAI or Gemini APIs.
- Use `--price` to estimate hosted cost before running generation.
- `draft-scenes --only prompt` and `draft-scenes --only panel-prompts` are prompt-building stages and do not generate images.

## Deprecated Options

The following options were removed. Using them will produce an informative error with migration instructions:

| Removed Flag | Replacement |
|---|---|
| `--episode`, `--scene` | Pass a script file path directly |
| `--concurrency` | Commands now process a single script |
| `--panel <n>` | Use `--panels <n>` |
| `--panel-limit <n>` | Use `--panels <range>` directly (e.g. `--panels 1-4`) |
| `--chunk <number>` | Use `--panels <range>` with `--target sketches` |
| `--sketch-group-size <n\|all>` | Sketches auto-group in chunks of 4; use `--panels <range>` for explicit selection |
| `--sketch-panels <range>` | Use `--panels <range>` |
| `--draft-scenes` | Scene drafts are auto-detected |
| `--skip-panel-prompts` | Panel prompts are auto-detected |
| `generate-images --target prompts` | Use `draft-scenes <script-path> --only panel-prompts` |
