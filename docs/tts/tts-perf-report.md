# TTS Performance Comparison Report

This report compares the performance characteristics of four Text-to-Speech (TTS) options: Chatterbox, CosyVoice, FishAudio, and Qwen3.

## Overview

| TTS Engine | Setup Time | Storage | Best For |
|------------|-----------|---------|----------|
| **Chatterbox** | ~72-80s | ~1.43 GB | Two speed options (standard/turbo), no external downloads |
| **CosyVoice** | ~225s (incl. 180s model download) | ~1.33 GB | Multiple models: Instruct (fastest), SFT (predefined voices), base (voice cloning) |
| **FishAudio** | ~73s (+40s model download) | ~895 MB | Small local footprint |
| **Qwen3** | ~72-75s | ~1.27 GB | High quality output, multiple model variants |

## Setup Performance

### Installation Time

- **Chatterbox**: ~72-80 seconds (no additional downloads required)
- **CosyVoice**: ~225 seconds total (~45s setup + ~180s model download from ModelScope)
  - CosyVoice-300M-Instruct: ~201s (~41s setup + ~160s download)
  - CosyVoice-300M-SFT: ~225s (~45s setup + ~180s download)
- **FishAudio**: ~73 seconds base + ~40 seconds for downloading ~2GB model weights
- **Qwen3**: ~72-75 seconds (no additional downloads)

### Storage Requirements

| TTS Engine | Local Size | External Downloads | Key Dependencies |
|------------|-----------|-------------------|------------------|
| Chatterbox | 1.43 GB | None | PyTorch, Gradio, NumPy, LLVM, Perth |
| CosyVoice | 1.33 GB | Model from ModelScope | PyTorch, ONNX Runtime, Tokenizers, PyArrow |
| FishAudio | 895 MB | ~2GB weights | PyTorch, LLVM, SciPy |
| Qwen3 | 1.27 GB | None | PyTorch, ONNX Runtime, Tokenizers |

## Runtime Performance

### Short Text (107 characters, 23 words)

| TTS Engine | Processing Time | Characters/sec | Words/sec | Output Duration | Real-time Ratio |
|------------|----------------|----------------|-----------|-----------------|-----------------|
| **CosyVoice-300M-Instruct** | 26.7s | 4.0 | 0.9 | 6.54s | 0.24x |
| **Qwen3** (0.6B-CustomVoice) | 28.7s | 3.7 | 0.8 | 8.54s | 0.30x |
| **Chatterbox** (standard) | 40.1s | 2.7 | 0.6 | 5.80s | 0.14x |
| **CosyVoice-300M-SFT** | 40.4s | 2.6 | 0.6 | 9.53s | 0.24x |
| **Chatterbox** (turbo) | 90.2s | 1.2 | 0.3 | 7.68s | 0.09x |
| **FishAudio** | 531.4s* | 0.2 | 0.04 | 6.46s | 0.01x |

*FishAudio processing time includes Docker container startup (~90s on first run)

### Chatterbox Model Comparison

| Model | Processing Time | Characters/sec | Words/sec | Output Duration | Real-time Ratio |
|-------|----------------|----------------|-----------|-----------------|-----------------|
| **standard** | 40.1s | 2.7 | 0.6 | 5.80s | 0.14x |
| **turbo** | 90.2s | 1.2 | 0.3 | 7.68s | 0.09x |

**Note:** The "standard" model is faster (40.1s) with shorter audio output (5.80s), while "turbo" is slower (90.2s) but produces longer audio (7.68s). The naming appears counterintuitive.

### Qwen3 Model Comparison

All tests use CustomVoice variants with speaker "Vivian" in custom mode:

| Model | Processing Time | Characters/sec | Words/sec | Output Duration | Real-time Ratio |
|-------|----------------|----------------|-----------|-----------------|-----------------|
| **0.6B-CustomVoice** | 28.7s | 3.7 | 0.8 | 8.54s | 0.30x |
| **1.7B-CustomVoice** | 114.9s | 0.9 | 0.2 | 15.26s | 0.13x |

**Note:** The 1.7B model produces significantly longer audio output (15.26s vs 8.54s) but takes 4x longer to generate.

### CosyVoice Model Comparison

All CosyVoice v1.0 models work on CPU without requiring reference audio:

| Model | Processing Time | Characters/sec | Words/sec | Output Duration | Real-time Ratio | Use Case |
|-------|----------------|----------------|-----------|-----------------|-----------------|----------|
| **300M-Instruct** | 26.7s | 4.0 | 0.9 | 6.54s | 0.24x | Natural language instructions |
| **300M-SFT** | 40.4s | 2.6 | 0.6 | 9.53s | 0.24x | Predefined speaker voices |

