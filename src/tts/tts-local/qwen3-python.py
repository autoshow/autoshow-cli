import sys
import json
import warnings
import os

os.environ["TRANSFORMERS_NO_FLASH_ATTN_WARNING"] = "1"
os.environ["QWEN_TTS_NO_FLASH_ATTN_WARNING"] = "1"
warnings.filterwarnings("ignore")
warnings.filterwarnings("ignore", message=".*flash-attn.*")

import io

_stderr = sys.stderr
sys.stderr = io.StringIO()

import torch
import soundfile as sf
import numpy as np
from qwen_tts import Qwen3TTSModel

sys.stderr = _stderr

MAX_CHUNK_SIZE = 500

def chunk_text(text, max_size=MAX_CHUNK_SIZE):
    import re

    sentences = re.split(r"(?<=[.!?])\s+", text)
    sentences = [s.strip() for s in sentences if s.strip()]

    chunks = []
    current_chunk = ""

    for sentence in sentences:
        if len(sentence) > max_size:

            words = sentence.split()
            temp_chunk = ""
            for word in words:
                if len(temp_chunk) + len(word) + 1 <= max_size:
                    temp_chunk = temp_chunk + " " + word if temp_chunk else word
                else:
                    if temp_chunk:

                        if not temp_chunk[-1] in ".!?":
                            temp_chunk += "."
                        chunks.append(temp_chunk)
                    temp_chunk = word
            if temp_chunk:
                if not temp_chunk[-1] in ".!?":
                    temp_chunk += "."
                chunks.append(temp_chunk)
        elif len(current_chunk) + len(sentence) + 1 <= max_size:
            current_chunk = (
                current_chunk + " " + sentence if current_chunk else sentence
            )
        else:
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = sentence

    if current_chunk:
        chunks.append(current_chunk)

    return chunks if chunks else [text]

def get_device_and_dtype():
    if torch.cuda.is_available():
        return "cuda:0", torch.bfloat16, "flash_attention_2"

    else:
        return "cpu", torch.float32, "sdpa"

def generate_custom_voice(model, config):
    text = config["text"]
    speaker = config.get("speaker", "Vivian")
    language = config.get("language", "Auto")
    instruct = config.get("instruct", "")

    kwargs = {
        "text": text,
        "language": language,
        "speaker": speaker,
    }
    if instruct:
        kwargs["instruct"] = instruct

    wavs, sr = model.generate_custom_voice(**kwargs)
    return wavs[0], sr

def generate_voice_design(model, config):
    text = config["text"]
    language = config.get("language", "Auto")
    instruct = config.get("instruct", "")

    if not instruct:
        raise ValueError("Voice design mode requires --qwen3-instruct")

    wavs, sr = model.generate_voice_design(
        text=text, language=language, instruct=instruct
    )
    return wavs[0], sr

def generate_voice_clone(model, config):
    text = config["text"]
    language = config.get("language", "English")
    ref_audio = config.get("ref_audio")
    ref_text = config.get("ref_text")

    if not ref_audio:
        raise ValueError("Voice clone mode requires --ref-audio")

    kwargs = {
        "text": text,
        "language": language,
        "ref_audio": ref_audio,
    }
    if ref_text:
        kwargs["ref_text"] = ref_text

    wavs, sr = model.generate_voice_clone(**kwargs)
    return wavs[0], sr

def emit_result(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=True) + "\n")
    sys.stdout.flush()

def log(msg):
    sys.stderr.write(str(msg) + "\n")
    sys.stderr.flush()

if len(sys.argv) < 2:
    emit_result({"ok": False, "error": "No configuration provided"})
    sys.exit(1)

config = json.loads(sys.argv[1])
mode = config.get("mode", "custom")
model_name = config.get("model", "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice")
max_chunk = config.get("max_chunk", MAX_CHUNK_SIZE)

log(f"Mode: {mode}, Model: {model_name}")

sr = 24000

try:
    device, dtype, attn_impl = get_device_and_dtype()
    log(f"Using device: {device}, dtype: {dtype}")

    load_kwargs = {
        "device_map": device,
        "torch_dtype": dtype,
    }
    if device != "cpu":
        load_kwargs["attn_implementation"] = attn_impl

    model = Qwen3TTSModel.from_pretrained(model_name, **load_kwargs)

    text = config["text"]
    if len(text) > max_chunk:
        log(f"Text too long ({len(text)} chars), processing in chunks...")
        chunks = chunk_text(text, max_chunk)
        audio_parts = []

        for i, chunk in enumerate(chunks):
            log(f"Processing chunk {i + 1}/{len(chunks)}")
            chunk_config = {**config, "text": chunk}

            if mode == "custom":
                audio, sr = generate_custom_voice(model, chunk_config)
            elif mode == "design":
                audio, sr = generate_voice_design(model, chunk_config)
            elif mode == "clone":
                audio, sr = generate_voice_clone(model, chunk_config)
            else:
                raise ValueError(f"Unknown mode: {mode}")

            audio_parts.append(audio)

            silence = np.zeros(int(0.2 * sr), dtype=audio.dtype)
            audio_parts.append(silence)

        audio = np.concatenate(audio_parts[:-1])
    else:
        if mode == "custom":
            audio, sr = generate_custom_voice(model, config)
        elif mode == "design":
            audio, sr = generate_voice_design(model, config)
        elif mode == "clone":
            audio, sr = generate_voice_clone(model, config)
        else:
            raise ValueError(f"Unknown mode: {mode}")

    speed = config.get("speed", 1.0)
    if speed != 1.0:
        indices = np.round(np.arange(0, len(audio), speed)).astype(int)
        indices = indices[indices < len(audio)]
        audio = audio[indices]
        log(f"Applied speed adjustment: {speed}x")

    sf.write(config["output"], audio, sr)
    emit_result({"ok": True, "output": config["output"], "sample_rate": sr})

except Exception as e:
    import traceback

    log(f"Error: {e}")
    log(traceback.format_exc())
    emit_result({"ok": False, "error": str(e)})
    sys.exit(1)
