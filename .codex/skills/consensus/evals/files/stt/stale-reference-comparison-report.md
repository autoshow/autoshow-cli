# Consensus Transcript Comparison Report

## Summary

- Reference transcript: `consensus-transcription.txt`
- Compared providers:
  - `assembly`
  - `deepgram`
  - `google`
  - `whisper`
- Ranking metric: strict speaker-aware word error rate (WER)

## Ranking

| Rank | Provider | Score / 100 | Speaker-aware WER | Text-only WER |
| --- | --- | ---: | ---: | ---: |
| 1 | `deepgram` | 92.50 | 7.50% | 5.20% |
| 2 | `assembly` | 90.10 | 9.90% | 7.30% |
| 3 | `google` | 85.40 | 14.60% | 11.80% |
| 4 | `whisper` | 82.30 | 17.70% | 14.50% |

## Notes

- `google` provider was the cheapest at $0.01.
- This report was generated from a previous run and may contain stale data.
