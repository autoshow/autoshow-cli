# Music Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/output/2026-05-19_06-34-51-478_music-gen`
- Total providers: 5 (0 local, 5 service)
- Local and service providers are intentionally not ranked against each other.
- Reports expose separate fastest, cheapest, and highest-quality surfaces for each group.

## Method

- Fastest rankings use processing time when present.
- Cheapest local rankings use zero monetary cost and compare only local providers.
- Cheapest service rankings use reported monetary cost when present.
- Highest-quality rankings use only explicit quality evidence for the category.

## Local Providers

### Top 3 Fastest

Unavailable: No local providers were found.

### Top 3 Cheapest

Unavailable: No local providers were found.

### Top 3 Highest Quality

Unavailable: No local providers were found.

### Provider Detail

No local providers were found.

## Service Providers

### Top 3 Fastest

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `deapi/AceStep_1_5_Turbo` | 11.37s |
| 2 | `elevenlabs/music_v1` | 13.27s |
| 3 | `gemini/lyria-3-pro-preview` | 17.03s |

### Top 3 Cheapest

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `deapi/AceStep_1_5_Turbo` | $0.0009 |
| 2 | `gemini/lyria-3-pro-preview` | $0.0800 |
| 3 | `minimax/music-2.5` | $0.1600 |

### Top 3 Highest Quality

Unavailable: No explicit music quality metric was available for service providers. File size, dimensions, duration, bitrate, and subjective judgment are not used as quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| `deapi/AceStep_1_5_Turbo` | n/a | 11.37s | $0.0009 |
| `elevenlabs/music_v1` | n/a | 13.27s | $0.2800 |
| `gemini/lyria-3-pro-preview` | n/a | 17.03s | $0.0800 |
| `minimax/music-2.5` | n/a | 164.26s | $0.1600 |
| `minimax/music-2.6` | n/a | 97.49s | $0.1600 |

## Notes

- Best overall: `deapi/AceStep_1_5_Turbo` scored 100.00/100.
- The cheapest provider was `deapi/AceStep_1_5_Turbo` at 0.0868¢ ($0.0009).
- Fastest provider: `deapi/AceStep_1_5_Turbo` at 11.37s.
- Ranking used price-speed scoring: cost efficiency (50%) and processing speed (50%).
- Music artifact existence, file size, duration, lyrics, and audio metadata are reported as evidence only; audio/music quality is not assessed or scored.
