# Music Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/music/2026-05-21_09-58-58-871_music-gen`
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
| 4 | <code>elevenlabs/music_v1</code> | $0.1400 |
| 5 | <code>minimax/music-2.6</code> | $0.1600 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>elevenlabs/music_v1</code> | 10.65s |
| 2 | <code>gemini/lyria-3-clip-preview</code> | 19.52s |
| 3 | <code>gemini/lyria-3-pro-preview</code> | 22.83s |
| 4 | <code>minimax/music-2.6</code> | 108.63s |
| 5 | <code>minimax/music-2.6-free</code> | 124.15s |

### Automated Quality

Unavailable: No explicit music qualityScore was available for service providers. File size, dimensions, duration, bitrate, cost, and speed are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>elevenlabs/music_v1</code> | n/a | 10.65s | $0.1400 |
| <code>gemini/lyria-3-clip-preview</code> | n/a | 19.52s | $0.0400 |
| <code>gemini/lyria-3-pro-preview</code> | n/a | 22.83s | $0.0800 |
| <code>minimax/music-2.6</code> | n/a | 108.63s | $0.1600 |
| <code>minimax/music-2.6-free</code> | n/a | 124.15s | $0.0100 |

## Notes

- Best overall: `gemini/lyria-3-clip-preview` scored 86.10/100.
- The cheapest provider was `minimax/music-2.6-free` at 1.0000¢ ($0.0100).
- Fastest provider: `elevenlabs/music_v1` at 10.65s.
- Ranking used price-speed scoring: cost efficiency (50%) and processing speed (50%).
- Music artifact existence, file size, duration, lyrics, and audio metadata are reported as evidence only; audio/music quality is not assessed or scored.
