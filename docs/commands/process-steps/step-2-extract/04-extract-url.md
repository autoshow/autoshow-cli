# extract URL and X

Remote article URLs and local HTML files use article extraction, while X/Twitter Space inputs use the X API for metadata extraction.

## Outline

- [Article And HTML Path](#article-and-html-path)
- [URL Environment](#url-environment)
- [Shared URL Options](#shared-url-options)
- [Article Services](#article-services)
  - [Defuddle](#defuddle)
  - [Firecrawl](#firecrawl)
  - [GLM Reader](#glm-reader)
  - [Spider](#spider)
  - [Zyte](#zyte)
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
| Remote article URL | `html+defuddle` | `--url-backend firecrawl`, `--url-backend glm-reader`, `--url-backend spider`, or `--url-backend zyte` |
| Local `.html` / `.htm` | `html+defuddle` | Hosted article backends are ignored with a warning |

OCR engine flags do not apply to article extraction. If `defuddle` cannot extract meaningful content from a remote URL, the command suggests retrying with a remote backend such as `--url-backend firecrawl`, `--url-backend spider`, or `--url-backend zyte`.

## URL Environment

Use these only when you select the matching hosted article backend:

```bash
GLM_API_KEY=...
ZAI_BASE_URL=https://api.z.ai/api/paas/v4
FIRECRAWL_API_KEY=...
FIRECRAWL_API_URL=http://localhost:3002
SPIDER_API_KEY=...
SPIDER_API_URL=https://api.spider.cloud
ZYTE_API_KEY=...
ZYTE_API_URL=https://api.zyte.com
AUTOSHOW_URL_BACKEND=firecrawl
# or
AUTOSHOW_URL_BACKEND=glm-reader
# or
AUTOSHOW_URL_BACKEND=spider
# or
AUTOSHOW_URL_BACKEND=zyte
```

`FIRECRAWL_API_KEY`, `SPIDER_API_KEY`, and `ZYTE_API_KEY` are required for the hosted APIs. Their matching `*_API_URL` variables can point at compatible local or mock endpoints for development.

## Shared URL Options

| Flag | Description |
|------|-------------|
| `--url-backend <backend>` | Article backend for remote article URLs: `defuddle`, `firecrawl`, `glm-reader`, `spider`, or `zyte` |
| `--out <format>` | Output format: `text`, `json`, `tsv`, or `hocr` |
| `--batch-limit <n>` | Limit batch size |
| `--batch-all` | Process all batch items |
| `--batch-order <newest\|oldest>` | Choose batch ordering |
| `--batch-concurrency <n>` | Process batch items concurrently |

```bash
bun as extract input/examples/batch/2-urls.md --batch-all
bun as extract input/article.html --out json
```

## Article Services

### Defuddle

| Option | Value |
|--------|-------|
| Selector | default, or `--url-backend defuddle` |
| Inputs | Remote article URLs and local `.html` / `.htm` files |
| Runtime | Local HTML/article extraction |

```bash
bun as extract https://ajcwebdev.com
bun as extract input/article.html --out json
```

Local `.html` and `.htm` files always use `defuddle`, even if a hosted backend is requested.

### Firecrawl

| Option | Value |
|--------|-------|
| Selector | `--url-backend firecrawl` |
| Inputs | Remote article URLs |
| Required env | `FIRECRAWL_API_KEY` unless `FIRECRAWL_API_URL` points at a self-hosted instance |
| Optional env | `FIRECRAWL_API_URL` |
| Endpoint | `POST /v2/scrape` |

```bash
bun as extract https://ajcwebdev.com --url-backend firecrawl
```

### GLM Reader

| Option | Value |
|--------|-------|
| Selector | `--url-backend glm-reader` |
| Inputs | Remote article URLs |
| Required env | `GLM_API_KEY` |
| Optional env | `ZAI_BASE_URL` |

```bash
bun as extract https://ajcwebdev.com --url-backend glm-reader
```

### Spider

| Option | Value |
|--------|-------|
| Selector | `--url-backend spider` |
| Inputs | Remote article URLs |
| Required env | `SPIDER_API_KEY` unless `SPIDER_API_URL` points at a compatible mock endpoint |
| Optional env | `SPIDER_API_URL` |
| Endpoint | `POST /scrape` with `return_format: "markdown"` |

```bash
bun as extract https://ajcwebdev.com --url-backend spider
```

### Zyte

| Option | Value |
|--------|-------|
| Selector | `--url-backend zyte` |
| Inputs | Remote article URLs |
| Required env | `ZYTE_API_KEY` unless `ZYTE_API_URL` points at a compatible mock endpoint |
| Optional env | `ZYTE_API_URL` |
| Endpoint | `POST /v1/extract` with `article: true` |

```bash
bun as extract https://ajcwebdev.com --url-backend zyte
```

## URL Notes

- Remote article URLs use `defuddle` unless you pass `--url-backend firecrawl`, `--url-backend glm-reader`, `--url-backend spider`, `--url-backend zyte`, or set `AUTOSHOW_URL_BACKEND`.
- OCR engine flags do not apply to article extraction.
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
