# TTS Setup Performance Report

This report compares setup/download preparation performance for local TTS engines.

## Setup Overview

| TTS Engine | Setup Time | Storage | Setup Notes |
|------------|-----------|---------|-------------|
| **Chatterbox** | ~72-80s | ~1.43 GB | No additional model download in setup flow |
| **CosyVoice** | ~201-225s | ~1.33 GB | Includes large model download (ModelScope/HuggingFace) |
| **FishAudio** | ~73s + model weight step | ~895 MB | Setup dependencies are quick; model assets may require auth/download |
| **Qwen3** | ~72-75s | ~1.27 GB | No extra external download in baseline setup |

## Installation Timing Details

- **Chatterbox:** ~72-80 seconds.
- **CosyVoice:** ~201-225 seconds total depending on model.
  - 300M-Instruct: ~201s.
  - 300M-SFT: ~225s.
- **FishAudio:** ~73 seconds base setup, plus model weight availability step.
- **Qwen3:** ~72-75 seconds.

## Storage Requirements

| TTS Engine | Local Size | External Downloads | Key Dependencies |
|------------|-----------|-------------------|------------------|
| Chatterbox | 1.43 GB | None in baseline setup | PyTorch, Gradio, NumPy, LLVM, Perth |
| CosyVoice | 1.33 GB | Model download required | PyTorch, ONNX Runtime, Tokenizers, PyArrow |
| FishAudio | 895 MB | ~2GB (`s1-mini`) or ~8GB (`s1`) weights | PyTorch, LLVM, SciPy |
| Qwen3 | 1.27 GB | None in baseline setup | PyTorch, ONNX Runtime, Tokenizers |

## Setup Recommendations

### Choose Qwen3 setup when:
- You want predictable setup time.
- You want local TTS without extra model download in baseline path.

### Choose Chatterbox setup when:
- You want no large external model download during setup.
- You can accept higher local footprint.

### Choose CosyVoice setup when:
- You prioritize CosyVoice capabilities and can absorb longer initial setup/download.

### Choose FishAudio setup when:
- You prefer small local dependency footprint.
- You can handle model asset/download prerequisites.

---

*Data source: benchmark runs on macOS ARM64 (Apple Silicon), January 31, 2026.*
