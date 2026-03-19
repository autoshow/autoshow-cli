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

def load_cosyvoice_model(cosyvoice_dir, model_name="CosyVoice-300M-Instruct"):
    sys.path.insert(0, cosyvoice_dir)
    sys.path.insert(0, os.path.join(cosyvoice_dir, "third_party/Matcha-TTS"))

    model_dir = os.path.join(cosyvoice_dir, "pretrained_models", model_name)
    log(f"Loading model from: {model_dir}")

    # Check if model directory exists
    if not os.path.exists(model_dir):
        raise Exception(f"Model directory not found: {model_dir}")

    # Detect which CosyVoice class to use based on which config file exists
    from cosyvoice.cli.cosyvoice import CosyVoice, CosyVoice2, CosyVoice3

    # Check for config files in order of preference (newest to oldest)
    if os.path.exists(os.path.join(model_dir, "cosyvoice3.yaml")):
        log(f"Using CosyVoice3 class for {model_name}")
        model_class = CosyVoice3
    elif os.path.exists(os.path.join(model_dir, "cosyvoice2.yaml")):
        log(f"Using CosyVoice2 class for {model_name}")
        model_class = CosyVoice2
    elif os.path.exists(os.path.join(model_dir, "cosyvoice.yaml")):
        log(f"Using CosyVoice class for {model_name}")
        model_class = CosyVoice
    else:
        raise Exception(f"No valid config file found in {model_dir}. Expected cosyvoice.yaml, cosyvoice2.yaml, or cosyvoice3.yaml")

    try:
        model = model_class(model_dir)
        log(f"Successfully loaded {model_name}")
        return model
    except Exception as e:
        raise Exception(f"Failed to load model: {e}")

def inference_instruct(model, text, instruct_text, speaker="中文女", ref_audio=None, cosyvoice_dir="build/cosyvoice"):
    # CosyVoice (v1) supports inference_instruct with speaker ID
    # CosyVoice2/3 require inference_instruct2 with reference audio
    instruct = instruct_text or "Speak clearly and naturally."
    model_class = model.__class__.__name__

    if model_class in ['CosyVoice2', 'CosyVoice3']:
        # For CosyVoice2/3, use inference_instruct2 which requires reference audio
        if not ref_audio or not os.path.exists(ref_audio):
            # Use default reference audio from CosyVoice repository
            default_ref_audio = os.path.join(cosyvoice_dir, 'asset/zero_shot_prompt.wav')
            if os.path.exists(default_ref_audio):
                log(f"{model_class} using default reference audio: {default_ref_audio}")
                ref_audio = default_ref_audio
            else:
                raise ValueError(f"{model_class} requires reference audio for instruct mode, but no reference audio provided and default not found at {default_ref_audio}")

        # Add the special prompt marker for CosyVoice3
        if model_class == 'CosyVoice3' and '<|endofprompt|>' not in instruct:
            # Add the system prompt and marker as shown in examples
            instruct = f"You are a helpful assistant. {instruct}<|endofprompt|>"

        log(f"Using inference_instruct2 for {model_class}")
        for i, result in enumerate(
            model.inference_instruct2(text, instruct, ref_audio, stream=False)
        ):
            return result["tts_speech"], model.sample_rate
    else:
        # For CosyVoice v1, use standard inference_instruct
        log(f"Using inference_instruct for {model_class}")
        for i, result in enumerate(
            model.inference_instruct(text, speaker, instruct, stream=False)
        ):
            return result["tts_speech"], model.sample_rate

    raise ValueError("Failed to generate audio in instruct mode")

def inference_zero_shot(model, text, ref_audio_path, ref_text=None):
    if not ref_audio_path or not os.path.exists(ref_audio_path):
        raise ValueError("Zero-shot mode requires a reference audio file")

    prompt_text = ref_text or "这是一段示例音频。"

    for i, result in enumerate(
        model.inference_zero_shot(text, prompt_text, ref_audio_path, stream=False)
    ):
        return result["tts_speech"], model.sample_rate

    raise ValueError("Failed to generate audio in zero-shot mode")

def inference_cross_lingual(model, text, ref_audio_path):
    if not ref_audio_path or not os.path.exists(ref_audio_path):
        raise ValueError("Cross-lingual mode requires a reference audio file")

    for i, result in enumerate(
        model.inference_cross_lingual(text, ref_audio_path, stream=False)
    ):
        return result["tts_speech"], model.sample_rate

    raise ValueError("Failed to generate audio in cross-lingual mode")

def inference_sft(model, text, speaker="中文女"):
    # SFT mode uses predefined speakers (CosyVoice-300M-SFT)
    for i, result in enumerate(
        model.inference_sft(text, speaker, stream=False)
    ):
        return result["tts_speech"], model.sample_rate

    raise ValueError("Failed to generate audio in SFT mode")

if len(sys.argv) < 2:
    emit_result({"ok": False, "error": "No configuration provided"})
    sys.exit(1)

config = json.loads(sys.argv[1])
mode = config.get("mode", "instruct")
cosyvoice_dir = config.get("cosyvoice_dir", "build/cosyvoice")
model_name = config.get("model_name", "CosyVoice-300M-Instruct")
text = config.get("text", "")
output_path = config.get("output", "output.wav")
instruct = config.get("instruct", "")
speaker = config.get("speaker", "中文女")
ref_audio = config.get("ref_audio")
ref_text = config.get("ref_text")

log(f"Mode: {mode}, Model: {model_name}")
log(f"CosyVoice directory: {cosyvoice_dir}")

try:
    device = "cpu"
    log(f"Using device: {device}")

    model = load_cosyvoice_model(cosyvoice_dir, model_name)

    max_chunk = 500
    sr = model.sample_rate

    if len(text) > max_chunk:
        log(f"Text too long ({len(text)} chars), processing in chunks...")
        chunks = chunk_text(text, max_chunk)
        audio_parts = []

        for i, chunk in enumerate(chunks):
            log(f"Processing chunk {i + 1}/{len(chunks)}")

            if mode == "instruct":
                audio, chunk_sr = inference_instruct(model, chunk, instruct, speaker, ref_audio, cosyvoice_dir)
            elif mode == "zero_shot":
                audio, chunk_sr = inference_zero_shot(model, chunk, ref_audio, ref_text)
            elif mode == "cross_lingual":
                audio, chunk_sr = inference_cross_lingual(model, chunk, ref_audio)
            elif mode == "sft":
                audio, chunk_sr = inference_sft(model, chunk, speaker)
            else:
                raise ValueError(f"Unknown mode: {mode}")

            sr = chunk_sr
            audio_parts.append(audio)

            silence = torch.zeros(int(0.2 * sr))
            audio_parts.append(silence)

        audio = torch.cat(audio_parts[:-1])
    else:
        if mode == "instruct":
            audio, sr = inference_instruct(model, text, instruct, speaker, ref_audio, cosyvoice_dir)
        elif mode == "zero_shot":
            audio, sr = inference_zero_shot(model, text, ref_audio, ref_text)
        elif mode == "cross_lingual":
            audio, sr = inference_cross_lingual(model, text, ref_audio)
        elif mode == "sft":
            audio, sr = inference_sft(model, text, speaker)
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
