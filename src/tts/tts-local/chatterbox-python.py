import sys
import json
import warnings
import os

warnings.filterwarnings("ignore")

import torch
import torchaudio as ta
import numpy as np


def get_device_and_dtype(requested_device=None, requested_dtype=None):
    if requested_device in ["cpu", "mps", "cuda"]:
        device = requested_device
    elif torch.cuda.is_available():
        device = "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"

    if requested_dtype == "float16":
        dtype = torch.float16
    elif requested_dtype == "bfloat16":
        dtype = torch.bfloat16
    else:
        dtype = torch.float32

    return device, dtype


def emit_result(payload):
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()


def log(msg):
    sys.stderr.write(str(msg) + "\n")
    sys.stderr.flush()


config = json.loads(sys.argv[1])
model_type = config.get("model", "turbo")
text = config["text"]
output = config["output"]
ref_audio = config.get("ref_audio")
requested_device = config.get("device")
requested_dtype = config.get("dtype")

try:
    device, dtype = get_device_and_dtype(requested_device, requested_dtype)
    log(f"Using device: {device}, model: {model_type}")
    torch.set_default_dtype(dtype)

    if ref_audio and not os.path.exists(ref_audio):
        raise FileNotFoundError(f"Reference audio not found: {ref_audio}")

    if model_type == "turbo":
        from chatterbox.tts_turbo import ChatterboxTurboTTS

        try:
            model = ChatterboxTurboTTS.from_pretrained(device=device)
        except Exception:
            if device == "mps":
                log("MPS load failed, falling back to CPU")
                device = "cpu"
                model = ChatterboxTurboTTS.from_pretrained(device=device)
            else:
                raise

        if ref_audio:
            wav = model.generate(text, audio_prompt_path=ref_audio)
        else:
            wav = model.generate(text)

    elif model_type == "standard":
        from chatterbox.tts import ChatterboxTTS

        try:
            model = ChatterboxTTS.from_pretrained(device=device)
        except Exception:
            if device == "mps":
                log("MPS load failed, falling back to CPU")
                device = "cpu"
                model = ChatterboxTTS.from_pretrained(device=device)
            else:
                raise

        kwargs = {"text": text}
        if ref_audio:
            kwargs["audio_prompt_path"] = ref_audio
        if "exaggeration" in config:
            kwargs["exaggeration"] = config["exaggeration"]
        if "cfg_weight" in config:
            kwargs["cfg_weight"] = config["cfg_weight"]
        wav = model.generate(**kwargs)

    else:
        raise ValueError(
            f"Invalid model type: {model_type}. Supported models: turbo, standard"
        )

    ta.save(output, wav, model.sr)
    emit_result({"ok": True, "output": output, "sample_rate": model.sr})

except Exception as e:
    import traceback

    log(traceback.format_exc())
    emit_result({"ok": False, "error": str(e)})
    sys.exit(1)
