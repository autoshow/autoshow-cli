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
bun as comic draft-scenes [--episode ep01] [--script <script-slug>] [--only structure|prompt|scene] [--llm-model <model>] [--concurrency <n>] [--price]
bun as comic generate-images [--episode ep01] [--scene <scene-slug>] [--target prompts|images|sketches|both] [--llm-model <model>] [--concurrency <n>] [--panel <number>] [--panels <all|list>] [--panel-limit <n>] [--panels-per-image <n>] [--chunk <number>] [--sketch-group-size <number|all>] [--sketch-panels <start-end|all>] [--image-model <model[,model...]>] [--size <size>] [--quality <quality>] [--force] [--price]
bun as comic character-sketch --image <source-image|sketch-dir> [--image-model <model[,model...]>] [--size <size>] [--quality <quality>] [--force] [--revise --notes <text>] [--price]
```

## Walkthrough: 01-co-work-smarter

This walkthrough starts from:

```text
input/episode-scripts/ep02-scripts/01-co-work-smarter.md
```

The CLI selects that file with `--episode ep02 --script 01-co-work-smarter`. Downstream image steps use the matching scene slug, `--scene 01-co-work-smarter`.

To run the complete script-to-page pipeline:

```bash
bun as comic generate-images --episode ep02 --scene 01-co-work-smarter --target images --panels 1-16
```

This writes grouped final page images under `output/episode-comics/episode-02-comic-images/01-co-work-smarter/pages/`.

### 1. Create structured script JSON

```bash
bun as comic draft-scenes --episode ep02 --script 01-co-work-smarter --only structure
```

### 2. Build the scene-drafting prompt

```bash
bun as comic draft-scenes --episode ep02 --script 01-co-work-smarter --only prompt
```

### 3. Draft scene JSON

```bash
bun as comic draft-scenes --episode ep02 --script 01-co-work-smarter --only scene
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
bun as comic generate-images --episode ep02 --scene 01-co-work-smarter --target prompts
```

Review these prompt bundles before spending image-generation cost.

### 6. Generate review sketches

```bash
bun as comic generate-images --episode ep02 --scene 01-co-work-smarter --target sketches
```

Panel prompt bundles from the previous step are detected automatically and reused. Use `--force` to rebuild them.

### 7. Generate final panel images

```bash
bun as comic generate-images --episode ep02 --scene 01-co-work-smarter --target images
```

To generate review sketches and final panel images in one run after scene JSON exists, use:

```bash
bun as comic generate-images --episode ep02 --scene 01-co-work-smarter --target both
```

## draft-scenes

`draft-scenes` runs script markdown through structured script JSON, draft prompt bundles, and scene JSON panel objects.

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `-e, --episode <episode>` | Run one episode key such as `ep02` | none (runs all episodes) |
| `--script <script>` | Run one script slug in the selected episode | none (runs all scripts) |
| `--only <stage>` | Run only `structure`, `prompt`, or `scene` | none (runs all stages) |
| `--llm-model <model>` | Use a supported OpenAI or Gemini text model | `gpt-5.4-nano` |
| `--concurrency <n>` | Process up to n scripts in parallel | `3` |
| `--price` | Estimate API-backed stages without making API calls | `false` |

### Examples

```bash
bun as comic draft-scenes --episode ep02 --script 01-co-work-smarter
bun as comic draft-scenes --episode ep02 --script 02-unaccounted-for
bun as comic draft-scenes --episode ep02 --script 01-co-work-smarter --only structure
bun as comic draft-scenes --episode ep02 --script 01-co-work-smarter --only prompt
bun as comic draft-scenes --episode ep02 --script 01-co-work-smarter --only scene
```

### Behavior

- The full run executes `structure`, `prompt`, and `scene` in order.
- `--only structure` creates or reviews structured script JSON.
- `--only prompt` builds the scene-drafting prompt bundle and does not call an API.
- `--only scene` drafts scene JSON from an existing prompt bundle.
- Scene drafting validates generated JSON before writing it.

## generate-images

`generate-images` turns scene JSON into stable panel prompt bundles, optional black-and-white review sketches, and final comic panel images.

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `-e, --episode <episode>` | Run one episode key such as `ep02` | none (runs all episodes) |
| `-s, --scene <scene>` | Run one scene slug in the selected episode | none (runs all scenes) |
| `--target <target>` | `prompts`, `images`, `sketches`, or `both` | `images` |
| `--llm-model <model>` | Use a supported OpenAI or Gemini text model for scene drafting (used when scene drafts are auto-generated) | `gpt-5.4-nano` |
| `--concurrency <n>` | Process up to n scripts in parallel during scene drafting | `3` |
| `--panel <number>` | Generate one 1-based final panel image | none |
| `--panels <all\|list>` | Panel selection: `all`, a range like `1-8`, a list like `1,3,7`, or mixed like `1-4,9`; mutually exclusive with `--panel` | `all` |
| `--panel-limit <n>` | Cap selected panels after `--panels` resolution | none |
| `--panels-per-image <n>` | Number of ordered panels per page image; values greater than 1 trigger page generation mode | `4` |
| `--chunk <number>` | Generate one 1-based review-sketch chunk | none |
| `--sketch-group-size <number\|all>` | Group review sketches by panel count, or all panels | none |
| `--sketch-panels <range>` | Generate one explicit range such as `1-4` or `all` | none |
| `--image-model <model[,model...]>` | Use one or more supported OpenAI or Gemini image models | `gpt-image-1.5` |
| `--size <size>` | Image size such as `1536x1024`, `1024x1024`, `1024x1536`, or `auto` | `1536x1024` |
| `--quality <quality>` | `low`, `medium`, `high`, or `auto`; Gemini ignores this compatibility flag | `high` |
| `-f, --force` | Rebuild panel prompts and overwrite existing generated PNGs | `false` |
| `--price` | Estimate image-generation costs without making API calls | `false` |

### Examples

```bash
bun as comic generate-images --episode ep02 --scene 01-co-work-smarter --target prompts
bun as comic generate-images --episode ep02 --scene 02-unaccounted-for --target prompts
bun as comic generate-images --episode ep02 --scene 01-co-work-smarter --target sketches
bun as comic generate-images --episode ep02 --scene 01-co-work-smarter --target images
bun as comic generate-images --episode ep02 --scene 01-co-work-smarter --target both
bun as comic generate-images --episode ep02 --scene 01-co-work-smarter --target images --panels 1-16 --panels-per-image 4
bun as comic generate-images --episode ep02 --scene 01-co-work-smarter --target images --panels 1,3,7
bun as comic generate-images --episode ep05 --draft-scenes --target prompts
```

### Behavior

- `--draft-scenes` runs the full draft-scenes pipeline (structure, prompt, scene JSON) before building panel prompts, combining both steps into one command.
- `--llm-model` selects the text model for scene drafting and requires `--draft-scenes`.
- Panel prompt bundles are auto-detected: if they already exist for the target scope, the rebuild is skipped. Use `--force` to rebuild existing prompts, or `--target prompts` to explicitly rebuild.
- `--target prompts` always rebuilds stable panel prompt bundles.
- `--target sketches` builds panel prompt bundles if missing, then generates review sketches.
- `--target images` builds panel prompt bundles if missing, then generates final panel images.
- `--target both` builds panel prompt bundles if missing, generates sketches, then generates final images.
- When `--panels-per-image` is greater than 1, the images target produces grouped page images instead of individual panel images.
- `--panels` and `--panel-limit` filter which panels are processed in both individual panel and page generation modes.
- `--panel` and `--panels` are mutually exclusive.
- `--panels`, `--panel-limit`, and `--panels-per-image` only apply when `--target` is `images` or `both`.
- Review sketches and final images use the defaults shown above (`gpt-image-1.5`, `1536x1024`, `high`).
- Multi-model runs write model-specific filenames.

## character-sketch

`character-sketch` generates three reusable outline-only character references from a source image, or combines an existing sketch directory into one reference sheet.

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--image <path>` | Source image under `input/characters/`, or a sketch directory under `output/characters/sketches/` | required |
| `--image-model <model[,model...]>` | Use one or more supported OpenAI or Gemini image models | `gpt-image-1.5` |
| `--size <size>` | Image size such as `1024x1536`, `1024x1024`, `1536x1024`, or `auto` | `1024x1536` |
| `--quality <quality>` | `low`, `medium`, `high`, or `auto`; Gemini ignores this compatibility flag | `medium` |
| `-f, --force` | Overwrite existing generated sketch PNGs | `false` |
| `-r, --revise` | Revise existing sketches using the source image and existing sketch refs | `false` |
| `--notes <text>` | Revision instructions; required with `--revise` | none |
| `--price` | Estimate image-generation costs without making API calls | `false` |

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
- After generating or updating character sketch refs, rerun `generate-images --target prompts` for affected scenes so stable panel bundles stage the new refs.

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

## Notes

- Real `draft-scenes`, `generate-images`, and source-image `character-sketch` runs can call OpenAI or Gemini APIs.
- Use `--price` to estimate hosted cost before running generation.
- `generate-images --target prompts` and `draft-scenes --only prompt` are prompt-building stages and do not generate images.
