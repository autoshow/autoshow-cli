# TTS Performance Comparison Report

This report compares the performance characteristics of three Text-to-Speech (TTS) options: Chatterbox, FishAudio, and Qwen3.

## Overview

| TTS Engine | Setup Time | Storage | Best For |
|------------|-----------|---------|----------|
| **Chatterbox** | ~71s | ~1.4 GB | Long texts, consistent performance |
| **FishAudio** | ~64s (+37s download) | ~854 MB | Small footprint (with external models) |
| **Qwen3** | ~76s | ~1.2 GB | Short texts (when warm), high quality |

## Setup Performance

### Installation Time

- **Chatterbox**: ~71 seconds (fastest setup, no additional downloads)
- **FishAudio**: ~64 seconds base + ~38 seconds for downloading ~2GB model weights
- **Qwen3**: ~76 seconds (moderate setup time)

### Storage Requirements

| TTS Engine | Total Size | Key Dependencies |
|------------|-----------|------------------|
| Chatterbox | 1.36 GB | PyTorch, Gradio (includes web UI), NumPy |
| FishAudio | 854 MB | PyTorch, ONNX Runtime, LLVM |
| Qwen3 | 1.21 GB | PyTorch, ONNX Runtime, Tokenizers, LLVM |

**Note**: FishAudio downloads ~2GB of model weights separately during setup.

## Runtime Performance

### Short Text (107 characters, 23 words)

| TTS Engine | Processing Time | Characters/sec | Words/sec | Output Duration | Real-time Ratio |
|------------|----------------|----------------|-----------|-----------------|-----------------|
| **Chatterbox** | 84.5s | 1.27 | 0.27 | 7.92s | 0.094 |
| **FishAudio** | 409.3s | 0.26 | 0.06 | 5.71s | 0.014 |
| **Qwen3** | 38.4s - 103.8s | 1.03 - 2.79 | 0.22 - 0.60 | 8.6s - 9.2s | 0.088 - 0.224 |

### Long Text (2,097 characters, 365 words)

| TTS Engine | Processing Time | Characters/sec | Words/sec | Output Duration | Real-time Ratio |
|------------|----------------|----------------|-----------|-----------------|-----------------|
| **Chatterbox** | 84.9s | 24.69 | 4.30 | 9.6s | 0.113 |
| **Qwen3** | 426.3s | 4.92 | 0.86 | 182.4s | 0.428 |
| **FishAudio** | N/A | N/A | N/A | N/A | N/A |

## Key Findings

### Chatterbox

**Strengths:**
- Fastest setup with no external downloads
- Consistent performance across text lengths (84s for both short and long texts)
- Excellent throughput for long texts (24.7 chars/sec)
- Predictable real-time ratio (~0.1x)

**Weaknesses:**
- Largest storage footprint (1.36 GB)
- Includes unnecessary Gradio/web UI components
- Slower than Qwen3 for short texts when Qwen3 is warm

### FishAudio

**Strengths:**
- Smallest local storage footprint (854 MB)
- Uses Docker for isolation
- Model weights downloaded on-demand

**Weaknesses:**
- Extremely slow for short texts (409s) due to Docker server startup overhead
- Requires external model download (~2GB)
- Server initialization can take 5+ minutes on first run
- Lowest real-time ratio (0.014x)

### Qwen3

**Strengths:**
- Fastest for short texts when model is warm (38.4s)
- High output quality (produces longer, more natural audio)
- Good character throughput for short texts

**Weaknesses:**
- Highly variable performance (38s to 104s for same input)
- Much slower for long texts (426s, 7+ minutes)
- Warning: "flash-attn is not installed" - could be faster with optimization
- Poor scaling with text length (real-time ratio increases to 0.43x for long texts)

## Recommendations

### Choose Chatterbox when:
- You need consistent, predictable performance
- Processing longer texts regularly
- Want fastest setup without external downloads
- Storage space is not a concern

### Choose FishAudio when:
- You have limited local storage (smallest footprint)
- Running in containerized environments
- Can tolerate long initial startup times
- Using for batch processing where startup time is amortized

### Choose Qwen3 when:
- Processing short texts frequently (and can keep model warm)
- Audio quality is priority over speed
- Can install flash-attn for potential speed improvements
- You have the patience for variable performance

## Performance Summary

| Metric | Chatterbox | FishAudio | Qwen3 |
|--------|-----------|-----------|-------|
| Setup Speed | ★★★★★ | ★★★☆☆ | ★★★★☆ |
| Short Text Speed | ★★★☆☆ | ★☆☆☆☆ | ★★★★★ (warm) |
| Long Text Speed | ★★★★★ | N/A | ★★☆☆☆ |
| Consistency | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ |
| Storage Efficiency | ★★☆☆☆ | ★★★★★ | ★★★☆☆ |
| Output Quality | ★★★☆☆ | ★★★☆☆ | ★★★★★ |

---

*Report generated from benchmark data collected on macOS ARM64 (Apple Silicon)*
