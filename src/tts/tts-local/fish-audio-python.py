import sys
import json
import warnings
import os
import subprocess
import tempfile

warnings.filterwarnings("ignore")


def emit_result(payload):
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()


def log(msg):
    sys.stderr.write(str(msg) + "\n")
    sys.stderr.flush()


def synthesize_via_api(config):
    import requests

    api_url = config.get("api_url", "http://localhost:8080")
    text = config["text"]
    output = config["output"]
    ref_audio = config.get("ref_audio")
    ref_text = config.get("ref_text")

    log(f"Using API server at {api_url}")

    timeout = 600

    if ref_audio and os.path.exists(ref_audio):
        with open(ref_audio, "rb") as f:
            files = {"audio": ("reference.wav", f, "audio/wav")}
            data = {"text": text, "format": "wav"}
            if ref_text:
                data["reference_text"] = ref_text

            response = requests.post(
                f"{api_url}/v1/tts", files=files, data=data, timeout=timeout
            )
    else:
        payload = {"text": text, "format": "wav"}
        response = requests.post(
            f"{api_url}/v1/tts",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=timeout,
        )

    response.raise_for_status()

    with open(output, "wb") as f:
        f.write(response.content)

    return {"ok": True, "output": output, "method": "api"}


def synthesize_via_cli(config):
    import torch

    checkpoint_path = config.get(
        "checkpoint_path", "build/checkpoints/openaudio-s1-mini"
    )
    text = config["text"]
    output = config["output"]
    ref_audio = config.get("ref_audio")
    ref_text = config.get("ref_text")
    compile_flag = config.get("compile", False)
    device = config.get("device")

    fish_speech_inference = os.path.join(
        os.getcwd(), "fish_speech/models/text2semantic/inference.py"
    )
    if not os.path.exists(fish_speech_inference):
        raise RuntimeError(
            "CLI fallback requires the fish-speech repository. "
            "Please start the FishAudio API server instead:\n"
            "  docker run -d --gpus all -p 8080:8080 -v ./checkpoints:/app/checkpoints fishaudio/fish-speech:server-cuda\n"
            "Or for CPU: docker run -d -p 8080:8080 -v ./checkpoints:/app/checkpoints fishaudio/fish-speech:server-cpu"
        )
    if not os.path.exists(fish_speech_inference):
        raise RuntimeError(
            "CLI fallback requires the fish-speech repository. "
            "Please start the FishAudio API server instead:\n"
            "  docker run -d --gpus all -p 8080:8080 -v ./checkpoints:/app/checkpoints fishaudio/fish-speech:latest-server-cuda\n"
            "Or clone fish-speech: git clone https://github.com/fishaudio/fish-speech.git"
        )

    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(
            f"Checkpoint not found: {checkpoint_path}. "
            f"Run: hf download fishaudio/openaudio-s1-mini --local-dir {checkpoint_path}"
        )

    if device:
        pass
    elif torch.cuda.is_available():
        device = "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"

    log(f"Using device: {device}, checkpoint: {checkpoint_path}")

    with tempfile.TemporaryDirectory() as tmpdir:
        prompt_tokens = None
        if ref_audio and os.path.exists(ref_audio):
            log("Extracting reference audio tokens...")
            codec_cmd = [
                sys.executable,
                "fish_speech/models/dac/inference.py",
                "-i",
                ref_audio,
                "--checkpoint-path",
                f"{checkpoint_path}/codec.pth",
                "--output-dir",
                tmpdir,
            ]
            result = subprocess.run(codec_cmd, capture_output=True, text=True)
            if result.returncode != 0:
                log(f"Codec extraction failed: {result.stderr}")
            else:
                prompt_tokens = os.path.join(tmpdir, "fake.npy")
                if not os.path.exists(prompt_tokens):
                    prompt_tokens = None

        log("Generating semantic tokens...")
        semantic_cmd = [
            sys.executable,
            "fish_speech/models/text2semantic/inference.py",
            "--text",
            text,
            "--checkpoint-path",
            checkpoint_path,
            "--output-dir",
            tmpdir,
        ]

        if prompt_tokens:
            semantic_cmd.extend(["--prompt-tokens", prompt_tokens])
            if ref_text:
                semantic_cmd.extend(["--prompt-text", ref_text])

        if compile_flag and device == "cuda":
            semantic_cmd.append("--compile")

        result = subprocess.run(semantic_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Semantic generation failed: {result.stderr}")

        codes_file = None
        for f in os.listdir(tmpdir):
            if f.startswith("codes_") and f.endswith(".npy"):
                codes_file = os.path.join(tmpdir, f)
                break

        if not codes_file:
            raise RuntimeError("No codes file generated")

        log("Generating audio...")
        audio_cmd = [
            sys.executable,
            "fish_speech/models/dac/inference.py",
            "-i",
            codes_file,
            "--checkpoint-path",
            f"{checkpoint_path}/codec.pth",
            "-o",
            output,
        ]

        result = subprocess.run(audio_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Audio generation failed: {result.stderr}")

    return {"ok": True, "output": output, "method": "cli", "device": device}


if len(sys.argv) < 2:
    emit_result({"ok": False, "error": "No configuration provided"})
    sys.exit(1)

config = json.loads(sys.argv[1])
use_api = config.get("use_api", True)

try:
    if use_api:
        try:
            result = synthesize_via_api(config)
            emit_result(result)
        except Exception as api_error:
            log(f"API failed ({api_error}), falling back to CLI inference...")
            result = synthesize_via_cli(config)
            emit_result(result)
    else:
        result = synthesize_via_cli(config)
        emit_result(result)

except Exception as e:
    import traceback

    log(traceback.format_exc())
    emit_result({"ok": False, "error": str(e)})
    sys.exit(1)
