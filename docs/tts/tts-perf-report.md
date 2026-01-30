# TTS Performance Comparison Report

This report compares the performance characteristics of four Text-to-Speech (TTS) options: Chatterbox, CosyVoice, FishAudio, and Qwen3.

## Overview

| TTS Engine | Setup Time | Storage | Best For |
|------------|-----------|---------|----------|
| **Chatterbox** | ~87s | ~1.33 GB | Consistent performance, no external downloads |
| **CosyVoice** | ~206s (incl. model download) | ~1.33 GB | Fast generation, good quality |
| **FishAudio** | ~65s (+38s model download) | ~854 MB | Small local footprint |
| **Qwen3** | ~81s | ~1.18 GB | High quality output, longer audio |

## Setup Performance

### Installation Time

- **Chatterbox**: ~87 seconds (no additional downloads required)
- **CosyVoice**: ~206 seconds total (~19s setup + ~165s model download from ModelScope)
- **FishAudio**: ~65 seconds base + ~38 seconds for downloading ~2GB model weights
- **Qwen3**: ~81 seconds (no additional downloads)

### Storage Requirements

| TTS Engine | Local Size | External Downloads | Key Dependencies |
|------------|-----------|-------------------|------------------|
| Chatterbox | 1.33 GB | None | PyTorch, Gradio, NumPy, LLVM |
| CosyVoice | 1.33 GB | ~300M model | PyTorch, ONNX Runtime, Tokenizers |
| FishAudio | 854 MB | ~2GB weights | PyTorch, LLVM, SciPy |
| Qwen3 | 1.18 GB | None | PyTorch, ONNX Runtime, Tokenizers |

## Runtime Performance

### Short Text (107 characters, 23 words)

| TTS Engine | Processing Time | Characters/sec | Words/sec | Output Duration | Real-time Ratio |
|------------|----------------|----------------|-----------|-----------------|-----------------|
| **CosyVoice** | 27.0s | 4.0 | 0.9 | 6.54s | 0.24x |
| **Qwen3** | 56.2s | 1.9 | 0.4 | 11.26s | 0.20x |
| **Chatterbox** | 87.0s | 1.2 | 0.3 | 8.04s | 0.09x |
| **FishAudio** | 320.6s | 0.3 | 0.1 | 5.39s | 0.02x |

## Key Findings

### CosyVoice

**Strengths:**
- Fastest processing time for short texts (27s)
- Best characters/second throughput (4.0 chars/sec)
- Good real-time ratio (0.24x)
- High quality output from Alibaba's CosyVoice-300M-Instruct model

**Weaknesses:**
- Longest total setup time due to model download (~206s)
- Requires downloading model from ModelScope
- Produces shorter audio output compared to Qwen3

### Chatterbox

**Strengths:**
- No external downloads required
- Consistent, predictable performance
- Good audio duration output (8.04s)

**Weaknesses:**
- Largest storage footprint (1.33 GB)
- Includes unnecessary Gradio/web UI components
- Slower than CosyVoice and Qwen3 for short texts

### FishAudio

**Strengths:**
- Smallest local storage footprint (854 MB)
- Lightweight dependencies

**Weaknesses:**
- Extremely slow processing (320.6s for short text)
- Requires external model download (~2GB)
- Lowest real-time ratio (0.02x)
- Produces shortest audio output (5.39s)

### Qwen3

**Strengths:**
- Good balance of speed and quality
- Produces longest, most natural audio (11.26s)
- Smallest local footprint among full-featured options (1.18 GB)
- No external downloads required

**Weaknesses:**
- Warning: "flash-attn is not installed" - could be faster with optimization
- Moderate processing time (56.2s)

## Recommendations

### Choose CosyVoice when:
- Processing speed is the priority
- You can wait for initial model download
- You want good quality with fast generation

### Choose Chatterbox when:
- You want no external downloads
- Consistent, predictable performance is important
- Storage space is not a concern

### Choose FishAudio when:
- You have very limited local storage
- Processing speed is not important
- Using for batch processing where startup time is amortized

### Choose Qwen3 when:
- Audio quality and naturalness is priority
- You want longer audio output
- Can install flash-attn for potential speed improvements
- Storage efficiency matters

## Performance Summary

| Metric | CosyVoice | Qwen3 | Chatterbox | FishAudio |
|--------|-----------|-------|------------|-----------|
| Setup Speed | ★★☆☆☆ | ★★★★☆ | ★★★★☆ | ★★★☆☆ |
| Short Text Speed | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★☆☆☆☆ |
| Consistency | ★★★★☆ | ★★★☆☆ | ★★★★★ | ★★☆☆☆ |
| Storage Efficiency | ★★★☆☆ | ★★★★☆ | ★★☆☆☆ | ★★★★★ |
| Output Quality | ★★★★☆ | ★★★★★ | ★★★☆☆ | ★★★☆☆ |

---

*Report generated from benchmark data collected on macOS ARM64 (Apple Silicon) on January 28, 2026*