**Note:** The 300M-Instruct model is fastest (26.7s) but produces shorter audio (6.54s), while 300M-SFT is slower (40.4s) but generates longer output (9.53s) with predefined voice quality.

## Key Findings

### CosyVoice

**Strengths:**
- Fastest processing time for short texts (26.7s with CosyVoice-300M-Instruct)
- Best characters/second throughput (4.0 chars/sec)
- Good real-time ratio (0.24x for both Instruct and SFT models)
- Multiple model options: Instruct (fastest, instruction-controlled), SFT (predefined voices), Base (voice cloning with ref audio)
- High quality output from Alibaba's open-source models

**Weaknesses:**
- Longest total setup time due to model download (~201-225s depending on model)
- Requires downloading models from ModelScope
- Instruct model produces shorter audio output (6.54s) compared to SFT (9.53s) and Qwen3 1.7B models
- CosyVoice2/3 models have CPU compatibility issues (BFloat16 dtype mismatches)

### Chatterbox

**Strengths:**
- No external downloads required
- Two model options: "standard" (faster, 40.1s) and "turbo" (slower, 90.2s)
- Standard model offers good balance between speed and quality
- Includes Perth voice processing

**Weaknesses:**
- Largest storage footprint (1.43 GB)
- Includes unnecessary Gradio/web UI components
- Turbo model is counterintuitively slower than standard
- Slower than CosyVoice and Qwen3 0.6B for short texts

### FishAudio

**Strengths:**
- Smallest local storage footprint (895 MB)
- Lightweight dependencies

**Weaknesses:**
- Extremely slow processing (531s for short text, includes Docker startup)
- Requires external model download (~2GB)
- Lowest real-time ratio (0.01x)
- Docker-based architecture adds complexity and startup overhead
- Failed on longer text (2097 chars) after multiple retries

### Qwen3

**Strengths:**
- 0.6B-CustomVoice matches CosyVoice speed (28.7s) with good audio quality
- 1.7B-CustomVoice produces longest, most natural audio (15.26s)
- Multiple model sizes available (0.6B and 1.7B with Base, CustomVoice, and VoiceDesign variants)
- No external downloads required
- CustomVoice models support voice cloning with speaker selection

**Weaknesses:**
- Warning: "flash-attn is not installed" - could be faster with optimization
- 1.7B model significantly slower (114.9s) but produces longer audio
- Storage footprint (1.27 GB) larger than FishAudio
- Base and VoiceDesign models require proper mode configuration (not compatible with custom mode)

## Recommendations

### Choose CosyVoice when:
- Processing speed is the priority (300M-Instruct is fastest at 26.7s)
- You can wait for initial model download
- You want good quality with fast generation
- You need instruction-based control (300M-Instruct) or predefined voices (300M-SFT)
- Note: Avoid CosyVoice2/3 models on CPU due to compatibility issues

### Choose Chatterbox when:
- You want no external downloads
- You prefer the standard model's balanced performance (40.1s)
- Storage space is not a concern
- You need Perth voice processing capabilities

### Choose FishAudio when:
- You have very limited local storage
- Processing speed is not important
- Using for batch processing where startup time is amortized

### Choose Qwen3 when:
- You want competitive speed with CosyVoice (0.6B-CustomVoice: 28.7s)
- Audio quality and naturalness is priority
- You want longer audio output (1.7B models produce ~15s audio vs 0.6B's ~8.5s)
- You need voice cloning/speaker selection (CustomVoice models)
- Can install flash-attn for potential speed improvements
- You need multiple model size options (0.6B for speed, 1.7B for quality and longer output)

## Performance Summary

| Metric | CosyVoice | Qwen3 | Chatterbox | FishAudio |
|--------|-----------|-------|------------|-----------|
| Setup Speed | ★★☆☆☆ | ★★★★☆ | ★★★★☆ | ★★★☆☆ |
| Short Text Speed | ★★★★★ | ★★★★★ | ★★★★☆ | ★☆☆☆☆ |
| Consistency | ★★★★☆ | ★★★★☆ | ★★★★★ | ★★☆☆☆ |
| Storage Efficiency | ★★☆☆☆ | ★★★☆☆ | ★★☆☆☆ | ★★★★★ |
| Output Quality | ★★★★☆ | ★★★★★ | ★★★☆☆ | ★★★☆☆ |

**Notes:**
- Qwen3 ratings reflect the 0.6B-CustomVoice model performance. The 1.7B-CustomVoice model trades speed (★★☆☆☆) for even longer, higher quality output.
- Chatterbox ratings reflect the "standard" model performance (40.1s). The "turbo" model is slower (★★☆☆☆).

---

*Report generated from benchmark data collected on macOS ARM64 (Apple Silicon). Last updated January 31, 2026.*
