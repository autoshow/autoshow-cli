#!/usr/bin/env python3
import sys
try:
    import torch
    import torchaudio
    import numpy
    import omegaconf
    import sentencepiece
    import soundfile
    import librosa
    import scipy
    import wenet
    import pyannote.audio
    import pyannote.core
    import pyannote.pipeline
    print("Reverb environment OK")
except ImportError as e:
    print(f"Import failed: {e}")
    sys.exit(1)