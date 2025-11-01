import sys

missing = []
mods = ["torch", "coremltools", "numpy", "transformers", "sentencepiece", "huggingface_hub", "ane_transformers", "safetensors", "whisper"]

for m in mods:
    try:
        __import__(m)
    except Exception as e:
        missing.append(f"{m}:{e}")

if missing:
    raise SystemExit("Missing modules: " + ", ".join(missing))

print("CoreML environment validation successful")