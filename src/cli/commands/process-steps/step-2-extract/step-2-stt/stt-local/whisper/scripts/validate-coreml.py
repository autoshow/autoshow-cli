#!/usr/bin/env python3
import sys
try:
    import torch
    import coremltools
    import numpy
    import sentencepiece
    import huggingface_hub
    import ane_transformers
    import safetensors
    import whisper
    print("CoreML conversion environment OK")
except ImportError as e:
    print(f"Import failed: {e}")
    sys.exit(1)
