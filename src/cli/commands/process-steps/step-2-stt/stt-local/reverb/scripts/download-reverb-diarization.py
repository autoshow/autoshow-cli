import sys
import os

if len(sys.argv) != 3:
    print("Usage: download-reverb-diarization.py <model_name> <hf_token>", file=sys.stderr)
    sys.exit(1)

model_name = sys.argv[1]
hf_token = sys.argv[2]

try:
    print(f"Attempting to load model: {model_name}", file=sys.stderr)
    from pyannote.audio import Pipeline
    print(f"pyannote.audio imported successfully", file=sys.stderr)
    pipeline = Pipeline.from_pretrained(model_name, token=hf_token)
    print(f"Model {model_name} loaded successfully", file=sys.stderr)
    sys.exit(0)
except ImportError as e:
    print(f"Import error: {e}", file=sys.stderr)
    print("pyannote.audio is not installed or dependencies are missing", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"Failed to download/load model {model_name}: {e}", file=sys.stderr)
    sys.exit(1)