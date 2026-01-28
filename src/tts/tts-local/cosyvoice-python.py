import sys
import json
import warnings
import os

os.environ["TRANSFORMERS_NO_FLASH_ATTN_WARNING"] = "1"
warnings.filterwarnings("ignore")

import io

_stderr = sys.stderr
sys.stderr = io.StringIO()

import torch
import torchaudio

sys.stderr = _stderr

def emit_result(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=True) + "\n")
    sys.stdout.flush()

def log(msg):
    sys.stderr.write(str(msg) + "\n")
    sys.stderr.flush()

def chunk_text(text, max_size=500):
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

def load_cosyvoice_model(cosyvoice_dir, model_name="Fun-CosyVoice3-0.5B"):

    sys.path.insert(0, cosyvoice_dir)
    sys.path.insert(0, os.path.join(cosyvoice_dir, "third_party/Matcha-TTS"))

    from cosyvoice.cli.cosyvoice import AutoModel

    model_dir = os.path.join(cosyvoice_dir, "pretrained_models", model_name)
    log(f"Loading model from: {model_dir}")

    model = AutoModel(model_dir=model_dir)
    return model

def get_default_ref_audio(cosyvoice_dir):
    default_path = os.path.join(cosyvoice_dir, "asset", "zero_shot_prompt.wav")
    if os.path.exists(default_path):
        return default_path
    return None

def inference_instruct(model, text, instruct_text, ref_audio_path, language="auto"):

    system_prompt = "You are a helpful assistant."
    if instruct_text:
        system_prompt = f"You are a helpful assistant. {instruct_text}"

    if not ref_audio_path or not os.path.exists(ref_audio_path):
        raise ValueError("Reference audio is required for CosyVoice3")

    for i, result in enumerate(
        model.inference_instruct2(text, system_prompt, ref_audio_path, stream=False)
    ):
        return result["tts_speech"], model.sample_rate

    raise ValueError("Failed to generate audio in instruct mode")

def inference_zero_shot(model, text, ref_audio_path, ref_text=None, language="auto"):
    if not ref_audio_path or not os.path.exists(ref_audio_path):
        raise ValueError("Zero-shot mode requires a reference audio file")

    prompt_text = ref_text or "You are a helpful assistant."

    for i, result in enumerate(
        model.inference_zero_shot(text, prompt_text, ref_audio_path, stream=False)
    ):
        return result["tts_speech"], model.sample_rate

    raise ValueError("Failed to generate audio in zero-shot mode")

def inference_cross_lingual(model, text, ref_audio_path, language="auto"):
    if not ref_audio_path or not os.path.exists(ref_audio_path):
        raise ValueError("Cross-lingual mode requires a reference audio file")

    for i, result in enumerate(
        model.inference_cross_lingual(text, ref_audio_path, stream=False)
    ):
        return result["tts_speech"], model.sample_rate

    raise ValueError("Failed to generate audio in cross-lingual mode")

if len(sys.argv) < 2:
    emit_result({"ok": False, "error": "No configuration provided"})
    sys.exit(1)

config = json.loads(sys.argv[1])
mode = config.get("mode", "instruct")
cosyvoice_dir = config.get("cosyvoice_dir", "build/cosyvoice")
text = config.get("text", "")
output_path = config.get("output", "output.wav")
language = config.get("language", "auto")
instruct = config.get("instruct", "")
ref_audio = config.get("ref_audio")
ref_text = config.get("ref_text")

if not ref_audio or not os.path.exists(str(ref_audio)):
    ref_audio = get_default_ref_audio(cosyvoice_dir)
    if ref_audio:
        log(f"Using default reference audio: {ref_audio}")
    else:
        log("WARNING: No reference audio found, synthesis may fail")

log(f"Mode: {mode}, Language: {language}")
log(f"CosyVoice directory: {cosyvoice_dir}")

try:

    device = "cpu"
    log(f"Using device: {device}")

    model = load_cosyvoice_model(cosyvoice_dir)

    max_chunk = 500
    sr = model.sample_rate

    if len(text) > max_chunk:
        log(f"Text too long ({len(text)} chars), processing in chunks...")
        chunks = chunk_text(text, max_chunk)
        audio_parts = []

        for i, chunk in enumerate(chunks):
            log(f"Processing chunk {i + 1}/{len(chunks)}")

            if mode == "instruct":
                audio, chunk_sr = inference_instruct(
                    model, chunk, instruct, ref_audio, language
                )
            elif mode == "zero_shot":
                audio, chunk_sr = inference_zero_shot(
                    model, chunk, ref_audio, ref_text, language
                )
            elif mode == "cross_lingual":
                audio, chunk_sr = inference_cross_lingual(
                    model, chunk, ref_audio, language
                )
            else:
                raise ValueError(f"Unknown mode: {mode}")

            sr = chunk_sr
            audio_parts.append(audio)

            silence = torch.zeros(int(0.2 * sr))
            audio_parts.append(silence)

        audio = torch.cat(audio_parts[:-1])
    else:
        if mode == "instruct":
            audio, sr = inference_instruct(model, text, instruct, ref_audio, language)
        elif mode == "zero_shot":
            audio, sr = inference_zero_shot(model, text, ref_audio, ref_text, language)
        elif mode == "cross_lingual":
            audio, sr = inference_cross_lingual(model, text, ref_audio, language)
        else:
            raise ValueError(f"Unknown mode: {mode}")

    if audio.dim() == 1:
        audio = audio.unsqueeze(0)
    torchaudio.save(output_path, audio, sr)
    log(f"Saved audio to: {output_path}")

    emit_result({"ok": True, "output": output_path, "sample_rate": sr})

except Exception as e:
    import traceback

    log(f"Error: {e}")
    log(traceback.format_exc())
    emit_result({"ok": False, "error": str(e)})
    sys.exit(1)
