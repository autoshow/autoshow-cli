# extract URL and X

Remote article URLs and local HTML files use article extraction, while X/Twitter Space inputs use the X API for metadata extraction.

## Outline

- [Article And HTML Path](#article-and-html-path)
- [URL Environment](#url-environment)
- [Shared URL Options](#shared-url-options)
- [All URL Backends](#all-url-backends)
- [Article Services](#article-services)
  - [Defuddle](#defuddle)
  - [Firecrawl](#firecrawl)
  - [GLM Reader](#glm-reader)
  - [Spider](#spider)
  - [Supadata](#supadata)
  - [Zyte](#zyte)
- [URL Output](#url-output)
- [URL Consensus](#url-consensus)
- [URL Notes](#url-notes)
- [X Space Path](#x-space-path)
  - [X API](#x-api)
- [X Space Setup](#x-space-setup)
- [Supported URL Patterns](#supported-url-patterns)
- [X Space Output](#x-space-output)
- [X Space Batch Support](#x-space-batch-support)
- [X Space Notes](#x-space-notes)

See the [`extract` overview](./01-extract.md) for input routing across STT, OCR, article HTML, and X/Twitter inputs.

## Article And HTML Path

Article-style HTML inputs route through article extraction rather than OCR provider engines.

| Input family | Default path | Other available paths |
|--------------|--------------|-----------------------|
| Remote article URL | `html+defuddle` | `--url-provider firecrawl`, `--url-provider glm-reader`, `--url-provider spider`, `--url-provider supadata`, `--url-provider zyte`, route-aware `--provider <backend>`, or `--all-providers` |
| Local `.html` / `.htm` | `html+defuddle` | `--all-providers` runs `defuddle` and marks hosted backends skipped |

OCR engine flags do not apply to article extraction. In single-backend mode, the default remote `defuddle` path preserves the existing fallback to `firecrawl` when local extraction fails. In `--all-providers` mode, each backend is run and scored independently, so `defuddle` does not silently fall back to `firecrawl`.

## URL Environment

Use these only when you select the matching hosted article backend:

```bash
GLM_API_KEY=...
ZAI_BASE_URL=https://api.z.ai/api/paas/v4
FIRECRAWL_API_KEY=...
FIRECRAWL_API_URL=http://localhost:3002
SPIDER_API_KEY=...
SPIDER_API_URL=https://api.spider.cloud
SUPADATA_API_KEY=...
SUPADATA_BASE_URL=https://api.supadata.ai/v1
ZYTE_API_KEY=...
ZYTE_API_URL=https://api.zyte.com
AUTOSHOW_URL_BACKEND=firecrawl
# or
AUTOSHOW_URL_BACKEND=glm-reader
# or
AUTOSHOW_URL_BACKEND=spider
# or
AUTOSHOW_URL_BACKEND=supadata
# or
AUTOSHOW_URL_BACKEND=zyte
```

`FIRECRAWL_API_KEY`, `SPIDER_API_KEY`, `SUPADATA_API_KEY`, and `ZYTE_API_KEY` are required for the hosted APIs. `GLM_API_KEY` is required for GLM Reader. Their matching `*_API_URL` / `*_BASE_URL` variables can point at compatible local or mock endpoints for development.

Do not combine `AUTOSHOW_URL_BACKEND` with `--all-providers`; `--all-providers` selects the full canonical backend set.

## Shared URL Options

| Flag | Description |
|------|-------------|
| `--url-provider <backend>` | Article backend for remote article URLs: `defuddle`, `firecrawl`, `glm-reader`, `spider`, `supadata`, or `zyte` |
| `--provider <backend>` | Route-aware shorthand for a URL backend on article inputs |
| `--all-providers` | For `extract`, run every current URL article backend: `defuddle`, `firecrawl`, `glm-reader`, `spider`, `supadata`, and `zyte` |
| `--provider-concurrency <n>` | Hosted URL backends to run concurrently per item; default `2`, or up to `4` by default with `--all-providers` |
| `--url-request-timeout-ms <ms>` | Per-provider URL request timeout; default `60000`. Env fallback: `AUTOSHOW_URL_REQUEST_TIMEOUT_MS` |
| `--url-request-attempts <n>` | Total provider request attempts, including the first try; default `3`. Env fallback: `AUTOSHOW_URL_REQUEST_ATTEMPTS` |
| `--format <format>` | Output format: `text`, `json`, `tsv`, or `hocr` |
| `--price` | Show the aggregated URL extraction estimate and exit |
| `--batch-limit <n>` | Limit batch size |
| `--batch-all` | Process all batch items |
| `--batch-order <newest\|oldest>` | Choose batch ordering |
| `--batch-concurrency <n>` | Process batch items concurrently |

```bash
bun as extract input/examples/batch/2-urls.md --batch-all
bun as extract input/article.html --format json
bun as extract https://example.com/article --all-providers --price
bun as extract https://example.com/article --all-providers --provider-concurrency 2
bun as extract https://example.com/article --all-providers --url-request-timeout-ms 90000 --url-request-attempts 2
```

## All URL Backends

`--all-providers` is scoped to article inputs on the `extract` command. It runs remote HTML/article inputs through the current URL backend set in canonical order:

```text
defuddle, firecrawl, glm-reader, spider, supadata, zyte
```

`defuddle` is local and free, so it runs in its own single-slot lane. Hosted backends run in a separate pool controlled by `--provider-concurrency`.

Because `--all-providers` includes hosted providers, use `--price` first when you want an estimate without making provider calls.

Rules:

- `--all-providers` conflicts with `--url-provider` and with `AUTOSHOW_URL_BACKEND`.
- `write --all-providers url` is rejected for this release because there is no primary URL extraction artifact for the LLM step.
- Remote `--all-providers` runs do not use the single-backend Defuddle-to-Firecrawl fallback path.
- Local `.html` / `.htm --all-providers` runs `defuddle` only and records hosted backends as skipped.
- URL request retries repeat hosted provider requests after timeout, network, `408`, `429`, and `5xx` failures. Increasing `--url-request-attempts` can increase hosted provider usage, quota consumption, or cost.

## Article Services

### Defuddle

| Option | Value |
|--------|-------|
| Selector | default, or `--url-provider defuddle` |
| Inputs | Remote article URLs and local `.html` / `.htm` files |
| Runtime | Local HTML/article extraction through the Defuddle CLI |

```bash
bun as setup --step defuddle
bun as extract https://ajcwebdev.com
bun as extract input/article.html --format json
```

Set `AUTOSHOW_DEFUDDLE_BIN` to use a specific `defuddle` executable. Otherwise AutoShow tries the managed runtime install, then a `defuddle` binary on `PATH`.

Local `.html` and `.htm` files always use `defuddle`, even if a hosted backend is requested.

### Firecrawl

| Option | Value |
|--------|-------|
| Selector | `--url-provider firecrawl` or `--provider firecrawl` |
| Inputs | Remote article URLs |
| Required env | `FIRECRAWL_API_KEY` unless `FIRECRAWL_API_URL` points at a self-hosted instance |
| Optional env | `FIRECRAWL_API_URL` |
| Endpoint | `POST /v2/scrape` |

```bash
bun as extract https://ajcwebdev.com --url-provider firecrawl
```

### GLM Reader

| Option | Value |
|--------|-------|
| Selector | `--url-provider glm-reader` or `--provider glm-reader` |
| Inputs | Remote article URLs |
| Required env | `GLM_API_KEY` |
| Optional env | `ZAI_BASE_URL` |

```bash
bun as extract https://ajcwebdev.com --provider glm-reader
```

### Spider

| Option | Value |
|--------|-------|
| Selector | `--url-provider spider` or `--provider spider` |
| Inputs | Remote article URLs |
| Required env | `SPIDER_API_KEY` unless `SPIDER_API_URL` points at a compatible mock endpoint |
| Optional env | `SPIDER_API_URL` |
| Endpoint | `POST /scrape` with `return_format: "markdown"` |

```bash
bun as extract https://ajcwebdev.com --url-provider spider
```

### Supadata

| Option | Value |
|--------|-------|
| Selector | `--url-provider supadata` or `--provider supadata` |
| Inputs | Remote article URLs |
| Required env | `SUPADATA_API_KEY` |
| Optional env | `SUPADATA_BASE_URL` |
| Endpoint | `GET /web/scrape?url=<source>` |

```bash
bun as extract https://ajcwebdev.com --url-provider supadata
```

### Zyte

| Option | Value |
|--------|-------|
| Selector | `--url-provider zyte` or `--provider zyte` |
| Inputs | Remote article URLs |
| Required env | `ZYTE_API_KEY` unless `ZYTE_API_URL` points at a compatible mock endpoint |
| Optional env | `ZYTE_API_URL` |
| Endpoint | `POST /v1/extract` with `article: true` |

```bash
bun as extract https://ajcwebdev.com --url-provider zyte
```

## URL Output

Single-backend article extraction writes one top-level extraction artifact plus `run.json`:

```text
output/YYYY-MM-DD_HH-MM-SS_article/
  extraction.txt      # default --format text
  result.json         # if --format json
  extraction.tsv      # if --format tsv
  extraction.hocr     # if --format hocr
  run.json
```

`--all-providers` writes fixed per-provider artifacts instead of a top-level extraction:

```text
output/YYYY-MM-DD_HH-MM-SS_article/
  providers/
    defuddle/
      extraction.txt
      result.json
    firecrawl/
      extraction.txt
      result.json
    glm-reader/
      extraction.txt
      result.json
    spider/
      extraction.txt
      result.json
    supadata/
      extraction.txt
      result.json
    zyte/
      extraction.txt
      result.json
  run.json
```

Each provider `result.json` is a provider-result envelope with the URL extraction metadata and structured extraction result. The root `run.json` records `completionStatus`, `requestedProviders`, `providerStates`, `missingProviders`, `errors` when present, estimated and actual cost data, and per-provider timing data.

Incomplete runs can still leave useful provider artifacts. For example, local `.html --all-providers` succeeds with `defuddle`, marks hosted providers skipped, and records an `incomplete` status because those hosted providers were requested by the shortcut.

## URL Consensus

After an `--all-providers` run, use the local `consensus` skill to build a gold reference and comparison reports from `providers/*/result.json`:

```text
.codex/skills/consensus/
  scripts/run.ts url build-packet <run_dir>
  scripts/run.ts url build-report <run_dir>
```

The expected consensus deliverables are `consensus-extraction.txt`, `provider-comparison-report.md`, and `provider-comparison-report.json` in the run directory.

## URL Notes

- Remote article URLs use `defuddle` unless you pass `--url-provider firecrawl`, `--url-provider glm-reader`, `--url-provider spider`, `--url-provider supadata`, `--url-provider zyte`, set `AUTOSHOW_URL_BACKEND`, or select every backend with `--all-providers`.
- OCR engine flags do not apply to article extraction.
- Single-backend article extraction writes a top-level extraction artifact. `--all-providers` writes provider artifacts only.
- Public URL flags are intentionally generic. Provider-specific browser actions, crawl/map/search, screenshots, and structured extraction controls are not exposed as article flags yet.

## X Space Path

X/Twitter Space URLs, post URLs, and raw Space IDs are auto-detected and processed via the X v2 API. No special flags are needed.

### X API

| Option | Value |
|--------|-------|
| Selector | Automatic for supported X/Twitter Space inputs |
| Required env | `X_BEARER_TOKEN` |
| Output | Space metadata, user profiles, post references, sources, and error details |

```bash
bun as extract "https://x.com/i/spaces/1DXxyRYNejbKM"
bun as extract "https://twitter.com/i/spaces/1DXxyRYNejbKM"
bun as extract "https://x.com/user/status/1234567890"
bun as extract 1DXxyRYNejbKM
```

## X Space Setup

Set the `X_BEARER_TOKEN` environment variable. Create a Bearer Token at [developer.x.com](https://developer.x.com/en/portal/dashboard).

## Supported URL Patterns

| Pattern | Example |
|---------|---------|
| Space URL | `https://x.com/i/spaces/<id>` |
| Twitter Space URL | `https://twitter.com/i/spaces/<id>` |
| Post URL (handle) | `https://x.com/<handle>/status/<id>` |
| Post URL (web) | `https://x.com/i/web/status/<id>` |
| Raw Space ID | `1DXxyRYNejbKM` (1-13 alphanumeric characters) |

Mobile (`mobile.x.com`, `mobile.twitter.com`) and www variants are also supported.

## X Space Output

X Space extraction writes three files to the output directory:

- `result.json` - full JSON artifact with Space metadata, user profiles, post references, sources, and error details
- `extraction.md` - Markdown report with summary table, Spaces table, posts table, and errors
- `run.json` - run manifest

## X Space Batch Support

X Space URLs work in batch input lists (`.md` / `.txt` files) alongside other URL types. Each URL is classified individually: YouTube URLs route to STT, document URLs route to OCR, and X URLs route to the X API:

```bash
bun as extract input/spaces.txt --batch-all
```

## X Space Notes

- X Space extraction is only supported by the `extract` command. Other processing commands (`metadata`, `download`, `write`, and generation commands) reject X links with a clear error.
- Post URLs that don't reference a Space still produce a report with the post metadata and an empty Spaces section.
- The X API has rate limits. Batch processing of many X URLs may encounter 429 responses.
