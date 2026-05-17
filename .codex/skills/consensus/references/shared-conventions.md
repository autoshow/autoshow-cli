# Shared Consensus Conventions

## Public Entry Point

Use `scripts/run.ts` for all category workflows:

```bash
bun scripts/run.ts <category> build-packet <run_dir> [--input-text <path>] [--out <path>]
bun scripts/run.ts <category> build-report <run_dir> [--input-text <path>] [--roundtrip-dir <path>]
```

The dispatcher calls category-specific scripts and then rewrites reports into the consolidated ranking contract.

## Local And Service Separation

Never rank local providers against hosted, cloud, paid, or API-backed services in the same table.

Use two report groups:

1. `local` for providers that run on the user's machine and have zero monetary cost in this report.
2. `service` for hosted, cloud, or third-party providers with possible monetary cost, quota, or billing.

Local cheapest rankings treat each local provider as zero monetary cost and only compare local providers with each other.

## Required Ranking Surfaces

JSON reports must expose all six paths:

```text
rankingSurfaces.local.fastest
rankingSurfaces.local.cheapest
rankingSurfaces.local.highestQuality
rankingSurfaces.service.fastest
rankingSurfaces.service.cheapest
rankingSurfaces.service.highestQuality
```

Each surface contains up to three providers. If unavailable, it is an empty array and the adjacent unavailable reason field explains why.

Markdown reports must expose matching sections:

1. Local Providers / Top 3 Fastest
2. Local Providers / Top 3 Cheapest
3. Local Providers / Top 3 Highest Quality
4. Service Providers / Top 3 Fastest
5. Service Providers / Top 3 Cheapest
6. Service Providers / Top 3 Highest Quality

## Quality Evidence Rules

Highest-quality rankings must be evidence-only:

1. OCR: WER/CER-derived extraction accuracy.
2. STT: speaker-aware WER-derived transcript accuracy.
3. URL: extraction accuracy using WER, CER, and content coverage.
4. TTS: roundtrip WER, or explicit voice-quality report data if already present.
5. Image, music, and video: unavailable unless an explicit quality metric exists.

Do not use file size, dimensions, bitrate, duration, or subjective judgment as quality proxies.

## No-Cost Verification

Use only local fixture or metadata-only checks unless the user explicitly approves a paid provider run.

Do not run smoke or e2e tests that can reach OpenAI, Anthropic, Gemini, Mistral, AWS, Google Cloud, ElevenLabs, MiniMax, deAPI, Deepgram, Groq, Grok, Firecrawl, or other paid providers.
