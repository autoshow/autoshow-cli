# Shared Consensus Conventions

## Public Entry Point

Use `scripts/run.ts` for all category workflows:

```bash
bun scripts/run.ts <category> build-packet <run_dir> [--input-text <path>] [--out <path>]
bun scripts/run.ts <category> build-report <run_dir> [--input-text <path>] [--roundtrip-dir <path>]
```

The dispatcher calls category-specific scripts and then normalizes reports into the consolidated ranking contract. OCR and STT use category-specific grouped full `metricRankings` instead of `rankingSurfaces`.

## Local And Service Separation

Always expose local and service provider ranking surfaces separately, so local zero-cost tools are not hidden inside service cost comparisons.

Use two report groups:

1. `local` for providers that run on the user's machine and have zero monetary cost in this report.
2. `service` for hosted, cloud, or third-party providers with possible monetary cost, quota, or billing.

Local cheapest rankings treat each local provider as zero monetary cost and only compare local providers with each other.

OCR and STT are metric-ranking exceptions: they do not emit combined balanced-overall leaderboards, tiering, or ranking surfaces. They expose full rankings by price, speed, and quality score within category-specific provider groups.

## Required Ranking Surfaces

Image, music, TTS, URL, and video JSON reports must expose complete rankings under both `rankingSurfaces.local` and `rankingSurfaces.service`:

```text
price
speed
automatedQuality
humanQuality
```

Each surface has a matching `*UnavailableReason` field. Price and speed rankings include every provider in the relevant group, with missing values sorted last as `value: null` and `label: "n/a"`. Automated and human quality rankings use only explicit evidence for that metric. If unavailable, the array is empty and the adjacent unavailable reason explains why.

Compatibility aliases are also required and must point at full-length arrays:

```text
fastest = speed
cheapest = price
highestQuality = humanQuality when humanQuality is present, otherwise automatedQuality
```

OCR JSON reports must expose full metric rankings at:

```text
metricRankings.local.price
metricRankings.local.speed
metricRankings.local.qualityScore
metricRankings.thirdPartyService.price
metricRankings.thirdPartyService.speed
metricRankings.thirdPartyService.qualityScore
```

STT JSON reports must expose full metric rankings at:

```text
metricRankings.local.price
metricRankings.local.speed
metricRankings.local.qualityScore
metricRankings.thirdPartyServiceNonDiarization.price
metricRankings.thirdPartyServiceNonDiarization.speed
metricRankings.thirdPartyServiceNonDiarization.qualityScore
metricRankings.thirdPartyServiceDiarization.price
metricRankings.thirdPartyServiceDiarization.speed
metricRankings.thirdPartyServiceDiarization.qualityScore
```

OCR/STT metric ranking arrays include every provider in the relevant group. Price sorts lower cost first, with local providers at zero and missing service price last. Speed sorts lower processing time first, with missing timing last. Quality Score sorts the existing score higher first. OCR/STT JSON must not emit `rankingSurfaces`, `overall`, `overallMetric`, `overallWeights`, or `tiering`.

Markdown reports normally expose matching sections:

1. Local Providers / Price
2. Local Providers / Speed
3. Local Providers / Automated Quality
4. Local Providers / Human Quality
5. Service Providers / Price
6. Service Providers / Speed
7. Service Providers / Automated Quality
8. Service Providers / Human Quality

OCR and STT markdown use `## Metric Rankings` with group-specific full Price, Speed, and Quality Score tables. They must not include `## Overall Ranking`, `## Tier Breakdown`, combined `## Ranking`, or “Top 3” ranking sections.

TTS markdown uses Local Models and Third-Party Service Models sections with full Price, Speed, Automated Quality, and Human Quality tables. Do not label any non-OCR/STT ranking sections as “Top 3”.

## Quality Evidence Rules

Automated and human quality rankings must be evidence-only:

1. OCR: WER/CER-derived extraction accuracy.
2. STT: speaker-aware WER-derived transcript accuracy, split into local, third-party non-diarization, and third-party diarization groups.
3. URL: extraction accuracy using WER, CER, and content coverage.
4. TTS automated quality: roundtrip WER-derived accuracy, including median roundtrip WER from `voice-quality-report.json`.
5. TTS human quality: `humanSpeechScore` from `voice-quality-report.json`.
6. Image: image judge `qualityScore`.
7. Music and video: explicit `qualityScore` fields when present.
8. Human quality: explicit `humanQualityScore`, or TTS `humanSpeechScore`.

Do not use file size, dimensions, bitrate, duration, cost, speed, generic qualityScore as human quality, or subjective judgment as quality proxies.

## No-Cost Verification

Use only local fixture or metadata-only checks unless the user explicitly approves a paid provider run.

Do not run smoke or e2e tests that can reach OpenAI, Anthropic, Gemini, Mistral, AWS, Google Cloud, ElevenLabs, MiniMax, deAPI, Deepgram, Groq, Grok, Firecrawl, or other paid providers.
