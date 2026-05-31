# Music Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/music/2026-05-21_09-58-34-695_music-gen`
- Total providers: 5 (0 local, 5 service)
- Local and service providers are intentionally not ranked against each other.
- Reports expose complete price, speed, automated-quality, and human-quality rankings for each group.

## Method

- Price rankings use zero monetary cost for local providers and reported monetary cost for services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Automated quality rankings use only explicit qualityScore evidence.
- Human quality rankings use only explicit humanQualityScore evidence.
- File size, dimensions, duration, bitrate, cost, and speed are not used as quality proxies.

## Local Providers

### Price

Unavailable: No local providers were found.

### Speed

Unavailable: No local providers were found.

### Automated Quality

Unavailable: No local providers were found.

### Human Quality

Unavailable: No local providers were found.

### Provider Detail

No local providers were found.

## Service Providers

### Price

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>minimax/music-2.6-free</code> | $0.0100 |
| 2 | <code>gemini/lyria-3-clip-preview</code> | $0.0400 |
| 3 | <code>gemini/lyria-3-pro-preview</code> | $0.0800 |
| 4 | <code>minimax/music-2.6</code> | $0.1600 |
| 5 | <code>elevenlabs/music_v1</code> | $0.5600 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>gemini/lyria-3-clip-preview</code> | 20.46s |
| 2 | <code>elevenlabs/music_v1</code> | 23.02s |
| 3 | <code>gemini/lyria-3-pro-preview</code> | 46.40s |
| 4 | <code>minimax/music-2.6-free</code> | 99.56s |
| 5 | <code>minimax/music-2.6</code> | 105.29s |

### Automated Quality

Unavailable: No explicit music qualityScore was available for service providers. File size, dimensions, duration, bitrate, cost, and speed are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>elevenlabs/music_v1</code> | n/a | 23.02s | $0.5600 |
| <code>gemini/lyria-3-clip-preview</code> | n/a | 20.46s | $0.0400 |
| <code>gemini/lyria-3-pro-preview</code> | n/a | 46.40s | $0.0800 |
| <code>minimax/music-2.6</code> | n/a | 105.29s | $0.1600 |
| <code>minimax/music-2.6-free</code> | n/a | 99.56s | $0.0100 |

## Notes

- Music artifact existence, file size, duration, lyrics, and audio metadata are reported as evidence only; audio/music quality is not assessed or scored.
