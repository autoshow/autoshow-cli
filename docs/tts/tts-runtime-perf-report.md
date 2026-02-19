# TTS Runtime Performance Report

This report compares ready-runtime TTS generation speed after setup/model readiness is complete.

## Runtime Test Input

- Short text sample: **107 characters / 23 words**
- Runtime method: warm-up run followed by measured run
- Rankings below are based on measured runtime values

## Short Text Runtime Results

| TTS Engine | Processing Time | Characters/sec | Words/sec | Output Duration | Real-time Ratio |
|------------|----------------|----------------|-----------|-----------------|-----------------|
| **CosyVoice-300M-Instruct** | 26.7s | 4.0 | 0.9 | 6.54s | 0.24x |
| **Qwen3** (0.6B-CustomVoice) | 28.7s | 3.7 | 0.8 | 8.54s | 0.30x |
| **Chatterbox** (standard) | 40.1s | 2.7 | 0.6 | 5.80s | 0.14x |
| **CosyVoice-300M-SFT** | 40.4s | 2.6 | 0.6 | 9.53s | 0.24x |
| **Chatterbox** (turbo) | 90.2s | 1.2 | 0.3 | 7.68s | 0.09x |
| **FishAudio** | 531.4s* | 0.2 | 0.04 | 6.46s | 0.01x |

\*FishAudio number included container startup overhead in the measured path when cold.

## Model-Level Runtime Notes

### Qwen3

| Model | Processing Time | Characters/sec | Output Duration | Real-time Ratio |
|-------|----------------|----------------|-----------------|-----------------|
| **0.6B-CustomVoice** | 28.7s | 3.7 | 8.54s | 0.30x |
| **1.7B-CustomVoice** | 114.9s | 0.9 | 15.26s | 0.13x |

- 0.6B is better for speed.
- 1.7B is slower but produces longer output.

### Chatterbox

| Model | Processing Time | Characters/sec | Output Duration | Real-time Ratio |
|-------|----------------|----------------|-----------------|-----------------|
| **standard** | 40.1s | 2.7 | 5.80s | 0.14x |
| **turbo** | 90.2s | 1.2 | 7.68s | 0.09x |

- In these runs, `standard` was faster than `turbo`.

### CosyVoice

| Model | Processing Time | Characters/sec | Output Duration | Real-time Ratio |
|-------|----------------|----------------|-----------------|-----------------|
| **300M-Instruct** | 26.7s | 4.0 | 6.54s | 0.24x |
| **300M-SFT** | 40.4s | 2.6 | 9.53s | 0.24x |

- 300M-Instruct had the fastest measured runtime.

## Runtime Recommendations

### Choose CosyVoice runtime when:
- Speed is top priority.
- You are already set up and model-ready.

### Choose Qwen3 runtime when:
- You want speed close to CosyVoice with strong output quality.
- You want model-size tradeoff options.

### Choose Chatterbox runtime when:
- You want stable local operation and can accept slower runtime than top performers.

### Choose FishAudio runtime when:
- You can amortize startup overhead in long-running/batch scenarios.

---

*Data source: benchmark runs on macOS ARM64 (Apple Silicon), January 31, 2026.*
